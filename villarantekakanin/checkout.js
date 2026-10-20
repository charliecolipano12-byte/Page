document.addEventListener("DOMContentLoaded", function() {
    const config = window.CONFIG || {};
    const orderConfig = config.order || {};
    const cart = window.cart;
    const products = window.PRODUCTS || [];
    const orderService = window.OrderService;
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    const checkoutForm = document.getElementById("checkoutForm");
    const checkoutError = document.getElementById("checkoutError");
    const demoWarning = document.getElementById("demoWarning");
    const emptyCartState = document.getElementById("emptyCartState");
    const summaryItems = document.getElementById("summaryItems");
    const availabilityMessages = document.getElementById("availabilityMessages");
    const subtotalElement = document.getElementById("subtotal");
    const deliveryFeeElement = document.getElementById("deliveryFee");
    const totalElement = document.getElementById("total");
    const placeOrderButton = checkoutForm.querySelector('[type="submit"]');
    const orderType = document.getElementById("orderType");
    const deliveryFields = document.getElementById("deliveryFields");
    const address = document.getElementById("address");
    const pickupDate = document.getElementById("pickupDate");
    const timeSlot = document.getElementById("timeSlot");
    const payment = document.getElementById("payment");
    const referenceNumber = document.getElementById("referenceNumber");
    const gcashPaymentInfo = document.getElementById("gcashPaymentInfo");
    const availability = new Map();
    let availabilityRequest = 0;

    if (demoWarning) demoWarning.hidden = !orderService.isDemoMode();

    function dateKey(date) {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(date);
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
    }

    function dateFromKey(key) {
        return new Date(`${key}T00:00:00Z`);
    }

    function isClosedDate(date) {
        const weekday = weekdays[date.getUTCDay()];
        const closed = (orderConfig.closedDays || []).some(day =>
            String(day).toLowerCase() === weekday
        );
        return closed || !orderConfig.openingHours?.[weekday];
    }

    function populatePickupDates() {
        pickupDate.replaceChildren(new Option("-- Select a date --", ""));
        const firstDate = dateFromKey(dateKey(new Date()));
        firstDate.setUTCDate(firstDate.getUTCDate() + Math.max(0, Number(orderConfig.leadTimeDays || 0)));
        for (let offset = 0; offset <= 365; offset += 1) {
            const date = new Date(firstDate);
            date.setUTCDate(firstDate.getUTCDate() + offset);
            if (isClosedDate(date)) continue;
            const value = date.toISOString().slice(0, 10);
            const label = new Intl.DateTimeFormat("en-PH", {
                timeZone: "UTC",
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            }).format(date);
            pickupDate.add(new Option(label, value));
        }
    }

    function formatTime(minutes) {
        const date = new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
        return date.toLocaleTimeString("en-US", {
            timeZone: "UTC",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function currentBusinessMinutes() {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Manila",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        }).formatToParts(new Date());
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return Number(values.hour) * 60 + Number(values.minute);
    }

    function populateTimeSlots() {
        timeSlot.replaceChildren(new Option("-- Select time slot --", ""));
        if (!pickupDate.value) return;
        const weekday = weekdays[dateFromKey(pickupDate.value).getUTCDay()];
        const hours = orderConfig.openingHours?.[weekday];
        if (!hours) return;
        const [openHour, openMinute] = hours.open.split(":").map(Number);
        const [closeHour, closeMinute] = hours.close.split(":").map(Number);
        const opening = openHour * 60 + openMinute;
        const closing = closeHour * 60 + closeMinute;
        const duration = Number(orderConfig.slotDurationMinutes || 60);
        const today = dateKey(new Date());
        const earliest = pickupDate.value === today
            ? currentBusinessMinutes() + Number(orderConfig.leadTimeDays || 0) * 1440
            : -1;

        for (let start = opening; start + duration <= closing; start += duration) {
            if (pickupDate.value === today && start <= earliest) continue;
            const end = start + duration;
            const key = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}-${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
            timeSlot.add(new Option(`${formatTime(start)} - ${formatTime(end)}`, key));
        }
    }

    function updateDeliveryFields() {
        const isDelivery = orderType.value === "delivery";
        deliveryFields.hidden = !isDelivery;
        address.required = isDelivery;
        if (!isDelivery) address.value = "";
        renderSummary();
    }

    function updatePaymentFields() {
        const isGcash = payment.value === "gcash";
        gcashPaymentInfo.hidden = !isGcash;
        referenceNumber.required = isGcash;
    }

    const deliveryOption = document.getElementById("deliveryOption");
    if (orderConfig.pickupOnly) {
        if (deliveryOption) deliveryOption.remove();
    } else if (deliveryOption) {
        deliveryOption.textContent = `Delivery (+₱${Number(orderConfig.deliveryFee ?? 0).toFixed(2)})`;
    }

    const gcash = config.business?.gcash || {};
    document.getElementById("gcashName").textContent = gcash.name || "[GCash account name - not provided]";
    document.getElementById("gcashNumber").textContent = gcash.number || "[GCash mobile number - not provided]";
    const gcashQrImage = document.getElementById("gcashQrImage");
    const gcashPlaceholder = document.getElementById("gcashPlaceholder");
    if (gcash.qrImage) {
        gcashQrImage.src = gcash.qrImage;
        gcashQrImage.hidden = false;
        gcashQrImage.addEventListener("error", () => {
            gcashQrImage.hidden = true;
            gcashPlaceholder.hidden = false;
        }, { once: true });
    } else {
        gcashPlaceholder.hidden = false;
    }

    function renderSummary() {
        const isEmpty = cart.items.length === 0;
        emptyCartState.hidden = !isEmpty;
        checkoutForm.hidden = isEmpty;
        summaryItems.replaceChildren();
        if (isEmpty) {
            subtotalElement.textContent = "₱0.00";
            deliveryFeeElement.textContent = "₱0.00";
            totalElement.textContent = "₱0.00";
            return;
        }

        cart.items.forEach(item => {
            const product = products.find(candidate => candidate.id === item.id);
            if (!product) return;
            const row = document.createElement("div");
            row.className = "summary-item cart-edit-row";
            row.dataset.productId = product.id;

            const details = document.createElement("div");
            const name = document.createElement("strong");
            name.textContent = product.name;
            const price = document.createElement("span");
            price.className = "small-text";
            price.textContent = `₱${product.price.toFixed(2)} each`;
            const stock = document.createElement("span");
            stock.className = "small-text availability-message";
            stock.id = `availability-${product.id}`;
            details.append(name, document.createElement("br"), price, document.createElement("br"), stock);

            const controls = document.createElement("div");
            controls.className = "cart-quantity-controls";
            const minus = document.createElement("button");
            minus.type = "button";
            minus.className = "btn btn-sm cart-quantity-button";
            minus.dataset.action = "decrease";
            minus.setAttribute("aria-label", `Decrease ${product.name} quantity`);
            minus.textContent = "−";
            const quantity = document.createElement("input");
            quantity.className = "cart-quantity-input";
            quantity.type = "number";
            quantity.min = "1";
            quantity.step = "1";
            quantity.value = String(item.qty);
            quantity.dataset.action = "quantity";
            quantity.setAttribute("aria-label", `${product.name} quantity`);
            const plus = document.createElement("button");
            plus.type = "button";
            plus.className = "btn btn-sm cart-quantity-button";
            plus.dataset.action = "increase";
            plus.setAttribute("aria-label", `Increase ${product.name} quantity`);
            plus.textContent = "+";
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "btn btn-sm btn-outline cart-remove-button";
            remove.dataset.action = "remove";
            remove.textContent = "Remove";
            controls.append(minus, quantity, plus, remove);

            const lineTotal = document.createElement("strong");
            lineTotal.className = "cart-line-total";
            lineTotal.textContent = `₱${(product.price * item.qty).toFixed(2)}`;
            row.append(details, controls, lineTotal);
            summaryItems.appendChild(row);
            updateQuantityControls(row, item);
        });

        const subtotal = cart.subtotal();
        const delivery = orderType.value === "delivery" ? Number(orderConfig.deliveryFee ?? 0) : 0;
        subtotalElement.textContent = `₱${subtotal.toFixed(2)}`;
        deliveryFeeElement.textContent = `₱${delivery.toFixed(2)}`;
        totalElement.textContent = `₱${(subtotal + delivery).toFixed(2)}`;
    }

    function updateQuantityControls(row, item) {
        const remaining = availability.get(item.id);
        const input = row.querySelector(".cart-quantity-input");
        const plus = row.querySelector('[data-action="increase"]');
        if (Number.isInteger(remaining)) {
            input.max = String(remaining);
            plus.disabled = item.qty >= remaining;
        }
    }

    async function refreshAvailability() {
        const requestId = ++availabilityRequest;
        availability.clear();
        availabilityMessages.textContent = "";
        if (!pickupDate.value || cart.items.length === 0) {
            placeOrderButton.disabled = false;
            return;
        }
        placeOrderButton.disabled = true;
        availabilityMessages.textContent = "Checking availability…";
        try {
            const results = await Promise.all(cart.items.map(async item => ({
                id: item.id,
                remaining: await orderService.getRemainingCapacity(pickupDate.value, item.id)
            })));
            if (requestId !== availabilityRequest) return;
            results.forEach(result => availability.set(result.id, result.remaining));
            results.forEach(result => {
                const item = cart.items.find(cartItem => cartItem.id === result.id);
                const message = document.getElementById(`availability-${result.id}`);
                if (message) {
                    message.textContent = result.remaining <= 0
                        ? "Sold out for this date"
                        : `Only ${result.remaining} left for this date`;
                }
                const row = summaryItems.querySelector(`[data-product-id="${result.id}"]`);
                if (row && item) updateQuantityControls(row, item);
            });
            availabilityMessages.textContent = "";
            updateOrderButton();
        } catch (error) {
            if (requestId !== availabilityRequest) return;
            availabilityMessages.textContent = "Availability could not be checked. Please try again.";
            checkoutError.textContent = error.message || "Availability could not be checked.";
            placeOrderButton.disabled = true;
        }
    }

    function updateOrderButton() {
        const hasDate = Boolean(pickupDate.value);
        const unavailable = cart.items.some(item =>
            !availability.has(item.id) || availability.get(item.id) < item.qty
        );
        placeOrderButton.disabled = hasDate && unavailable;
    }

    function updateCartQuantity(productId, quantity) {
        const parsed = Number(quantity);
        if (!Number.isInteger(parsed) || parsed < 1) return;
        const remaining = availability.get(productId);
        if (Number.isInteger(remaining) && parsed > remaining) return;
        cart.update(productId, parsed);
        renderSummary();
        refreshAvailability();
    }

    summaryItems.addEventListener("click", event => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const row = button.closest("[data-product-id]");
        const productId = row.dataset.productId;
        const current = cart.items.find(item => item.id === productId);
        if (!current) return;
        if (button.dataset.action === "increase") {
            updateCartQuantity(productId, current.qty + 1);
        } else if (button.dataset.action === "decrease" && current.qty > 1) {
            updateCartQuantity(productId, current.qty - 1);
        } else if (button.dataset.action === "remove") {
            cart.remove(productId);
            renderSummary();
            refreshAvailability();
        }
    });

    summaryItems.addEventListener("change", event => {
        if (!event.target.matches('input[data-action="quantity"]')) return;
        const productId = event.target.closest("[data-product-id]").dataset.productId;
        updateCartQuantity(productId, Number(event.target.value));
    });

    function validatePhone(phone) {
        const digits = phone.replace(/\D/g, "");
        return (digits.startsWith("63") && digits.length >= 12) ||
            (digits.startsWith("09") && digits.length >= 11);
    }

    function displayError(id, message) {
        const error = document.getElementById(id);
        if (error) error.textContent = message;
    }

    orderType.addEventListener("change", updateDeliveryFields);
    payment.addEventListener("change", updatePaymentFields);
    pickupDate.addEventListener("change", () => {
        populateTimeSlots();
        refreshAvailability();
    });
    populatePickupDates();
    updateDeliveryFields();
    updatePaymentFields();
    renderSummary();

    checkoutForm.addEventListener("submit", async event => {
        event.preventDefault();
        document.querySelectorAll(".error-text").forEach(error => {
            error.textContent = "";
        });
        checkoutError.textContent = "";
        let valid = true;
        const fullName = document.getElementById("fullName").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const email = document.getElementById("email").value.trim();

        if (cart.items.length === 0) {
            checkoutError.textContent = "Your cart is empty. Add items from the menu first.";
            return;
        }
        if (!fullName) {
            displayError("error-fullName", "Full name is required.");
            valid = false;
        }
        if (!validatePhone(phone)) {
            displayError("error-phone", "Enter a valid PH mobile (09XXXXXXXXX or +639XXXXXXXXX).");
            valid = false;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            displayError("error-email", "Enter a valid email.");
            valid = false;
        }
        if (payment.value === "gcash" && !/^\d{10,13}$/.test(referenceNumber.value.trim())) {
            displayError("error-referenceNumber", "Enter a 10–13 digit GCash reference number.");
            valid = false;
        }
        if (orderType.value === "delivery" && !address.value.trim()) {
            displayError("error-address", "Delivery address is required.");
            valid = false;
        }
        if (!pickupDate.value) {
            displayError("error-pickupDate", "Select an available date.");
            valid = false;
        } else {
            const selected = dateFromKey(pickupDate.value);
            const minimum = dateFromKey(dateKey(new Date()));
            minimum.setUTCDate(minimum.getUTCDate() + Math.max(0, Number(orderConfig.leadTimeDays || 0)));
            if (isClosedDate(selected) || selected < minimum) {
                displayError("error-pickupDate", "Choose an open date that meets the minimum lead time.");
                valid = false;
            }
        }
        if (!timeSlot.value) {
            displayError("error-timeSlot", "Select an available time slot.");
            valid = false;
        }
        if (orderConfig.pickupOnly && orderType.value === "delivery") {
            checkoutError.textContent = "Delivery is not currently available.";
            valid = false;
        }
        if (pickupDate.value && cart.items.some(item =>
            !availability.has(item.id) || availability.get(item.id) < item.qty
        )) {
            checkoutError.textContent = "One or more items are unavailable in the selected quantities.";
            valid = false;
        }
        if (!valid) return;

        const subtotal = cart.subtotal();
        const deliveryFee = orderType.value === "delivery" ? Number(orderConfig.deliveryFee ?? 0) : 0;
        const order = {
            customer: {
                name: fullName,
                phone,
                email
            },
            items: cart.items.map(item => {
                const product = products.find(candidate => candidate.id === item.id);
                return { id: item.id, name: product.name, price: product.price, qty: item.qty };
            }),
            orderType: orderType.value,
            deliveryAddress: orderType.value === "delivery" ? address.value.trim() : null,
            pickupDate: pickupDate.value,
            timeSlot: timeSlot.value,
            paymentMethod: payment.value,
            referenceNumber: payment.value === "gcash" ? referenceNumber.value.trim() : "",
            paymentStatus: payment.value === "gcash" ? "paid-pending-verification" : "unpaid",
            notes: document.getElementById("notes").value.trim(),
            subtotal,
            deliveryFee,
            total: subtotal + deliveryFee
        };

        placeOrderButton.disabled = true;
        try {
            const result = await orderService.submitOrder(order);
            cart.clear();
            const query = new URLSearchParams({ order: result.orderNumber });
            if (result.confirmationToken) query.set("token", result.confirmationToken);
            window.location.href = `confirmation.html?${query.toString()}`;
        } catch (error) {
            checkoutError.textContent = error.message || "Failed to submit order. Please try again.";
            placeOrderButton.disabled = false;
        }
    });
});
