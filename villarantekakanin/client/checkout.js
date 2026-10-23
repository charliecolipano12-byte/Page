const cart = window.cart;

document.addEventListener("DOMContentLoaded", async function() {
    const form = document.getElementById("checkoutForm");
    if (!form) return;
    const summaryItems = document.getElementById("summaryItems");
    const checkoutError = document.getElementById("checkoutError");
    const demoWarning = document.getElementById("demoWarning");
    const emptyCartState = document.getElementById("emptyCartState");
    const placeOrderButton = form.querySelector('[type="submit"]');
    const dateInput = document.getElementById("pickupDate");
    const totalPiecesElement = document.getElementById("totalPieces");
    const totalElement = document.getElementById("total");
    let isSubmitting = false;
    let signedInUser = null;

    function products() {
        return window.PRODUCTS || [];
    }

    function packages() {
        return window.PACKAGES || [];
    }

    function formatMoney(amount) {
        return `?${Number(amount).toFixed(2)}`;
    }

    function lineKey(item) {
        const varieties = Array.isArray(item.varieties) ? [...item.varieties].sort() : [];
        return `${item.packageId}|${varieties.join(",")}`;
    }

    function renderSummary() {
        const isEmpty = !cart || cart.items.length === 0;
        emptyCartState.hidden = !isEmpty;
        form.hidden = isEmpty;
        summaryItems.replaceChildren();
        if (isEmpty) {
            totalPiecesElement.textContent = "0 pcs";
            totalElement.textContent = formatMoney(0);
            return;
        }

        cart.items.forEach(item => {
            const packageInfo = packages().find(candidate => candidate.id === item.packageId);
            if (!packageInfo) return;
            const varieties = Array.isArray(item.varieties) ? [...item.varieties] : [];
            const varietyNames = varieties.map(vid => {
                const product = products().find(candidate => candidate.id === vid);
                return product ? product.name : vid;
            }).join(" + ");
            const row = document.createElement("div");
            row.className = "summary-item cart-edit-row";
            row.dataset.packageId = item.packageId;
            row.dataset.varieties = varieties.slice().sort().join(",");

            const details = document.createElement("div");
            const name = document.createElement("strong");
            name.textContent = `${packageInfo.name}`;
            const packageName = document.createElement("p");
            packageName.className = "small-text";
            packageName.textContent = `${varietyNames} · ${packageInfo.name} · ${packageInfo.pieces} pcs x ${item.qty} = ${packageInfo.pieces * item.qty} pcs`;
            details.append(name, packageName);

            const controls = document.createElement("div");
            controls.className = "cart-quantity-controls";
            const quantity = document.createElement("input");
            quantity.className = "cart-quantity-input";
            quantity.type = "number";
            quantity.min = "1";
            quantity.step = "1";
            quantity.value = String(item.qty);
            quantity.dataset.action = "quantity";
            quantity.setAttribute("aria-label", `${packageInfo.name} quantity`);
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "btn btn-sm btn-outline cart-remove-button";
            remove.dataset.action = "remove";
            remove.textContent = "Remove";
            controls.append(quantity, remove);

            const lineTotal = document.createElement("strong");
            lineTotal.className = "cart-line-total";
            lineTotal.textContent = formatMoney(packageInfo.price * item.qty);
            row.append(details, controls, lineTotal);
            summaryItems.appendChild(row);
        });

        const totalPieces = cart.items.reduce((sum, item) => {
            const packageInfo = packages().find(candidate => candidate.id === item.packageId);
            return sum + (packageInfo ? packageInfo.pieces * item.qty : 0);
        }, 0);
        totalPiecesElement.textContent = `${totalPieces} pcs`;
        totalElement.textContent = formatMoney(cart.subtotal());
    }

    function setMinimumPickupDate() {
        const today = new Date();
        const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        dateInput.min = localDate;
    }

    async function requireSignedInCustomer() {
        const response = await fetch("/api/auth/session", {
            credentials: "same-origin",
            headers: { Accept: "application/json" },
            cache: "no-store"
        });
        if (!response.ok) throw new Error("Could not verify your account.");
        const result = await response.json();
        signedInUser = result.user || null;
        return Boolean(signedInUser);
    }

    async function prefillSignedInCustomer() {
        if (!signedInUser) return;
        const nameInput = document.getElementById("fullName");
        const emailInput = document.getElementById("email");
        if (!nameInput.value) nameInput.value = signedInUser.name || "";
        if (!emailInput.value) emailInput.value = signedInUser.email || "";
    }

    summaryItems.addEventListener("click", event => {
        const button = event.target.closest('button[data-action="remove"]');
        if (!button) return;
        const row = button.closest(".cart-edit-row");
        if (!row) return;
        const packageId = row.dataset.packageId;
        const varietiesStr = row.dataset.varieties || "";
        const varieties = varietiesStr ? varietiesStr.split(",").filter(Boolean) : [];
        cart.remove(packageId, varieties);
        renderSummary();
    });

    summaryItems.addEventListener("change", event => {
        const input = event.target.closest('input[data-action="quantity"]');
        if (!input) return;
        const row = input.closest(".cart-edit-row");
        const quantity = Number(input.value);
        if (!row || !Number.isInteger(quantity) || quantity < 1) {
            renderSummary();
            return;
        }
        const packageId = row.dataset.packageId;
        const varietiesStr = row.dataset.varieties || "";
        const varieties = varietiesStr ? varietiesStr.split(",").filter(Boolean) : [];
        cart.update(packageId, varieties, quantity);
        renderSummary();
    });

    if (demoWarning && window.OrderService && window.OrderService.isDemoMode()) {
        demoWarning.hidden = false;
        demoWarning.textContent = "Demo mode: orders are stored only in this browser and are not sent to the owner.";
    }

    try {
        if (!(await requireSignedInCustomer())) {
            window.location.assign("/signup/?returnTo=%2Fcheckout.html");
            return;
        }
    } catch (error) {
        console.error("Unable to verify customer sign-in before checkout:", error);
        demoWarning.hidden = false;
        demoWarning.textContent = "We could not verify your sign-in status. Please try again or log in before placing an order.";
        return;
    }

    if (window.OrderService && !window.OrderService.isDemoMode()) {
        try {
            await window.OrderService.getPublicConfig();
        } catch (error) {
            console.error("Unable to load order configuration:", error);
            demoWarning.hidden = false;
            demoWarning.textContent = "The order service could not be reached. You can review your order, but submitting it may fail.";
        }
    }

    await prefillSignedInCustomer();
    setMinimumPickupDate();
    renderSummary();

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (isSubmitting) return;
        checkoutError.textContent = "";
        document.querySelectorAll(".error-text").forEach(error => { error.textContent = ""; });

        let valid = true;
        const fullName = document.getElementById("fullName").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const email = document.getElementById("email").value.trim();
        const date = dateInput.value;
        const time = document.getElementById("timeSlot").value.trim();
        const consent = document.getElementById("privacyConsent");

        if (!cart || cart.items.length === 0) {
            checkoutError.textContent = "Your cart is empty. Add items from the menu first.";
            return;
        }
        if (!fullName) {
            document.getElementById("error-fullName").textContent = "Enter your name.";
            valid = false;
        } else if (fullName.length > 80) {
            document.getElementById("error-fullName").textContent = "Name must be 80 characters or fewer.";
            valid = false;
        }
        if (!/^(?:09\d{9}|\+?639\d{9})$/.test(phone.replace(/[\s()-]/g, ""))) {
            document.getElementById("error-phone").textContent = "Enter a valid Philippine mobile number.";
            valid = false;
        }
        if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            document.getElementById("error-email").textContent = "Enter a valid email address.";
            valid = false;
        }
        if (!date || date < dateInput.min) {
            document.getElementById("error-pickupDate").textContent = date
                ? "Pickup date cannot be in the past."
                : "Choose your preferred pickup date.";
            valid = false;
        }
        if (!time) {
            document.getElementById("error-timeSlot").textContent = "Enter your preferred pickup time.";
            valid = false;
        } else if (time.length > 80) {
            document.getElementById("error-timeSlot").textContent = "Preferred pickup time must be 80 characters or fewer.";
            valid = false;
        }
        if (!consent.checked) {
            checkoutError.textContent = "Please agree to the privacy notice before sending your order.";
            valid = false;
        }
        if (!valid) return;

        let orderItems;
        try {
            orderItems = cart.items.map(item => {
                const packageInfo = packages().find(candidate => candidate.id === item.packageId);
                if (
                    !packageInfo ||
                    !Number.isSafeInteger(item.qty) ||
                    item.qty < 1 ||
                    !Number.isSafeInteger(packageInfo.price) ||
                    packageInfo.price < 0
                ) {
                    throw new Error("An item or tray size in your cart is no longer available. Please review your cart.");
                }
                const varieties = Array.isArray(item.varieties) ? item.varieties : [];
                if (varieties.length < 1 || varieties.length > 3) {
                    throw new Error("Each tray must have 1 to 3 varieties.");
                }
                if (new Set(varieties).size !== varieties.length) {
                    throw new Error("Duplicate variety.");
                }
                if (!varieties.every(v => products().some(p => p.id === v))) {
                    throw new Error("Invalid variety.");
                }
                return {
                    packageId: packageInfo.id,
                    packageName: packageInfo.name,
                    pieces: packageInfo.pieces,
                    price: packageInfo.price,
                    qty: item.qty,
                    varieties: varieties.slice()
                };
            });
        } catch (error) {
            checkoutError.textContent = error.message || "Please review your cart and try again.";
            return;
        }

        const subtotal = orderItems.reduce((sum, item) => {
            const packageInfo = packages().find(candidate => candidate.id === item.packageId);
            return sum + (packageInfo ? packageInfo.price * item.qty : 0);
        }, 0);
        if (!Number.isSafeInteger(subtotal) || subtotal < 0) {
            checkoutError.textContent = "The order total is outside the supported range. Please review your cart.";
            return;
        }
        const order = {
            customer: { name: fullName, phone, email },
            accountEmail: signedInUser.email,
            items: orderItems,
            orderType: "pickup",
            deliveryAddress: "",
            pickupDate: date,
            timeSlot: time,
            paymentMethod: document.getElementById("payment").value,
            referenceNumber: "",
            paymentStatus: "unpaid",
            notes: document.getElementById("notes").value.trim(),
            subtotal,
            deliveryFee: 0,
            total: subtotal,
            honeypot: document.getElementById("website").value.trim(),
            consent: consent.checked
        };

        isSubmitting = true;
        placeOrderButton.disabled = true;
        try {
            const result = await window.OrderService.submitOrder(order);
            cart.clear();
            const query = new URLSearchParams({ order: result.orderNumber });
            if (result.confirmationToken) query.set("token", result.confirmationToken);
            window.location.href = `confirmation.html?${query.toString()}`;
        } catch (error) {
            checkoutError.textContent = error.message || "Failed to submit your order. Please try again.";
            placeOrderButton.disabled = false;
            isSubmitting = false;
        }
    });
});
