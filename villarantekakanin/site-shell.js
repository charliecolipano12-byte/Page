(() => {
    const currentPage = location.pathname.split("/").pop() || "index.html";
    const pages = [
        ["index.html", "Home"],
        ["menu.html", "Menu"],
        ["about.html", "Our Story"],
        ["contact.html", "Contact"],
        ["checkout.html", "Cart"]
    ];
    const headerSlot = document.querySelector("[data-site-header]");
    const footerSlot = document.querySelector("[data-site-footer]");

    if (!headerSlot || !footerSlot) {
        console.error("The shared customer header or footer placeholder is missing.");
        return;
    }

    const header = document.createElement("header");
    header.className = "site-header";
    header.setAttribute("role", "banner");
    header.innerHTML = `
        <nav class="navbar" aria-label="Main navigation">
            <a href="index.html" class="brand" aria-label="Ate My's Kakanin Home">
                <span class="brand-text">Ate My's Kakanin</span>
            </a>
            <button class="hamburger" type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="Open navigation menu">
                <span class="hamburger-line" aria-hidden="true"></span>
                <span class="hamburger-line" aria-hidden="true"></span>
                <span class="hamburger-line" aria-hidden="true"></span>
            </button>
            <ul id="nav-menu" class="nav-menu" aria-label="Site navigation">
                ${pages.map(([href, label]) => `
                    <li>
                        <a href="${href}" class="nav-link${currentPage === href ? " active" : ""}"${currentPage === href ? ' aria-current="page"' : ""}${href === "checkout.html" ? ' aria-label="Shopping cart"' : ""}>
                            ${href === "checkout.html" ? 'Cart <span class="cart-badge" id="cart-count" hidden>0</span>' : label}
                        </a>
                    </li>
                `).join("")}
                <li class="account-area" data-auth-guest>
                    <a href="login/" class="nav-link nav-login">Login</a>
                    <a href="signup/" class="btn btn-primary nav-signup">Sign up</a>
                </li>
                <li class="account-area account-area-user" data-auth-user hidden>
                    <button class="account-trigger" type="button" data-account-menu-toggle aria-expanded="false" aria-controls="account-menu">
                        <span data-auth-name></span>
                        <span class="account-chevron" aria-hidden="true"></span>
                    </button>
                    <div class="account-menu" id="account-menu" hidden>
                        <button type="button" data-auth-logout>Log out</button>
                        <button type="button" data-auth-delete>Delete account</button>
                    </div>
                </li>
                <li class="auth-status" data-auth-status role="status" aria-live="polite" hidden></li>
            </ul>
        </nav>
    `;

    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.setAttribute("role", "contentinfo");
    footer.innerHTML = `
        <div class="container">
            <div class="footer-grid">
                <div class="footer-brand">
                    <a href="index.html" class="brand brand-footer" aria-label="Ate My's Kakanin Home">
                        <span class="brand-text" data-business-name>Ate My's Kakanin</span>
                    </a>
                    <p class="footer-tagline" data-business-tagline></p>
                </div>
                <div class="footer-column">
                    <h2 class="footer-heading">Pickup</h2>
                    <address class="footer-address">
                        <p data-business-address></p>
                        <p data-business-hours></p>
                        <p>Pickup only</p>
                    </address>
                </div>
                <div class="footer-column">
                    <h2 class="footer-heading">Contact</h2>
                    <ul class="footer-contact">
                        <li><a data-business-phone></a></li>
                        <li><a data-business-email></a></li>
                        <li>Facebook / Messenger: Mylen Villarante</li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p class="copyright">&copy; <span data-current-year></span> <span data-business-name></span>.</p>
                <nav class="footer-nav" aria-label="Footer navigation">
                    <a href="about.html">Our Story</a>
                    <a href="menu.html">Menu</a>
                    <a href="contact.html">Contact</a>
                    <a href="checkout.html">Order</a>
                </nav>
            </div>
        </div>
    `;

    const accountDialog = document.createElement("dialog");
    accountDialog.className = "account-delete-dialog";
    accountDialog.setAttribute("data-account-delete-dialog", "");
    accountDialog.setAttribute("aria-labelledby", "account-delete-title");
    accountDialog.innerHTML = `
        <form data-account-delete-form>
            <h2 id="account-delete-title">Delete your account?</h2>
            <p>This permanently deletes your account and signs you out on all devices. Separate order records are not deleted.</p>
            <div class="form-group">
                <label for="delete-account-password">Confirm your password</label>
                <div class="input-wrapper">
                    <input id="delete-account-password" name="password" type="password" autocomplete="current-password" maxlength="128" required>
                </div>
            </div>
            <p id="account-delete-message" class="form-links" role="alert" aria-live="polite"></p>
            <div class="account-delete-actions">
                <button class="btn btn-secondary" type="button" data-account-delete-cancel>Cancel</button>
                <button class="btn btn-primary" type="submit">Permanently delete account</button>
            </div>
        </form>
    `;

    headerSlot.replaceWith(header);
    footerSlot.replaceWith(footer);
    document.body.appendChild(accountDialog);
})();
