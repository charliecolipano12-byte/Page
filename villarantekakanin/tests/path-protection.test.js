const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { test } = require("node:test");
const crypto = require("node:crypto");

const projectDirectory = path.resolve(__dirname, "..");

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
            if (response.status === 200) return;
        } catch {
            await delay(50);
        }
    }
    throw new Error(`Server did not become ready: ${getOutput()}`);
}

test("static file protection rejects encoded Windows path aliases", async context => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "amk-path-protection-"));
    const port = await findAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const serverProcess = spawn(process.execPath, ["server.js"], {
        cwd: projectDirectory,
        env: {
            ...process.env,
            SESSION_SECRET: crypto.randomBytes(48).toString("hex"),
            NODE_ENV: "development",
            PORT: String(port),
            HOST: "127.0.0.1",
            AUTH_DB_PATH: path.join(temporaryDirectory, "auth.sqlite"),
            ADMIN_EMAIL: "owner@example.test"
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

    await waitForServer(serverProcess, baseUrl, () => output);

    const paths = [
        "/server.js",
        "/Code.gs",
        "/cOdE.gS",
        "/AUTH_SETUP.md",
        "/APPS_SCRIPT_SETUP.md",
        "/.env.example",
        "/nested%5c..%5cserver.js",
        "/nested%5C..%5Cadmin.js",
        "/nested%255c..%255cserver.js",
        "/nested%255C..%255Cadmin.js",
        "/%252e%252e/server.js",
        "/nested//../Code.gs",
        "/server.js%2e",
        "/server.js%20",
        "/server.js%3a%3a%24DATA",
        "/server.js?download=1"
    ];

    for (const requestPath of paths) {
        const response = await fetch(`${baseUrl}${requestPath}`, { redirect: "manual" });
        assert.equal(
            response.status,
            404,
            `${requestPath} should not serve a protected file`
        );
    }

    const malformedEncoding = await fetch(`${baseUrl}/bad%ZZpath`, { redirect: "manual" });
    assert.equal(malformedEncoding.status, 400);

    const adminLogin = await fetch(`${baseUrl}/admin/login/`, { redirect: "manual" });
    assert.equal(adminLogin.status, 200);
    assert.match(await adminLogin.text(), /data-auth-form="login"/);
    const adminLoginStyles = await fetch(`${baseUrl}/admin/login.css`, { redirect: "manual" });
    assert.equal(adminLoginStyles.status, 200);
    const contentSecurityPolicy = adminLoginStyles.headers.get("content-security-policy") || "";
    assert.match(contentSecurityPolicy, /connect-src 'self' https:\/\/script\.google\.com/);

    for (const adminPath of [
        "/admin",
        "/admin/",
        "/admin/index.html",
        "/admin/admin.css",
        "/admin/admin.js",
        "/admin.html"
    ]) {
        const response = await fetch(`${baseUrl}${adminPath}`, { redirect: "manual" });
        assert.equal(response.status, 302, `${adminPath} should require admin sign-in`);
        assert.equal(response.headers.get("location"), "/admin/login/");
        assert.doesNotMatch(await response.text(), /Owner dashboard|Manage orders/);
    }

    for (const apiPath of [
        "/api/admin/orders",
        "/api/admin/customers",
        "/api/admin/packages"
    ]) {
        const response = await fetch(`${baseUrl}${apiPath}`, { redirect: "manual" });
        assert.equal(response.status, 401, `${apiPath} should require sign-in`);
    }

    const signup = await fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: {
            Origin: baseUrl,
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify({
            name: "Path Protection Customer",
            email: `customer-${crypto.randomUUID()}@example.test`,
            password: "PathProtection!123",
            confirmPassword: "PathProtection!123",
            accountPrivacy: true
        })
    });
    assert.equal(signup.status, 201);
    const sessionCookie = signup.headers.get("set-cookie")?.split(";")[0];
    assert.ok(sessionCookie, "signup should establish an authenticated session");

    for (const adminPath of ["/admin/", "/admin/index.html", "/admin/admin.js", "/admin.html"]) {
        const response = await fetch(`${baseUrl}${adminPath}`, {
            headers: { Cookie: sessionCookie },
            redirect: "manual"
        });
        assert.equal(response.status, 403, `${adminPath} should reject a signed-in customer`);
        assert.doesNotMatch(await response.text(), /Owner dashboard|Manage orders/);
    }

    for (const apiPath of [
        "/api/admin/orders",
        "/api/admin/customers",
        "/api/admin/packages"
    ]) {
        const response = await fetch(`${baseUrl}${apiPath}`, {
            headers: { Cookie: sessionCookie },
            redirect: "manual"
        });
        assert.equal(response.status, 403, `${apiPath} should reject a signed-in customer`);
    }

    const customerStatusUpdate = await fetch(`${baseUrl}/api/admin/orders/TEST-ORDER/status`, {
        method: "PUT",
        headers: {
            Cookie: sessionCookie,
            Origin: baseUrl,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "confirmed" }),
        redirect: "manual"
    });
    assert.equal(customerStatusUpdate.status, 403);
});
