const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const client = join(process.cwd(), 'client');
const menuPage = readFileSync(join(client, 'menu-page.js'), 'utf8');
const trayPhotos = readFileSync(join(client, 'tray-photos.js'), 'utf8');
const { Cart } = require(join(client, 'cart.js'));

test('variety cards show only photo/name/description/seasonal/allergen and Add to Order button without tray size controls', () => {
    assert.ok(menuPage.includes('Add to Order'));
    assert.ok(!menuPage.includes('tray-size-radio'));
    assert.ok(!menuPage.includes('tray-size-fieldset'));
    assert.ok(!menuPage.includes('product-from-price'));
    assert.ok(menuPage.includes('tray-builder-dialog'));
});

test('gallery renders .webp <source> and .jpg fallback from tray-photos.js', () => {
    assert.ok(menuPage.includes('source.srcset = photo.file;'));
    assert.ok(menuPage.includes('source.type = "image/webp";'));
    assert.ok(menuPage.includes('image.src = photo.file.replace(/\\.webp$/i, ".jpg");'));
    assert.ok(menuPage.includes('image.loading = "lazy";'));
    assert.ok(menuPage.includes('image.alt = photo.alt;'));
    assert.ok(menuPage.includes('image.width = Number(photo.width);'));
    assert.ok(menuPage.includes('image.height = Number(photo.height);'));
    const files = [...trayPhotos.matchAll(/file:\s*"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(files.length > 0);
    const missing = [];
    for (const file of files) {
        assert.ok(file.endsWith('.webp'));
        const jpg = file.replace(/\.webp$/i, '.jpg');
        try { readFileSync(join(client, jpg)); } catch { missing.push(jpg); }
    }
    assert.deepStrictEqual(missing, []);
});

test('cart enforces max 3 varieties and rejects duplicates', () => {
    global.window = { PACKAGES: [{id:'aluminum-tray',name:'Aluminum Tray',pieces:30,price:280}], PRODUCTS:[{id:'a'},{id:'b'},{id:'c'},{id:'d'}] };
    const cart = new Cart();
    cart.items = [];
    assert.throws(() => cart.add('aluminum-tray', ['a','b','c','d'], 1), /1 to 3/);
    assert.throws(() => cart.add('aluminum-tray', ['a','a'], 1), /Duplicate/);
    delete global.window;
});

test('old cart lines migrate from {id, packageId, qty} to varieties: [id]', () => {
    const store = {};
    const origLocalStorage = global.localStorage;
    global.window = { PACKAGES: [{id:'aluminum-tray',name:'Aluminum Tray',pieces:30,price:280}], PRODUCTS:[{id:'puto-cheese'}] };
    global.localStorage = { getItem:(k)=>store[k]||null, setItem:(k,v)=>{store[k]=String(v);}, removeItem:(k)=>{delete store[k];} };
    store['vk_cart'] = JSON.stringify([{ id: 'puto-cheese', packageId: 'aluminum-tray', qty: 2 }]);
    const cart = new Cart();
    assert.equal(cart.items.length, 1);
    assert.deepEqual(cart.items[0].varieties, ['puto-cheese']);
    global.localStorage = origLocalStorage;
    delete global.window;
});

test('same set of varieties in different order merges', () => {
    global.window = { PACKAGES: [{id:'aluminum-tray',name:'Aluminum Tray',pieces:30,price:280}], PRODUCTS:[{id:'kutsinta'},{id:'puto-cheese'}] };
    const cart = new Cart();
    cart.items = [];
    cart.add('aluminum-tray', ['kutsinta', 'puto-cheese'], 1);
    cart.add('aluminum-tray', ['puto-cheese', 'kutsinta'], 2);
    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0].qty, 3);
    assert.deepEqual(cart.items[0].varieties, ['kutsinta','puto-cheese'].sort());
    delete global.window;
});

test('price unaffected by which varieties are chosen', () => {
    global.window = { PACKAGES: [{ id: 'aluminum-tray', name: 'Aluminum Tray', pieces: 30, price: 280 }], PRODUCTS: [{ id: 'puto-cheese' }, { id: 'biko' }] };
    const cart = new Cart();
    cart.items = [];
    cart.add('aluminum-tray', ['puto-cheese'], 1);
    const subtotal1 = cart.subtotal();
    cart.clear();
    cart.add('aluminum-tray', ['puto-cheese', 'biko'], 3);
    const subtotal2 = cart.subtotal();
    assert.equal(subtotal1, 280);
    assert.equal(subtotal2, 840);
    delete global.window;
});
