// Villarante's Kakanin - Order Service (Firebase adapter)
const OrderService = {
    isDemoMode() {
        return Boolean(window.CONFIG &&
            window.CONFIG.firebase &&
            window.CONFIG.firebase.apiKey === "YOUR_API_KEY");
    },

    initializeFirebase() {
        if (this.isDemoMode()) return null;
        if (!window.firebase || !window.firebase.firestore || !window.firebase.functions || !window.firebase.auth) {
            throw new Error("Firebase SDKs did not load. Check your network and Firebase script tags.");
        }
        if (!window.CONFIG || !window.CONFIG.firebase || !window.CONFIG.firebase.projectId) {
            throw new Error("Firebase is not configured. Add your Firebase web config in config.js.");
        }
        const app = window.firebase.apps.length
            ? window.firebase.app()
            : window.firebase.initializeApp(window.CONFIG.firebase);
        return {
            app,
            db: app.firestore(),
            functions: app.functions(),
            auth: app.auth()
        };
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
        const { functions } = this.initializeFirebase();
        const result = await functions.httpsCallable("submitOrder")(order);
        return result.data;
    },

    async getOrderConfirmation(orderNumber, confirmationToken) {
        if (this.isDemoMode()) {
            const orders = JSON.parse(localStorage.getItem("vk_orders") || "[]");
            const order = orders.find(item => item.orderNumber === orderNumber);
            if (!order) throw new Error("Order was not found in this browser's demo storage.");
            return order;
        }
        const { functions } = this.initializeFirebase();
        const result = await functions.httpsCallable("getOrderConfirmation")({
            orderNumber,
            confirmationToken
        });
        return result.data;
    },

    async getOrders() {
        if (this.isDemoMode()) {
            return JSON.parse(localStorage.getItem("vk_orders") || "[]");
        }
        const { db } = this.initializeFirebase();
        const snapshot = await db.collection("orders").orderBy("createdAt", "desc").get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async updateOrderStatus(orderId, status) {
        if (this.isDemoMode()) {
            const orders = JSON.parse(localStorage.getItem("vk_orders") || "[]");
            const idx = orders.findIndex(o => o.id === orderId);
            if (idx >= 0) {
                orders[idx].status = status;
                localStorage.setItem("vk_orders", JSON.stringify(orders));
            }
            return { success: true };
        }
        const { functions } = this.initializeFirebase();
        const result = await functions.httpsCallable("updateOrderStatus")({ orderId, status });
        return result.data;
    },

    async getProductSettings() {
        if (this.isDemoMode()) {
            return JSON.parse(localStorage.getItem("vk_product_settings") || "{}");
        }
        const { db } = this.initializeFirebase();
        const snapshot = await db.collection("productSettings").get();
        return snapshot.docs.reduce((settings, doc) => {
            settings[doc.id] = doc.data();
            return settings;
        }, {});
    },

    async saveProductSettings(productId, settings) {
        const product = (window.PRODUCTS || []).find(item => item.id === productId);
        if (!product || !Number.isInteger(settings.dailyCapacity) || settings.dailyCapacity < 0) {
            throw new Error("Product capacity must be a non-negative whole number.");
        }
        if (this.isDemoMode()) {
            const allSettings = await this.getProductSettings();
            allSettings[productId] = {
                dailyCapacity: settings.dailyCapacity,
                soldOut: settings.soldOut === true
            };
            localStorage.setItem("vk_product_settings", JSON.stringify(allSettings));
            return;
        }
        const { db } = this.initializeFirebase();
        await db.collection("productSettings").doc(productId).set({
            dailyCapacity: settings.dailyCapacity,
            soldOut: settings.soldOut === true
        }, { merge: true });
    },

    async verifyPayment(orderId) {
        if (this.isDemoMode()) {
            const orders = JSON.parse(localStorage.getItem("vk_orders") || "[]");
            const order = orders.find(item => item.id === orderId);
            if (order) {
                order.paymentStatus = "paid";
                localStorage.setItem("vk_orders", JSON.stringify(orders));
            }
            return { success: true };
        }
        const { functions } = this.initializeFirebase();
        const result = await functions.httpsCallable("verifyPayment")({ orderId });
        return result.data;
    },

    async getRemainingCapacity(date, productId) {
        if (this.isDemoMode()) {
            const products = window.PRODUCTS || [];
            const product = products.find(p => p.id === productId);
            if (!product) throw new Error("Unknown product: " + productId);
            const orders = JSON.parse(localStorage.getItem("vk_orders") || "[]");
            const settings = JSON.parse(localStorage.getItem("vk_product_settings") || "{}");
            const used = orders
                .filter(order => order.pickupDate === date && order.status !== "cancelled")
                .reduce((sum, order) => sum + (order.items || [])
                    .filter(item => item.id === productId)
                    .reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0), 0);
            const capacity = Number.isInteger(settings[productId]?.dailyCapacity)
                ? settings[productId].dailyCapacity
                : product.dailyCapacity;
            return settings[productId]?.soldOut === true ? 0 : Math.max(0, capacity - used);
        }
        const { functions } = this.initializeFirebase();
        const result = await functions.httpsCallable("getAvailability")({ date, productId });
        return result.data.remaining;
    },

    generateDemoOrderNumber() {
        const now = new Date();
        const dateStr = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');
        const key = "vk_demo_counter_" + dateStr;
        const next = Number(localStorage.getItem(key) || "0") + 1;
        localStorage.setItem(key, String(next));
        return `VK-${dateStr}-${String(next).padStart(3, '0')}`;
    }
};

if (typeof window !== "undefined") {
    window.OrderService = OrderService;
}