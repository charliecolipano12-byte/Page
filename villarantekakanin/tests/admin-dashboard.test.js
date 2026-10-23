const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const http = require("node:http");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { setTimeout: delay } = require("node:timers/promises");
const { test } = require("node:test");

const projectDirectory = path.resolve(__dirname, "..");

async function findAvailablePort() {
    const server = net.createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    return port;
}

function makePasswordHash(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 64, {
        N: 1 << 15,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024
    });
    return ["scrypt", "32768", "8", "1", salt.toString("hex"), hash.toString("hex")].join("$");
}

async function waitForServer(process, url, getOutput) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (process.exitCode !== null) {
            throw new Error(`Server exited before becoming ready: ${getOutput()}`);
        }
        try {
            if ((await fetch(url)).status === 200) return;
        } catch {
            await delay(50);
        }
    }
    throw new Error(`Server did not become ready: ${getOutput()}`);
}

test("admin dashboard APIs are protected and return safe customer summaries", async context => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "amk-admin-dashboard-"));
    const databasePath = path.join(temporaryDirectory, "auth.sqlite");
    const appPort = await findAvailablePort();
    const appsScriptPort = await findAvailablePort();
    const baseUrl = `http://127.0.0.1:${appPort}`;
    const ownerEmail = "owner@example.test";
    const ownerPassword = "OwnerPassword!234";
    const customerPassword = "CustomerPassword!234";
    const adminSecret = crypto.randomBytes(48).toString("hex");
    const packageData = [
        { id: "aluminum-tray", name: "Aluminum Tray", pieces: 30, price: 280 }
    ];
    const fixtureOrders = [
        { orderNumber: "AMK-100", accountEmail: "alice@example.test", createdAt: "2026-10-18 10:00:00" },
        { orderNumber: "AMK-101", accountEmail: "alice@example.test", createdAt: "2026-10-21 12:30:00" },
        { orderNumber: "AMK-102", accountEmail: "bob@example.test", createdAt: "2026-10-19 09:15:00" }
    ];
    const appsScriptServer = http.createServer(async (request, response) => {
        let rawBody = "";
        for await (const chunk of request) rawBody += chunk;
        const body = JSON.parse(rawBody || "{}");
        let result;
        if (body.action === "listOrders") {
            result = { success: true, orders: fixtureOrders };
        } else if (body.action === "updateOrderStatus") {
            result = { success: true, orderNumber: body.orderNumber, status: body.status };
        } else if (body.action === "listPackages") {
            result = { success: true, packages: packageData };
        } else if (body.action === "updatePackage") {
            Object.assign(packageData[0], body.package);
            result = { success: true, package: packageData[0] };
        } else {
            result = { success: false, message: "Unknown test action." };
        }
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(result));
    });
    appsScriptServer.listen(appsScriptPort, "127.0.0.1");
    await once(appsScriptServer, "listening");

    const { DatabaseSync } = require("node:sqlite");
    const database = new DatabaseSync(databasePath);
    database.exec(`
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL COLLATE NOCASE UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE sessions (
            session_id TEXT PRIMARY KEY,
            expires_at INTEGER NOT NULL,
            data TEXT NOT NULL
        );
        CREATE TABLE admin_accounts (
            user_id TEXT PRIMARY KEY,
            email TEXT NOT NULL COLLATE NOCASE UNIQUE
        );
    `);
    const insertUser = database.prepare(
        "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    const ownerId = crypto.randomUUID();
    const aliceId = crypto.randomUUID();
    const bobId = crypto.randomUUID();
    const noOrdersId = crypto.randomUUID();
    insertUser.run(ownerId, "Test Owner", ownerEmail, makePasswordHash(ownerPassword), "2025-01-01T00:00:00.000Z");
    insertUser.run(aliceId, "Alice Example", "alice@example.test", makePasswordHash(customerPassword), "2026-01-05T00:00:00.000Z");
    insertUser.run(bobId, "Bob Example", "bob@example.test", makePasswordHash(customerPassword), "2026-02-06T00:00:00.000Z");
    insertUser.run(noOrdersId, "Casey Example", "casey@example.test", makePasswordHash(customerPassword), "2026-03-07T00:00:00.000Z");
    database.prepare("INSERT INTO admin_accounts (user_id, email) VALUES (?, ?)").run(ownerId, ownerEmail);
    database.close();

    const serverProcess = spawn(process.execPath, ["server.js"], {
        cwd: projectDirectory,
        env: {
            ...process.env,
            SESSION_SECRET: crypto.randomBytes(48).toString("hex"),
            NODE_ENV: "development",
            PORT: String(appPort),
            HOST: "127.0.0.1",
            AUTH_DB_PATH: databasePath,
            ADMIN_EMAIL: ownerEmail,
            APPS_SCRIPT_URL: `http://127.0.0.1:${appsScriptPort}/exec`,
            APPS_SCRIPT_ADMIN_SECRET: adminSecret
        },
        stdio: ["ignore", "pipe", "pipe"]
    });
    let serverOutput = "";
    serverProcess.stdout.setEncoding("utf8").on("data", chunk => serverOutput += chunk);
    serverProcess.stderr.setEncoding("utf8").on("data", chunk => serverOutput += chunk);

    context.after(async () => {
        if (serverProcess.exitCode === null) {
            serverProcess.kill();
            await Promise.race([once(serverProcess, "exit"), delay(3000)]);
        }
        await new Promise(resolve => appsScriptServer.close(resolve));
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    });

    await waitForServer(serverProcess, baseUrl, () => serverOutput);

    const ownerLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
            Origin: baseUrl,
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify({ email: ownerEmail, password: ownerPassword })
    });
    assert.equal(ownerLogin.status, 200);
    const ownerCookie = ownerLogin.headers.get("set-cookie")?.split(";")[0];
    assert.ok(ownerCookie);

    const dashboard = await fetch(`${baseUrl}/admin/`, { headers: { Cookie: ownerCookie } });
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /Owner Dashboard/);
    assert.match(dashboard.headers.get("cache-control") || "", /no-store/);

    const statusUpdate = await fetch(`${baseUrl}/api/admin/orders/AMK-100/status`, {
        method: "PUT",
        headers: {
            Cookie: ownerCookie,
            Origin: baseUrl,
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify({ status: "confirmed" })
    });
    assert.equal(statusUpdate.status, 200);
    assert.equal((await statusUpdate.json()).status, "confirmed");

    const customersResponse = await fetch(`${baseUrl}/api/admin/customers`, {
        headers: { Cookie: ownerCookie, Accept: "application/json" }
    });
    assert.equal(customersResponse.status, 200);
    const customersResult = await customersResponse.json();
    assert.equal(customersResult.total, 3);
    const alice = customersResult.customers.find(customer => customer.email === "alice@example.test");
    assert.deepEqual(alice, {
        name: "Alice Example",
        email: "alice@example.test",
        joinedAt: "2026-01-05T00:00:00.000Z",
        orderCount: 2,
        lastOrderDate: "2026-10-21"
    });
    const casey = customersResult.customers.find(customer => customer.email === "casey@example.test");
    assert.equal(casey.orderCount, 0);
    assert.equal(casey.lastOrderDate, "");
    for (const customer of customersResult.customers) {
        assert.deepEqual(
            Object.keys(customer).sort(),
            ["email", "joinedAt", "lastOrderDate", "name", "orderCount"]
        );
    }

    const searchResponse = await fetch(`${baseUrl}/api/admin/customers?search=alice`, {
        headers: { Cookie: ownerCookie, Accept: "application/json" }
    });
    const searchResult = await searchResponse.json();
    assert.equal(searchResponse.status, 200);
    assert.equal(searchResult.total, 1);
    assert.equal(searchResult.customers[0].email, "alice@example.test");

    const packagesResponse = await fetch(`${baseUrl}/api/admin/packages`, {
        headers: { Cookie: ownerCookie, Accept: "application/json" }
    });
    assert.equal(packagesResponse.status, 200);
    assert.equal((await packagesResponse.json()).packages[0].price, 280);

    const updateResponse = await fetch(`${baseUrl}/api/admin/packages`, {
        method: "PUT",
        headers: {
            Cookie: ownerCookie,
            Origin: baseUrl,
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify({
            package: { id: "aluminum-tray", name: "Aluminum Tray", pieces: 30, price: 300 }
        })
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).package.price, 300);

    const customerLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
            Origin: baseUrl,
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify({ email: "alice@example.test", password: customerPassword })
    });
    assert.equal(customerLogin.status, 200);
    const customerCookie = customerLogin.headers.get("set-cookie")?.split(";")[0];
    assert.ok(customerCookie);
    const forbiddenResponse = await fetch(`${baseUrl}/api/admin/customers`, {
        headers: { Cookie: customerCookie },
        redirect: "manual"
    });
    assert.equal(forbiddenResponse.status, 403);

    const missingOriginUpdate = await fetch(`${baseUrl}/api/admin/packages`, {
        method: "PUT",
        headers: {
            Cookie: ownerCookie,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            package: { id: "aluminum-tray", name: "Aluminum Tray", pieces: 30, price: 300 }
        })
    });
    assert.equal(missingOriginUpdate.status, 403);
});
