# Changelog

## Phase 0 — Security hygiene
- Replaced real-looking values in `.env.example` (`SESSION_SECRET`, `ADMIN_EMAIL`, `APPS_SCRIPT_URL`, `APPS_SCRIPT_ADMIN_SECRET`) with clear placeholders; real values remain only in `.env` (gitignored).
- Added a "Security hygiene" note in `AUTH_SETUP.md`: keep real secrets in `.env` (never commit), generate new random secrets (>= 32 chars), and set `APPS_SCRIPT_ADMIN_SECRET` in `.env` to match `ADMIN_API_SECRET` in Apps Script Script Properties.

Files: `villarantekakanin/.env.example`, `villarantekakanin/AUTH_SETUP.md`, `villarantekakanin/CHANGELOG.md`

## Phase 1 — Landing page leftovers
- Testimonials/photos: added `client/testimonials.js` with a single `window.TESTIMONIALS = []` array (comment explains how to add owner-supplied entries: `quote`, `name`, `photo`). Section renders only when the array has entries and stays hidden otherwise; no testimonials invented. Added hidden placeholder section in `client/index.html`.
- "Freshness and Storage": collapsed into `<details class="freshness-details">`; open on desktop (>600px via `matchMedia("(min-width: 601px)")`), closed on screens <=600px. Styling added in `client/style.css`.

Files: `villarantekakanin/client/index.html`, `villarantekakanin/client/style.css`, `villarantekakanin/client/testimonials.js`, `villarantekakanin/CHANGELOG.md`

## Phase 2 — Login/sign-up UX (accessibility + guidance)
- Sign-up: removed duplicate password rule in placeholder; kept one hint and added a live checklist ("12+ characters", "passwords match") with per-keystroke validation and match check while typing.
- Errors now render next to the field and in a summary above the submit button (not only below). Inputs use `aria-invalid` and `aria-describedby`; summary uses `role="alert"`. Did not add another "Show password" control (`client/show-password.js` already does that).
- Login: added matching field/summary error structure and `aria-invalid`/`aria-describedby` for accessible error reporting.
- Desktop (>900px) sign-up: added a side panel with a kakanin photo (`client/images/kutsinta.jpg`) and the line "An account lets us link your orders to you." Panel is hidden on smaller viewports.

Files: `villarantekakanin/client/login/index.html`, `villarantekakanin/client/signup/index.html`, `villarantekakanin/client/auth.js`, `villarantekakanin/client/style.css`, `villarantekakanin/CHANGELOG.md`

## Phase 3 — Admin dashboard (admin/, server.js, Code.gs)
- Overview: added "Needs action" (pending orders, soonest pickup first) and "Upcoming pickups" (today + next 7 days, Asia/Manila). Metric cards are now clickable buttons that open Orders filtered by that status; "Today's pickups" filters to today's pickup date.
- Order details dialog: shows order total (uses payload `total`/`subtotal` when present; falls back to summing item `qty*price`; `Code.gs` admin order/public confirmation payloads now include `subtotal`/`total`). Owner can change status and save from inside the dialog (calls existing `PUT /api/admin/orders/:orderNumber/status`). Added `tel:` link and "Copy phone" button.
- Customers: clicking a customer row (or Enter/Space) loads their orders matched on account email. Added protected endpoint `GET /api/admin/customers/:email/orders` in `server.js` (uses existing `requireSignedIn` + `requireAdmin`).
- Legacy files: searched `server.js`, `admin/*`, `client/*` (non-image/dir), and `Code.gs` for `legacy`. Found references only in `admin/legacy.html` (loaded `/admin/legacy.js`) and `server.js:462` (`legacyHeaders:false` in express-rate-limit config, not a file reference). No other pages referenced legacy admin files. Deleted unused `admin/legacy.html` and `admin/legacy.js`. Left `server.js` rate-limit `legacyHeaders` unchanged.
- `Code.gs` maintenance: fixed `submitOrder`/`findOrderByNumber` boundary formatting bug (missing newline) encountered while adding totals; `sanitizePublicOrder` now includes `subtotal`.

Files: `villarantekakanin/admin/index.html`, `villarantekakanin/admin/admin.js`, `villarantekakanin/admin/admin.css`, `villarantekakanin/server.js`, `villarantekakanin/Code.gs`, `villarantekakanin/CHANGELOG.md`; deleted `villarantekakanin/admin/legacy.html`, `villarantekakanin/admin/legacy.js`

## Phase 4 — Stage A (admin product editing backend + admin UI; public site unchanged)
- `Code.gs`: idempotent Products sheet migration (`ensureSheet` headers + `migrateProductRows`) adds/ensures `id,name,description,allergens,image,available,seasonal,displayOrder`; preserves existing IDs/values; migrates `active`→`available` when needed; seeds missing catalog rows from existing known client copy only (no invented allergen/ingredient text; Bibingka placeholder kept). Added admin actions `listProducts`/`updateProduct` (authorized via existing `ADMIN_API_SECRET` check) and `getAdminProducts`/`getPublicConfig` read from sheet+seed with availability/display-order handling. `submitOrder` now validates varieties exist **and** are `available` (IDs immutable) and returns the complete order persistence/confirmation response (order number + confirmation token). Package behavior and package admin actions unchanged.
- `server.js`: added protected admin endpoints `GET /api/admin/products` and `PUT /api/admin/products` (existing `requireSignedIn` + `requireAdmin`; writes require same-origin), proxying to Apps Script. Server-side validation: fixed IDs, safe name/length, description/allergens limits, `image` path-only (`images/...`, no schemes/`..`/control chars), boolean available/seasonal, integer display order. Existing package endpoints unchanged.
- `admin/index.html`, `admin/admin.js`, `admin/admin.css`: Products view now includes a **Menu products** editor (name, description, allergen/ingredient note, photo path-only, available on/off, seasonal on/off, display order; IDs shown fixed/read-only) and keeps **Tray packages** editor/refresh working. Accessible labels, status messages, responsive layout (grid collapses on narrow widths). No public site (`client/` menu/orderService/cart) changes in Stage A.
- **You must redeploy `Code.gs`** as a new version of the existing Apps Script Web app deployment (same URL as `APPS_SCRIPT_URL`) before testing live admin product/order behavior against Apps Script.

Files: `villarantekakanin/Code.gs`, `villarantekakanin/server.js`, `villarantekakanin/admin/index.html`, `villarantekakanin/admin/admin.js`, `villarantekakanin/admin/admin.css`, `villarantekakanin/CHANGELOG.md`

## Phase 5 — CSS cleanup and visual validation
- Merged duplicate global CSS rules in `client/style.css` for navigation sign-up links, product grids/cards/content, empty-cart states, and form controls while preserving the declarations that won the cascade and carrying forward unique properties.
- Captured before-and-after browser screenshots for home, menu, checkout route, login, sign-up, and admin pages at 1366px and 390px. Visual layouts remained unchanged.
- Verified the 390px routes have no horizontal page scroll and no browser console errors.
- Ran `npm test` successfully (8 tests passed).

Files: `villarantekakanin/client/style.css`, `villarantekakanin/CHANGELOG.md`

## Phase 4 — Stage B (public reads product catalog; cart availability guard)
- Added public `GET /api/products` in `server.js` that proxies Apps Script `action=config` with a short timeout, returns only safe public product fields (`id,name,description,allergens,image,seasonal,displayOrder`) sorted by `displayOrder`, includes packages/order/business passthrough, and responds with `Cache-Control: no-store` (fails safely with `success:false` when unavailable).
- Updated `client/js/orderService.js` to load public config from `/api/products` (short timeout, `no-store`) and to merge config without resurrecting unavailable products from static fallback; fallback copy is kept only for IDs still returned by the server.
- Updated `client/menu-page.js` to render the server catalog when available, keep the existing "details may be out of date" warning when loading fails, prune unavailable cart items after a successful load, and continue falling back to `window.PRODUCTS` on error.
- Updated `client/cart.js` to reject unknown/unavailable varieties when a catalog is loaded (`"That variety is not available."`) while preserving cart payload shape `{packageId, varieties:[id], qty}` and the existing global API used by tests/checkout. Added `validateItems`/`removeUnavailable` helpers.
- Did not change `Code.gs` `submitOrder` validation (it remains the final server-side check). Added `tests/phase4-stageb.test.js` covering public route available-only+`displayOrder`+safe fields, safe failure when Apps Script is unavailable, merge fallback behavior, and cart rejection of an unavailable variety.

Files: `villarantekakanin/server.js`, `villarantekakanin/client/js/orderService.js`, `villarantekakanin/client/menu-page.js`, `villarantekakanin/client/cart.js`, `villarantekakanin/tests/phase4-stageb.test.js`, `villarantekakanin/CHANGELOG.md`

