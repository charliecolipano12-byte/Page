# Node.js authentication setup

The storefront and customer account pages are served by the Express app in `server.js`. Customer accounts are stored in SQLite; passwords are stored as scrypt hashes, and login sessions are kept in the SQLite database. Customers must confirm the account privacy notice when signing up. They can permanently delete their account from the home page after signing in; deletion requires their password and invalidates all of their sessions. Separate order records are not deleted.

## Run locally

1. Install Node.js 22.13 or newer.
2. From this directory, install the dependencies with `npm install`.
3. Copy `.env.example` to `.env`.
4. Replace `SESSION_SECRET` with a private random value of at least 32 characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and put the result in `.env`.
5. Start the site using `npm start`, then open `http://localhost:3000`.

The database defaults to `../.ate-mys-kakanin-auth/auth.sqlite`, outside the public site directory. Set `AUTH_DB_PATH` to another persistent path outside the public site directory when deploying.

## Deployment notes

- Deploy this as a Node.js application; static-only hosting cannot run the authentication API.
- Use HTTPS in production so the session cookie is Secure. Keep `SESSION_SECRET` private and stable across restarts. Set `TRUST_PROXY=1` only when the app is behind one trusted reverse proxy.
- The SQLite database must live on persistent storage and should be included in a protected backup/retention process. Do not put it in a publicly served directory or commit it.
- Sign-up creates customer accounts only. It does not grant admin access, and accounts are not required to place an order.
- Set `ADMIN_EMAIL` to the owner's sign-in email, then run `npm run admin:provision` on the server to create or reset that account. Only accounts in the server-provisioned admin list and matching `ADMIN_EMAIL` can open `/admin/`; the separate owner login is `/admin/login/`. Public sign-up cannot claim the configured admin email. Provisioning requires local server access and invalidates the account's previous sessions if resetting it.
- Accounts remain until the customer deletes them. Email verification and password-reset-by-email are not configured.
- The existing Apps Script order backend remains independent; customer accounts are not connected to order records.
