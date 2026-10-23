document.addEventListener("DOMContentLoaded", async function() {
    const grids = [
        document.getElementById("menu-grid"),
        document.getElementById("featured-grid")
    ].filter(Boolean);
    if (!grids.length) return;
    const cart = window.cart;
    const pendingCartKey = "vk_pending_cart_item";

    function escapeHtml(value) {
        const element = document.createElement("div");
        element.textContent = value == null ? "" : String(value);
        return element.innerHTML;
    }

    function renderPackagePrices() {
        document.querySelectorAll("[data-package-prices]").forEach(container => {
            const card = document.createElement("div");
            card.className = "pricing-card";
            const heading = document.createElement("h3");
            heading.textContent = "Package Prices";
            const list = document.createElement("ul");
            packages().forEach(packageInfo => {
                const item = document.createElement("li");
                item.textContent = `${packageInfo.name}, ${packageInfo.pieces} pcs: ₱${packageInfo.price}`;
                list.appendChild(item);
            });
            const note = document.createElement("p");
            note.textContent = "No minimum order. Bulk orders are welcome for birthdays, fiestas, Christmas, and family gatherings. Discounts depend on quantity; message us for bulk pricing and special requests.";
            card.append(heading, list, note);
            container.replaceChildren(card);
        });
    }

    function packages() {
        return window.PACKAGES || [];
    }

    function getReturnPath() {
        return `${location.pathname}${location.search}${location.hash}`;
    }

    function getAuthUrl(path) {
        const url = new URL(path, location.href);
        url.searchParams.set("returnTo", getReturnPath());
        return url.pathname + url.search + url.hash;
    }

    function getOrderGateDialog() {
        let dialog = document.querySelector("[data-order-auth-dialog]");
        if (dialog) return dialog;
        dialog = document.createElement("dialog");
        dialog.className = "account-delete-dialog order-auth-dialog";
        dialog.setAttribute("data-order-auth-dialog", "");
        dialog.setAttribute("aria-labelledby", "order-auth-title");
        dialog.innerHTML = `
            <div class="order-auth-content">
                <h2 id="order-auth-title">Create an account to place an order</h2>
                <p data-order-auth-message>Sign in or create an account to continue. Your selected item will be added after you return.</p>
                <div class="account-delete-actions">
                    <a class="btn btn-secondary" data-order-auth-login>Login</a>
                    <a class="btn btn-primary" data-order-auth-signup>Sign up</a>
                    <button class="btn btn-outline" type="button" data-order-auth-close>Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        dialog.querySelector("[data-order-auth-close]").addEventListener("click", () => dialog.close());
        return dialog;
    }

    async function getSignedInUser() {
        const response = await fetch("/api/auth/session", {
            credentials: "same-origin",
            headers: { Accept: "application/json" },
            cache: "no-store"
        });
        if (!response.ok) throw new Error("Could not check sign-in status.");
        const result = await response.json();
        return result.user || null;
    }

    async function handleAddToOrder(productId, packageId, button) {
        if (!cart) throw new Error("The cart is unavailable.");
        const user = await getSignedInUser();
        if (user) {
            cart.add(productId, packageId);
            const original = button.textContent;
            button.textContent = "Added!";
            window.setTimeout(() => { button.textContent = original; }, 1000);
            return;
        }

        sessionStorage.setItem(pendingCartKey, JSON.stringify({
            productId,
            packageId,
            returnPath: getReturnPath(),
            createdAt: Date.now()
        }));
        const dialog = getOrderGateDialog();
        dialog.querySelector("[data-order-auth-login]").href = getAuthUrl("/login/");
        dialog.querySelector("[data-order-auth-signup]").href = getAuthUrl("/signup/");
        dialog.showModal();
    }

    async function resumePendingCartItem() {
        let pending;
        try {
            pending = JSON.parse(sessionStorage.getItem(pendingCartKey) || "null");
        } catch (error) {
            console.error("Unable to read the pending cart item:", error);
            sessionStorage.removeItem(pendingCartKey);
            return;
        }
        if (!pending) return;
        if (
            typeof pending.productId !== "string" ||
            typeof pending.packageId !== "string" ||
            pending.returnPath !== getReturnPath() ||
            !Number.isFinite(pending.createdAt) ||
            Date.now() - pending.createdAt > 15 * 60 * 1000
        ) {
            sessionStorage.removeItem(pendingCartKey);
            return;
        }
        let user;
        try {
            user = await getSignedInUser();
        } catch (error) {
            console.error("Unable to verify the account for the pending cart item:", error);
            return;
        }
        if (!user) return;
        if (!(window.PRODUCTS || []).some(product => product.id === pending.productId) ||
            !packages().some(packageInfo => packageInfo.id === pending.packageId)) {
            console.error("The pending cart item or package is no longer available.");
            sessionStorage.removeItem(pendingCartKey);
            return;
        }
        try {
            cart.add(pending.productId, pending.packageId);
            sessionStorage.removeItem(pendingCartKey);
        } catch (error) {
            console.error("Unable to restore the pending cart item:", error);
        }
    }

    function renderProducts(products, noticeText = "") {
        grids.forEach(grid => {
            grid.replaceChildren();
            if (noticeText) {
                const notice = document.createElement("p");
                notice.className = "warning-banner";
                notice.textContent = noticeText;
                grid.appendChild(notice);
            }
            products.forEach(product => {
                const card = document.createElement("article");
                card.className = "product-card";
                const packageOptions = (window.PACKAGES || []).map(item =>
                    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${item.pieces} pcs · ₱${item.price}</option>`
                ).join("");
                const image = product.image
                    ? `<div class="product-image"><picture><source srcset="${escapeHtml(product.image.replace(/\.jpg$/i, ".webp"))}" type="image/webp"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy"></picture></div>`
                    : "";
                card.innerHTML = `
                    ${image}
                    <div class="product-content">
                        <h3 class="product-name">${escapeHtml(product.name)}</h3>
                        ${product.seasonal ? '<p class="seasonal-label">Seasonal</p>' : ""}
                        <p class="product-description">${escapeHtml(product.description)}</p>
                        <p class="small-text"><strong>Ingredients / allergen information:</strong> ${escapeHtml(product.allergens)}</p>
                        <label class="package-label" for="package-${escapeHtml(product.id)}">Package</label>
                        <select class="package-select" id="package-${escapeHtml(product.id)}" aria-label="${escapeHtml(product.name)} package">${packageOptions}</select>
                        <div class="product-footer">
                            <button class="btn btn-sm btn-primary add-to-cart" type="button" data-id="${escapeHtml(product.id)}">Add to Order</button>
                        </div>
                    </div>
                `;
                card.querySelector(".add-to-cart").addEventListener("click", async event => {
                    const button = event.currentTarget;
                    const packageId = card.querySelector(".package-select").value;
                    button.disabled = true;
                    try {
                        await handleAddToOrder(product.id, packageId, button);
                    } catch (error) {
                        console.error("Unable to add the selected item to the cart:", error);
                        const dialog = getOrderGateDialog();
                        dialog.querySelector("[data-order-auth-message]").textContent =
                            "We could not verify your sign-in status. Log in or create an account to continue.";
                        dialog.querySelector("[data-order-auth-login]").href = getAuthUrl("/login/");
                        dialog.querySelector("[data-order-auth-signup]").href = getAuthUrl("/signup/");
                        dialog.showModal();
                    } finally {
                        button.disabled = false;
                    }
                });
                grid.appendChild(card);
            });
        });
    }

    try {
        const config = window.OrderService ? await window.OrderService.getPublicConfig() : null;
        renderPackagePrices();
        renderProducts(Array.isArray(config && config.products) ? config.products : (window.PRODUCTS || []));
        await resumePendingCartItem();
    } catch (error) {
        console.error("Unable to load public product configuration:", error);
        renderPackagePrices();
        renderProducts(window.PRODUCTS || [], "Server configuration could not be loaded. Showing the current package details; contact us if your order cannot be submitted.");
        await resumePendingCartItem();
    }
});
