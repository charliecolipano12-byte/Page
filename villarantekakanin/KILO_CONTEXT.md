# Project context for AI assistants: Ate My's Kakanin

Read this file fully before starting any task. Do only the phase you are asked to do, then stop and summarize.

## Project facts
- Stack: Node.js >= 22.13, Express 5, `node:sqlite` for customer accounts. Client is plain HTML/CSS/JS in `client/`. Owner dashboard is in `admin/`. Orders are stored in Google Sheets via Google Apps Script (`Code.gs`).
- Run: `npm install`, copy `.env.example` to `.env`, `npm start`, open http://localhost:3000. Owner account: `npm run admin:provision`. Tests: `npm test`.
- Business rules (do NOT change): bulk orders only; pickup only at P-2 Cawayan, Calinan, Davao City; payment on pickup (cash, GCash, Maribank); customers must have an account to order.
- Varieties: Puto Cheese, Pichi-Pichi, Kutsinta, Palitaw, Sapin-Sapin, Tikoy, Biko, Suman, Maja Blanca, Cassava Flan, plus seasonal Bibingka.
- Trays: Aluminum Tray 30 pcs P280, Medium Bilao 50 pcs P380, Large Bilao 100 pcs P580.
- Course requirement: the landing page must define the website and what it offers (instructor example header: Features | How it works | Login).

## Working rules
1. After each phase run `npm test` and check pages at 1366px and 390px widths: no horizontal page scroll at 390px, no console errors.
2. Keep changes minimal and match existing style. No frameworks or build tools.
3. Files use CRLF line endings. Some files (e.g. `client/confirmation.js`, `client/checkout.html`) contain stray non-UTF-8 bytes: edit them byte-safely and do not re-encode. Check `git diff` for unexpected changes.
4. Never invent content (testimonials, allergen info, ingredients, prices, QR codes). If missing, build the structure and use a clearly marked, customer-safe fallback.
5. Keep forms accessible: labels, keyboard use, visible focus, contrast, `aria-live` for messages.
6. Append what you changed to `CHANGELOG.md` (files per phase).

## Already done (verify only, do not redo)
- Bibingka allergen and GCash "TODO" text replaced with customer-safe wording; checkout total shows P0.00; sign-in failure message shown in checkout card; "Photo coming soon" placeholder for products without photos.
- Home header has anchor links; "How Ordering Works" and final "Ready to order?" sections exist.
- `client/show-password.js` adds a "Show password" checkbox to login, sign-up and owner login.
- Login/sign-up wording fixes; menu notice full width; aligned buttons; larger allergen text; 2-column phone menu.
- Admin: Account email column hidden in Orders table, plain-language errors, stale message cleared on view change, mobile order cards.

## Content still to be supplied by the owner (leave clear placeholders)
Photos for Pichi-Pichi, Sapin-Sapin, Tikoy, Maja Blanca, Cassava Flan; confirmed Bibingka ingredients/allergens; optional GCash QR code; real customer testimonials or photos.
