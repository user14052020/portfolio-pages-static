const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('project-previews/party-1c.js');
const context = vm.createContext({ HTMLElement: class { attachShadow() {} }, customElements: { get: () => true }, Intl, Date, requestAnimationFrame: () => 1 });
vm.runInContext(source.replace("import { ICONS } from './tm-icons.js';", read('project-previews/tm-icons.js').replace('export const ICONS', 'const ICONS'))
  .replace("import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';", 'const renderPreview = () => {}; const stopPreviewLoading = () => {};')
  .replace("import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=7';", require('./project-diagram-fixture.cjs'))
  .replace("new URL('./party-1c.css?v=1', import.meta.url).href", "'party-1c.css'")
  + '\nthis.Preview = Party1cPreview; this.lots = LOTS; this.docs = DOCUMENTS; this.allocate = allocate; this.balance = balance; this.crm = crmProjection; this.days = days; this.heading = projectHeading;', context);
assert.equal(context.heading('party').match(/<svg /g).length, 4);
const before = JSON.stringify(context.lots);
context.lots.forEach(Object.freeze); context.docs.forEach(Object.freeze);
const four = context.allocate(4, 0), twelve = context.allocate(12, 0), missing = context.allocate(4, 1);
assert.deepEqual(Array.from(four.rows, row => [row.lot.id, row.take]), [['B-024', 4]]);
assert.deepEqual(Array.from(twelve.rows, row => [row.lot.id, row.take]), [['B-024', 10], ['B-025', 2]]);
assert.equal(twelve.remaining, 0); assert.equal(missing.remaining, 1);
assert.equal(context.days('2026-06-17', '2026-09-15'), 90);
assert.equal(context.days('2026-08-20', '2026-09-15'), 26);
for (const quantity of [4, 12]) for (const warehouse of [0, 1]) {
  const selection = context.allocate(quantity, warehouse);
  assert.equal(selection.rows.reduce((sum, row) => sum + row.take, 0) + selection.remaining, quantity);
  selection.rows.forEach(({ lot, take }) => {
    assert.equal(lot.warehouse, warehouse); assert.ok(lot.expiry >= '2026-08-20'); assert.ok(take <= lot.stock - lot.reserved);
    const reserve = context.balance(lot, take, 'reserve'), sale = context.balance(lot, take, 'sale');
    assert.equal(reserve.stock, lot.stock); assert.equal(reserve.reserved, lot.reserved + take);
    assert.equal(sale.stock, lot.stock - take); assert.equal(sale.reserved, lot.reserved);
    const crm = context.crm(lot, take);
    assert.equal(crm.stock, sale.stock); assert.equal(crm.available, sale.stock - sale.reserved);
    assert.equal(crm.documents.length, 2); assert.ok(crm.documents.every(file => file.includes(lot.id.replace('-', ''))));
    assert.ok(!JSON.stringify(crm).includes('customs-')); assert.ok(!('history' in crm) && !('user' in crm));
  });
}
const preview = new context.Preview();
const attrs = { locale: 'ru' };
preview.getAttribute = name => attrs[name] || null;
preview.style = { setProperty() {} }; preview.setAttribute = () => {};
preview.motion = { matches: false }; preview.syncClock = () => {}; preview.updatePlayButton = () => {};
const scene = { innerHTML: '', setAttribute() {} }, counter = {}, playback = {}, focusNode = { focus() {} };
preview.shadowRoot = { querySelector: selector => selector === '.scene' ? scene : selector === '[data-counter]' ? counter : selector === '[data-playback-state]' ? playback : focusNode, querySelectorAll: () => [] };
for (const locale of ['ru', 'en']) {
  attrs.locale = locale;
  for (const warehouse of [0, 1]) for (const quantity of [4, 12]) {
    preview.warehouse = warehouse; preview.quantity = quantity;
    for (let feature = 0; feature < 4; feature++) {
      preview.feature = feature; preview.renderScene();
      assert.ok(scene.innerHTML.includes('class="flow"')); assert.ok(!/undefined|Invalid Date|NaN/.test(scene.innerHTML));
      assert.equal(counter.textContent, `0${feature + 1} / 04`);
    }
    assert.equal(preview.stockScene().includes('class="ledger-grid"'), preview.selection.remaining === 0, 'Incomplete allocations cannot post a sale');
  }
  for (let index = 0; index < 3; index++) { preview.documentIndex = index; assert.ok(preview.passportScene().includes(context.docs[index].file)); }
}
assert.equal(JSON.stringify(context.lots), before, 'Scenes do not mutate stock data');
function change(value, selector) { preview.onChange({ target: { value, matches: rule => rule === selector } }); }
change('4', '[data-quantity]'); assert.equal(preview.quantity, 4);
change('12', '[data-quantity]'); assert.equal(preview.quantity, 12);
change('9', '[data-quantity]'); assert.equal(preview.quantity, 12);
change('0', '[data-warehouse]'); assert.equal(preview.warehouse, 0);
change('1', '[data-warehouse]'); assert.equal(preview.warehouse, 1);
preview.feature = 0; preview.tour = true; preview.elapsed = 0; preview.running = true;
for (let now = 100; now <= 12200; now += 100) preview.tick(now);
assert.equal(preview.feature, 1);
preview.select(3); assert.equal(preview.feature, 3); assert.equal(preview.tour, false);
preview.select(-1); assert.equal(preview.feature, 3);
preview.motion.matches = true; preview.select(2); assert.equal(preview.elapsed, 11999); assert.equal(preview.wanted, false);
preview.running = false; preview.tick(25000); assert.equal(preview.elapsed, 11999);
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|<iframe|localStorage/i.test(source));
for (const file of ['party-1c.js', 'party-1c.css', 'party-host.css']) assert.equal(read('project-previews/' + file), fs.readFileSync(path.resolve(root, '../apps/frontend/public/project-previews/' + file), 'utf8'));
assert.ok(read('project-previews/party-1c.css').includes('prefers-reduced-motion'));
const canonical = fs.readFileSync(path.resolve(root, '../apps/frontend/src/widgets/home-showcase/ui/HomeShowcase.tsx'), 'utf8');
assert.ok(canonical.includes('project.slug === "partiya-1c"')); assert.ok(canonical.includes('<Party1cPreview locale={locale} description={projectDescription} />'));
for (const file of ['index.html', '404.html']) {
  const html = read(file); assert.ok(html.includes('src="/project-previews/party-1c.js?v=1"')); assert.ok(html.includes('party-host.css?v=1'));
  const chunkPath = [...new Set(html.match(/app\/page-[a-f0-9]+\.js/g))]; assert.equal(chunkPath.length, 1);
  const chunk = read('_next/static/chunks/' + chunkPath[0]);
  assert.equal(chunkPath[0], 'app/page-' + crypto.createHash('sha256').update(chunk).digest('hex').slice(0, 16) + '.js');
  assert.ok(chunk.includes('"partiya-1c"===n.slug?(0,r.jsx)("party-1c-preview",{locale:a,description:m})'));
  assert.ok(['payments-1c-preview', 'receipts-1c-preview', 'contracts-1c-preview'].every(tag => chunk.includes(tag))); new vm.Script(chunk);
}
const project = JSON.parse(read('data/projects.json')).find(item => item.slug === 'partiya-1c');
assert.equal(project.media_items.length, 6);
assert.ok(project.media_items.every(media => read('projects/partiya-1c/index.html').includes(media.url)));
console.log('Party / 1C FEFO, reservations, shipment balances, CRM permissions, four scenes and static integration checks passed.');
