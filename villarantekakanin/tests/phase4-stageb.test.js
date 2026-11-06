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
const { Cart } = require(path.join(projectDirectory, "client", "cart.js"));

async function findAvailablePort() {
    const server = net.createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    return port;
}

async function waitForServer(process, url, getOutput) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (process.exitCode !== null) {
            throw new Error(`Server exited before becoming ready: ${getOutput()}`);
        }
        try {
            const response = await fetch(url);
            if (response.ok) return;
        } catch {}
        await delay(50);
    }
    throw new Error(`Server did not become ready: ${getOutput()}`);
}

test("GET /api/products returns only available products in displayOrder with safe public fields", async context => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "amk-stageb-"));
    const appPort = await findAvailablePort();
    const appsScriptPort = await findAvailablePort();
    const baseUrl = `http://127.0.0.1:${appPort}`;

    const appsScriptServer = http.createServer((request, response) => {
        const url = new URL(request.url, "http://127.0.0.1");
        if (request.method === "GET" && url.searchParams.get("action") === "config") {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify({
                success: true,
                // Mirrors Apps Script getPublicConfig (available-only, no available field).
                products: [
                    { id: "b", name: "B", description: "b", allergens: "a", image: "images/b.jpg", seasonal: false, displayOrder: 20, secret: "x" },
                    { id: "a", name: "A", description: "a", allergens: "a", seasonal: true, displayOrder: 10 }
                ],
                packages: [{ id: "aluminum-tray", name: "Aluminum Tray", pieces: 30, price: 280 }],
                order: { pickupOnly: true },
                business: {}
            }));
            return;
        }
        response.writeHead(404, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ success: false }));
    });
    appsScriptServer.listen(appsScriptPort, "127.0.0.1");
    await once(appsScriptServer, "listening");

    const serverProcess = spawn(process.execPath, ["server.js"], {
        cwd: projectDirectory,
        env: {
            ...process.env,
            SESSION_SECRET: crypto.randomBytes(48).toString("hex"),
            NODE_ENV: "development",
            PORT: String(appPort),
            HOST: "127.0.0.1",
            AUTH_DB_PATH: path.join(temporaryDirectory, "auth.sqlite"),
            APPS_SCRIPT_URL: `http://127.0.0.1:${appsScriptPort}/exec`
        },
        stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    serverProcess.stdout.setEncoding("utf8").on("data", chunk => output += chunk);
    serverProcess.stderr.setEncoding("utf8").on("data", chunk => output += chunk);
    context.after(async () => {
        if (serverProcess.exitCode === null) {
            serverProcess.kill();
            await Promise.race([once(serverProcess, "exit"), delay(3000)]);
        }
        await new Promise(resolve => appsScriptServer.close(resolve));
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    });

    await waitForServer(serverProcess, `${baseUrl}/api/auth/session`, () => output);
    const response = await fetch(`${baseUrl}/api/products`, { headers: { Accept: "application/json" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await response.json();
    assert.equal(result.success, true);
    assert.deepEqual(result.products.map(product => product.id), ["a", "b"]);
    assert.ok(!result.products.some(product => product.id === "hidden"));
    for (const product of result.products) {
        assert.deepEqual(
            Object.keys(product).sort(),
            ["allergens", "description", "displayOrder", "id", "image", "name", "seasonal"]
        );
        assert.equal("available" in product, false);
        assert.equal("secret" in product, false);
    }
});

test("GET /api/products fails safely when Apps Script is unavailable", async context => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "amk-stageb-fail-"));
    const appPort = await findAvailablePort();
    const baseUrl = `http://127.0.0.1:${appPort}`;

    const serverProcess = spawn(process.execPath, ["server.js"], {
        cwd: projectDirectory,
        env: {
            ...process.env,
            SESSION_SECRET: crypto.randomBytes(48).toString("hex"),
            NODE_ENV: "development",
            PORT: String(appPort),
            HOST: "127.0.0.1",
            AUTH_DB_PATH: path.join(temporaryDirectory, "auth.sqlite"),
            APPS_SCRIPT_URL: "YOUR_APPS_SCRIPT_WEB_APP_URL"
        },
        stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    serverProcess.stdout.setEncoding("utf8").on("data", chunk => output += chunk);
    serverProcess.stderr.setEncoding("utf8").on("data", chunk => output += chunk);
    context.after(async () => {
        if (serverProcess.exitCode === null) {
            serverProcess.kill();
            await Promise.race([once(serverProcess, "exit"), delay(3000)]);
        }
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    });

    await waitForServer(serverProcess, `${baseUrl}/api/auth/session`, () => output);
    const response = await fetch(`${baseUrl}/api/products`, { headers: { Accept: "application/json" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await response.json();
    assert.equal(result.success, false);
});

test("OrderService merge keeps server availability and never resurrects unavailable fallback items", () => {
    const orderServicePath = path.join(projectDirectory, "client", "js", "orderService.js");
    global.window = {
        CONFIG: { backend: { appsScriptUrl: "YOUR_APPS_SCRIPT_WEB_APP_URL" }, order: {}, business: {} },
        PRODUCTS: [
            { id: "a", name: "A", description: "fallback A", allergens: "a" },
            { id: "gone", name: "Gone", description: "fallback gone", allergens: "g" }
        ],
        PACKAGES: [{ id: "aluminum-tray", name: "Aluminum Tray", pieces: 30, price: 280 }],
        sessionStorage: { setItem() {}, getItem() { return null; } }
    };
    delete require.cache[require.resolve(orderServicePath)];
    require(orderServicePath);
    const merged = window.OrderService.mergePublicConfig({
        products: [{ id: "a", name: "A live", description: "", allergens: "", seasonal: false }],
        packages: [],
        order: {},
        business: {}
    });
    assert.deepEqual(merged.map(product => product.id), ["a"]);
    assert.ok(!merged.some(product => product.id === "gone"));
    assert.equal(merged[0].name, "A live");
    delete global.window;
});

test("cart rejects unavailable variety when catalog is loaded", () => {
    global.window = {
        PACKAGES: [{ id: "aluminum-tray", name: "Aluminum Tray", pieces: 30, price: 280 }],
        PRODUCTS: [{ id: "puto-cheese" }]
    };
    const cart = new Cart();
    cart.items = [];
    assert.throws(() => cart.add("aluminum-tray", ["kutsinta"], 1), /not available/);
    delete global.window;
});
