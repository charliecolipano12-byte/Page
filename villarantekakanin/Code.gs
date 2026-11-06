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
// Seed catalog: IDs immutable. Descriptions/allergens/photos come from existing client data;
// never invent allergen/ingredient text. Placeholders kept where owner confirmation is needed.
const PRODUCT_CATALOG = [
  { id: "puto-cheese", name: "Puto Cheese", description: "Soft, fluffy steamed rice cakes topped with creamy cheese.", allergens: "May contain milk, wheat, and eggs.", image: "images/puto.jpg", available: true, seasonal: false },
  { id: "pichi-pichi", name: "Pichi-Pichi", description: "Soft, chewy cassava delicacy coated with grated coconut.", allergens: "Commonly contains coconut or coconut products.", image: "", available: true, seasonal: false },
  { id: "kutsinta", name: "Kutsinta", description: "Soft, chewy, slightly sweet rice cake, best with grated coconut.", allergens: "Commonly contains coconut or coconut products.", image: "images/kutsinta.jpg", available: true, seasonal: false },
  { id: "palitaw", name: "Palitaw", description: "Chewy glutinous rice cakes with grated coconut, sugar, and toasted sesame seeds.", allergens: "Commonly contains coconut or coconut products; contains sesame.", image: "images/palitaw.jpg", available: true, seasonal: false },
  { id: "sapin-sapin", name: "Sapin-Sapin", description: "Colorful layered rice cake with glutinous rice flour and coconut milk.", allergens: "Commonly contains coconut or coconut products.", image: "", available: true, seasonal: false },
  { id: "tikoy", name: "Tikoy", description: "Soft, sticky, sweet glutinous rice cake. Slices can be pan-fried.", allergens: "Mainly glutinous rice flour and sugar.", image: "", available: true, seasonal: false },
  { id: "biko", name: "Biko", description: "Glutinous rice, coconut milk, and brown sugar with a caramelized coconut topping.", allergens: "Commonly contains coconut or coconut products.", image: "images/biko.jpg", available: true, seasonal: false },
  { id: "suman", name: "Suman", description: "Glutinous rice and coconut milk wrapped in banana leaves.", allergens: "Commonly contains coconut or coconut products.", image: "images/suman.jpg", available: true, seasonal: false },
  { id: "maja-blanca", name: "Maja Blanca", description: "Creamy coconut pudding made with coconut milk and cornstarch.", allergens: "May contain milk and corn.", image: "", available: true, seasonal: false },
  { id: "cassava-flan", name: "Cassava Flan", description: "Grated cassava with creamy custard flan.", allergens: "Typically contains cassava, eggs, and milk.", image: "", available: true, seasonal: false },
  { id: "bibingka", name: "Bibingka (Seasonal)", description: "Available during the Christmas season and popular after Simbang Gabi. Please order in advance.", allergens: "Please ask us about Bibingka ingredients and allergens before ordering.", image: "images/bibingka.jpg", available: true, seasonal: true }
];
const PRODUCT_HEADERS = ["id", "name", "description", "allergens", "image", "available", "seasonal", "displayOrder"];
// TODO: Confirm whether these package prices apply to every kakanin.
const PACKAGE_CATALOG = [
  { id: "aluminum-tray", name: "Aluminum Tray", pieces: 30, price: 280 },
  { id: "medium-bilao", name: "Medium Bilao", pieces: 50, price: 380 },
  { id: "large-bilao", name: "Large Bilao", pieces: 100, price: 580 }
];

function setupSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const productsSheet = ensureSheet(SHEET_TABS.PRODUCTS, PRODUCT_HEADERS, []);
  migrateProductRows(productsSheet);
  const packagesSheet = ensureSheet(SHEET_TABS.PACKAGES, ["id", "name", "pieces", "price"], PACKAGE_CATALOG.map(packageInfo => [packageInfo.id, packageInfo.name, packageInfo.pieces, packageInfo.price]));
  const packageRows = packagesSheet.getDataRange().getValues();
  const packageHeaders = packageRows[0].map(String);
  const packageIdIndex = packageHeaders.indexOf("id");
  if (packageIdIndex < 0) throw new Error("Package sheet ID column is missing.");
  const existingPackageIds = new Set(packageRows.slice(1).map(row => String(row[packageIdIndex] || "")));
  PACKAGE_CATALOG.filter(packageInfo => !existingPackageIds.has(packageInfo.id)).forEach(packageInfo => {
    packagesSheet.appendRow([packageInfo.id, packageInfo.name, packageInfo.pieces, packageInfo.price]);
  });
  ensureSheet(SHEET_TABS.SETTINGS, ["key", "value"], [["pickupOnly", "TRUE"], ["ownerEmail", OWNER_EMAIL], ["notifyOwner", "TRUE"], ["notifyCustomer", "TRUE"]]);
  ensureSheet(SHEET_TABS.ORDERS, ["createdAt", "orderNumber", "status", "pickupDate", "timeSlot", "orderType", "customerName", "phone", "email", "itemsSummary", "subtotal", "deliveryFee", "total", "paymentMethod", "gcashReference", "paymentStatus", "deliveryAddress", "notes", "tokenHash", "accountEmail"]);
  const ordersSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDERS);
  applyOrderValidation(ordersSheet);
  freezeHeader(ordersSheet);
  ensureSheet(SHEET_TABS.ORDER_ITEMS, ["orderNumber", "pickupDate", "productId", "productName", "qty", "status", "packageId", "packageName", "pieces", "unitPrice"]);
  const orderItemsSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDER_ITEMS);
  freezeHeader(orderItemsSheet);
  ensureProductionSheet(spreadsheet);
  protectHeadersAndSettings(spreadsheet);
  return spreadsheet;
}

// Run this once from the Apps Script editor to migrate only the Products tab (safer than re-running setupSheet).
function migrateProductsOnly() {
  migrateProductRows(ensureSheet(SHEET_TABS.PRODUCTS, PRODUCT_HEADERS, []));
}

function migrateProductRows(sheet) {
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  if (!rows.length) return;
  const headers = rows[0].map(String);
  const idIdx = headers.indexOf("id");
  if (idIdx < 0) return;
  const byId = {};
  for (let i = 1; i < rows.length; i++) { const id = String(rows[i][idIdx] || "").trim(); if (id) byId[id] = rows[i]; }
  const seedById = {};
  PRODUCT_CATALOG.forEach((p, i) => { seedById[p.id] = Object.assign({ displayOrder: (i + 1) * 10 }, p); });
  // Add missing seed rows (never invent allergen/ingredient text beyond existing seed).
  PRODUCT_CATALOG.forEach((seed, i) => {
    if (byId[seed.id]) return;
    const full = Object.assign({ displayOrder: (i + 1) * 10 }, seed);
    sheet.appendRow(headers.map(h => (full[h] === undefined ? "" : full[h])));
  });
  // Backfill/migrate existing rows in place (preserve IDs and existing values).
  const updated = sheet.getDataRange().getValues();
  const hdr = updated[0].map(String);
  function idx(name) { return hdr.indexOf(name); }
  const map = { id: idx("id"), name: idx("name"), description: idx("description"), allergens: idx("allergens"), image: idx("image"), available: idx("available"), seasonal: idx("seasonal"), displayOrder: idx("displayOrder"), active: idx("active") };
  if (map.id < 0) return;
  for (let i = 1; i < updated.length; i++) {
    const id = String(updated[i][map.id] || "").trim();
    if (!id) continue;
    const seed = seedById[id];
    const rowNum = i + 1;
    // Migrate active -> available if available empty and active present.
    if (map.available >= 0 && map.active >= 0) {
      const availCell = updated[i][map.available];
      const activeCell = updated[i][map.active];
      if (availCell === "" || availCell == null) sheet.getRange(rowNum, map.available + 1).setValue(activeCell === "" || activeCell == null ? true : toBool(activeCell, true));
    } else if (map.available >= 0 && (updated[i][map.available] === "" || updated[i][map.available] == null)) {
      sheet.getRange(rowNum, map.available + 1).setValue(seed ? seed.available : true);
    }
    if (seed) {
      if (map.description >= 0 && String(updated[i][map.description] || "").trim() === "") sheet.getRange(rowNum, map.description + 1).setValue(seed.description);
      if (map.allergens >= 0 && String(updated[i][map.allergens] || "").trim() === "") sheet.getRange(rowNum, map.allergens + 1).setValue(seed.allergens);
      if (map.image >= 0 && String(updated[i][map.image] || "").trim() === "" && seed.image) sheet.getRange(rowNum, map.image + 1).setValue(seed.image);
      if (map.seasonal >= 0 && (updated[i][map.seasonal] === "" || updated[i][map.seasonal] == null)) sheet.getRange(rowNum, map.seasonal + 1).setValue(seed.seasonal);
      if (map.displayOrder >= 0 && (updated[i][map.displayOrder] === "" || updated[i][map.displayOrder] == null)) sheet.getRange(rowNum, map.displayOrder + 1).setValue(seed.displayOrder);
      if (map.name >= 0 && String(updated[i][map.name] || "").trim() === "") sheet.getRange(rowNum, map.name + 1).setValue(seed.name);
    } else {
      if (map.available >= 0 && (updated[i][map.available] === "" || updated[i][map.available] == null)) sheet.getRange(rowNum, map.available + 1).setValue(true);
      if (map.seasonal >= 0 && (updated[i][map.seasonal] === "" || updated[i][map.seasonal] == null)) sheet.getRange(rowNum, map.seasonal + 1).setValue(false);
      if (map.displayOrder >= 0 && (updated[i][map.displayOrder] === "" || updated[i][map.displayOrder] == null)) sheet.getRange(rowNum, map.displayOrder + 1).setValue((i + 1) * 10);
    }
  }
}

function toBool(value, defaultValue) {
  if (value === true || value === false) return value;
  const text = String(value == null ? "" : value).trim().toLowerCase();
  if (text === "true" || text === "1" || text === "yes") return true;
  if (text === "false" || text === "0" || text === "no") return false;
  return defaultValue;
}

function ensureSheet(name, headers, seedRows) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    if (Array.isArray(seedRows) && seedRows.length) seedRows.forEach(row => sheet.appendRow(Array.isArray(row) ? row : Object.values(row)));
  }
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) sheet.appendRow(headers);
  if (sheet.getLastRow() > 0) {
    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    headers.forEach(header => {
      if (!existingHeaders.includes(header)) { sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header); existingHeaders.push(header); }
    });
  }
  return sheet;
}

function ensureProductionSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_TABS.PRODUCTION);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_TABS.PRODUCTION);
  if (sheet.getLastRow() === 0) { sheet.appendRow(["pickupDate"]); sheet.appendRow([""]); }
  if (sheet.getLastRow() < 2) sheet.appendRow(["pickupDate"]);
  sheet.getRange(1, 1, 1, 1).setValue("pickupDate");
  if (!sheet.getRange("B1").getValue()) sheet.getRange("B1").setValue("Total qty per product");
  return sheet;
}

function freezeHeader(sheet) { if (!sheet) return; sheet.setFrozenRows(1); }

function protectHeadersAndSettings(spreadsheet) {
  const protection = spreadsheet.getSheetByName(SHEET_TABS.SETTINGS).protect();
  protection.setDescription("Protected Settings tab");
  protection.addEditor(Session.getEffectiveUser().getEmail());
  protection.removeEditors(protection.getEditors());
  protection.addEditor(Session.getEffectiveUser().getEmail());
  const ordersSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDERS);
  if (ordersSheet) { const p = ordersSheet.protect(); p.setDescription("Protected header rows"); p.setWarningOnly(true); }
  const itemsSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDER_ITEMS);
  if (itemsSheet) { const p = itemsSheet.protect(); p.setDescription("Protected header rows"); p.setWarningOnly(true); }
}

function applyOrderValidation(sheet) {
  if (!sheet) return;
  const statusRange = sheet.getRange(2, 3, Math.max(sheet.getLastRow() - 1, 1), 1);
  statusRange.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ORDER_STATUS_VALUES, true).build());
}

function sanitizeForCell(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return "";
  if (/^(?:[=\-+@]|\t|\n|\r)/.test(text)) return "'" + text;
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
  rows.slice(1).forEach(([key, value]) => { if (key) map[String(key).trim()] = value; });
  return map;
}

function normalizeProductRow(row, headers, seedById) {
  function val(name) { return getCellValue(row, headers, name); }
  const id = String(val("id") || "").trim();
  if (!id) return null;
  const seed = seedById[id] || {};
  const availableRaw = val("available");
  const activeRaw = val("active");
  const available = availableRaw === "" || availableRaw == null ? toBool(activeRaw, seed.available !== false) : toBool(availableRaw, seed.available !== false);
  const displayOrderNum = Number(val("displayOrder"));
  return {
    id: id,
    name: String(val("name") || seed.name || id).trim(),
    description: String(val("description") != null && String(val("description")).trim() !== "" ? val("description") : (seed.description || "")).trim(),
    allergens: String(val("allergens") != null && String(val("allergens")).trim() !== "" ? val("allergens") : (seed.allergens || "")).trim(),
    image: String(val("image") != null && String(val("image")).trim() !== "" ? val("image") : (seed.image || "")).trim(),
    available: available,
    seasonal: toBool(val("seasonal"), Boolean(seed.seasonal)),
    displayOrder: Number.isSafeInteger(displayOrderNum) ? displayOrderNum : (Number.isSafeInteger(seed.displayOrder) ? seed.displayOrder : 9999)
  };
}

function getAllProductsFromSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.PRODUCTS);
  const seedById = {};
  PRODUCT_CATALOG.forEach((p, i) => { seedById[p.id] = Object.assign({ displayOrder: (i + 1) * 10 }, p); });
  if (!sheet || sheet.getLastRow() < 2) return PRODUCT_CATALOG.map((p, i) => Object.assign({ displayOrder: (i + 1) * 10 }, p));
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(String);
  const products = rows.slice(1).map(row => normalizeProductRow(row, headers, seedById)).filter(Boolean);
  const seen = new Set(products.map(p => p.id));
  PRODUCT_CATALOG.forEach((p, i) => { if (!seen.has(p.id)) products.push(Object.assign({ displayOrder: (i + 1) * 10 }, p)); });
  products.sort((a, b) => (a.displayOrder - b.displayOrder) || String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id)));
  return products;
}

function getProductsFromSheet() { return getAllProductsFromSheet(); }

function getPublicConfig() {
  const products = getAllProductsFromSheet().filter(p => p.available)
    .map(p => ({ id: p.id, name: p.name, description: p.description, allergens: p.allergens, image: p.image || undefined, seasonal: p.seasonal || undefined }));
  return { success: true, products: products, packages: getPackagesFromSheet(), order: { pickupOnly: true }, business: {} };
}

function getAdminProducts() {
  return getAllProductsFromSheet().map(p => ({ id: p.id, name: p.name, description: p.description, allergens: p.allergens, image: p.image, available: p.available, seasonal: p.seasonal, displayOrder: p.displayOrder }));
}

function sanitizeImagePath(value) {
  const text = String(value == null ? "" : value).trim().replace(/\\/g, "/");
  if (!text) return "";
  if (text.length > 200) return null;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(text) || text.startsWith("//")) return null;
  if (text.includes("..") || /[\u0000-\u001f\u007f]/.test(text)) return null;
  if (!/^images\/[a-zA-Z0-9._\/-]+$/.test(text)) return null;
  return text;
}

function updateAdminProduct(payload) {
  const id = String(payload && payload.id || "").trim();
  if (!id || id.length > 80 || !/^[a-z0-9-]+$/.test(id)) return { success: false, message: "A valid product ID is required." };
  const name = String(payload && payload.name || "").trim();
  const description = String(payload && payload.description == null ? "" : payload.description).trim();
  const allergens = String(payload && payload.allergens == null ? "" : payload.allergens).trim();
  const imageRaw = payload && Object.prototype.hasOwnProperty.call(payload, "image") ? payload.image : "";
  const image = sanitizeImagePath(imageRaw);
  const available = toBool(payload && payload.available, true);
  const seasonal = toBool(payload && payload.seasonal, false);
  const displayOrder = Number(payload && payload.displayOrder);
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) return { success: false, message: "Enter a valid product name." };
  if (description.length > 2000 || allergens.length > 2000) return { success: false, message: "Description or allergen text is too long." };
  if (image === null) return { success: false, message: "Photo must be a path like images/puto.jpg, or left empty." };
  if (!Number.isSafeInteger(displayOrder) || displayOrder < -999999 || displayOrder > 999999) return { success: false, message: "Display order must be a whole number." };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.PRODUCTS);
    if (!sheet) throw new Error("Products sheet is not set up. Run setupSheet() first.");
    ensureSheet(SHEET_TABS.PRODUCTS, PRODUCT_HEADERS, []);
    const rows = sheet.getDataRange().getValues();
    const headers = rows.length ? rows[0].map(String) : [];
    const idIndex = headers.indexOf("id");
    if (idIndex < 0) throw new Error("Products sheet columns are missing.");
    const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[idIndex] || "").trim() === id);
    if (rowIndex < 1) return { success: false, message: "Product not found. Product IDs cannot be added or changed here." };
    const rowNumber = rowIndex + 1;
    function setCol(header, value) { const ci = headers.indexOf(header); if (ci >= 0) sheet.getRange(rowNumber, ci + 1).setValue(value); }
    setCol("name", sanitizeForCell(name)); setCol("description", sanitizeForCell(description)); setCol("allergens", sanitizeForCell(allergens));
    setCol("image", image); setCol("available", available); setCol("seasonal", seasonal); setCol("displayOrder", displayOrder);
    if (headers.indexOf("active") >= 0) setCol("active", available);
    return { success: true, product: { id, name, description, allergens, image, available, seasonal, displayOrder } };
  } finally { lock.releaseLock(); }
}

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || "").toLowerCase();
  if (action === "config") return ContentService.createTextOutput(JSON.stringify(getPublicConfig())).setMimeType(ContentService.MimeType.JSON);
  if (action === "confirmation") {
    const orderNumber = String(e.parameter.order || "");
    const token = String(e.parameter.token || "");
    const order = findOrderByNumber(orderNumber);
    if (!order) return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Order not found." })).setMimeType(ContentService.MimeType.JSON);
    if (!order.tokenHash || sha256Hex(token) !== order.tokenHash) return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Invalid confirmation token." })).setMimeType(ContentService.MimeType.JSON);
    return ContentService.createTextOutput(JSON.stringify({ success: true, order: sanitizePublicOrder(order) })).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Unknown action." })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const body = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (body && ["listOrders", "updateOrderStatus", "listPackages", "updatePackage", "listProducts", "updateProduct"].includes(body.action)) {
      if (!isAuthorizedAdminRequest(body.adminSecret)) return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Unauthorized." })).setMimeType(ContentService.MimeType.JSON);
      if (body.action === "listOrders") return ContentService.createTextOutput(JSON.stringify({ success: true, orders: getAdminOrders() })).setMimeType(ContentService.MimeType.JSON);
      if (body.action === "listPackages") return ContentService.createTextOutput(JSON.stringify({ success: true, packages: getPackagesFromSheet() })).setMimeType(ContentService.MimeType.JSON);
      if (body.action === "updatePackage") return ContentService.createTextOutput(JSON.stringify(updateAdminPackage(body.package))).setMimeType(ContentService.MimeType.JSON);
      if (body.action === "listProducts") return ContentService.createTextOutput(JSON.stringify({ success: true, products: getAdminProducts() })).setMimeType(ContentService.MimeType.JSON);
      if (body.action === "updateProduct") return ContentService.createTextOutput(JSON.stringify(updateAdminProduct(body.product))).setMimeType(ContentService.MimeType.JSON);
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
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ candidate.charCodeAt(index);
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
    itemsByOrder[orderNumber].push({ name: String(getCellValue(row, itemHeaders, "productName") || ""), packageName: String(getCellValue(row, itemHeaders, "packageName") || ""), pieces: Number(getCellValue(row, itemHeaders, "pieces") || 0), qty: Number(getCellValue(row, itemHeaders, "qty") || 0) });
  });
  return orderRows.slice(1).reverse().filter(row => getCellValue(row, orderHeaders, "orderNumber")).map(row => ({
    orderNumber: String(getCellValue(row, orderHeaders, "orderNumber")), createdAt: String(getCellValue(row, orderHeaders, "createdAt") || ""), customerName: String(getCellValue(row, orderHeaders, "customerName") || ""), phone: String(getCellValue(row, orderHeaders, "phone") || ""),
    pickupDate: formatOrderDate(getCellValue(row, orderHeaders, "pickupDate")), timeSlot: String(getCellValue(row, orderHeaders, "timeSlot") || ""), status: String(getCellValue(row, orderHeaders, "status") || "pending").toLowerCase(), accountEmail: String(getCellValue(row, orderHeaders, "accountEmail") || ""),
    subtotal: Number(getCellValue(row, orderHeaders, "subtotal") || 0), total: Number(getCellValue(row, orderHeaders, "total") || 0), items: itemsByOrder[String(getCellValue(row, orderHeaders, "orderNumber"))] || []
  }));
}

function getPackagesFromSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.PACKAGES);
  if (!sheet || sheet.getLastRow() < 2) return PACKAGE_CATALOG.map(packageInfo => ({ ...packageInfo }));
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(String);
  const indexes = { id: headers.indexOf("id"), name: headers.indexOf("name"), pieces: headers.indexOf("pieces"), price: headers.indexOf("price") };
  if (Object.values(indexes).some(index => index < 0)) throw new Error("Package sheet columns are missing.");
  return rows.slice(1).filter(row => row[indexes.id]).map(row => {
    const packageInfo = { id: String(row[indexes.id]), name: String(row[indexes.name] || "").trim(), pieces: Number(row[indexes.pieces]), price: Number(row[indexes.price]) };
    if (!packageInfo.name || !Number.isSafeInteger(packageInfo.pieces) || packageInfo.pieces < 1 || !Number.isSafeInteger(packageInfo.price) || packageInfo.price < 0) throw new Error(`Package details are invalid for ${packageInfo.id}.`);
    return packageInfo;
  });
}

function updateAdminPackage(payload) {
  const id = String(payload && payload.id || "").trim();
  const name = String(payload && payload.name || "").trim();
  const pieces = Number(payload && payload.pieces);
  const price = Number(payload && payload.price);
  if (!PACKAGE_CATALOG.some(packageInfo => packageInfo.id === id) || !name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name) || !Number.isSafeInteger(pieces) || pieces < 1 || pieces > 100000 || !Number.isSafeInteger(price) || price < 0 || price > 10000000) {
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
    ["name", "pieces", "price"].forEach((header) => {
      const index = headers.indexOf(header);
      if (index < 0) throw new Error("Package sheet columns are missing.");
      sheet.getRange(rowNumber, index + 1).setValue(header === "name" ? sanitizeForCell(name) : header === "pieces" ? pieces : price);
    });
    return { success: true, package: { id, name, pieces, price } };
  } finally { lock.releaseLock(); }
}

function getCellValue(row, headers, name) { const index = headers.indexOf(name); return index < 0 ? "" : row[index]; }

function updateAdminOrderStatus(orderNumber, status) {
  const normalizedOrderNumber = String(orderNumber || "").trim();
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!normalizedOrderNumber || normalizedOrderNumber.length > 80 || !ORDER_STATUS_VALUES.includes(normalizedStatus)) return { success: false, message: "A valid order number and status are required." };
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
    for (let index = 1; index < orderRows.length; index++) { if (String(orderRows[index][orderNumberIndex] || "") === normalizedOrderNumber) { orderRow = index + 1; break; } }
    if (orderRow < 0) return { success: false, message: "Order not found." };
    const itemRows = orderItemsSheet.getDataRange().getValues();
    const itemHeaders = itemRows.length ? itemRows[0].map(String) : [];
    const itemOrderNumberIndex = itemHeaders.indexOf("orderNumber");
    const itemStatusIndex = itemHeaders.indexOf("status");
    if (itemOrderNumberIndex < 0 || itemStatusIndex < 0) throw new Error("Order item columns are missing.");
    ordersSheet.getRange(orderRow, statusIndex + 1).setValue(normalizedStatus);
    for (let index = 1; index < itemRows.length; index++) { if (String(itemRows[index][itemOrderNumberIndex] || "") === normalizedOrderNumber) orderItemsSheet.getRange(index + 1, itemStatusIndex + 1).setValue(normalizedStatus); }
    return { success: true, orderNumber: normalizedOrderNumber, status: normalizedStatus };
  } finally { lock.releaseLock(); }
}

function submitOrder(payload) {
  if (!payload || typeof payload !== "object") return { success: false, message: "Order details are missing." };
  if (payload.honeypot && String(payload.honeypot).trim()) return { success: false, message: "Request rejected." };
  if (JSON.stringify(payload).length > 50000) return { success: false, message: "Your order is too large." };
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
  const today = Utilities.formatDate(new Date(), "Asia/Manila", "yyyy-MM-dd");
  if (pickupDate < today) return { success: false, message: "Pickup date cannot be in the past." };
  const orderDetail = [];
  let subtotal = 0;
  const availablePackages = getPackagesFromSheet();
  const allProducts = getAllProductsFromSheet();
  const productById = {};
  allProducts.forEach(p => { if (p && p.id) productById[String(p.id)] = p; });
  for (const item of items) {
    const packageInfo = availablePackages.find(entry => entry.id === String(item.packageId));
    const qty = Number(item.qty || 0);
    if (!packageInfo) return { success: false, message: "Unknown product or package." };
    if (!Number.isSafeInteger(qty) || qty < 1) return { success: false, message: "Invalid package quantity." };
    let varietyIds = [];
    if (Array.isArray(item.varieties)) varietyIds = item.varieties.map(v => String(v)); else if (item.id) varietyIds = [String(item.id)];
    if (varietyIds.length < 1 || varietyIds.length > 3) return { success: false, message: "Choose 1 to 3 varieties." };
    if (new Set(varietyIds).size !== varietyIds.length) return { success: false, message: "Duplicate variety." };
    if (!varietyIds.every(vid => productById[vid] && productById[vid].available)) return { success: false, message: "A selected variety is unavailable. Please refresh the menu and try again." };
    const varietyNames = varietyIds.map(vid => productById[vid].name || vid);
    orderDetail.push({ productId: varietyIds.join("+"), productName: varietyNames.join(" + "), qty, packageId: packageInfo.id, packageName: packageInfo.name, pieces: packageInfo.pieces, price: packageInfo.price });
    subtotal += qty * packageInfo.price;
  }
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) return { success: false, message: "The order total is outside the supported range." };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const ordersSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDERS);
    const orderItemsSheet = spreadsheet.getSheetByName(SHEET_TABS.ORDER_ITEMS);
    if (!ordersSheet || !orderItemsSheet) throw new Error("Order sheets are not set up. Run setupSheet() first.");
    const orderNumber = generateOrderNumber();
    const createdAt = Utilities.formatDate(new Date(), "Asia/Manila", "yyyy-MM-dd HH:mm:ss");
    const confirmationToken = Utilities.getUuid() + "-" + Utilities.getUuid();
    const tokenHash = sha256Hex(confirmationToken);
    const itemsSummary = orderDetail.map(d => `${d.productName} (${d.packageName}, ${d.pieces} pcs) x ${d.qty}`).join("; ");
    ordersSheet.appendRow([createdAt, orderNumber, "pending", pickupDate, pickupTime, "pickup", sanitizeForCell(name), sanitizeForCell(phone), sanitizeForCell(email), sanitizeForCell(itemsSummary), subtotal, 0, subtotal, paymentMethod, "", "unpaid", "", sanitizeForCell(notes), tokenHash, sanitizeForCell(accountEmail)]);
    orderDetail.forEach(d => { orderItemsSheet.appendRow([orderNumber, pickupDate, d.productId, sanitizeForCell(d.productName), d.qty, "pending", d.packageId, sanitizeForCell(d.packageName), d.pieces, d.price]); });
    return { success: true, orderNumber: orderNumber, confirmationToken: confirmationToken };
  } finally { lock.releaseLock(); }
}

function findOrderByNumber(orderNumber) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TABS.ORDERS);
  if (!sheet) return null;
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const orderIndex = headers.indexOf("orderNumber");
  if (orderIndex < 0) return null;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][orderIndex] || "") === String(orderNumber)) { const record = {}; headers.forEach((header, index) => { record[String(header)] = rows[i][index]; }); return record; }
  }
  return null;
}

function sanitizePublicOrder(order) {
  return {
    orderNumber: order.orderNumber, status: order.status, pickupDate: formatOrderDate(order.pickupDate), timeSlot: order.timeSlot, orderType: order.orderType,
    paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, subtotal: Number(order.subtotal || 0), total: Number(order.total || 0),
    items: getOrderItemsForNumber(order.orderNumber).map(item => ({ id: item.productId, name: item.productName, qty: Number(item.qty || 0), packageId: item.packageId || "", packageName: item.packageName || "", pieces: Number(item.pieces || 0), price: Number(item.unitPrice || 0) }))
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
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][orderNumberIndex] || "") === String(orderNumber)) {
      result.push({ orderNumber: rows[i][orderNumberIndex], pickupDate: getCellValue(rows[i], headers, "pickupDate"), productId: getCellValue(rows[i], headers, "productId"), productName: getCellValue(rows[i], headers, "productName"), qty: getCellValue(rows[i], headers, "qty"), status: getCellValue(rows[i], headers, "status"), packageId: getCellValue(rows[i], headers, "packageId") || "", packageName: getCellValue(rows[i], headers, "packageName") || "", pieces: getCellValue(rows[i], headers, "pieces") || "", unitPrice: getCellValue(rows[i], headers, "unitPrice") || "" });
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
  for (let i = 1; i < rows.length; i++) { if (String(rows[i][orderNumberIndex]) === orderNumber) orderItemsSheet.getRange(i + 1, statusIndex + 1).setValue(newStatus); }
}
