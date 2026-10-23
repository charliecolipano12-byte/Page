# Ate My's Kakanin: Google Sheets and Apps Script

The site uses its existing static HTML/CSS/JavaScript frontend and Google Apps Script backend. When the backend is configured, order requests are saved to the private Google Sheet and the owner is notified by email.

## Initial setup

1. Create a Google Sheet and open **Extensions > Apps Script**.
2. Replace the script contents with `Code.gs`, and add the provided `appsscript.json`.
3. Run `setupSheet()` and authorize access to the spreadsheet and email service.
4. Deploy as a web app, executing as the owner, accessible to anyone.
5. Set the deployment's `/exec` URL in `config.js` as `appsScriptUrl`.
6. Deploy a new version after code changes. If using an existing spreadsheet, run `setupSheet()` again so the `Packages` tab and new `Orders` account-email column are added.
7. In **Project Settings > Script Properties**, add `ADMIN_API_SECRET` with a long random value. Put the same value in the Node app's `APPS_SCRIPT_ADMIN_SECRET` environment setting, and set `APPS_SCRIPT_URL` to the deployed `/exec` URL. Keep this secret private. The Node admin API checks the signed-in `ADMIN_EMAIL`; Apps Script also requires the shared secret before listing orders or changing statuses.

The `Orders` and `OrderItems` tabs record submitted orders. The `accountEmail` column links an order to a signed-in customer account; older orders remain unlinked. Keep the spreadsheet private and review orders each day. Owner email notifications are enabled in a newly created Settings tab and use `rayvillarante119@gmail.com`; the script substitutes this address for the original `owner@example.com` placeholder.

The owner dashboard is served at `/admin/` only to the provisioned owner account whose email matches `ADMIN_EMAIL`. The separate owner login is at `/admin/login/`. Order listings and status changes are proxied by Node to the Apps Script web app using the shared secret. Configure both the Apps Script Script Property and the Node environment variable before using dashboard data.

## Product packages

`setupSheet()` creates a `Packages` tab seeded with the current package options and prices:

- Aluminum Tray, 30 pcs: ₱280
- Medium Bilao, 50 pcs: ₱380
- Large Bilao, 100 pcs: ₱580

The owner can update package names, piece counts, and prices from the dashboard's Products page. The `Packages` tab is the source of truth for Apps Script public configuration and order price validation; customer pages refresh package details from that configuration. Existing legacy product rows are not used to determine website prices. Run `setupSheet()` on an existing spreadsheet before editing packages from the dashboard.

## Demo mode

If `appsScriptUrl` remains `YOUR_APPS_SCRIPT_WEB_APP_URL`, orders are stored only in the current browser and are not sent to the owner. The checkout page displays a demo-mode notice.

## Notifications and open items

- The confirmation page displays the order request immediately. An email confirmation is sent to the customer only when a valid email address is supplied and the `notifyCustomer` setting is enabled.
- TODO: Connect an authorized Messenger integration or provide an official Messenger page link to support automatic owner notifications and customer payment-proof confirmations.
- TODO: Configure and verify a data-retention cleanup process for order records older than one year, with a way to retain records longer when required for legal or accounting purposes.
- TODO: Confirm whether the published package prices apply to every kakanin.
- TODO: Confirm whether delivery around Calinan is offered. The current site says pickup only.
