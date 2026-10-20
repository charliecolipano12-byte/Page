document.addEventListener("DOMContentLoaded", function() {
    const products = window.PRODUCTS || [];
    const orderService = window.OrderService;
    const adminLogin = document.getElementById("adminLogin");
    const adminPanel = document.getElementById("adminPanel");
    const adminLoginBtn = document.getElementById("adminLoginBtn");
    const adminEmail = document.getElementById("adminEmail");
    const adminPassword = document.getElementById("adminPassword");
    const adminLoginMsg = document.getElementById("adminLoginMsg");
    const ordersMessage = document.getElementById("ordersMessage");
    const settingsMessage = document.getElementById("settingsMessage");
    const ordersTableBody = document.getElementById("ordersTableBody");
    const statusFilter = document.getElementById("statusFilter");
    const dateFilter = document.getElementById("dateFilter");
    const refreshOrders = document.getElementById("refreshOrders");
    const signOutBtn = document.getElementById("signOutBtn");
    const productSettings = document.getElementById("productSettings");
    const productionDate = document.getElementById("productionDate");
    const productionSummary = document.getElementById("productionSummary");
    const statuses = ["pending", "confirmed", "ready", "completed", "cancelled"];
    let orders = [];

    function cell(text) {
        const element = document.createElement("td");
        element.textContent = text == null ? "" : String(text);
        return element;
    }

    async function loadOrders() {
        ordersMessage.textContent = "Loading orders…";
        try {
            orders = await orderService.getOrders();
            ordersMessage.textContent = "";
            renderOrders();
            renderProductionSummary();
        } catch (error) {
            ordersMessage.textContent = error.message || "Unable to load orders.";
        }
    }

    function renderOrders() {
        ordersTableBody.replaceChildren();
        const selectedStatus = statusFilter.value;
        const selectedDate = dateFilter.value;
        const filtered = orders.filter(order =>
            (selectedStatus === "all" || order.status === selectedStatus) &&
            (!selectedDate || order.pickupDate === selectedDate)
        );

        if (filtered.length === 0) {
            const row = document.createElement("tr");
            const empty = cell("No orders found.");
            empty.colSpan = 10;
            row.appendChild(empty);
            ordersTableBody.appendChild(row);
            return;
        }

        filtered.forEach(order => {
            const row = document.createElement("tr");
            row.dataset.orderId = String(order.id || "");
            row.appendChild(cell(order.orderNumber || order.id));
            row.appendChild(cell(order.pickupDate));

            const customer = document.createElement("td");
            const customerName = document.createElement("div");
            customerName.textContent = order.customer?.name || "";
            const customerPhone = document.createElement("div");
            customerPhone.textContent = order.customer?.phone || "";
            const customerEmail = document.createElement("div");
            customerEmail.textContent = order.customer?.email || "";
            customer.append(customerName, customerPhone, customerEmail);
            row.appendChild(customer);

            const itemCell = document.createElement("td");
            const itemList = document.createElement("ul");
            (Array.isArray(order.items) ? order.items : []).forEach(item => {
                const entry = document.createElement("li");
                entry.textContent = `${item.name || item.id} × ${Number(item.qty) || 0}`;
                itemList.appendChild(entry);
            });
            itemCell.appendChild(itemList);
            row.appendChild(itemCell);
            row.appendChild(cell(`₱${Number(order.total || 0).toFixed(2)}`));
            row.appendChild(cell(order.orderType));

            const paymentCell = document.createElement("td");
            const method = document.createElement("div");
            method.textContent = order.paymentMethod || order.payment || "—";
            const paymentStatus = document.createElement("div");
            paymentStatus.textContent = `Status: ${order.paymentStatus || "unpaid"}`;
            paymentCell.append(method, paymentStatus);
            if (order.referenceNumber) {
                const reference = document.createElement("div");
                reference.textContent = `Reference: ${order.referenceNumber}`;
                paymentCell.appendChild(reference);
            }
            if ((order.paymentMethod === "gcash" || order.payment === "gcash") &&
                order.paymentStatus !== "paid") {
                const verify = document.createElement("button");
                verify.type = "button";
                verify.className = "btn btn-sm verify-payment";
                verify.textContent = "Mark verified";
                paymentCell.appendChild(verify);
            }
            row.appendChild(paymentCell);

            const details = document.createElement("td");
            details.textContent = [
                order.orderType === "delivery" ? `Address: ${order.deliveryAddress || ""}` : "Pickup",
                `Notes: ${order.notes || "—"}`
            ].join("\n");
            row.appendChild(details);

            const statusCell = document.createElement("td");
            const badge = document.createElement("span");
            const status = statuses.includes(order.status) ? order.status : "pending";
            badge.className = `status-badge status-${status}`;
            badge.textContent = status;
            statusCell.appendChild(badge);
            row.appendChild(statusCell);

            const actions = document.createElement("td");
            const statusSelect = document.createElement("select");
            statusSelect.className = "status-select";
            statusSelect.setAttribute("aria-label", `Status for order ${order.orderNumber || order.id}`);
            statuses.forEach(value => {
                const option = new Option(value.charAt(0).toUpperCase() + value.slice(1), value);
                option.selected = status === value;
                statusSelect.add(option);
            });
            const update = document.createElement("button");
            update.type = "button";
            update.className = "btn btn-sm update-status";
            update.textContent = "Update";
            actions.append(statusSelect, update);
            row.appendChild(actions);
            ordersTableBody.appendChild(row);
        });
    }

    function renderProductionSummary() {
        productionSummary.replaceChildren();
        const date = productionDate.value;
        if (!date) {
            productionSummary.textContent = "Select a pickup date to view production quantities.";
            return;
        }
        const quantities = new Map();
        orders
            .filter(order => order.pickupDate === date && order.status !== "cancelled")
            .forEach(order => {
                (Array.isArray(order.items) ? order.items : []).forEach(item => {
                    quantities.set(item.id, (quantities.get(item.id) || 0) + (Number(item.qty) || 0));
                });
            });
        if (quantities.size === 0) {
            productionSummary.textContent = "No active orders for this date.";
            return;
        }
        const list = document.createElement("ul");
        quantities.forEach((quantity, productId) => {
            const product = products.find(item => item.id === productId);
            const entry = document.createElement("li");
            entry.textContent = `${product ? product.name : productId}: ${quantity}`;
            list.appendChild(entry);
        });
        productionSummary.appendChild(list);
    }

    async function renderProductSettings() {
        productSettings.replaceChildren();
        settingsMessage.textContent = "Loading product settings…";
        try {
            const saved = await orderService.getProductSettings();
            const grid = document.createElement("div");
            grid.className = "product-settings-grid";
            products.forEach(product => {
                const current = saved[product.id] || {};
                const card = document.createElement("div");
                card.className = "product-setting-card";
                const heading = document.createElement("h3");
                heading.textContent = product.name;

                const capacityLabel = document.createElement("label");
                capacityLabel.textContent = "Daily capacity ";
                const capacity = document.createElement("input");
                capacity.type = "number";
                capacity.min = "0";
                capacity.step = "1";
                capacity.value = String(Number.isInteger(current.dailyCapacity)
                    ? current.dailyCapacity
                    : product.dailyCapacity);
                capacityLabel.appendChild(capacity);

                const soldOutLabel = document.createElement("label");
                const soldOut = document.createElement("input");
                soldOut.type = "checkbox";
                soldOut.checked = current.soldOut === true;
                soldOutLabel.append(soldOut, document.createTextNode(" Sold out"));

                const save = document.createElement("button");
                save.type = "button";
                save.className = "btn btn-sm save-product-settings";
                save.textContent = "Save";
                save.dataset.productId = product.id;
                const message = document.createElement("p");
                message.className = "small-text";
                save.addEventListener("click", async () => {
                    const dailyCapacity = Number(capacity.value);
                    if (!Number.isInteger(dailyCapacity) || dailyCapacity < 0) {
                        message.textContent = "Enter a non-negative whole number.";
                        return;
                    }
                    try {
                        await orderService.saveProductSettings(product.id, {
                            dailyCapacity,
                            soldOut: soldOut.checked
                        });
                        message.textContent = "Settings saved.";
                    } catch (error) {
                        message.textContent = error.message || "Unable to save settings.";
                    }
                });
                card.append(heading, capacityLabel, soldOutLabel, save, message);
                grid.appendChild(card);
            });
            productSettings.appendChild(grid);
            settingsMessage.textContent = "";
        } catch (error) {
            settingsMessage.textContent = error.message || "Unable to load product settings.";
        }
    }

    async function showAdmin(user) {
        if (!user || user.uid !== window.CONFIG.admin.uid) {
            adminPanel.hidden = true;
            adminLogin.hidden = false;
            if (user) {
                adminLoginMsg.textContent = "This account is not the configured administrator.";
                await window.OrderService.initializeFirebase().auth.signOut();
            }
            return;
        }
        adminLogin.hidden = true;
        adminPanel.hidden = false;
        await Promise.all([loadOrders(), renderProductSettings()]);
    }

    adminLoginBtn.addEventListener("click", async () => {
        adminLoginMsg.textContent = "";
        adminLoginBtn.disabled = true;
        try {
            if (orderService.isDemoMode()) {
                throw new Error("Configure Firebase before using the admin panel.");
            }
            const { auth } = orderService.initializeFirebase();
            await auth.signInWithEmailAndPassword(adminEmail.value.trim(), adminPassword.value);
        } catch (error) {
            adminLoginMsg.textContent = error.message || "Unable to sign in.";
        } finally {
            adminLoginBtn.disabled = false;
        }
    });

    let auth;
    if (orderService.isDemoMode()) {
        adminLoginMsg.textContent = "Configure Firebase before using the admin panel.";
    } else {
        try {
            auth = orderService.initializeFirebase().auth;
            auth.onAuthStateChanged(user => {
                showAdmin(user).catch(error => {
                    adminLoginMsg.textContent = error.message || "Unable to load the admin panel.";
                });
            });
        } catch (error) {
            adminLoginMsg.textContent = error.message || "Unable to initialize Firebase Authentication.";
        }
    }

    signOutBtn.addEventListener("click", async () => {
        if (!auth) return;
        try {
            await auth.signOut();
        } catch (error) {
            ordersMessage.textContent = error.message || "Unable to sign out.";
        }
    });
    statusFilter.addEventListener("change", renderOrders);
    dateFilter.addEventListener("change", renderOrders);
    productionDate.addEventListener("change", renderProductionSummary);
    refreshOrders.addEventListener("click", loadOrders);

    ordersTableBody.addEventListener("click", async event => {
        const row = event.target.closest("tr[data-order-id]");
        if (!row) return;
        const orderId = row.dataset.orderId;
        if (event.target.matches(".update-status")) {
            const status = row.querySelector(".status-select").value;
            try {
                await orderService.updateOrderStatus(orderId, status);
                await loadOrders();
            } catch (error) {
                ordersMessage.textContent = error.message || "Unable to update order status.";
            }
        } else if (event.target.matches(".verify-payment")) {
            try {
                await orderService.verifyPayment(orderId);
                await loadOrders();
            } catch (error) {
                ordersMessage.textContent = error.message || "Unable to verify payment.";
            }
        }
    });
});
