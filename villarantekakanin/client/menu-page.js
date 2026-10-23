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
            heading.textContent = "Tray Sizes & Prices";
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

    function renderTrayGallery() {
        const section = document.getElementById("tray-gallery-section");
        const gallery = document.getElementById("tray-gallery");
        const button = document.getElementById("tray-gallery-more");
        const photos = window.TRAY_PHOTOS;
        if (!section || !gallery || !button || !Array.isArray(photos) || photos.length === 0) {
            if (section) section.hidden = true;
            return;
        }

        gallery.replaceChildren();
        photos.forEach((photo, index) => {
            const figure = document.createElement("figure");
            figure.className = "tray-gallery-item";
            figure.hidden = index >= 8;
            const picture = document.createElement("picture");
            const source = document.createElement("source");
            source.srcset = photo.file;
            source.type = "image/webp";
            const image = document.createElement("img");
            image.src = photo.file.replace(/\.webp$/i, ".jpg");
            image.alt = photo.alt;
            image.loading = "lazy";
            image.width = Number(photo.width);
            image.height = Number(photo.height);
            picture.append(source, image);
            figure.appendChild(picture);
            gallery.appendChild(figure);
        });

        button.hidden = photos.length <= 8;
        button.onclick = () => {
            gallery.querySelectorAll(".tray-gallery-item[hidden]").forEach(item => {
                item.hidden = false;
            });
            button.hidden = true;
        };
        section.hidden = false;
    }

    function packages() {
        return window.PACKAGES || [];
    }

    function productsList() {
        return window.PRODUCTS || [];
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

    function formatPeso(amount) {
        return "\u20b1" + Number(amount).toLocaleString("en-PH");
    }

    function createVarietyThumb(product) {
        const thumb = document.createElement("span");
        thumb.className = "tray-builder-thumb";
        thumb.setAttribute("aria-hidden", "true");
        if (product && product.image) {
            const picture = document.createElement("picture");
            const source = document.createElement("source");
            source.srcset = product.image.replace(/\.jpg$/i, ".webp");
            source.type = "image/webp";
            const image = document.createElement("img");
            image.src = product.image;
            image.alt = "";
            image.loading = "lazy";
            picture.append(source, image);
            thumb.appendChild(picture);
        } else {
            thumb.classList.add("is-initial");
            thumb.textContent = product && product.name ? product.name.charAt(0) : "?";
        }
        return thumb;
    }

    function setTrayQty(dialog, value) {
        const qtyInput = dialog.querySelector("[data-tray-builder-qty]");
        const next = Math.min(99, Math.max(1, Math.floor(Number(value)) || 1));
        trayBuilderState.qty = next;
        qtyInput.value = String(next);
        updateTrayBuilderUI(dialog);
    }

    function getTrayBuilderDialog() {
        let dialog = document.querySelector("[data-tray-builder-dialog]");
        if (dialog) return dialog;
        dialog = document.createElement("dialog");
        dialog.className = "tray-builder-dialog";
        dialog.setAttribute("data-tray-builder-dialog", "");
        dialog.setAttribute("aria-labelledby", "tray-builder-title");
        dialog.innerHTML = `
            <div class="tray-builder-content" role="document">
                <div class="tray-builder-header">
                    <div class="tray-builder-heading">
                        <p class="tray-builder-eyebrow">Ate My's Kakanin</p>
                        <h2 id="tray-builder-title">Build your tray</h2>
                        <p class="tray-builder-subtitle">Pick a size, then mix up to 3 kakanin on the same tray.</p>
                    </div>
                    <button class="tray-builder-close" type="button" data-tray-builder-close aria-label="Close">&times;</button>
                </div>
                <form class="tray-builder-form" novalidate>
                    <div class="tray-builder-body">
                        <fieldset class="tray-builder-section">
                            <legend><span class="tray-builder-step" aria-hidden="true">1</span>Choose a tray size</legend>
                            <div class="tray-builder-packages" data-tray-builder-packages></div>
                        </fieldset>
                        <fieldset class="tray-builder-section">
                            <legend><span class="tray-builder-step" aria-hidden="true">2</span>Choose your varieties</legend>
                            <p class="tray-builder-counter" data-tray-builder-counter aria-live="polite">1 of 3 chosen</p>
                            <ul class="tray-builder-selected" data-tray-builder-selected></ul>
                            <p class="tray-builder-picker-label">Tap to add or remove</p>
                            <div class="tray-builder-picker" data-tray-builder-picker></div>
                            <p class="tray-builder-limit-note" data-tray-builder-limit-note aria-live="polite"></p>
                        </fieldset>
                        <p class="tray-builder-hint">Ordering in bulk? Discounts depend on quantity &ndash; message us for bulk pricing.</p>
                    </div>
                    <div class="tray-builder-footer">
                        <p class="tray-builder-summary" data-tray-builder-summary aria-live="polite"></p>
                        <div class="tray-builder-footer-row">
                            <div class="tray-builder-qty-group">
                                <label class="tray-builder-qty-label" for="tray-builder-qty">Trays</label>
                                <div class="tray-builder-stepper">
                                    <button class="tray-builder-stepper-btn" type="button" data-tray-builder-minus aria-label="Fewer trays">&minus;</button>
                                    <input id="tray-builder-qty" class="tray-builder-qty" type="number" inputmode="numeric" min="1" max="99" step="1" value="1" data-tray-builder-qty>
                                    <button class="tray-builder-stepper-btn" type="button" data-tray-builder-plus aria-label="More trays">+</button>
                                </div>
                            </div>
                            <p class="tray-builder-total" data-tray-builder-total></p>
                        </div>
                        <p class="tray-builder-error" data-tray-builder-error role="alert"></p>
                        <div class="tray-builder-actions">
                            <button class="btn btn-outline" type="button" data-tray-builder-cancel>Cancel</button>
                            <button class="btn btn-primary" type="submit" data-tray-builder-add>Add tray to order</button>
                        </div>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(dialog);
        dialog.querySelector("[data-tray-builder-close]").addEventListener("click", () => dialog.close());
        dialog.querySelector("[data-tray-builder-cancel]").addEventListener("click", () => dialog.close());
        // Clicking the dimmed backdrop closes the dialog.
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) dialog.close();
        });
        dialog.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                dialog.close();
            }
        });

        const qtyInput = dialog.querySelector("[data-tray-builder-qty]");
        qtyInput.addEventListener("input", () => {
            if (!trayBuilderState) return;
            const val = Number(qtyInput.value);
            if (Number.isInteger(val) && val >= 1) {
                trayBuilderState.qty = Math.min(99, val);
                updateTrayBuilderUI(dialog);
            }
        });
        // Put a valid number back if the field is left empty or invalid.
        qtyInput.addEventListener("change", () => {
            if (trayBuilderState) setTrayQty(dialog, qtyInput.value);
        });
        dialog.querySelector("[data-tray-builder-minus]").addEventListener("click", () => {
            if (trayBuilderState) setTrayQty(dialog, trayBuilderState.qty - 1);
        });
        dialog.querySelector("[data-tray-builder-plus]").addEventListener("click", () => {
            if (trayBuilderState) setTrayQty(dialog, trayBuilderState.qty + 1);
        });
        dialog.querySelector(".tray-builder-form").addEventListener("submit", (event) => {
            event.preventDefault();
            addTrayFromBuilder(dialog, lastTrayButton);
        });
        return dialog;
    }

    let trayBuilderState = null;
    let lastTrayButton = null;

    function toggleTrayVariety(dialog, productId) {
        const limitNote = dialog.querySelector("[data-tray-builder-limit-note]");
        const varieties = trayBuilderState.varieties;
        const index = varieties.indexOf(productId);
        if (index >= 0) {
            if (varieties.length <= 1) {
                limitNote.textContent = "Keep at least one variety on your tray.";
                return;
            }
            varieties.splice(index, 1);
        } else {
            if (varieties.length >= 3) return;
            varieties.push(productId);
        }
        updateTrayBuilderUI(dialog);
    }

    function openTrayBuilder(productId, button) {
        const dialog = getTrayBuilderDialog();
        const products = productsList();
        const product = products.find(p => p.id === productId);
        if (!product) return;
        lastTrayButton = button;
        const availablePackages = packages();
        if (!availablePackages.length) return;
        const initialPackage = availablePackages[0];
        trayBuilderState = {
            productId: product.id,
            packageId: initialPackage.id,
            varieties: [product.id],
            qty: 1
        };

        dialog.querySelector("[data-tray-builder-error]").textContent = "";

        // Tray sizes
        const packagesContainer = dialog.querySelector("[data-tray-builder-packages]");
        packagesContainer.replaceChildren();
        availablePackages.forEach((pkg, index) => {
            const optionId = `tray-builder-pkg-${pkg.id}`;
            const label = document.createElement("label");
            label.className = "tray-builder-package-option";
            label.setAttribute("for", optionId);
            const input = document.createElement("input");
            input.type = "radio";
            input.className = "tray-builder-package-radio";
            input.id = optionId;
            input.name = "tray-builder-package";
            input.value = pkg.id;
            if (index === 0) input.checked = true;
            input.addEventListener("change", () => {
                if (input.checked) {
                    trayBuilderState.packageId = pkg.id;
                    updateTrayBuilderUI(dialog);
                }
            });
            const name = document.createElement("span");
            name.className = "tray-builder-package-name";
            name.textContent = pkg.name;
            const pieces = document.createElement("span");
            pieces.className = "tray-builder-package-pieces";
            const piecesCount = document.createElement("strong");
            piecesCount.textContent = String(pkg.pieces);
            pieces.append(piecesCount, " pcs");
            const price = document.createElement("span");
            price.className = "tray-builder-package-price";
            price.textContent = formatPeso(pkg.price);
            label.append(input, name, pieces, price);
            packagesContainer.appendChild(label);
        });

        // Variety picker (built once per open so keyboard focus is never lost)
        const picker = dialog.querySelector("[data-tray-builder-picker]");
        picker.replaceChildren();
        products.forEach((prod) => {
            const tile = document.createElement("button");
            tile.type = "button";
            tile.className = "tray-builder-picker-item";
            tile.dataset.productId = prod.id;
            tile.setAttribute("aria-pressed", "false");
            const label = document.createElement("span");
            label.className = "tray-builder-picker-name";
            label.textContent = prod.name;
            const mark = document.createElement("span");
            mark.className = "tray-builder-picker-mark";
            mark.setAttribute("aria-hidden", "true");
            tile.append(createVarietyThumb(prod), label, mark);
            tile.addEventListener("click", () => toggleTrayVariety(dialog, prod.id));
            picker.appendChild(tile);
        });

        setTrayQty(dialog, 1);
        dialog.showModal();
        dialog.querySelector(".tray-builder-body").scrollTop = 0;
        const firstInput = dialog.querySelector(".tray-builder-package-radio");
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 0);
        }
    }

    function updateTrayBuilderUI(dialog) {
        if (!trayBuilderState) return;
        const products = productsList();
        const availablePackages = packages();
        const currentPackage = availablePackages.find(p => p.id === trayBuilderState.packageId) || availablePackages[0];
        if (currentPackage) trayBuilderState.packageId = currentPackage.id;
        const maxVarieties = 3;
        const chosen = trayBuilderState.varieties;
        const atLimit = chosen.length >= maxVarieties;

        // Tray preview: chosen varieties plus dashed empty slots
        const selectedList = dialog.querySelector("[data-tray-builder-selected]");
        selectedList.replaceChildren();
        chosen.forEach((vid) => {
            const prod = products.find(p => p.id === vid);
            const li = document.createElement("li");
            li.className = "tray-builder-selected-item";
            const nameSpan = document.createElement("span");
            nameSpan.className = "tray-builder-selected-name";
            nameSpan.textContent = prod ? prod.name : vid;
            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "tray-builder-remove";
            removeBtn.setAttribute("aria-label", `Remove ${prod ? prod.name : vid}`);
            removeBtn.innerHTML = "&times;";
            removeBtn.disabled = chosen.length <= 1;
            removeBtn.addEventListener("click", () => {
                toggleTrayVariety(dialog, vid);
                const tile = dialog.querySelector(`.tray-builder-picker-item[data-product-id="${CSS.escape(vid)}"]`);
                if (tile) tile.focus();
            });
            li.append(createVarietyThumb(prod), nameSpan, removeBtn);
            selectedList.appendChild(li);
        });
        for (let i = chosen.length; i < maxVarieties; i++) {
            const empty = document.createElement("li");
            empty.className = "tray-builder-selected-item is-empty";
            empty.setAttribute("aria-hidden", "true");
            empty.textContent = "Open spot";
            selectedList.appendChild(empty);
        }

        dialog.querySelector("[data-tray-builder-counter]").textContent =
            `${chosen.length} of ${maxVarieties} chosen`;

        // Picker state
        dialog.querySelectorAll(".tray-builder-picker-item").forEach((tile) => {
            const selected = chosen.includes(tile.dataset.productId);
            tile.classList.toggle("is-selected", selected);
            tile.setAttribute("aria-pressed", selected ? "true" : "false");
            tile.disabled = atLimit && !selected;
        });
        const limitNote = dialog.querySelector("[data-tray-builder-limit-note]");
        limitNote.textContent = atLimit
            ? "Your tray is full. Tap a selected variety to swap it out."
            : "";

        // Summary + total
        const varietyNames = chosen.map(vid => {
            const p = products.find(prod => prod.id === vid);
            return p ? p.name : vid;
        });
        const pkg = currentPackage || availablePackages[0];
        const qty = trayBuilderState.qty;
        dialog.querySelector("[data-tray-builder-summary]").textContent =
            `${pkg.name} \u00b7 ${pkg.pieces} pcs \u00b7 ${varietyNames.join(" + ")}`;
        const total = dialog.querySelector("[data-tray-builder-total]");
        total.replaceChildren();
        const totalLabel = document.createElement("span");
        totalLabel.className = "tray-builder-total-label";
        totalLabel.textContent = qty > 1
            ? `${formatPeso(pkg.price)} each \u00d7 ${qty} trays`
            : "1 tray";
        const totalValue = document.createElement("strong");
        totalValue.textContent = formatPeso(pkg.price * qty);
        total.append(totalLabel, totalValue);

        // Quantity controls
        dialog.querySelector("[data-tray-builder-qty]").value = String(qty);
        dialog.querySelector("[data-tray-builder-minus]").disabled = qty <= 1;
        dialog.querySelector("[data-tray-builder-plus]").disabled = qty >= 99;
    }

    async function addTrayFromBuilder(dialog, button) {
        const errorEl = dialog.querySelector("[data-tray-builder-error]");
        errorEl.textContent = "";
        if (!cart) {
            errorEl.textContent = "The cart is unavailable.";
            return;
        }
        if (!trayBuilderState) return;
        if (!Array.isArray(trayBuilderState.varieties) || trayBuilderState.varieties.length < 1 || trayBuilderState.varieties.length > 3) {
            errorEl.textContent = "Choose 1 to 3 varieties.";
            return;
        }
        if (new Set(trayBuilderState.varieties).size !== trayBuilderState.varieties.length) {
            errorEl.textContent = "Duplicate variety.";
            return;
        }
        const qty = Number(trayBuilderState.qty);
        if (!Number.isInteger(qty) || qty < 1) {
            errorEl.textContent = "Enter a valid number of trays.";
            return;
        }

        try {
            const user = await getSignedInUser();
            if (user) {
                cart.add(trayBuilderState.packageId, trayBuilderState.varieties, qty);
                dialog.close();
                if (button) {
                    const original = button.textContent;
                    button.textContent = "Added!";
                    window.setTimeout(() => { button.textContent = original; }, 1000);
                }
                return;
            }
            sessionStorage.setItem(pendingCartKey, JSON.stringify({
                packageId: trayBuilderState.packageId,
                varieties: trayBuilderState.varieties,
                qty: qty,
                returnPath: getReturnPath(),
                createdAt: Date.now()
            }));
            const gate = getOrderGateDialog();
            gate.querySelector("[data-order-auth-login]").href = getAuthUrl("/login/");
            gate.querySelector("[data-order-auth-signup]").href = getAuthUrl("/signup/");
            gate.showModal();
        } catch (error) {
            console.error("Unable to add tray to cart:", error);
            errorEl.textContent = "We could not verify your sign-in status. Log in or create an account to continue.";
        }
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
            typeof pending.packageId !== "string" ||
            !Array.isArray(pending.varieties) ||
            pending.varieties.length < 1 ||
            pending.varieties.length > 3 ||
            !pending.varieties.every(v => typeof v === "string") ||
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
        if (!pending.varieties.every(v => (window.PRODUCTS || []).some(product => product.id === v)) ||
            !packages().some(packageInfo => packageInfo.id === pending.packageId)) {
            console.error("The pending cart item or package is no longer available.");
            sessionStorage.removeItem(pendingCartKey);
            return;
        }
        try {
            const qty = Number.isInteger(pending.qty) && pending.qty >= 1 ? pending.qty : 1;
            cart.add(pending.packageId, pending.varieties, qty);
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
                let image;
                if (product.image) {
                    image = `<div class="product-image product-image--${escapeHtml(product.id)}"><picture><source srcset="${escapeHtml(product.image.replace(/\.jpg$/i, ".webp"))}" type="image/webp"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy"></picture></div>`;
                } else {
                    image = `<div class="product-image product-image-placeholder"><span>${escapeHtml(product.name)}</span></div>`;
                }
                card.innerHTML = `
                    ${image}
                    <div class="product-content">
                        <h3 class="product-name">${escapeHtml(product.name)}</h3>
                        ${product.seasonal ? '<p class="seasonal-label">Seasonal</p>' : ""}
                        <p class="product-description">${escapeHtml(product.description)}</p>
                        <p class="small-text"><strong>Ingredients / allergen information:</strong> ${escapeHtml(product.allergens)}</p>
                        <div class="product-footer">
                            <button class="btn btn-sm btn-primary add-to-cart" type="button" data-id="${escapeHtml(product.id)}">Add to Order</button>
                        </div>
                    </div>
                `;
                card.querySelector(".add-to-cart").addEventListener("click", async event => {
                    const button = event.currentTarget;
                    button.disabled = true;
                    try {
                        openTrayBuilder(product.id, button);
                    } catch (error) {
                        console.error("Unable to open tray builder:", error);
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
        renderTrayGallery();
        renderProducts(Array.isArray(config && config.products) ? config.products : (window.PRODUCTS || []));
        await resumePendingCartItem();
    } catch (error) {
        console.error("Unable to load public product configuration:", error);
        renderPackagePrices();
        renderTrayGallery();
        renderProducts(window.PRODUCTS || [], "Server configuration could not be loaded. Showing the current tray size details; contact us if your order cannot be submitted.");
        await resumePendingCartItem();
    }
});
