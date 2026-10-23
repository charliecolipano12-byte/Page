const SHEET_TABS = {
  PRODUCTS: "Products",
  PACKAGES: "Packages",
  SETTINGS: "Settings",
  ORDERS: "Orders",
  ORDER_ITEMS: "OrderItems",
  PRODUCTION: "Production"
};

const ORDER_STATUS_VALUES = ["pending", "confirmed", "ready", "completed", "cancelled"];
const OWNER_EMAIL = "rayvillarante119@gmail.com";
const PRODUCT_CATALOG = [
  { id: "puto-cheese", name: "Puto Cheese", active: true },
  { id: "pichi-pichi", name: "Pichi-Pichi", active: true },
  { id: "kutsinta", name: "Kutsinta", active: true },
  { id: "palitaw", name: "Palitaw", active: true },
  { id: "sapin-sapin", name: "Sapin-Sapin", active: true },
  { id: "tikoy", name: "Tikoy", active: true },
  { id: "biko", name: "Biko", active: true },
  { id: "suman", name: "Suman", active: true },
  { id: "maja-blanca", name: "Maja Blanca", active: true },
  { id: "cassava-flan", name: "Cassava Flan", active: true },
  { id: "bibingka", name: "Bibingka (Seasonal)", active: true }
];
// TODO: Confirm whether these package prices apply to every kakanin.
const PACKAGE_CATALOG = [
  { id: "aluminum-tray", name: "Aluminum Tray", pieces: 30, price: 280 },
  { id: "medium-bilao", name: "Medium Bilao", pieces: 50, price: 380 },
  { id: "large-bilao", name: "Large Bilao", pieces: 100, price: 580 }
];

function setupSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const productSeed = PRODUCT_CATALOG.map(product => [product.id, product.name, true]);

  ensureSheet(SHEET_TABS.PRODUCTS, [
    "id", "name", "active"
  ], productSeed);

  const packagesSheet = ensureSheet(SHEET_TABS.PACKAGES, [
    "id", "name", "pieces", "price"
  ], PACKAGE_CATALOG.map(packageInfo => [
    packageInfo.id, packageInfo.name, packageInfo.pieces, packageInfo.price
  ]));
  const packageRows = packagesSheet.getDataRange().getValues();
  const packageHeaders = packageRows[0].map(String);
  const packageIdIndex = packageHeaders.indexOf("id");
  if (packageIdIndex < 0) throw new Error("Package sheet ID column is missing.");
  const existingPackageIds = new Set(packageRows.slice(1).map(row => String(row[packageIdIndex] || "")));
  PACKAGE_CATALOG.filter(packageInfo => !existingPackageIds.has(packageInfo.id)).forEach(packageInfo => {
    packagesSheet.appendRow([packageInfo.id, packageInfo.name, packageInfo.pieces, packageInfo.price]);
  });

  ensureSheet(SHEET_TABS.SETTINGS, ["key", "value"], [
    ["pickupOnly", "TRUE"],
    ["ownerEmail", OWNER_EMAIL],
    ["notifyOwner", "TRUE"],
    ["notifyCustomer", "TRUE"]
  ]);

  ensureSheet(SHEET_TABS.ORDERS, [
    "createdAt", "orderNumber", "status", "pickupDate", "timeSlot", "orderType", "customerName", "phone", "email",
    "itemsSummary", "subtotal", "deliveryFee", "total", "paymentMethod", "gcashReference", "paymentStatus",
    "deliveryAddress", "notes", "tokenHash", "accountEmail"
  ]);

  const ordersSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDERS);
  applyOrderValidation(ordersSheet);
  freezeHeader(ordersSheet);

  ensureSheet(SHEET_TABS.ORDER_ITEMS, [
    "orderNumber", "pickupDate", "productId", "productName", "qty", "status", "packageId", "packageName", "pieces", "unitPrice"
  ]);

  const orderItemsSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDER_ITEMS);
  freezeHeader(orderItemsSheet);

  ensureProductionSheet(spreadsheet);
  protectHeadersAndSettings(spreadsheet);
  return spreadsheet;
}

function ensureSheet(name, headers, seedRows) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    if (Array.isArray(seedRows) && seedRows.length) {
      seedRows.forEach(row => sheet.appendRow(Array.isArray(row) ? row : Object.values(row)));
    }
  }
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.appendRow(headers);
  }
  if (sheet.getLastRow() > 0) {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    headers.forEach(header => {
      if (!existingHeaders.includes(header)) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
        existingHeaders.push(header);
      }
    });
  }
  return sheet;
}

function ensureProductionSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_TABS.PRODUCTION);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_TABS.PRODUCTION);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["pickupDate"]);
    sheet.appendRow([""]);
  }
  const range = sheet.getRange(1, 1, 1, 100);
  const formulas = [
    ["pickupDate"],
    ["=IF(B2=\"\",\"\",TEXT(B2,\"yyyy-mm-dd\"))"]
  ];
  if (sheet.getLastRow() < 2) {
    sheet.appendRow(["pickupDate"]);
  }
  sheet.getRange(1, 1, 1, 1).setValue("pickupDate");
  if (!sheet.getRange("B1").getValue()) {
    sheet.getRange("B1").setValue("Total qty per product");
  }
  return sheet;
}

function freezeHeader(sheet) {
  if (!sheet) return;
  sheet.setFrozenRows(1);
}

function protectHeadersAndSettings(spreadsheet) {
  const protection = spreadsheet.getSheetByName(SHEET_TABS.SETTINGS).protect();
  protection.setDescription("Protected Settings tab");
  protection.addEditor(Session.getEffectiveUser().getEmail());
  protection.removeEditors(protection.getEditors());
  protection.addEditor(Session.getEffectiveUser().getEmail());

  const ordersSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDERS);
  if (ordersSheet) {
    const orderProtection = ordersSheet.protect();
    orderProtection.setDescription("Protected header rows");
    orderProtection.setWarningOnly(true);
  }

  const itemsSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDER_ITEMS);
  if (itemsSheet) {
    const itemProtection = itemsSheet.protect();
    itemProtection.setDescription("Protected header rows");
    itemProtection.setWarningOnly(true);
  }
}

function applyOrderValidation(sheet) {
  if (!sheet) return;
  const statusRange = sheet.getRange(2, 3, Math.max(sheet.getLastRow() - 1, 1), 1);
  const validation = SpreadsheetApp.newDataValidation().requireValueInList(ORDER_STATUS_VALUES, true).build();
  statusRange.setDataValidation(validation);
}

function sanitizeForCell(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return "";
  if (/^(?:[=\-+@]|\t|\n|\r)/.test(text)) {
    return "'" + text;
  }
  return text;
}

function sha256Hex(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value || "", Utilities.Charset.UTF_8)
    .map(byte => (byte & 0xff).toString(16).padStart(2, "0")).join("");
}

function getSettingsMap() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.SETTINGS);
  const rows = sheet ? sheet.getDataRange().getValues() : [];
  const map = {};
  rows.slice(1).forEach(([key, value]) => {
    if (key) map[String(key).trim()] = value;
  });
  return map;
}

function getProductsFromSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.PRODUCTS);
  const rows = sheet ? sheet.getDataRange().getValues() : [];
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter(row => row.some(value => value !== "")).map(row => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[String(header).trim()] = row[index];
    });
    return entry;
  });
}

function getPublicConfig() {
  return {
    success: true,
    products: PRODUCT_CATALOG,
    packages: getPackagesFromSheet(),
    order: {
      pickupOnly: true
    },
    business: {}
  };
}

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || "").toLowerCase();
  if (action === "config") {
    return ContentService.createTextOutput(JSON.stringify(getPublicConfig())).setMimeType(ContentService.MimeType.JSON);
  }
  if (action === "confirmation") {
    const orderNumber = String(e.parameter.order || "");
    const token = String(e.parameter.token || "");
    const order = findOrderByNumber(orderNumber);
    if (!order) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Order not found." })).setMimeType(ContentService.MimeType.JSON);
    }
    const expectedHash = order.tokenHash || "";
    if (!expectedHash || sha256Hex(token) !== expectedHash) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid confirmation token." })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, order: sanitizePublicOrder(order) })).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Unknown action." })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const body = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (body && ["listOrders", "updateOrderStatus", "listPackages", "updatePackage"].includes(body.action)) {
      if (!isAuthorizedAdminRequest(body.adminSecret)) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Unauthorized." })).setMimeType(ContentService.MimeType.JSON);
      }
      if (body.action === "listOrders") {
        return ContentService.createTextOutput(JSON.stringify({ success: true, orders: getAdminOrders() })).setMimeType(ContentService.MimeType.JSON);
      }
      if (body.action === "listPackages") {
        return ContentService.createTextOutput(JSON.stringify({ success: true, packages: getPackagesFromSheet() })).setMimeType(ContentService.MimeType.JSON);
      }
      if (body.action === "updatePackage") {
        return ContentService.createTextOutput(JSON.stringify(updateAdminPackage(body.package))).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify(updateAdminOrderStatus(body.orderNumber, body.status))).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify(submitOrder(body))).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Your order could not be submitted. Please try again." })).setMimeType(ContentService.MimeType.JSON);
  }
}

function isAuthorizedAdminRequest(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty("ADMIN_API_SECRET") || "";
  const candidate = String(secret || "");
  if (expected.length < 32 || candidate.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ candidate.charCodeAt(index);
  }
  return difference === 0;
}

function getAdminOrders() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const ordersSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDERS);
  const orderItemsSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDER_ITEMS);
  if (!ordersSheet || !orderItemsSheet) throw new Error("Order sheets are not set up.");

  const orderRows = ordersSheet.getDataRange().getValues();
  const itemRows = orderItemsSheet.getDataRange().getValues();
  if (!orderRows.length || !itemRows.length) return [];
  const orderHeaders = orderRows[0].map(String);
  const itemHeaders = itemRows[0].map(String);
  const itemsByOrder = {};

  itemRows.slice(1).forEach(row => {
    const orderNumber = String(getCellValue(row, itemHeaders, "orderNumber") || "");
    if (!orderNumber) return;
    if (!itemsByOrder[orderNumber]) itemsByOrder[orderNumber] = [];
    itemsByOrder[orderNumber].push({
      name: String(getCellValue(row, itemHeaders, "productName") || ""),
      packageName: String(getCellValue(row, itemHeaders, "packageName") || ""),
      pieces: Number(getCellValue(row, itemHeaders, "pieces") || 0),
      qty: Number(getCellValue(row, itemHeaders, "qty") || 0)
    });
  });

  return orderRows.slice(1).reverse().filter(row => getCellValue(row, orderHeaders, "orderNumber")).map(row => ({
    orderNumber: String(getCellValue(row, orderHeaders, "orderNumber")),
    createdAt: String(getCellValue(row, orderHeaders, "createdAt") || ""),
    customerName: String(getCellValue(row, orderHeaders, "customerName") || ""),
    phone: String(getCellValue(row, orderHeaders, "phone") || ""),
    pickupDate: formatOrderDate(getCellValue(row, orderHeaders, "pickupDate")),
    timeSlot: String(getCellValue(row, orderHeaders, "timeSlot") || ""),
    status: String(getCellValue(row, orderHeaders, "status") || "pending").toLowerCase(),
    accountEmail: String(getCellValue(row, orderHeaders, "accountEmail") || ""),
    items: itemsByOrder[String(getCellValue(row, orderHeaders, "orderNumber"))] || []
  }));
}

function getPackagesFromSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.PACKAGES);
  if (!sheet || sheet.getLastRow() < 2) return PACKAGE_CATALOG.map(packageInfo => ({ ...packageInfo }));
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(String);
  const indexes = {
    id: headers.indexOf("id"),
    name: headers.indexOf("name"),
    pieces: headers.indexOf("pieces"),
    price: headers.indexOf("price")
  };
  if (Object.values(indexes).some(index => index < 0)) throw new Error("Package sheet columns are missing.");
  const packages = rows.slice(1).filter(row => row[indexes.id]).map(row => {
    const packageInfo = {
      id: String(row[indexes.id]),
      name: String(row[indexes.name] || "").trim(),
      pieces: Number(row[indexes.pieces]),
      price: Number(row[indexes.price])
    };
    if (!packageInfo.name || !Number.isSafeInteger(packageInfo.pieces) ||
        packageInfo.pieces < 1 || !Number.isSafeInteger(packageInfo.price) ||
        packageInfo.price < 0) {
      throw new Error(`Package details are invalid for ${packageInfo.id}.`);
    }
    return packageInfo;
  });
  return packages;
}

function updateAdminPackage(payload) {
  const id = String(payload && payload.id || "").trim();
  const name = String(payload && payload.name || "").trim();
  const pieces = Number(payload && payload.pieces);
  const price = Number(payload && payload.price);
  if (!PACKAGE_CATALOG.some(packageInfo => packageInfo.id === id) ||
      !name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name) ||
      !Number.isSafeInteger(pieces) || pieces < 1 || pieces > 100000 ||
      !Number.isSafeInteger(price) || price < 0 || price > 10000000) {
    return { success: false, message: "Enter a valid package name, piece count, and price." };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.PACKAGES);
    if (!sheet) throw new Error("Package sheet is not set up. Run setupSheet() first.");
    const rows = sheet.getDataRange().getValues();
    const headers = rows.length ? rows[0].map(String) : [];
    const idIndex = headers.indexOf("id");
    if (idIndex < 0) throw new Error("Package sheet columns are missing.");
    const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[idIndex]) === id);
    if (rowIndex < 1) throw new Error("Package was not found.");
    const rowNumber = rowIndex + 1;
    ["name", "pieces", "price"].forEach((header, column) => {
      const index = headers.indexOf(header);
      if (index < 0) throw new Error("Package sheet columns are missing.");
      sheet.getRange(rowNumber, index + 1).setValue(
        header === "name" ? sanitizeForCell(name) : header === "pieces" ? pieces : price
      );
    });
    return { success: true, package: { id, name, pieces, price } };
  } finally {
    lock.releaseLock();
  }
}

function getCellValue(row, headers, name) {
  const index = headers.indexOf(name);
  return index < 0 ? "" : row[index];
}

function updateAdminOrderStatus(orderNumber, status) {
  const normalizedOrderNumber = String(orderNumber || "").trim();
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!normalizedOrderNumber || normalizedOrderNumber.length > 80 || !ORDER_STATUS_VALUES.includes(normalizedStatus)) {
    return { success: false, message: "A valid order number and status are required." };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const ordersSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDERS);
    const orderItemsSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDER_ITEMS);
    if (!ordersSheet || !orderItemsSheet) throw new Error("Order sheets are not set up.");

    const orderRows = ordersSheet.getDataRange().getValues();
    const orderHeaders = orderRows.length ? orderRows[0].map(String) : [];
    const orderNumberIndex = orderHeaders.indexOf("orderNumber");
    const statusIndex = orderHeaders.indexOf("status");
    if (orderNumberIndex < 0 || statusIndex < 0) throw new Error("Order sheet columns are missing.");

    let orderRow = -1;
    for (let index = 1; index < orderRows.length; index++) {
      if (String(orderRows[index][orderNumberIndex] || "") === normalizedOrderNumber) {
        orderRow = index + 1;
        break;
      }
    }
    if (orderRow < 0) return { success: false, message: "Order not found." };

    const itemRows = orderItemsSheet.getDataRange().getValues();
    const itemHeaders = itemRows.length ? itemRows[0].map(String) : [];
    const itemOrderNumberIndex = itemHeaders.indexOf("orderNumber");
    const itemStatusIndex = itemHeaders.indexOf("status");
    if (itemOrderNumberIndex < 0 || itemStatusIndex < 0) throw new Error("Order item columns are missing.");

    ordersSheet.getRange(orderRow, statusIndex + 1).setValue(normalizedStatus);
    for (let index = 1; index < itemRows.length; index++) {
      if (String(itemRows[index][itemOrderNumberIndex] || "") === normalizedOrderNumber) {
        orderItemsSheet.getRange(index + 1, itemStatusIndex + 1).setValue(normalizedStatus);
      }
    }
    return { success: true, orderNumber: normalizedOrderNumber, status: normalizedStatus };
  } finally {
    lock.releaseLock();
  }
}

function submitOrder(payload) {
  if (!payload || typeof payload !== "object") {
    return { success: false, message: "Order details are missing." };
  }

  if (payload.honeypot && String(payload.honeypot).trim()) {
    return { success: false, message: "Request rejected." };
  }

  if (JSON.stringify(payload).length > 50000) {
    return { success: false, message: "Your order is too large." };
  }

  const phone = String((payload.customer && payload.customer.phone) || "").trim();
  const email = String((payload.customer && payload.customer.email) || "").trim();
  const accountEmail = String(payload.accountEmail || "").trim().toLowerCase();
  const name = String((payload.customer && payload.customer.name) || "").trim();
  const pickupDate = String(payload.pickupDate || "").trim();
  const pickupTime = String(payload.timeSlot || "").trim();
  const paymentMethod = String(payload.paymentMethod || "").trim().toLowerCase();
  const notes = String(payload.notes || "").trim();
  const items = Array.isArray(payload.items) ? payload.items : [];
  const validPayments = ["gcash", "cash-on-pickup", "maribank"];

  if (!name || name.length > 80) return { success: false, message: "Enter your name." };
  if (!isValidPhone(phone)) return { success: false, message: "Enter a valid mobile number." };
  if (email && !isValidEmail(email)) return { success: false, message: "Enter a valid email." };
  if (accountEmail && !isValidEmail(accountEmail)) return { success: false, message: "The account email is invalid." };
  if (items.length === 0) return { success: false, message: "Select at least one item." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || !parseDateKey(pickupDate)) return { success: false, message: "Enter a valid preferred pickup date." };
  if (!pickupTime || pickupTime.length > 80) return { success: false, message: "Enter your preferred pickup time." };
  if (!validPayments.includes(paymentMethod)) return { success: false, message: "Choose a valid payment method." };
  if (payload.consent !== true) return { success: false, message: "Privacy consent is required." };

  const settings = getSettingsMap();
  const today = Utilities.formatDate(new Date(), "Asia/Manila", "yyyy-MM-dd");
  if (pickupDate < today) return { success: false, message: "Pickup date cannot be in the past." };

  const orderDetail = [];
  let subtotal = 0;
  const availablePackages = getPackagesFromSheet();

  items.forEach(item => {
    const product = PRODUCT_CATALOG.find(entry => entry.id === String(item.id));
    const packageInfo = availablePackages.find(entry => entry.id === String(item.packageId));
    const qty = Number(item.qty || 0);
    if (!product || !packageInfo) throw new Error("Unknown product or package.");
    if (!Number.isSafeInteger(qty) || qty < 1) throw new Error("Invalid package quantity.");
    orderDetail.push({
      productId: product.id,
      productName: product.name,
      qty,
      packageId: packageInfo.id,
      packageName: packageInfo.name,
      pieces: packageInfo.pieces,
      price: packageInfo.price
    });
    subtotal += qty * packageInfo.price;
  });
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) return { success: false, message: "The order total is outside the supported range." };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const deliveryFee = 0;
    const total = subtotal;
    const gcashReference = "";

    const orderNumber = generateOrderNumber();
    const token = Utilities.getUuid();
    const tokenHash = sha256Hex(token);
    const now = Utilities.formatDate(new Date(), "Asia/Manila", "yyyy-MM-dd HH:mm:ss");
    const row = [
      now,
      orderNumber,
      "pending",
      pickupDate,
      pickupTime,
      "pickup",
      sanitizeForCell(name),
      sanitizeForCell(phone),
      sanitizeForCell(email),
      orderDetail.map(item => `${item.productName} — ${item.packageName} (${item.pieces} pcs) x${item.qty}`).join("; "),
      subtotal,
      deliveryFee,
      total,
      paymentMethod,
      sanitizeForCell(gcashReference),
      "unpaid",
      "",
      sanitizeForCell(notes),
      tokenHash,
      sanitizeForCell(accountEmail)
    ];

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.ORDERS);
    sheet.appendRow(row);

    const orderItemsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.ORDER_ITEMS);
    orderDetail.forEach(item => {
      orderItemsSheet.appendRow([
        orderNumber,
        pickupDate,
        item.productId,
        item.productName,
        item.qty,
        "pending",
        item.packageId,
        item.packageName,
        item.pieces,
        item.price
      ]);
    });

    if (String(settings.notifyOwner || "FALSE").toLowerCase() === "true") {
      try {
        MailApp.sendEmail(
          String(settings.ownerEmail || OWNER_EMAIL) === "owner@example.com" ? OWNER_EMAIL : String(settings.ownerEmail || OWNER_EMAIL),
          `New order ${orderNumber}`,
          `Customer: ${name}\nPhone: ${phone}\nPickup date: ${pickupDate}\nPreferred time: ${pickupTime}\nItems: ${orderDetail.map(item => `${item.productName} — ${item.packageName} (${item.pieces} pcs) x${item.qty}`).join(", ")}\nTotal: ₱${total.toFixed(2)}\nPayment on pickup: ${paymentMethod}\nNotes/allergies: ${notes}`
        );
      } catch (sendError) {
        Logger.log(`Owner notification email failed for ${orderNumber}: ${sendError}`);
      }
    }

    if (String(settings.notifyCustomer || "FALSE").toLowerCase() === "true" && email) {
      try {
        MailApp.sendEmail(
          email,
          `Your order confirmation - ${orderNumber}`,
          `Thank you for ordering with Ate My's Kakanin. Your order number is ${orderNumber}.\n\nPreferred pickup date: ${pickupDate}\nPreferred pickup time: ${pickupTime}\nTotal: ₱${total.toFixed(2)}\nPayment on pickup: ${paymentMethod}`
        );
      } catch (sendError) {
        Logger.log(`Customer confirmation email failed for ${orderNumber}: ${sendError}`);
      }
    }

    // TODO: Configure an authorized Messenger integration or page link for owner order notifications.
    // TODO: Configure retention cleanup after one year and a process for legal/accounting retention exceptions.
    return { success: true, orderNumber, confirmationToken: token, total };
  } finally {
    lock.releaseLock();
  }
}

function findOrderByNumber(orderNumber) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.ORDERS);
  if (!sheet) return null;
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const orderIndex = headers.indexOf("orderNumber");
  if (orderIndex < 0) return null;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][orderIndex] || "") === String(orderNumber)) {
      const record = {};
      headers.forEach((header, index) => { record[String(header)] = rows[i][index]; });
      return record;
    }
  }
  return null;
}

function sanitizePublicOrder(order) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    pickupDate: formatOrderDate(order.pickupDate),
    timeSlot: order.timeSlot,
    orderType: order.orderType,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    total: Number(order.total || 0),
    items: getOrderItemsForNumber(order.orderNumber).map(item => ({
      id: item.productId,
      name: item.productName,
      qty: Number(item.qty || 0),
      packageId: item.packageId || "",
      packageName: item.packageName || "",
      pieces: Number(item.pieces || 0),
      price: Number(item.unitPrice || 0)
    }))
  };
}

function formatOrderDate(value) {
  if (value instanceof Date) return Utilities.formatDate(value, "Asia/Manila", "yyyy-MM-dd");
  const text = String(value || "");
  const parsed = parseDateKey(text);
  return parsed ? Utilities.formatDate(parsed, "Asia/Manila", "yyyy-MM-dd") : text;
}

function getOrderItemsForNumber(orderNumber) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.ORDER_ITEMS);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const orderNumberIndex = headers.indexOf("orderNumber");
  const pickupDateIndex = headers.indexOf("pickupDate");
  const productIdIndex = headers.indexOf("productId");
  const productNameIndex = headers.indexOf("productName");
  const qtyIndex = headers.indexOf("qty");
  const statusIndex = headers.indexOf("status");
  const packageIdIndex = headers.indexOf("packageId");
  const packageNameIndex = headers.indexOf("packageName");
  const piecesIndex = headers.indexOf("pieces");
  const unitPriceIndex = headers.indexOf("unitPrice");
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][orderNumberIndex] || "") === String(orderNumber)) {
      result.push({
        orderNumber: rows[i][orderNumberIndex],
        pickupDate: rows[i][pickupDateIndex],
        productId: rows[i][productIdIndex],
        productName: rows[i][productNameIndex],
        qty: rows[i][qtyIndex],
        status: rows[i][statusIndex],
        packageId: packageIdIndex >= 0 ? rows[i][packageIdIndex] : "",
        packageName: packageNameIndex >= 0 ? rows[i][packageNameIndex] : "",
        pieces: piecesIndex >= 0 ? rows[i][piecesIndex] : "",
        unitPrice: unitPriceIndex >= 0 ? rows[i][unitPriceIndex] : ""
      });
    }
  }
  return result;
}

function generateOrderNumber() {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), "Asia/Manila", "yyyyMMdd");
  const key = "order_counter_" + today;
  const next = Number(props.getProperty(key) || "0") + 1;
  props.setProperty(key, String(next));
  return `AMK-${today}-${String(next).padStart(3, "0")}`;
}

function parseDateKey(date) {
  if (!date) return null;
  const [year, month, day] = String(date).split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function isValidPhone(value) {
  const text = String(value || "").trim();
  if (!/^[+\d\s()-]+$/.test(text)) return false;
  const digits = text.replace(/\D/g, "");
  return /^(?:09\d{9}|639\d{9})$/.test(digits);
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== SHEET_TABS.ORDERS) return;
  const column = range.getColumn();
  const row = range.getRow();
  if (column !== 3 || row < 2) return;
  const newStatus = String(range.getValue() || "").trim().toLowerCase();
  if (!ORDER_STATUS_VALUES.includes(newStatus)) return;
  const orderNumber = String(sheet.getRange(row, 2).getValue() || "");
  const orderItemsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.ORDER_ITEMS);
  const rows = orderItemsSheet.getDataRange().getValues();
  const headers = rows[0];
  const orderNumberIndex = headers.indexOf("orderNumber");
  const statusIndex = headers.indexOf("status");
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][orderNumberIndex]) === orderNumber) {
      orderItemsSheet.getRange(i + 1, statusIndex + 1).setValue(newStatus);
    }
  }
}
