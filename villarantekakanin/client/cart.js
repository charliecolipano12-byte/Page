// Ate My's Kakanin - Cart Management
class Cart {
    constructor() {
        this.key = "vk_cart";
        this.items = this.load();
    }

    load() {
        try {
            const data = typeof localStorage !== "undefined" ? localStorage.getItem(this.key) : null;
            const items = data ? JSON.parse(data) : [];
            if (!Array.isArray(items)) throw new Error("Cart storage is not an array.");
            return items.map(item => {
                if (!item || typeof item.packageId !== "string") return null;
                let varieties;
                if (Array.isArray(item.varieties)) {
                    varieties = item.varieties.filter(v => typeof v === "string");
                } else if (typeof item.id === "string") {
                    varieties = [item.id];
                } else {
                    return null;
                }
                if (varieties.length < 1 || varieties.length > 3) return null;
                if (new Set(varieties).size !== varieties.length) return null;
                const qty = item.qty;
                if (!Number.isInteger(qty) || qty < 1) return null;
                return { packageId: item.packageId, varieties: [...varieties].sort(), qty };
            }).filter(Boolean);
        } catch (e) {
            console.error("Unable to load the saved cart:", e);
            return [];
        }
    }

    save() {
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(this.key, JSON.stringify(this.items));
            }
        } catch (e) {
            console.error("Unable to save the cart:", e);
        }
        try {
            this.updateBadge();
        } catch (e) {
            // ignore in non-browser environments
        }
    }

    mergeKey(packageId, varieties) {
        return `${packageId}|${[...varieties].sort().join(",")}`;
    }

    validate(packageId, varieties, qty) {
        const packages = typeof window !== "undefined" && window.PACKAGES ? window.PACKAGES : [];
        const products = typeof window !== "undefined" && window.PRODUCTS ? window.PRODUCTS : [];
        if (!packages.some(p => p.id === packageId)) throw new Error("Invalid package.");
        if (!Array.isArray(varieties) || varieties.length < 1 || varieties.length > 3) throw new Error("Choose 1 to 3 varieties.");
        if (new Set(varieties).size !== varieties.length) throw new Error("Duplicate variety.");
        if (!varieties.every(v => products.some(p => p.id === v))) throw new Error("Invalid variety.");
        if (!Number.isInteger(qty) || qty < 1) throw new Error("Invalid quantity.");
    }

    add(packageId, varieties, qty = 1) {
        const sorted = [...varieties].sort();
        this.validate(packageId, sorted, qty);
        const key = this.mergeKey(packageId, sorted);
        const existing = this.items.find(i => this.mergeKey(i.packageId, i.varieties) === key);
        if (existing) {
            existing.qty += qty;
        } else {
            this.items.push({ packageId, varieties: sorted, qty });
        }
        this.save();
    }

    update(packageId, varieties, qty) {
        const sorted = [...varieties].sort();
        if (!Number.isInteger(qty) || qty <= 0) {
            this.remove(packageId, sorted);
            return;
        }
        const key = this.mergeKey(packageId, sorted);
        const item = this.items.find(i => this.mergeKey(i.packageId, i.varieties) === key);
        if (!item) return;
        item.qty = qty;
        this.save();
    }

    remove(packageId, varieties) {
        const sorted = [...varieties].sort();
        const key = this.mergeKey(packageId, sorted);
        this.items = this.items.filter(i => this.mergeKey(i.packageId, i.varieties) !== key);
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
        const priceList = (typeof window !== "undefined" && window.PACKAGES) ? window.PACKAGES : [];
        return this.items.reduce((sum, i) => {
            const p = priceList.find(item => item.id === i.packageId);
            const price = Number(p && p.price);
            return sum + (Number.isFinite(price) ? price * i.qty : 0);
        }, 0);
    }

    updateBadge() {
        if (typeof document === "undefined") return;
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
    if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", () => {
            if (window.cart) {
                try { window.cart.updateBadge(); } catch (e) {}
            }
        });
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { Cart };
}
