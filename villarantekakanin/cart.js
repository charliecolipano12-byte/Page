// Villarante's Kakanin - Cart Management
class Cart {
    constructor() {
        this.key = "vk_cart";
        this.items = this.load();
    }

    load() {
        try {
            const data = localStorage.getItem(this.key);
            const items = data ? JSON.parse(data) : [];
            if (!Array.isArray(items)) throw new Error("Cart storage is not an array.");
            return items.filter(item =>
                item && typeof item.id === "string" &&
                Number.isInteger(item.qty) && item.qty > 0
            );
        } catch (e) {
            console.error("Unable to load the saved cart:", e);
            return [];
        }
    }

    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.items));
        } catch (e) {
            console.error("Unable to save the cart:", e);
        }
        this.updateBadge();
    }

    add(productId, qty = 1) {
        if (!(window.PRODUCTS || []).some(product => product.id === productId) ||
            !Number.isInteger(qty) || qty < 1) {
            throw new Error("A valid product and positive whole-number quantity are required.");
        }
        const existing = this.items.find(i => i.id === productId);
        if (existing) {
            existing.qty += qty;
        } else {
            this.items.push({ id: productId, qty: Math.max(1, qty) });
        }
        this.save();
    }

    update(productId, qty) {
        const item = this.items.find(i => i.id === productId);
        if (!item) return;
        if (!Number.isInteger(qty) || qty <= 0) {
            this.remove(productId);
            return;
        }
        item.qty = qty;
        this.save();
    }

    remove(productId) {
        this.items = this.items.filter(i => i.id !== productId);
        this.save();
    }

    clear() {
        this.items = [];
        this.save();
    }

    count() {
        return this.items.reduce((sum, i) => sum + i.qty, 0);
    }

    subtotal() {
        const products = window.PRODUCTS || [];
        return this.items.reduce((sum, i) => {
            const p = products.find(prod => prod.id === i.id);
            return sum + (p ? p.price * i.qty : 0);
        }, 0);
    }

    updateBadge() {
        const badge = document.getElementById("cart-count");
        if (badge) {
            badge.textContent = this.count().toString();
            badge.style.display = this.count() > 0 ? "flex" : "none";
        }
    }
}

if (typeof window !== "undefined") {
    window.Cart = Cart;
    window.cart = new Cart();
    document.addEventListener("DOMContentLoaded", () => {
        window.cart.updateBadge();
    });
}