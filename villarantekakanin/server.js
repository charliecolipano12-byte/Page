require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");
const express = require("express");
const session = require("express-session");
const { rateLimit } = require("express-rate-limit");

const app = express();
const publicDirectory = __dirname;
const clientDirectory = path.join(publicDirectory, "client");
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const scryptAsync = promisify(crypto.scrypt);
const sessionSecret = process.env.SESSION_SECRET;

if (
    !sessionSecret ||
    sessionSecret.length < 32 ||
    sessionSecret.includes("replace-with-a-random-value")
) {
    throw new Error("Set SESSION_SECRET to a random value of at least 32 characters.");
}

if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
}

const databasePath = path.resolve(
    __dirname,
    process.env.AUTH_DB_PATH || "../.ate-mys-kakanin-auth/auth.sqlite"
);
const databaseRelativePath = path.relative(__dirname, databasePath);
if (
    databaseRelativePath === "" ||
    (!databaseRelativePath.startsWith(`..${path.sep}`) &&
        databaseRelativePath !== ".." &&
        !path.isAbsolute(databaseRelativePath))
) {
    throw new Error("AUTH_DB_PATH must point outside the publicly served site directory.");
}
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec("PRAGMA journal_mode = WAL");
database.exec("PRAGMA busy_timeout = 5000");
database.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_accounts (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE
    );

    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
`);

function runInTransaction(work) {
    database.exec("BEGIN");
    try {
        const result = work();
        database.exec("COMMIT");
        return result;
    } catch (error) {
        database.exec("ROLLBACK");
        throw error;
    }
}

class SqliteSessionStore extends session.Store {
    constructor(db) {
        super();
        this.db = db;
        this.getSession = db.prepare("SELECT expires_at, data FROM sessions WHERE session_id = ?");
        this.saveSession = db.prepare(`
            INSERT INTO sessions (session_id, expires_at, data)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                expires_at = excluded.expires_at,
                data = excluded.data
        `);
        this.deleteSession = db.prepare("DELETE FROM sessions WHERE session_id = ?");
        this.updateExpiry = db.prepare("UPDATE sessions SET expires_at = ? WHERE session_id = ?");
    }

    get(sessionId, callback) {
        try {
            const row = this.getSession.get(sessionId);
            if (!row) return callback(null, null);
            if (row.expires_at <= Date.now()) {
                this.deleteSession.run(sessionId);
                return callback(null, null);
            }
            callback(null, JSON.parse(row.data));
        } catch (error) {
            callback(error);
        }
    }

    set(sessionId, value, callback = () => {}) {
        try {
            this.saveSession.run(sessionId, this.expiration(value), JSON.stringify(value));
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    destroy(sessionId, callback = () => {}) {
        try {
            this.deleteSession.run(sessionId);
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    touch(sessionId, value, callback = () => {}) {
        try {
            this.updateExpiry.run(this.expiration(value), sessionId);
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    deleteSessionsForUser(userId) {
        const sessions = this.db.prepare("SELECT session_id, data FROM sessions").all();
        for (const storedSession of sessions) {
            if (JSON.parse(storedSession.data).user?.id === userId) {
                this.deleteSession.run(storedSession.session_id);
            }
        }
    }

    expiration(value) {
        return value.cookie?.expires
            ? new Date(value.cookie.expires).getTime()
            : Date.now() + (value.cookie?.maxAge || sessionLifetimeMs);
    }
}

const sessionStore = new SqliteSessionStore(database);
const usersByEmail = database.prepare("SELECT id, name, email, password_hash FROM users WHERE email = ?");
const usersById = database.prepare("SELECT id, name, email, password_hash FROM users WHERE id = ?");
const usersForAdmin = database.prepare(`
    SELECT name, email, created_at
    FROM users
    WHERE id NOT IN (SELECT user_id FROM admin_accounts)
    ORDER BY created_at DESC
`);
const provisionedAdminById = database.prepare("SELECT user_id FROM admin_accounts WHERE user_id = ? AND email = ?");
const clearAdminAccounts = database.prepare("DELETE FROM admin_accounts");
const createAdminAccount = database.prepare("INSERT INTO admin_accounts (user_id, email) VALUES (?, ?)");
const createUser = database.prepare(`
    INSERT INTO users (id, name, email, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
`);
const updateUserCredentials = database.prepare("UPDATE users SET name = ?, password_hash = ? WHERE id = ?");
const deleteUser = database.prepare("DELETE FROM users WHERE id = ?");
const dummyPasswordHash = hashPassword(crypto.randomBytes(32).toString("hex"));

function isUniqueConstraintError(error) {
    return error?.errcode === 2067 || /UNIQUE constraint failed/i.test(error?.message || "");
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = await scryptAsync(password, salt, 64, {
        N: 1 << 15,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024
    });
    return `scrypt$32768$8$1$${salt.toString("hex")}$${Buffer.from(hash).toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
    const [algorithm, cost, blockSize, parallelism, saltHex, hashHex] = storedHash.split("$");
    if (
        algorithm !== "scrypt" ||
        cost !== "32768" ||
        blockSize !== "8" ||
        parallelism !== "1" ||
        !/^[\da-f]{32}$/.test(saltHex || "") ||
        !/^[\da-f]{128}$/.test(hashHex || "")
    ) {
        return false;
    }

    const expected = Buffer.from(hashHex, "hex");
    const derived = Buffer.from(await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length, {
        N: 1 << 15,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024
    }));
    return crypto.timingSafeEqual(expected, derived);
}

function promptLine(question) {
    const prompt = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        prompt.question(question, answer => {
            prompt.close();
            resolve(answer);
        });
    });
}

function promptPassword(question) {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
        return promptLine(question);
    }

    return new Promise((resolve, reject) => {
        const input = process.stdin;
        let password = "";
        process.stdout.write(question);
        input.setRawMode(true);
        input.setEncoding("utf8");
        input.resume();

        function finish(error) {
            input.removeListener("data", onData);
            input.setRawMode(false);
            input.pause();
            process.stdout.write("\n");
            if (error) reject(error);
            else resolve(password);
        }

        function onData(chunk) {
            for (const character of chunk) {
                if (character === "\u0003") {
                    finish(new Error("Admin provisioning was cancelled."));
                    return;
                }
                if (character === "\r" || character === "\n") {
                    finish();
                    return;
                }
                if (character === "\u0008" || character === "\u007f") {
                    if (password.length) {
                        password = password.slice(0, -1);
                        process.stdout.write("\b \b");
                    }
                    continue;
                }
                if (character >= " ") {
                    password += character;
                    process.stdout.write("*");
                }
            }
        }

        input.on("data", onData);
    });
}

async function provisionAdminAccount() {
    const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Set a valid ADMIN_EMAIL before provisioning the owner account.");
    }

    const name = (await promptLine("Owner display name: ")).trim();
    if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
        throw new Error("Enter a valid display name of 100 characters or fewer.");
    }

    const password = await promptPassword("Owner password (12-128 characters): ");
    const confirmation = await promptPassword("Confirm owner password: ");
    if (password.length < 12 || password.length > 128) {
        throw new Error("Password must be between 12 and 128 characters.");
    }
    if (password !== confirmation) {
        throw new Error("The passwords do not match.");
    }

    const existing = usersByEmail.get(email);
    const userId = existing ? existing.id : crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    runInTransaction(() => {
        if (existing) {
            updateUserCredentials.run(name, passwordHash, existing.id);
            sessionStore.deleteSessionsForUser(existing.id);
        } else {
            createUser.run(userId, name, email, passwordHash, new Date().toISOString());
        }
        clearAdminAccounts.run();
        createAdminAccount.run(userId, email);
    });
    console.log(existing ? `Owner account password reset for ${email}.` : `Owner account created for ${email}.`);
}

function regenerateSession(request) {
    return new Promise((resolve, reject) => {
        request.session.regenerate(error => error ? reject(error) : resolve());
    });
}

function saveSession(request) {
    return new Promise((resolve, reject) => {
        request.session.save(error => error ? reject(error) : resolve());
    });
}

function requireSameOrigin(request, response, next) {
    const origin = request.get("origin");
    if (!origin) {
        return response.status(403).json({ error: "Request origin could not be verified." });
    }

    try {
        const parsedOrigin = new URL(origin);
        if (
            !["http:", "https:"].includes(parsedOrigin.protocol) ||
            parsedOrigin.host.toLowerCase() !== request.get("host").toLowerCase()
        ) {
            return response.status(403).json({ error: "Request origin could not be verified." });
        }
    } catch {
        return response.status(403).json({ error: "Request origin could not be verified." });
    }

    next();
}

function requireSignedIn(request, response, next) {
    if (!request.session.user) {
        return response.status(401).json({ error: "Sign in to continue." });
    }
    next();
}

function requireAdmin(request, response, next) {
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const userEmail = String(request.session.user?.email || "").trim().toLowerCase();
    if (
        !adminEmail ||
        userEmail !== adminEmail ||
        !provisionedAdminById.get(request.session.user.id, adminEmail)
    ) {
        return response.status(403).json({ error: "Admin access is forbidden." });
    }
    next();
}

async function postAppsScriptAdmin(action, data = {}) {
    const endpoint = String(process.env.APPS_SCRIPT_URL || "").trim();
    const adminSecret = String(process.env.APPS_SCRIPT_ADMIN_SECRET || "");
    if (
        !endpoint ||
        endpoint === "YOUR_APPS_SCRIPT_WEB_APP_URL" ||
        adminSecret.length < 32
    ) {
        const error = new Error("Admin order management is not configured.");
        error.status = 503;
        throw error;
    }

    const endpointUrl = new URL(endpoint);
    if (endpointUrl.protocol !== "https:" && process.env.NODE_ENV !== "development") {
        const error = new Error("The Apps Script endpoint must use HTTPS.");
        error.status = 503;
        throw error;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        let response = await fetch(endpointUrl, {
            method: "POST",
            redirect: "manual",
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
                Accept: "application/json"
            },
            body: JSON.stringify({ action, ...data, adminSecret }),
            signal: controller.signal
        });

        if ([301, 302, 303].includes(response.status)) {
            const location = response.headers.get("location");
            if (!location) throw new Error("Apps Script returned an invalid redirect.");
            const redirectUrl = new URL(location, endpointUrl);
            if (redirectUrl.hostname !== "script.googleusercontent.com") {
                throw new Error("Apps Script returned an unexpected redirect.");
            }
            response = await fetch(redirectUrl, {
                method: "GET",
                redirect: "error",
                headers: { Accept: "application/json" },
                signal: controller.signal
            });
        }

        if (!response.ok) throw new Error(`Apps Script returned HTTP ${response.status}.`);
        const result = await response.json();
        if (!result || result.success !== true) {
            throw new Error("Apps Script rejected the admin request.");
        }
        return result;
    } finally {
        clearTimeout(timeout);
    }
}

app.disable("x-powered-by");
app.use((request, response, next) => {
    response.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://script.google.com https://script.googleusercontent.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    });
    next();
});
app.use(express.json({ limit: "10kb" }));
app.use("/api", (request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
});
app.use(session({
    name: "ate_my_session",
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: sessionLifetimeMs
    }
}));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (request, response) => {
        response.status(429).json({ error: "Too many attempts. Please try again in 15 minutes." });
    }
});

app.get("/api/auth/session", (request, response) => {
    response.set("Cache-Control", "no-store");
    response.json({ user: request.session.user || null });
});

app.post("/api/auth/signup", requireSameOrigin, authLimiter, async (request, response, next) => {
    const body = request.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

    if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
        return response.status(400).json({ error: "Enter a valid name (up to 100 characters)." });
    }
    if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        return response.status(400).json({ error: "Enter a valid email address." });
    }
    if (email === String(process.env.ADMIN_EMAIL || "").trim().toLowerCase()) {
        return response.status(403).json({ error: "This email is reserved for the owner account. Provision it on the server." });
    }
    if (password.length < 12 || password.length > 128) {
        return response.status(400).json({ error: "Password must be between 12 and 128 characters." });
    }
    if (password !== confirmPassword) {
        return response.status(400).json({ error: "The passwords do not match." });
    }
    if (body.accountPrivacy !== true) {
        return response.status(400).json({ error: "Please review and accept the account privacy notice." });
    }

    try {
        const passwordHash = await hashPassword(password);
        const user = {
            id: crypto.randomUUID(),
            name,
            email
        };
        createUser.run(user.id, user.name, user.email, passwordHash, new Date().toISOString());
        await regenerateSession(request);
        request.session.user = user;
        await saveSession(request);
        response.status(201).json({ user });
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return response.status(409).json({ error: "An account with that email already exists." });
        }
        next(error);
    }
});

app.post("/api/auth/login", requireSameOrigin, authLimiter, async (request, response, next) => {
    const body = request.body || {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || email.length > 254 || !password || password.length > 128) {
        return response.status(400).json({ error: "Enter your email address and password." });
    }

    try {
        const account = usersByEmail.get(email);
        if (!account) {
            await verifyPassword(password, await dummyPasswordHash);
            return response.status(401).json({ error: "Email or password is incorrect." });
        }
        if (!(await verifyPassword(password, account.password_hash))) {
            return response.status(401).json({ error: "Email or password is incorrect." });
        }

        const user = { id: account.id, name: account.name, email: account.email };
        await regenerateSession(request);
        request.session.user = user;
        await saveSession(request);
        response.json({ user });
    } catch (error) {
        next(error);
    }
});

app.post("/api/auth/logout", requireSameOrigin, (request, response, next) => {
    if (!request.session) return response.sendStatus(204);
    request.session.destroy(error => {
        if (error) return next(error);
        response.clearCookie("ate_my_session", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production"
        });
        response.sendStatus(204);
    });
});

function requireAdminPage(request, response, next) {
    if (!request.session.user) return response.redirect("/admin/login/");
    return requireAdmin(request, response, () => {
        response.set("Cache-Control", "no-store");
        next();
    });
}

app.get("/admin/login/", (request, response) => {
    response.sendFile(path.join(publicDirectory, "admin", "login.html"));
});
app.get("/admin/login.css", (request, response) => {
    response.sendFile(path.join(publicDirectory, "admin", "login.css"));
});
app.use("/admin", requireAdminPage);
app.get("/admin/", (request, response) => {
    response.sendFile(path.join(publicDirectory, "admin", "index.html"));
});
app.use("/admin", express.static(path.join(publicDirectory, "admin"), { index: false }));

app.get("/admin.html", (request, response, next) => {
    if (!request.session.user) return response.redirect("/admin/login/");
    next();
}, requireAdmin, (request, response) => {
    response.redirect("/admin/");
});

app.get("/api/admin/orders", requireSignedIn, requireAdmin, async (request, response) => {
    try {
        const result = await postAppsScriptAdmin("listOrders");
        response.set("Cache-Control", "no-store").json({ orders: result.orders || [] });
    } catch (error) {
        console.error("Unable to load admin orders:", error);
        response.status(error.status || 502).json({ error: "Could not load orders from the order service." });
    }
});

app.get("/api/admin/packages", requireSignedIn, requireAdmin, async (request, response) => {
    try {
        const result = await postAppsScriptAdmin("listPackages");
        response.set("Cache-Control", "no-store").json({ packages: result.packages || [] });
    } catch (error) {
        console.error("Unable to load admin packages:", error);
        response.status(error.status || 502).json({ error: "Could not load package details." });
    }
});

app.put("/api/admin/packages", requireSameOrigin, requireSignedIn, requireAdmin, async (request, response) => {
    const packageInfo = request.body?.package || {};
    const id = typeof packageInfo.id === "string" ? packageInfo.id.trim() : "";
    const name = typeof packageInfo.name === "string" ? packageInfo.name.trim() : "";
    const pieces = Number(packageInfo.pieces);
    const price = Number(packageInfo.price);
    if (
        !/^[a-z0-9-]{1,80}$/.test(id) ||
        !name ||
        name.length > 80 ||
        /[\u0000-\u001f\u007f]/.test(name) ||
        !Number.isSafeInteger(pieces) ||
        pieces < 1 ||
        pieces > 100000 ||
        !Number.isSafeInteger(price) ||
        price < 0 ||
        price > 10000000
    ) {
        return response.status(400).json({ error: "Enter a valid package name, piece count, and price." });
    }

    try {
        const result = await postAppsScriptAdmin("updatePackage", {
            package: { id, name, pieces, price }
        });
        response.set("Cache-Control", "no-store").json(result);
    } catch (error) {
        console.error("Unable to update admin package:", error);
        response.status(error.status || 502).json({ error: "Could not update package details." });
    }
});

app.get("/api/admin/customers", requireSignedIn, requireAdmin, async (request, response) => {
    const search = String(request.query.search || "").trim().slice(0, 100).toLowerCase();
    try {
        const result = await postAppsScriptAdmin("listOrders");
        const orderStats = new Map();
        (Array.isArray(result.orders) ? result.orders : []).forEach(order => {
            const email = String(order.accountEmail || "").trim().toLowerCase();
            if (!email) return;
            const stats = orderStats.get(email) || { orderCount: 0, lastOrderDate: "" };
            stats.orderCount += 1;
            const createdAt = String(order.createdAt || "").slice(0, 10);
            if (createdAt > stats.lastOrderDate) stats.lastOrderDate = createdAt;
            orderStats.set(email, stats);
        });

        const customers = usersForAdmin.all().map(user => {
            const stats = orderStats.get(String(user.email).toLowerCase()) || {
                orderCount: 0,
                lastOrderDate: ""
            };
            return {
                name: user.name,
                email: user.email,
                joinedAt: user.created_at,
                orderCount: stats.orderCount,
                lastOrderDate: stats.lastOrderDate
            };
        }).filter(customer => !search ||
            customer.name.toLowerCase().includes(search) ||
            customer.email.toLowerCase().includes(search)
        );

        response.set("Cache-Control", "no-store").json({
            customers,
            total: customers.length
        });
    } catch (error) {
        console.error("Unable to load admin customers:", error);
        response.status(error.status || 502).json({ error: "Could not load customer order history." });
    }
});

app.put("/api/admin/orders/:orderNumber/status", requireSameOrigin, requireSignedIn, requireAdmin, async (request, response) => {
    const orderNumber = String(request.params.orderNumber || "").trim();
    const status = String(request.body?.status || "").trim().toLowerCase();
    const validStatuses = ["pending", "confirmed", "ready", "completed", "cancelled"];
    if (!orderNumber || orderNumber.length > 80 || !validStatuses.includes(status)) {
        return response.status(400).json({ error: "A valid order number and status are required." });
    }

    try {
        const result = await postAppsScriptAdmin("updateOrderStatus", { orderNumber, status });
        response.set("Cache-Control", "no-store").json(result);
    } catch (error) {
        console.error("Unable to update order status:", error);
        response.status(error.status || 502).json({ error: "Could not update the order status." });
    }
});

app.delete("/api/auth/account", requireSameOrigin, authLimiter, requireSignedIn, async (request, response, next) => {
    const password = typeof request.body?.password === "string" ? request.body.password : "";
    if (!password || password.length > 128) {
        return response.status(400).json({ error: "Enter your password to delete your account." });
    }

    try {
        const account = usersById.get(request.session.user.id);
        if (!account || !(await verifyPassword(password, account.password_hash))) {
            return response.status(401).json({ error: "Password is incorrect." });
        }

        runInTransaction(() => {
            sessionStore.deleteSessionsForUser(account.id);
            const result = deleteUser.run(account.id);
            if (result.changes !== 1) throw new Error("Account could not be deleted.");
        });

        request.session.destroy(error => {
            if (error) return next(error);
            response.clearCookie("ate_my_session", {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production"
            });
            response.sendStatus(204);
        });
    } catch (error) {
        next(error);
    }
});

const protectedFiles = new Set([
    "/.env",
    "/.env.example",
    "/admin.html",
    "/admin.js",
    "/admin/index.html",
    "/admin/admin.css",
    "/admin/admin.js",
    "/admin/login.html",
    "/server.js",
    "/package.json",
    "/package-lock.json",
    "/AUTH_SETUP.md",
    "/APPS_SCRIPT_SETUP.md",
    "/Code.gs",
    "/appsscript.json"
].map(file => file.toLowerCase()));

function normalizeProtectedRequestPath(requestPath) {
    let decodedPath = requestPath;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const nextPath = decodeURIComponent(decodedPath).replace(/\\/g, "/");
        if (nextPath === decodedPath) break;
        decodedPath = nextPath;
    }
    if (/%[0-9a-f]{2}/i.test(decodedPath)) {
        throw new URIError("Request path contains excessive encoding.");
    }

    const pathSegments = decodedPath.split("/");
    if (pathSegments.some(segment =>
        segment.includes(":") || segment.endsWith(".") || segment.endsWith(" ")
    )) {
        return null;
    }

    return path.posix.normalize(decodedPath).toLowerCase();
}

app.use((request, response, next) => {
    let normalizedPath;
    try {
        normalizedPath = normalizeProtectedRequestPath(request.path);
    } catch {
        return response.sendStatus(400);
    }
    if (!normalizedPath) return response.sendStatus(404);
    const parts = normalizedPath.split("/");
    if (
        protectedFiles.has(normalizedPath) ||
        parts.includes("node_modules") ||
        parts.includes(".auth-data")
    ) {
        return response.sendStatus(404);
    }
    next();
});
app.use(express.static(clientDirectory, {
    dotfiles: "deny",
    index: "index.html"
}));
app.use("/api", (request, response) => {
    response.status(404).json({ error: "API route not found." });
});
app.use((error, request, response, next) => {
    console.error("Request failed:", error);
    if (response.headersSent) return next(error);
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
        ? error.status
        : 500;
    response.status(status).json({
        error: status === 500 ? "An unexpected server error occurred." : "Invalid request."
    });
});

const cleanupTimer = setInterval(() => {
    try {
        database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
    } catch (error) {
        console.error("Expired-session cleanup failed:", error);
    }
}, 15 * 60 * 1000);
cleanupTimer.unref();

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
if (process.argv.includes("--provision-admin")) {
    provisionAdminAccount()
        .catch(error => {
            console.error("Admin provisioning failed:", error.message);
            process.exitCode = 1;
        })
        .finally(() => database.close());
} else {
    app.listen(port, host, () => {
        console.log(`Ate My's Kakanin is listening on http://${host}:${port}`);
    });
}
