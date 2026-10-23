document.addEventListener("DOMContentLoaded", () => {
    const message = document.querySelector("[data-admin-message]");
    const orderBody = document.querySelector("[data-orders-body]");
    const orderCount = document.querySelector("[data-orders-count]");
    const orderSearch = document.querySelector("[data-order-search]");
    const orderDate = document.querySelector("[data-order-date]");
    const orderStatusFilter = document.querySelector("[data-order-status-filter]");
    const customerBody = document.querySelector("[data-customers-body]");
    const customerCount = document.querySelector("[data-customers-count]");
    const customerSearch = document.querySelector("[data-customer-search]");
    const packageList = document.querySelector("[data-packages-list]");
    const packageCount = document.querySelector("[data-packages-count]");
    const orderDialog = document.querySelector("[data-order-dialog]");
    const orderDetail = document.querySelector("[data-order-detail]");
    const state = { orders: [], customersLoaded: false, packagesLoaded: false, customerTimer: null };
    const statuses = [
        { value: "pending", label: "Pending" },
        { value: "confirmed", label: "Confirmed" },
        { value: "ready", label: "Ready for pickup" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" }
    ];

    function setMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle("is-error", isError);
    }

    async function requestJson(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            credentials: "same-origin",
            cache: "no-store",
            headers: { Accept: "application/json", ...(options.headers || {}) }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "The request could not be completed.");
        return result;
    }

    function addTextCell(row, value, className = "") {
        const cell = document.createElement("td");
        cell.textContent = value == null ? "" : String(value);
        if (className) cell.className = className;
        row.appendChild(cell);
        return cell;
    }

    function statusLabel(value) {
        return statuses.find(status => status.value === value)?.label || value || "Pending";
    }

    function renderMetrics() {
        const todayParts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(new Date()).reduce((parts, item) => {
            parts[item.type] = item.value;
            return parts;
        }, {});
        const todayKey = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
        const totals = { today: 0, pending: 0, confirmed: 0, ready: 0, completed: 0 };
        state.orders.forEach(order => {
            if (order.pickupDate === todayKey) totals.today += 1;
            if (Object.hasOwn(totals, order.status)) totals[order.status] += 1;
        });
        Object.entries(totals).forEach(([key, value]) => {
            document.querySelector(`[data-metric="${key}"]`).textContent = String(value);
        });
    }

    function filteredOrders() {
        const query = orderSearch.value.trim().toLowerCase();
        const date = orderDate.value;
        const status = orderStatusFilter.value;
        return state.orders.filter(order => {
            if (date && order.pickupDate !== date) return false;
            if (status !== "all" && order.status !== status) return false;
            if (!query) return true;
            const itemText = (order.items || []).map(item => `${item.name} ${item.packageName}`).join(" ");
            return [
                order.orderNumber, order.customerName, order.phone, order.accountEmail, itemText
            ].some(value => String(value || "").toLowerCase().includes(query));
        });
    }

    function openOrderDetails(order) {
        orderDetail.replaceChildren();
        const fields = [
            ["Order number", order.orderNumber],
            ["Status", statusLabel(order.status)],
            ["Customer", order.customerName],
            ["Phone", order.phone],
            ["Account email", order.accountEmail || "Not linked"],
            ["Pickup date", order.pickupDate],
            ["Preferred pickup time", order.timeSlot],
            ["Items and quantities", (order.items || []).map(item =>
                `${item.name}${item.packageName ? ` · ${item.packageName}` : ""}${item.pieces ? ` · ${item.pieces} pcs` : ""} × ${item.qty}`
            ).join("\n") || "No item details"],
            ["Order placed", order.createdAt || ""]
        ];
        fields.forEach(([label, value]) => {
            const wrapper = document.createElement("div");
            wrapper.className = "detail-field";
            if (label === "Items and quantities") wrapper.classList.add("detail-field-wide");
            const heading = document.createElement("span");
            heading.className = "detail-label";
            heading.textContent = label;
            const text = document.createElement("div");
            text.className = "detail-value";
            text.textContent = value == null ? "" : String(value);
            wrapper.append(heading, text);
            orderDetail.appendChild(wrapper);
        });
        orderDialog.showModal();
    }

    function renderOrders() {
        const orders = filteredOrders();
        orderBody.replaceChildren();
        orderCount.textContent = `${orders.length} of ${state.orders.length} order${state.orders.length === 1 ? "" : "s"}`;
        if (!orders.length) {
            const row = document.createElement("tr");
            const cell = addTextCell(row, state.orders.length ? "No orders match these filters." : "No orders yet.");
            cell.colSpan = 8;
            orderBody.appendChild(row);
            return;
        }
        orders.forEach(order => {
            const row = document.createElement("tr");
            row.dataset.orderNumber = order.orderNumber;
            addTextCell(row, order.orderNumber);
            addTextCell(row, order.customerName);
            addTextCell(row, order.phone);
            addTextCell(row, (order.items || []).map(item =>
                `${item.name}${item.packageName ? ` (${item.packageName})` : ""}${item.pieces ? `, ${item.pieces} pcs` : ""} × ${item.qty}`
            ).join("\n"), "items-cell");
            addTextCell(row, `${order.pickupDate || ""}${order.timeSlot ? `\n${order.timeSlot}` : ""}`, "items-cell");
            addTextCell(row, order.accountEmail || "—", "account-email-cell");
            const statusCell = addTextCell(row, statusLabel(order.status));
            statusCell.innerHTML = "";
            const badge = document.createElement("span");
            badge.className = `status-pill status-${order.status || "pending"}`;
            badge.textContent = statusLabel(order.status);
            statusCell.appendChild(badge);
            const actions = document.createElement("td");
            const actionRow = document.createElement("div");
            actionRow.className = "row-actions";
            const select = document.createElement("select");
            select.setAttribute("aria-label", `Set status for order ${order.orderNumber}`);
            statuses.forEach(status => {
                const option = document.createElement("option");
                option.value = status.value;
                option.textContent = status.label;
                option.selected = status.value === order.status;
                select.appendChild(option);
            });
            const save = document.createElement("button");
            save.type = "button";
            save.className = "button button-primary button-small";
            save.dataset.updateStatus = "";
            save.textContent = "Save";
            const details = document.createElement("button");
            details.type = "button";
            details.className = "text-button";
            details.dataset.orderDetails = "";
            details.textContent = "Details";
            actionRow.append(select, save, details);
            actions.appendChild(actionRow);
            row.appendChild(actions);
            orderBody.appendChild(row);
        });
    }

    async function loadOrders() {
        setMessage("Loading orders…");
        try {
            const result = await requestJson("/api/admin/orders");
            state.orders = Array.isArray(result.orders) ? result.orders : [];
            renderOrders();
            renderMetrics();
            setMessage(`${state.orders.length} order${state.orders.length === 1 ? "" : "s"} loaded.`);
        } catch (error) {
            setMessage(error.message || "Could not load orders.", true);
            orderBody.replaceChildren();
            const row = document.createElement("tr");
            const cell = addTextCell(row, "Orders could not be loaded.");
            cell.colSpan = 8;
            orderBody.appendChild(row);
            orderCount.textContent = "Unavailable";
        }
    }

    function addCustomerRow(customer) {
        const row = document.createElement("tr");
        addTextCell(row, customer.name);
        addTextCell(row, customer.email);
        addTextCell(row, customer.joinedAt);
        addTextCell(row, customer.orderCount);
        addTextCell(row, customer.lastOrderDate || "—");
        customerBody.appendChild(row);
    }

    async function loadCustomers() {
        const search = customerSearch.value.trim();
        const query = search ? `?search=${encodeURIComponent(search)}` : "";
        customerCount.textContent = "Loading customers…";
        try {
            const result = await requestJson(`/api/admin/customers${query}`);
            customerBody.replaceChildren();
            const customers = Array.isArray(result.customers) ? result.customers : [];
            if (!customers.length) {
                const row = document.createElement("tr");
                const cell = addTextCell(row, search ? "No matching customers." : "No customer accounts yet.");
                cell.colSpan = 5;
                customerBody.appendChild(row);
            } else {
                customers.forEach(addCustomerRow);
            }
            customerCount.textContent = `${result.total} customer${result.total === 1 ? "" : "s"}`;
            state.customersLoaded = true;
        } catch (error) {
            customerCount.textContent = "Customer list unavailable.";
            customerBody.replaceChildren();
            const row = document.createElement("tr");
            const cell = addTextCell(row, error.message || "Could not load customers.");
            cell.colSpan = 5;
            customerBody.appendChild(row);
            setMessage(error.message || "Could not load customers.", true);
        }
    }

    async function loadPackages() {
        packageCount.textContent = "Loading packages…";
        try {
            const result = await requestJson("/api/admin/packages");
            const packages = Array.isArray(result.packages) ? result.packages : [];
            packageList.replaceChildren();
            if (!packages.length) {
                packageCount.textContent = "No packages configured.";
                return;
            }
            packages.forEach(packageInfo => {
                const form = document.createElement("form");
                form.className = "package-row";
                form.dataset.packageId = packageInfo.id;
                form.innerHTML = `
                    <span class="package-id">Package ID: ${escapeText(packageInfo.id)}</span>
                    <label>Package name<input name="name" maxlength="80" required value="${escapeText(packageInfo.name)}"></label>
                    <label>Pieces<input name="pieces" type="number" min="1" max="100000" step="1" required value="${Number(packageInfo.pieces)}"></label>
                    <label>Price (₱)<input name="price" type="number" min="0" max="10000000" step="1" required value="${Number(packageInfo.price)}"></label>
                    <button class="button button-primary" type="submit">Save</button>
                `;
                packageList.appendChild(form);
            });
            packageCount.textContent = `${packages.length} package${packages.length === 1 ? "" : "s"}`;
        } catch (error) {
            packageCount.textContent = "Package list unavailable.";
            setMessage(error.message || "Could not load packages.", true);
        }
    }

    function escapeText(value) {
        const span = document.createElement("span");
        span.textContent = value == null ? "" : String(value);
        return span.innerHTML;
    }

    async function loadOwnerName() {
        try {
            const result = await requestJson("/api/auth/session");
            document.querySelector("[data-owner-name]").textContent = result.user?.name || "Owner";
        } catch (error) {
            setMessage(error.message || "Could not load the owner account.", true);
        }
    }

    function showView(name) {
        document.querySelectorAll("[data-admin-view]").forEach(button => {
            const active = button.dataset.adminView === name;
            button.classList.toggle("is-active", active);
            if (active) button.setAttribute("aria-current", "page");
            else button.removeAttribute("aria-current");
        });
        document.querySelectorAll("[data-view-panel]").forEach(panel => {
            panel.hidden = panel.dataset.viewPanel !== name;
        });
        if (name === "orders" && !state.orders.length) loadOrders();
        if (name === "products" && !state.packagesLoaded) {
            state.packagesLoaded = true;
            loadPackages();
        }
        if (name === "customers") loadCustomers();
        document.querySelector(".admin-sidebar").classList.remove("is-open");
        document.querySelector("[data-sidebar-toggle]").setAttribute("aria-expanded", "false");
    }

    document.querySelectorAll("[data-admin-view]").forEach(button => {
        button.addEventListener("click", () => showView(button.dataset.adminView));
    });
    document.querySelectorAll("[data-open-view]").forEach(button => {
        button.addEventListener("click", () => showView(button.dataset.openView));
    });
    document.querySelector("[data-sidebar-toggle]").addEventListener("click", event => {
        const sidebar = document.querySelector(".admin-sidebar");
        const open = sidebar.classList.toggle("is-open");
        event.currentTarget.setAttribute("aria-expanded", String(open));
    });
    document.querySelector("[data-sidebar-close]").addEventListener("click", () => {
        document.querySelector(".admin-sidebar").classList.remove("is-open");
        document.querySelector("[data-sidebar-toggle]").setAttribute("aria-expanded", "false");
        document.querySelector("[data-sidebar-toggle]").focus();
    });
    document.addEventListener("keydown", event => {
        const sidebar = document.querySelector(".admin-sidebar");
        if (event.key !== "Escape" || !sidebar.classList.contains("is-open")) return;
        sidebar.classList.remove("is-open");
        const toggle = document.querySelector("[data-sidebar-toggle]");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
    });
    document.querySelectorAll("[data-refresh-orders]").forEach(button => button.addEventListener("click", loadOrders));
    document.querySelector("[data-refresh-customers]").addEventListener("click", loadCustomers);
    document.querySelector("[data-refresh-packages]").addEventListener("click", loadPackages);
    orderSearch.addEventListener("input", renderOrders);
    orderDate.addEventListener("change", renderOrders);
    orderStatusFilter.addEventListener("change", renderOrders);
    customerSearch.addEventListener("input", () => {
        window.clearTimeout(state.customerTimer);
        state.customerTimer = window.setTimeout(loadCustomers, 250);
    });
    document.querySelector("[data-close-order]").addEventListener("click", () => orderDialog.close());
    orderDialog.addEventListener("click", event => {
        if (event.target === orderDialog) orderDialog.close();
    });

    orderBody.addEventListener("click", async event => {
        const row = event.target.closest("tr[data-order-number]");
        if (!row) return;
        if (event.target.closest("[data-order-details]")) {
            const order = state.orders.find(item => item.orderNumber === row.dataset.orderNumber);
            if (order) openOrderDetails(order);
            return;
        }
        const save = event.target.closest("[data-update-status]");
        if (!save) return;
        const select = row.querySelector("select");
        save.disabled = true;
        try {
            await requestJson(`/api/admin/orders/${encodeURIComponent(row.dataset.orderNumber)}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: select.value })
            });
            setMessage(`Order ${row.dataset.orderNumber} updated.`);
            await loadOrders();
        } catch (error) {
            setMessage(error.message || "Could not update the order.", true);
            save.disabled = false;
        }
    });

    packageList.addEventListener("submit", async event => {
        const form = event.target.closest("form[data-package-id]");
        if (!form) return;
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const data = new FormData(form);
        const packageInfo = {
            id: form.dataset.packageId,
            name: String(data.get("name") || "").trim(),
            pieces: Number(data.get("pieces")),
            price: Number(data.get("price"))
        };
        if (!packageInfo.name || packageInfo.name.length > 80 ||
            !Number.isSafeInteger(packageInfo.pieces) || packageInfo.pieces < 1 ||
            !Number.isSafeInteger(packageInfo.price) || packageInfo.price < 0) {
            setMessage("Enter a package name, a positive whole-number piece count, and a valid non-negative price.", true);
            return;
        }
        button.disabled = true;
        try {
            await requestJson("/api/admin/packages", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ package: packageInfo })
            });
            setMessage(`${packageInfo.name} updated. The storefront will use the new package details after its next configuration refresh.`);
            await loadPackages();
        } catch (error) {
            setMessage(error.message || "Could not update this package.", true);
            button.disabled = false;
        }
    });

    document.querySelector("[data-admin-logout]").addEventListener("click", async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });
            if (!response.ok) throw new Error("Could not log out.");
            window.location.assign("/admin/login/");
        } catch (error) {
            setMessage(error.message || "Could not log out.", true);
            button.disabled = false;
        }
    });

    loadOwnerName();
    loadOrders();
});
