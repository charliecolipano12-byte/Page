const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();
const ADMIN_UID = process.env.ADMIN_UID || "REPLACE_WITH_ADMIN_UID";
const PRODUCTS = {
  bibingka: { name: "Bibingka", price: 45 },
  puto: { name: "Puto", price: 25 },
  suman: { name: "Suman", price: 30 },
  kutsinta: { name: "Kutsinta", price: 35 },
  palitaw: { name: "Palitaw", price: 20 },
  biko: { name: "Biko", price: 40 }
};
const ORDER_POLICY = {
  leadTimeDays: 1,
  pickupOnly: true,
  deliveryFee: 50,
  slotDurationMinutes: 60,
  closedDays: [],
  openingHours: {
    monday: { open: "06:00", close: "19:00" },
    tuesday: { open: "06:00", close: "19:00" },
    wednesday: { open: "06:00", close: "19:00" },
    thursday: { open: "06:00", close: "19:00" },
    friday: { open: "06:00", close: "19:00" },
    saturday: { open: "06:00", close: "17:00" },
    sunday: { open: "07:00", close: "15:00" }
  }
};
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DEFAULT_CAPACITY = {
  bibingka: 50,
  puto: 100,
  suman: 80,
  kutsinta: 80,
  palitaw: 60,
  biko: 60
};
const VALID_STATUSES = ["pending", "confirmed", "ready", "completed", "cancelled"];

function requireAdmin(request) {
  if (!request.auth || request.auth.uid !== ADMIN_UID) {
    throw new HttpsError("permission-denied", "Admin authentication is required.");
  }
}

function validateDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError("invalid-argument", "A valid pickup date is required.");
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpsError("invalid-argument", "A valid pickup date is required.");
  }
}

function localDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localMinutes(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function timeMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
}

function formatTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function validateSchedule(date, slot, orderType, deliveryAddress) {
  const now = new Date();
  const today = localDateKey(now);
  const minimum = new Date(`${today}T00:00:00Z`);
  minimum.setUTCDate(minimum.getUTCDate() + ORDER_POLICY.leadTimeDays);
  const minimumDate = minimum.toISOString().slice(0, 10);
  if (date < minimumDate) {
    throw new HttpsError("failed-precondition", "The selected date does not meet the minimum lead time.");
  }
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  if (ORDER_POLICY.closedDays.map(day => day.toLowerCase()).includes(weekday) ||
      !ORDER_POLICY.openingHours[weekday]) {
    throw new HttpsError("failed-precondition", "The business is closed on the selected date.");
  }
  if (ORDER_POLICY.pickupOnly && orderType === "delivery") {
    throw new HttpsError("failed-precondition", "Delivery is not currently available.");
  }
  if (orderType === "delivery" && !cleanText(deliveryAddress, 500)) {
    throw new HttpsError("invalid-argument", "A delivery address is required.");
  }
  const slotMatch = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(slot || "");
  const start = slotMatch ? timeMinutes(slotMatch[1]) : -1;
  const end = slotMatch ? timeMinutes(slotMatch[2]) : -1;
  const hours = ORDER_POLICY.openingHours[weekday];
  const opening = timeMinutes(hours.open);
  const closing = timeMinutes(hours.close);
  if (start < opening || end > closing ||
      end - start !== ORDER_POLICY.slotDurationMinutes ||
      start % ORDER_POLICY.slotDurationMinutes !== opening % ORDER_POLICY.slotDurationMinutes) {
    throw new HttpsError("failed-precondition", "The selected time is outside opening hours.");
  }
  if (date === today && start <= localMinutes(now) + ORDER_POLICY.leadTimeDays * 1440) {
    throw new HttpsError("failed-precondition", "The selected time has passed or is within the required lead time.");
  }
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function normalizedItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "At least one item is required.");
  }
  const quantities = new Map();
  for (const item of items) {
    if (!item || !Object.prototype.hasOwnProperty.call(PRODUCTS, item.id) ||
        !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100) {
      throw new HttpsError("invalid-argument", "An order item is invalid.");
    }
    quantities.set(item.id, (quantities.get(item.id) || 0) + item.qty);
  }
  if (Array.from(quantities.values()).some(quantity => quantity > 100)) {
    throw new HttpsError("invalid-argument", "A product quantity cannot exceed 100.");
  }
  return Array.from(quantities, ([id, qty]) => ({
    id,
    name: PRODUCTS[id].name,
    price: PRODUCTS[id].price,
    qty
  }));
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function dayKey(date) {
  return date.replace(/-/g, "");
}

exports.submitOrder = onCall(async (request) => {
  const input = request.data || {};
  const customer = input.customer || {};
  const name = cleanText(customer.name, 120);
  const phone = cleanText(customer.phone, 30);
  const email = cleanText(customer.email, 254);
  const pickupDate = input.pickupDate;
  validateDate(pickupDate);
  if (!name || !phone) {
    throw new HttpsError("invalid-argument", "Customer name and phone are required.");
  }
  if (input.orderType !== "pickup" && input.orderType !== "delivery") {
    throw new HttpsError("invalid-argument", "Order type is invalid.");
  }
  const paymentMethod = input.paymentMethod === "gcash" ? "gcash" : input.paymentMethod === "cash" ? "cash" : null;
  if (!paymentMethod) {
    throw new HttpsError("invalid-argument", "Payment method is invalid.");
  }
  const referenceNumber = paymentMethod === "gcash" ? cleanText(input.referenceNumber, 13) : "";
  if (paymentMethod === "gcash" && !/^\d{10,13}$/.test(referenceNumber)) {
    throw new HttpsError("invalid-argument", "A valid GCash reference number is required.");
  }
  if (typeof input.timeSlot !== "string" || !input.timeSlot.trim()) {
    throw new HttpsError("invalid-argument", "A time slot is required.");
  }
  const timeSlot = validateSchedule(
    pickupDate,
    input.timeSlot,
    input.orderType,
    input.deliveryAddress
  );
  const items = normalizedItems(input.items);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const deliveryFee = input.orderType === "delivery" ? ORDER_POLICY.deliveryFee : 0;
  const total = subtotal + deliveryFee;
  const day = dayKey(localDateKey(new Date()));
  const orderRef = db.collection("orders").doc();
  const confirmationToken = crypto.randomBytes(32).toString("hex");
  const confirmationTokenHash = crypto.createHash("sha256").update(confirmationToken).digest("hex");
  const orderCounterRef = db.collection("orderCounters").doc(day);
  const settingsRefs = items.map(item => db.collection("productSettings").doc(item.id));
  const capacityRefs = items.map(item =>
    db.collection("capacityCounters").doc(`${pickupDate}_${item.id}`));
  const ordersForDate = db.collection("orders").where("pickupDate", "==", pickupDate);

  const orderNumber = await db.runTransaction(async transaction => {
    const [counterSnapshot, ...snapshots] = await Promise.all([
      transaction.get(orderCounterRef),
      ...settingsRefs.map(ref => transaction.get(ref)),
      ...capacityRefs.map(ref => transaction.get(ref))
    ]);
    const settingsSnapshots = snapshots.slice(0, items.length);
    const capacitySnapshots = snapshots.slice(items.length);
    const missingCapacity = capacitySnapshots.some(snapshot => !snapshot.exists);
    const existingOrders = missingCapacity ? await transaction.get(ordersForDate) : null;
    let nextOrderNumber = 1;
    if (counterSnapshot.exists) {
      nextOrderNumber = Number(counterSnapshot.get("lastNumber") || 0) + 1;
    }
    if (nextOrderNumber > 999) {
      throw new HttpsError("resource-exhausted", "Today's order number limit has been reached.");
    }

    const countExisting = productId => (existingOrders ? existingOrders.docs : [])
      .filter(doc => doc.get("status") !== "cancelled")
      .reduce((sum, doc) => sum + (doc.get("items") || [])
        .filter(item => item.id === productId)
        .reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0), 0);
    const reservations = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const setting = settingsSnapshots[index].exists ? settingsSnapshots[index].data() : {};
      const capacity = Number.isInteger(setting.dailyCapacity)
        ? setting.dailyCapacity
        : DEFAULT_CAPACITY[item.id];
      const soldOut = setting.soldOut === true;
      const current = capacitySnapshots[index].exists
        ? Number(capacitySnapshots[index].get("quantity") || 0)
        : countExisting(item.id);
      if (soldOut || current + item.qty > capacity) {
        throw new HttpsError("failed-precondition", `${item.name} does not have enough capacity for that date.`);
      }
      reservations.push({ ref: capacityRefs[index], quantity: current + item.qty });
    }

    transaction.set(orderCounterRef, { lastNumber: nextOrderNumber });
    reservations.forEach(reservation => {
      transaction.set(reservation.ref, {
        date: pickupDate,
        quantity: reservation.quantity
      });
    });
    transaction.set(orderRef, {
      orderNumber: `VK-${day}-${String(nextOrderNumber).padStart(3, "0")}`,
      customer: { name, phone, email },
      items,
      orderType: input.orderType,
      deliveryAddress: input.orderType === "delivery"
        ? cleanText(input.deliveryAddress, 500)
        : null,
      pickupDate,
      timeSlot,
      payment: paymentMethod,
      paymentMethod,
      referenceNumber,
      paymentStatus: paymentMethod === "gcash"
        ? "paid-pending-verification"
        : "unpaid",
      confirmationTokenHash,
      notes: cleanText(input.notes, 1000),
      subtotal,
      deliveryFee,
      total,
      status: "pending",
      createdAt: FieldValue.serverTimestamp()
    });
    return `VK-${day}-${String(nextOrderNumber).padStart(3, "0")}`;
  });

  return { success: true, orderNumber, id: orderRef.id, confirmationToken };
});

exports.getAvailability = onCall(async request => {
  const { date, productId } = request.data || {};
  validateDate(date);
  if (!Object.prototype.hasOwnProperty.call(PRODUCTS, productId)) {
    throw new HttpsError("invalid-argument", "Unknown product.");
  }
  const [settingSnapshot, orderSnapshot] = await Promise.all([
    db.collection("productSettings").doc(productId).get(),
    db.collection("orders").where("pickupDate", "==", date).get()
  ]);
  const setting = settingSnapshot.exists ? settingSnapshot.data() : {};
  const capacity = Number.isInteger(setting.dailyCapacity)
    ? setting.dailyCapacity
    : DEFAULT_CAPACITY[productId];
  const used = orderSnapshot.docs
    .filter(doc => doc.get("status") !== "cancelled")
    .reduce((sum, doc) => sum + (doc.get("items") || [])
      .filter(item => item.id === productId)
      .reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0), 0);
  return { remaining: setting.soldOut === true ? 0 : Math.max(0, capacity - used) };
});

exports.getOrderConfirmation = onCall(async request => {
  const { orderNumber, confirmationToken } = request.data || {};
  const safeOrderNumber = cleanText(orderNumber, 24);
  if (!/^VK-\d{8}-\d{3}$/.test(safeOrderNumber) ||
      typeof confirmationToken !== "string" ||
      !/^[a-f0-9]{64}$/.test(confirmationToken)) {
    throw new HttpsError("invalid-argument", "A valid order number is required.");
  }
  const tokenHash = crypto.createHash("sha256").update(confirmationToken).digest("hex");
  const snapshot = await db.collection("orders")
    .where("orderNumber", "==", safeOrderNumber)
    .limit(1)
    .get();
  if (snapshot.empty || snapshot.docs[0].get("confirmationTokenHash") !== tokenHash) {
    throw new HttpsError("not-found", "Order was not found.");
  }
  const order = snapshot.docs[0].data();
  return {
    orderNumber: order.orderNumber,
    items: order.items,
    orderType: order.orderType,
    deliveryAddress: order.deliveryAddress || "",
    pickupDate: order.pickupDate,
    timeSlot: order.timeSlot,
    payment: order.payment,
    paymentMethod: order.paymentMethod || order.payment,
    referenceNumber: order.referenceNumber || "",
    paymentStatus: order.paymentStatus || "unpaid",
    notes: order.notes || "",
    total: order.total,
    status: order.status
  };
});

exports.verifyPayment = onCall(async request => {
  requireAdmin(request);
  const orderId = (request.data || {}).orderId;
  if (typeof orderId !== "string") {
    throw new HttpsError("invalid-argument", "Order ID is required.");
  }
  const ref = db.collection("orders").doc(orderId);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Order was not found.");
    if ((snapshot.get("paymentMethod") || snapshot.get("payment")) !== "gcash") {
      throw new HttpsError("failed-precondition", "Only GCash orders can be verified.");
    }
    transaction.update(ref, { paymentStatus: "paid" });
  });
  return { success: true };
});

exports.updateOrderStatus = onCall(async request => {
  requireAdmin(request);
  const { orderId, status } = request.data || {};
  if (typeof orderId !== "string" || !VALID_STATUSES.includes(status)) {
    throw new HttpsError("invalid-argument", "Order or status is invalid.");
  }
  const ref = db.collection("orders").doc(orderId);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Order was not found.");
    const order = snapshot.data();
    const wasCancelled = order.status === "cancelled";
    const willCancel = status === "cancelled";
    if (wasCancelled !== willCancel) {
      const updates = (order.items || []).map(item => ({
        ref: db.collection("capacityCounters").doc(`${order.pickupDate}_${item.id}`),
        item
      }));
      const counters = await Promise.all(updates.map(update => transaction.get(update.ref)));
      const hasMissingCounter = counters.some(counter => !counter.exists);
      const existingOrders = hasMissingCounter
        ? await transaction.get(db.collection("orders").where("pickupDate", "==", order.pickupDate))
        : null;
      updates.forEach((update, index) => {
        let quantity;
        if (counters[index].exists) {
          const current = Number(counters[index].get("quantity") || 0);
          quantity = Math.max(0, current + (willCancel ? -update.item.qty : update.item.qty));
        } else {
          const otherOrders = existingOrders.docs.filter(doc =>
            doc.id !== orderId && doc.get("status") !== "cancelled");
          const otherQuantity = otherOrders.reduce((sum, doc) => sum + (doc.get("items") || [])
            .filter(item => item.id === update.item.id)
            .reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0), 0);
          quantity = otherQuantity + (willCancel ? 0 : update.item.qty);
        }
        transaction.set(update.ref, { date: order.pickupDate, quantity });
      });
    }
    transaction.update(ref, { status });
  });
  return { success: true };
});
