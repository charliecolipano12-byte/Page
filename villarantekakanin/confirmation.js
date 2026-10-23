document.addEventListener("DOMContentLoaded", async function() {
    const params = new URLSearchParams(window.location.search);
    const orderNumber = params.get("order") || "";
    const token = params.get("token") || "";
    const orderNumberElement = document.getElementById("orderNumber");
    const summary = document.getElementById("confirmationSummary");
    if (orderNumberElement) orderNumberElement.textContent = orderNumber || "Not found";
    if (!summary) return;

    try {
        const order = await window.OrderService.getOrderConfirmation(orderNumber, token);
        summary.replaceChildren();
        const heading = document.createElement("h2");
        heading.textContent = "Order summary";
        summary.appendChild(heading);

        const list = document.createElement("ul");
        (order.items || []).forEach(item => {
            const line = document.createElement("li");
            const label = [item.name, item.packageName, item.pieces ? `${item.pieces} pcs` : ""].filter(Boolean).join(" — ");
            line.textContent = `${label} × ${item.qty} — ₱${(Number(item.price || 0) * Number(item.qty || 0)).toFixed(2)}`;
            list.appendChild(line);
        });
        summary.appendChild(list);

        const total = document.createElement("p");
        const totalLabel = document.createElement("strong");
        totalLabel.textContent = "Total: ";
        total.append(totalLabel, document.createTextNode(`₱${Number(order.total || 0).toFixed(2)}`));
        summary.appendChild(total);
        addRow("Preferred pickup date", order.pickupDate || "");
        addRow("Preferred pickup time", order.timeSlot || "");
        addRow("Payment on pickup", order.paymentMethod || "");
        const paymentInfo = document.createElement("p");
        paymentInfo.textContent = "GCash: Mylen Villarante, 0946 435 1750. TODO: A GCash QR code was not provided.";
        summary.appendChild(paymentInfo);
        const pickupInfo = document.createElement("p");
        pickupInfo.textContent = "Pickup only at P-2 Cawayan, Calinan, Davao City. We will contact you to confirm your requested schedule.";
        summary.appendChild(pickupInfo);
    } catch (error) {
        summary.textContent = error.message || "Order details could not be loaded.";
    }

    function addRow(label, value) {
        const row = document.createElement("p");
        const title = document.createElement("strong");
        title.textContent = `${label}: `;
        row.append(title, document.createTextNode(String(value)));
        summary.appendChild(row);
    }
});
