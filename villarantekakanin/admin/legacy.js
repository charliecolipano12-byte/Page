document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("orders-table-body");
    const statusFilter = document.getElementById("status-filter");
    const message = document.getElementById("admin-message");
    const refreshButton = document.querySelector("[data-refresh-orders]");
    const logoutButton = document.querySelector("[data-admin-logout]");
    const statuses = [
        { value: "pending", label: "Pending" },
        { value: "confirmed", label: "Confirmed" },
        { value: "ready", label: "Ready for pickup" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" }
    ];
    let orders = [];

    function addCell(row, value) {
        const cell = document.createElement("td");
        cell.textContent = value == null ? "" : String(value);
        row.appendChild(cell);
        return cell;
    }

    function renderOrders() {
        tableBody.replaceChildren();
        const filter = statusFilter.value;
        const visibleOrders = filter === "all"
            ? orders
            : orders.filter(order => order.status === filter);

        if (!visibleOrders.length) {
            const row = document.createElement("tr");
            const cell = addCell(row, "No orders found.");
            cell.colSpan = 8;
            tableBody.appendChild(row);
            return;
        }

        visibleOrders.forEach(order => {
            const row = document.createElement("tr");
            row.dataset.orderNumber = order.orderNumber;
            addCell(row, order.orderNumber);
            addCell(row, order.customerName);
            addCell(row, order.phone);
            addCell(row, (order.items || []).map(item => {
                const packageName = item.packageName ? ` (${item.packageName})` : "";
                const pieces = item.pieces ? `, ${item.pieces} pcs` : "";
                return `${item.name}${packageName}${pieces} × ${item.qty}`;
            }).join("\n"));
            addCell(row, order.pickupDate);
            addCell(row, order.timeSlot);
            const statusCell = addCell(
                row,
                statuses.find(status => status.value === order.status)?.label || order.status
            );
            statusCell.classList.add("status-badge", `status-${order.status}`);

            const actionCell = document.createElement("td");
            const select = document.createElement("select");
            select.className = "status-select";
            select.setAttribute("aria-label", `New status for order ${order.orderNumber}`);
            statuses.forEach(status => {
                const option = document.createElement("option");
                option.value = status.value;
                option.textContent = status.label;
                option.selected = status.value === order.status;
                select.appendChild(option);
            });
            const update = document.createElement("button");
            update.className = "btn btn-sm btn-primary";
            update.type = "button";
            update.dataset.updateStatus = "";
            update.textContent = "Save";
            actionCell.append(select, update);
            row.appendChild(actionCell);
            tableBody.appendChild(row);
        });
    }

    async function loadOrders() {
        refreshButton.disabled = true;
        message.textContent = "Loading orders…";
        try {
            const response = await fetch("/api/admin/orders", {
                credentials: "same-origin",
                headers: { Accept: "application/json" },
                cache: "no-store"
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Could not load orders.");
            orders = Array.isArray(result.orders) ? result.orders : [];
            renderOrders();
            message.textContent = `${orders.length} order${orders.length === 1 ? "" : "s"} loaded.`;
        } catch (error) {
            message.textContent = error.message || "Could not load orders.";
            tableBody.replaceChildren();
        } finally {
            refreshButton.disabled = false;
        }
    }

    statusFilter.addEventListener("change", renderOrders);
    refreshButton.addEventListener("click", loadOrders);
    tableBody.addEventListener("click", async event => {
        const button = event.target.closest("[data-update-status]");
        if (!button) return;
        const row = button.closest("tr[data-order-number]");
        const select = row && row.querySelector("select");
        if (!row || !select) return;

        button.disabled = true;
        message.textContent = `Updating ${row.dataset.orderNumber}…`;
        try {
            const response = await fetch(
                `/api/admin/orders/${encodeURIComponent(row.dataset.orderNumber)}/status`,
                {
                    method: "PUT",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify({ status: select.value })
                }
            );
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Could not update the order.");
            message.textContent = `Order ${row.dataset.orderNumber} updated.`;
            await loadOrders();
        } catch (error) {
            message.textContent = error.message || "Could not update the order.";
            button.disabled = false;
        }
    });
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            });
            if (!response.ok) throw new Error("Could not log out.");
            window.location.assign("/admin/login/");
        } catch (error) {
            message.textContent = error.message || "Could not log out.";
            logoutButton.disabled = false;
        }
    });

    loadOrders();
});
