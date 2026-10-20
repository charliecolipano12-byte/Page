# Firebase setup and deployment

## Console checklist

1. Create a Firebase project at https://console.firebase.google.com/.
2. In **Build → Firestore Database**, create the database in production mode.
3. In **Build → Authentication → Sign-in method**, enable **Email/Password**.
4. In **Authentication → Users**, add the owner's admin email and a strong password. Copy that user's **UID**.
5. In **Project settings → General → Your apps**, register a Web app and paste its web configuration into `config.js` under `CONFIG.firebase`. Replace `YOUR_API_KEY` and all other `YOUR_...` values with the console values.
6. Replace `SET_ADMIN_UID_AFTER_CREATING_FIREBASE_USER` in `config.js` with the admin user's UID. Also replace `REPLACE_WITH_ADMIN_UID` in `firestore.rules` with the same UID.
7. Create `functions/.env` containing `ADMIN_UID=<admin-user-uid>`. Do not commit this file.
8. Install the Firebase CLI and authenticate once: `npm install -g firebase-tools`, then `firebase login`.
9. Enable the Firebase **Blaze (pay-as-you-go) plan** if required by the Functions deployment, and review the Cloud Functions and Firestore pricing/quota limits.
10. From the `villarantekakanin` directory, select the project: `firebase use --add`.
11. Install function dependencies from `villarantekakanin/functions`: `npm install`.
12. Keep `functions/.env` and all service-account credentials out of source control.
13. From `villarantekakanin`, deploy both the rules and callable backend: `firebase deploy --only firestore:rules,functions`.

The site uses the callable `submitOrder` function as its only public order-write path. Firestore client rules deny direct order creation so visitors cannot bypass server validation; anyone can still submit through the callable. Orders can only be read or changed by the UID configured as the admin. Product settings are readable by visitors and writable only by that admin.

The lead time, pickup-only switch, delivery fee, opening hours, and closed weekdays are intentionally duplicated in `functions/index.js` as trusted server policy. The trusted prices and default daily capacities are also mirrored there from `products.js`. Whenever order policy, prices, or default capacities change in the browser config/catalog, update the corresponding server constants before redeploying so client and server remain aligned.

## Hosting

- **GitHub Pages:** publish the `villarantekakanin` folder as the Pages site root. Deploy Firestore rules/functions separately with the Firebase CLI steps above.
- **Netlify:** set the publish directory to `villarantekakanin`. Deploy Firestore rules/functions separately with the Firebase CLI steps above.

Firebase API keys used by browser apps identify the project; Firestore rules and Authentication protect data. Never put a service-account key in this folder or in browser code.

## Demo mode

Until `CONFIG.firebase.apiKey` is changed from the exact `YOUR_API_KEY` placeholder, checkout stores demo orders only in that browser's local storage and displays a warning. A non-placeholder configuration never silently falls back to local storage: Firebase errors are shown instead.
