// Menu page rendering with cart functionality
document.addEventListener("DOMContentLoaded", function() {
    const menuGrid = document.getElementById("menu-grid");
    const filterButtons = document.querySelectorAll(".filter-btn");
    const products = window.PRODUCTS || [];
    const cart = window.cart;
    const orderService = window.OrderService;
    let productSettings = {};

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function renderMenu(category) {
        if (!menuGrid) return;
        menuGrid.innerHTML = "";
        const filtered = category === "all" ? products : products.filter(p => p.category === category);
        filtered.forEach(p => {
            const isSoldOut = productSettings[p.id]?.soldOut === true;
            const capacity = productSettings[p.id]?.dailyCapacity ?? p.dailyCapacity;
            const card = document.createElement("article");
            card.className = "product-card";
            card.innerHTML = `
                <div class="product-image">
                    <picture>
                        <source srcset="${escapeHtml(p.image.replace(/\.jpg$/i, ".webp"))}" type="image/webp">
                        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
                    </picture>
                </div>
                <div class="product-content">
                    <h3 class="product-name">${escapeHtml(p.name)}</h3>
                    <p class="product-description">${escapeHtml(p.description)}</p>
                    <div class="product-meta">
                        <span class="product-price">₱${p.price.toFixed(2)}</span>
                        <span class="product-units">${escapeHtml(p.units)} · ${escapeHtml(p.size)}</span>
                    </div>
                    <p class="small-text"><strong>Allergens:</strong> ${p.allergens.length ? escapeHtml(p.allergens.join(", ")) : "None listed"}</p>
                    <p class="small-text"><strong>Shelf life:</strong> ${escapeHtml(p.shelfLife)}</p>
                    <p class="small-text"><strong>Storage:</strong> ${escapeHtml(p.storageNotes)}</p>
                    <p class="small-text">${isSoldOut ? "Sold out" : `Daily capacity: ${escapeHtml(String(capacity))}`}</p>
                    <div class="product-footer">
                        <button class="btn btn-sm btn-primary add-to-cart" type="button" data-id="${escapeHtml(p.id)}" ${isSoldOut ? "disabled" : ""}>${isSoldOut ? "Sold Out" : "Add to Order"}</button>
                    </div>
                </div>
            `;
            menuGrid.appendChild(card);
        });

        // Add event listeners
        menuGrid.querySelectorAll(".add-to-cart").forEach(btn => {
            btn.addEventListener("click", function() {
                const id = this.getAttribute("data-id");
                cart.add(id, 1);
                const original = this.textContent;
                this.textContent = "Added! ✓";
                setTimeout(() => { this.textContent = original; }, 1000);
            });
        });
    }

    filterButtons.forEach(btn => {
        btn.addEventListener("click", function() {
            filterButtons.forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            renderMenu(this.getAttribute("data-category"));
        });
    });

    if (!orderService) {
        renderMenu("all");
        return;
    }
    orderService.getProductSettings()
        .then(settings => {
            productSettings = settings;
            renderMenu("all");
        })
        .catch(error => {
            menuGrid.textContent = error.message || "Product availability could not be loaded.";
        });
});