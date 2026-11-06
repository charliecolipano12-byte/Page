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
    const productList = document.querySelector("[data-products-list]");
    const productCount = document.querySelector("[data-products-count]");
    const orderDialog = document.querySelector("[data-order-dialog]");
    const orderDetail = document.querySelector("[data-order-detail]");
    const needsActionList = document.querySelector("[data-needs-action]");
    const upcomingList = document.querySelector("[data-upcoming-pickups]");
    const state = { orders: [], customersLoaded: false, packagesLoaded: false, productsLoaded: false, customerTimer: null };
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
        let result;
        try { result = await response.json(); } catch (error) { throw new Error("The server could not be reached. Please refresh the page and try again."); }
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

    function peso(value) {
        const num = Number(value);
        return Number.isFinite(num) ? `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
    }

    function manilaTodayKey() {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
        }).formatToParts(new Date()).reduce((acc, item) => { acc[item.type] = item.value; return acc; }, {});
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    function addDaysKey(key, days) {
        const d = new Date(`${key}T00:00:00+08:00`);
        d.setUTCDate(d.getUTCDate() + days);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        // Use Asia/Manila date parts from the shifted time
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" })
            .formatToParts(d).reduce((acc, item) => { acc[item.type] = item.value; return acc; }, {});
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    function pickupKey(order) {
        const raw = String(order.pickupDate || "").slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
    }

    function renderMetrics() {
        const todayKey = manilaTodayKey();
        const totals = { today: 0, pending: 0, confirmed: 0, ready: 0, completed: 0 };
        state.orders.forEach(order => {
            if (pickupKey(order) === todayKey) totals.today += 1;
            if (Object.hasOwn(totals, order.status)) totals[order.status] += 1;
        });
        Object.entries(totals).forEach(([key, value]) => {
            const el = document.querySelector(`[data-metric="${key}"]`);
            if (el) el.textContent = String(value);
        });
        renderOverviewLists(todayKey);
    }

    function renderActionList(listEl, orders, emptyText) {
        if (!listEl) return;
        listEl.replaceChildren();
        if (!orders.length) {
            const li = document.createElement("li");
            li.className = "action-empty";
            li.textContent = emptyText;
            listEl.appendChild(li);
            return;
        }
        orders.forEach(order => {
            const li = document.createElement("li");
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "action-item";
            btn.dataset.orderJump = order.orderNumber;
            const main = document.createElement("span");
            main.className = "action-main";
            main.textContent = `${order.orderNumber} · ${order.customerName || "Customer"}`;
            const sub = document.createElement("span");
            sub.className = "action-sub";
            sub.textContent = `${pickupKey(order) || "No date"}${order.timeSlot ? ` ${order.timeSlot}` : ""} · ${statusLabel(order.status)}`;
            btn.append(main, sub);
            li.appendChild(btn);
            listEl.appendChild(li);
        });
    }

    function renderOverviewLists(todayKey) {
        const pending = state.orders
            .filter(o => o.status === "pending")
            .slice()
            .sort((a, b) => (pickupKey(a) || "9999").localeCompare(pickupKey(b) || "9999") || String(a.timeSlot || "").localeCompare(String(b.timeSlot || "")));
        renderActionList(needsActionList, pending.slice(0, 8), "No pending orders right now.");

        const endKey = addDaysKey(todayKey, 7);
        const upcoming = state.orders
            .filter(o => {
                const k = pickupKey(o);
                return k && k >= todayKey && k <= endKey && o.status !== "cancelled" && o.status !== "completed";
            })
            .slice()
            .sort((a, b) => k(a).localeCompare(k(b)) || String(a.timeSlot || "").localeCompare(String(b.timeSlot || "")));
        function k(o){ return pickupKey(o) || "9999"; }
        renderActionList(upcomingList, upcoming.slice(0, 10), "No pickups scheduled in the next 7 days.");
    }

    function filteredOrders() {
        const query = orderSearch.value.trim().toLowerCase();
        const date = orderDate.value;
        const status = orderStatusFilter.value;
        return state.orders.filter(order => {
            if (date === "__today__") { if (pickupKey(order) !== manilaTodayKey()) return false; }
            else if (date && order.pickupDate !== date) return false;
            if (status !== "all" && order.status !== status) return false;
            if (!query) return true;
            const itemText = (order.items || []).map(item => `${item.name} ${item.packageName}`).join(" ");
            return [
                order.orderNumber, order.customerName, order.phone, order.accountEmail, itemText
            ].some(value => String(value || "").toLowerCase().includes(query));
        });
    }

    function orderTotal(order) {
        if (Number.isFinite(Number(order.total)) && Number(order.total) > 0) return Number(order.total);
        if (Number.isFinite(Number(order.subtotal)) && Number(order.subtotal) > 0) return Number(order.subtotal);
        const items = Array.isArray(order.items) ? order.items : [];
        const sum = items.reduce((acc, item) => acc + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
        return sum || 0;
    }

    async function copyText(text, label) {
        try {
            await navigator.clipboard.writeText(text);
            setMessage(`${label} copied.`);
        } catch {
            setMessage(`Could not copy ${label.toLowerCase()}.`, true);
        }
    }

    function openOrderDetails(order) {
        orderDetail.replaceChildren();
        const itemsText = (order.items || []).map(item =>
            `${item.name}${item.packageName ? ` · ${item.packageName}` : ""}${item.pieces ? ` · ${item.pieces} pcs` : ""} × ${item.qty}`
        ).join("\n") || "No item details";

        function field(label, valueNode, wide) {
            const wrapper = document.createElement("div");
            wrapper.className = "detail-field" + (wide ? " detail-field-wide" : "");
            const heading = document.createElement("span");
            heading.className = "detail-label";
            heading.textContent = label;
            wrapper.append(heading, valueNode);
            orderDetail.appendChild(wrapper);
        }
        function textVal(v) {
            const d = document.createElement("div");
            d.className = "detail-value";
            d.textContent = v == null ? "" : String(v);
            return d;
        }

        field("Order number", textVal(order.orderNumber));
        field("Status", (() => {
            const wrap = document.createElement("div");
            wrap.className = "detail-value detail-status-control";
            const select = document.createElement("select");
            select.id = "dialog-status";
            select.setAttribute("aria-label", "Order status");
            statuses.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s.value; opt.textContent = s.label; opt.selected = s.value === order.status;
                select.appendChild(opt);
            });
            const save = document.createElement("button");
            save.type = "button"; save.className = "button button-primary button-small"; save.textContent = "Save status";
            save.addEventListener("click", async () => {
                save.disabled = true;
                try {
                    await requestJson(`/api/admin/orders/${encodeURIComponent(order.orderNumber)}/status`, {
                        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: select.value })
                    });
                    setMessage(`Order ${order.orderNumber} updated.`);
                    await loadOrders();
                    const refreshed = state.orders.find(o => o.orderNumber === order.orderNumber);
                    if (refreshed) openOrderDetails(refreshed); else orderDialog.close();
                } catch (e) {
                    setMessage(e.message || "Could not update the order.", true);
                    save.disabled = false;
                }
            });
            wrap.append(select, save);
            return wrap;
        })());
        field("Customer", textVal(order.customerName));
        field("Phone", (() => {
            const wrap = document.createElement("div");
            wrap.className = "detail-value";
            const phone = String(order.phone || "").trim();
            if (phone) {
                const link = document.createElement("a");
                link.href = `tel:${phone.replace(/[^\d+]/g, "")}`;
                link.textContent = phone;
                link.className = "phone-link";
                const copy = document.createElement("button");
                copy.type = "button"; copy.className = "button button-outline button-small"; copy.textContent = "Copy phone";
                copy.addEventListener("click", () => copyText(phone, "Phone number"));
                wrap.append(link, document.createTextNode(" "), copy);
            } else {
                wrap.textContent = "—";
            }
            return wrap;
        })());
        field("Account email", textVal(order.accountEmail || "Not linked"));
        field("Order total", textVal(peso(orderTotal(order))));
        field("Pickup date", textVal(order.pickupDate));
        field("Preferred pickup time", textVal(order.timeSlot));
        field("Items and quantities", textVal(itemsText), true);
        field("Order placed", textVal(order.createdAt || ""));
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
                option.value = status.value; option.textContent = status.label; option.selected = status.value === order.status;
                select.appendChild(option);
            });
            const save = document.createElement("button");
            save.type = "button"; save.className = "button button-primary button-small"; save.dataset.updateStatus = ""; save.textContent = "Save";
            const details = document.createElement("button");
            details.type = "button"; details.className = "text-button"; details.dataset.orderDetails = ""; details.textContent = "Details";
            actionRow.append(select, save, details);
            actions.appendChild(actionRow);
            row.appendChild(actions);
            const labels = ["Order", "Customer", "Phone", "Items", "Pickup", "Account email", "Status", "Actions"];
            row.querySelectorAll("td").forEach((cell, index) => { cell.dataset.label = labels[index] || ""; });
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

    async function showCustomerOrders(email, name) {
        setMessage(`Loading orders for ${name || email}…`);
        try {
            const result = await requestJson(`/api/admin/customers/${encodeURIComponent(email)}/orders`);
            const orders = Array.isArray(result.orders) ? result.orders : [];
            orderDetail.replaceChildren();
            const heading = document.createElement("div");
            heading.className = "detail-field detail-field-wide";
            const hl = document.createElement("span"); hl.className = "detail-label"; hl.textContent = "Customer";
            const hv = document.createElement("div"); hv.className = "detail-value"; hv.textContent = `${name || ""} (${email}) — ${orders.length} order${orders.length === 1 ? "" : "s"}`;
            heading.append(hl, hv); orderDetail.appendChild(heading);
            if (!orders.length) {
                const empty = document.createElement("p"); empty.className = "detail-field detail-field-wide"; empty.textContent = "No orders found for this account."; orderDetail.appendChild(empty);
            } else {
                orders.forEach(order => {
                    const wrap = document.createElement("div");
                    wrap.className = "detail-field detail-field-wide customer-order-card";
                    const title = document.createElement("div"); title.className = "detail-value";
                    title.textContent = `${order.orderNumber} · ${pickupKey(order)} ${order.timeSlot || ""} · ${statusLabel(order.status)} · ${peso(orderTotal(order))}`;
                    const items = document.createElement("div"); items.className = "detail-label";
                    items.textContent = (order.items || []).map(i => `${i.name}${i.packageName ? ` (${i.packageName})` : ""} × ${i.qty}`).join(", ") || "No item details";
                    const btn = document.createElement("button"); btn.type = "button"; btn.className = "text-button"; btn.textContent = "Open order details";
                    btn.addEventListener("click", () => openOrderDetails(order));
                    wrap.append(title, items, btn); orderDetail.appendChild(wrap);
                });
            }
            document.getElementById("order-detail-title").textContent = "Customer orders";
            orderDialog.showModal();
            setMessage("");
        } catch (error) {
            setMessage(error.message || "Could not load customer orders.", true);
        }
    }

    function addCustomerRow(customer) {
        const row = document.createElement("tr");
        row.className = "customer-row";
        row.tabIndex = 0;
        row.dataset.customerEmail = customer.email;
        row.dataset.customerName = customer.name || "";
        addTextCell(row, customer.name);
        addTextCell(row, customer.email);
        addTextCell(row, customer.joinedAt);
        addTextCell(row, customer.orderCount);
        addTextCell(row, customer.lastOrderDate || "—");
        row.querySelectorAll("td").forEach((cell, i) => { cell.dataset.label = ["Name","Email","Date joined","Orders","Last order date"][i] || ""; });
        const open = () => showCustomerOrders(customer.email, customer.name);
        row.addEventListener("click", open);
        row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
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
            customerCount.textContent = `${result.total} customer${result.total === 1 ? "" : "s"}. Click a row to view orders.`;
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
            if (!packages.length) { packageCount.textContent = "No packages configured."; return; }
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

    async function loadProducts() {
        if (!productList || !productCount) return;
        productCount.textContent = "Loading products…";
        try {
            const result = await requestJson("/api/admin/products");
            const products = Array.isArray(result.products) ? result.products : [];
            productList.replaceChildren();
            if (!products.length) { productCount.textContent = "No products found."; return; }
            products.forEach(product => {
                const form = document.createElement("form");
                form.className = "product-editor-row";
                form.dataset.productId = product.id;
                form.innerHTML = `
                    <div class="product-editor-head">
                        <span class="package-id">ID (fixed): ${escapeText(product.id)}</span>
                        <span class="product-status-hint" data-product-status>${product.available ? "Shown on menu" : "Hidden from menu"}</span>
                    </div>
                    <div class="product-editor-grid">
                        <label>Name<input name="name" maxlength="120" required value="${escapeText(product.name || "")}"></label>
                        <label>Display order<input name="displayOrder" type="number" step="1" min="-999999" max="999999" required value="${Number.isFinite(Number(product.displayOrder)) ? Number(product.displayOrder) : 9999}"></label>
                        <label class="product-field-wide">Photo path (path only)<input name="image" maxlength="200" placeholder="images/puto.jpg" value="${escapeText(product.image || "")}"></label>
                        <label class="product-field-wide">Description<textarea name="description" rows="2" maxlength="2000">${escapeText(product.description || "")}</textarea></label>
                        <label class="product-field-wide">Allergen / ingredient note<textarea name="allergens" rows="2" maxlength="2000">${escapeText(product.allergens || "")}</textarea></label>
                        <div class="product-toggles product-field-wide">
                            <label class="toggle-label"><input name="available" type="checkbox" ${product.available ? "checked" : ""}> Available on menu</label>
                            <label class="toggle-label"><input name="seasonal" type="checkbox" ${product.seasonal ? "checked" : ""}> Seasonal</label>
                        </div>
                    </div>
                    <div class="product-editor-actions"><button class="button button-primary" type="submit">Save product</button></div>
                `;
                const avail = form.querySelector('input[name="available"]');
                const hint = form.querySelector("[data-product-status]");
                avail?.addEventListener("change", () => { if (hint) hint.textContent = avail.checked ? "Shown on menu" : "Hidden from menu"; });
                productList.appendChild(form);
            });
            productCount.textContent = `${products.length} product${products.length === 1 ? "" : "s"}. IDs are fixed.`;
            state.productsLoaded = true;
        } catch (error) {
            productCount.textContent = "Product list unavailable.";
            setMessage(error.message || "Could not load products.", true);
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
        setMessage("");
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
        if (name === "products") {
            if (!state.packagesLoaded) { state.packagesLoaded = true; loadPackages(); }
            if (!state.productsLoaded) { state.productsLoaded = true; loadProducts(); }
        }
        if (name === "customers") loadCustomers();
        document.querySelector(".admin-sidebar").classList.remove("is-open");
        document.querySelector("[data-sidebar-toggle]").setAttribute("aria-expanded", "false");
    }

    function openOrdersFiltered({ status, today } = {}) {
        showView("orders");
        if (status) orderStatusFilter.value = status; else orderStatusFilter.value = "all";
        if (today) { orderDate.value = manilaTodayKey(); } else { orderDate.value = ""; }
        renderOrders();
    }

    document.querySelectorAll("[data-admin-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.adminView)));
    document.querySelectorAll("[data-open-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.openView)));
    document.querySelectorAll("[data-filter-status]").forEach(button => {
        button.addEventListener("click", () => {
            const key = button.dataset.filterStatus;
            if (key === "today") openOrdersFiltered({ today: true });
            else openOrdersFiltered({ status: key });
        });
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
    document.querySelectorAll("[data-refresh-packages]").forEach(button => button.addEventListener("click", loadPackages));
    document.querySelectorAll("[data-refresh-products]").forEach(button => button.addEventListener("click", loadProducts));
    orderSearch.addEventListener("input", renderOrders);
    orderDate.addEventListener("change", renderOrders);
    orderStatusFilter.addEventListener("change", renderOrders);
    customerSearch.addEventListener("input", () => {
        window.clearTimeout(state.customerTimer);
        state.customerTimer = window.setTimeout(loadCustomers, 250);
    });
    document.querySelector("[data-close-order]").addEventListener("click", () => {
        document.getElementById("order-detail-title").textContent = "Order details";
        orderDialog.close();
    });
    orderDialog.addEventListener("click", event => { if (event.target === orderDialog) orderDialog.close(); });

    document.addEventListener("click", event => {
        const jump = event.target.closest("[data-order-jump]");
        if (!jump) return;
        const order = state.orders.find(o => o.orderNumber === jump.dataset.orderJump);
        if (order) openOrderDetails(order);
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
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: select.value })
            });
            setMessage(`Order ${row.dataset.orderNumber} updated.`);
            await loadOrders();
        } catch (error) {
            setMessage(error.message || "Could not update the order.", true);
            save.disabled = false;
        }
    });

    if (productList) productList.addEventListener("submit", async event => {
        const form = event.target.closest("form[data-product-id]");
        if (!form) return;
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const data = new FormData(form);
        const image = String(data.get("image") || "").trim().replace(/\\/g, "/");
        if (image && (!/^images\/[a-zA-Z0-9._/-]+$/.test(image) || image.includes("..") || image.length > 200)) {
            setMessage("Photo must be a path like images/puto.jpg, or left empty.", true);
            return;
        }
        const product = {
            id: form.dataset.productId,
            name: String(data.get("name") || "").trim(),
            description: String(data.get("description") || "").trim(),
            allergens: String(data.get("allergens") || "").trim(),
            image,
            available: data.get("available") === "on",
            seasonal: data.get("seasonal") === "on",
            displayOrder: Number(data.get("displayOrder"))
        };
        if (!product.name || product.name.length > 120) { setMessage("Enter a valid product name.", true); return; }
        if (!Number.isSafeInteger(product.displayOrder)) { setMessage("Display order must be a whole number.", true); return; }
        button.disabled = true;
        try {
            await requestJson("/api/admin/products", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product }) });
            setMessage(`${product.name} saved.`);
            state.productsLoaded = false;
            await loadProducts();
        } catch (error) {
            setMessage(error.message || "Could not update this product.", true);
            button.disabled = false;
        }
    });

    packageList.addEventListener("submit", async event => {
        const form = event.target.closest("form[data-package-id]");
        if (!form) return;
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const data = new FormData(form);
        const packageInfo = { id: form.dataset.packageId, name: String(data.get("name") || "").trim(), pieces: Number(data.get("pieces")), price: Number(data.get("price")) };
        if (!packageInfo.name || packageInfo.name.length > 80 || !Number.isSafeInteger(packageInfo.pieces) || packageInfo.pieces < 1 || !Number.isSafeInteger(packageInfo.price) || packageInfo.price < 0) {
            setMessage("Enter a package name, a positive whole-number piece count, and a valid non-negative price.", true);
            return;
        }
        button.disabled = true;
        try {
            await requestJson("/api/admin/packages", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ package: packageInfo }) });
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
            const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" } });
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
