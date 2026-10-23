// Ate My's Kakanin - Order Service adapter for Google Apps Script
const OrderService = {
    isDemoMode() {
        const url = window.CONFIG && window.CONFIG.backend && window.CONFIG.backend.appsScriptUrl;
        return !url || url === "YOUR_APPS_SCRIPT_WEB_APP_URL";
    },

    getBackendUrl(action, params = {}) {
        const base = (window.CONFIG && window.CONFIG.backend && window.CONFIG.backend.appsScriptUrl) || "";
        if (!base || base === "YOUR_APPS_SCRIPT_WEB_APP_URL") {
            return "";
        }
        const url = new URL(base);
        url.searchParams.set("action", action);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, String(value));
            }
        });
        return url.toString();
    },

    mergePublicConfig(serverConfig) {
        const baseProducts = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.slice() : [];
        const basePackages = Array.isArray(window.PACKAGES) ? window.PACKAGES.slice() : [];
        const map = {};
        (serverConfig.products || []).forEach(product => {
            map[product.id] = product;
        });

        const merged = baseProducts.map(product => ({
            ...product,
            ...(map[product.id] || {})
        }));
        const packageMap = {};
        (serverConfig.packages || []).forEach(packageInfo => {
            packageMap[packageInfo.id] = packageInfo;
        });
        const mergedPackages = basePackages.map(packageInfo => ({
            ...packageInfo,
            ...(packageMap[packageInfo.id] || {})
        }));

        if (typeof window !== "undefined") {
            window.PRODUCTS = merged;
            window.PACKAGES = mergedPackages;
        }

        if (serverConfig.order) {
            window.CONFIG = Object.assign({}, window.CONFIG || {}, {
                order: Object.assign({}, window.CONFIG && window.CONFIG.order, serverConfig.order),
                business: Object.assign({}, window.CONFIG && window.CONFIG.business, serverConfig.business || {})
            });
        }

        return merged;
    },

    async fetchJson(url, options = {}) {
        const controller = new AbortController();
        const timeoutMs = Number(options.timeoutMs || 20000);
        const timer = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            const contentType = response.headers.get("content-type") || "";
            let payload = null;
            if (contentType.includes("application/json")) {
                payload = await response.json();
            } else {
                payload = await response.text();
                try {
                    payload = JSON.parse(payload);
                } catch (error) {
                    payload = { success: false, message: String(payload || "Request failed.") };
                }
            }

            if (!response.ok || payload && payload.success === false) {
                throw new Error((payload && payload.message) || "The request could not be completed.");
            }
            return payload;
        } catch (error) {
            if (error.name === "AbortError") {
                throw new Error("The request timed out. Please try again.");
            }
            throw new Error(error.message || "The request could not be completed.");
        } finally {
            window.clearTimeout(timer);
        }
    },

    async getPublicConfig() {
        if (this.isDemoMode()) {
            const merged = Array.isArray(window.PRODUCTS) ? window.PRODUCTS.slice() : [];
            const fallback = {
                products: merged,
                packages: Array.isArray(window.PACKAGES) ? window.PACKAGES.slice() : [],
                order: window.CONFIG && window.CONFIG.order ? window.CONFIG.order : {},
                business: window.CONFIG && window.CONFIG.business ? window.CONFIG.business : {}
            };
            sessionStorage.setItem("vk_public_config", JSON.stringify(fallback));
            return fallback;
        }

        const url = this.getBackendUrl("config");
        const payload = await this.fetchJson(url, { method: "GET", timeoutMs: 20000 });
        const merged = this.mergePublicConfig(payload || {});
        sessionStorage.setItem("vk_public_config", JSON.stringify({
            products: merged,
            packages: window.PACKAGES || [],
            order: window.CONFIG && window.CONFIG.order ? window.CONFIG.order : {},
            business: window.CONFIG && window.CONFIG.business ? window.CONFIG.business : {}
        }));
        return { ...payload, products: merged, packages: window.PACKAGES || [] };
    },

    async submitOrder(order) {
        if (this.isDemoMode()) {
            const orders = JSON.parse(localStorage.getItem("vk_orders") || "[]");
            const orderNumber = this.generateDemoOrderNumber();
            orders.push({
                id: "local_" + Date.now(),
                orderNumber,
                ...order,
                status: "pending",
                createdAt: new Date().toISOString()
            });
            localStorage.setItem("vk_orders", JSON.stringify(orders));
            return { success: true, orderNumber, confirmationToken: "demo" };
        }

        const payload = JSON.stringify(order);
        const url = this.getBackendUrl("submitOrder");
        return this.fetchJson(url, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: payload,
            timeoutMs: 20000
        });
    },

    async getOrderConfirmation(orderNumber, confirmationToken) {
        if (this.isDemoMode()) {
            const orders = JSON.parse(localStorage.getItem("vk_orders") || "[]");
            const order = orders.find(item => item.orderNumber === orderNumber);
            if (!order) throw new Error("Order not found in demo storage.");
            return order;
        }

        const url = this.getBackendUrl("confirmation", { order: orderNumber, token: confirmationToken });
        const payload = await this.fetchJson(url, { method: "GET", timeoutMs: 20000 });
        return payload.order || payload;
    },

    generateDemoOrderNumber() {
        const now = new Date();
        const dateStr = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');
        const key = "vk_demo_counter_" + dateStr;
        const next = Number(localStorage.getItem(key) || "0") + 1;
        localStorage.setItem(key, String(next));
        return `AMK-${dateStr}-${String(next).padStart(3, '0')}`;
    }
};

if (typeof window !== "undefined") {
    window.OrderService = OrderService;
}