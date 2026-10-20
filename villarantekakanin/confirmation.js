document.addEventListener("DOMContentLoaded", async function() {
    const params = new URLSearchParams(window.location.search);
    const orderNumber = params.get("order") || "";
    const confirmationToken = params.get("token") || "";
    const orderNumberElement = document.getElementById("orderNumber");
    const summary = document.getElementById("confirmationSummary");
    if (orderNumberElement) orderNumberElement.textContent = orderNumber || "Not found";

    function addRow(label, value) {
        const row = document.createElement("p");
        const title = document.createElement("strong");
        title.textContent = `${label}: `;
        row.append(title, document.createTextNode(String(value)));
        summary.appendChild(row);
    }

    try {
        const order = await window.OrderService.getOrderConfirmation(orderNumber, confirmationToken);
        summary.replaceChildren();
        const heading = document.createElement("h2");
        heading.textContent = "Order summary";
        summary.appendChild(heading);

        const list = document.createElement("ul");
        (order.items || []).forEach(item => {
            const line = document.createElement("li");
            line.textContent = `${item.name} × ${item.qty} — ₱${(item.price * item.qty).toFixed(2)}`;
            list.appendChild(line);
        });
        summary.appendChild(list);
        addRow("Total", `₱${Number(order.total || 0).toFixed(2)}`);
        addRow(order.orderType === "delivery" ? "Delivery date" : "Pickup date", order.pickupDate);
        addRow("Time", order.timeSlot);
        if (order.orderType === "delivery") addRow("Delivery address", order.deliveryAddress || "");
        if (order.notes) addRow("Notes", order.notes);
        addRow("Payment method", order.paymentMethod || order.payment);
        addRow("Payment status", order.paymentStatus || "unpaid");
        if (order.paymentMethod === "gcash" || order.payment === "gcash") {
            addRow("GCash reference", order.referenceNumber || "Pending");
            const gcash = window.CONFIG.business.gcash;
            const instruction = document.createElement("p");
            instruction.textContent = `Send payment to ${gcash.name} (${gcash.number}). Keep your reference number; payment will be verified by the shop.`;
            summary.appendChild(instruction);
            if (gcash.qrImage) {
                const qr = document.createElement("img");
                qr.src = gcash.qrImage;
                qr.alt = "GCash payment QR code";
                summary.appendChild(qr);
            }
        } else {
            addRow("Payment instructions", "Please prepare cash at pickup or delivery.");
        }
    } catch (error) {
        summary.textContent = error.message || "Order details could not be loaded.";
    }
});
