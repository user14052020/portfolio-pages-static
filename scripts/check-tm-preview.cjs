const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('project-previews/tm-electronics.js');
const icons = read('project-previews/tm-icons.js');
const context = vm.createContext({
  HTMLElement: class { attachShadow() {} }, customElements: {get: () => true}, URL, Intl,
  requestAnimationFrame: () => 1, cancelAnimationFrame: () => {}, document: {hidden: false},
});
vm.runInContext(source.replace("import { ICONS } from './tm-icons.js';", icons.replace('export const ICONS', 'const ICONS'))
  .replace("import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';", 'const renderPreview = (root, urls, markup) => { root.innerHTML = markup; }; const stopPreviewLoading = () => {};')
  .replace("import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=3';", require('./project-diagram-fixture.cjs'))
  .replaceAll('import.meta.url', "'https://example.com/project-previews/tm-electronics.js'")
  + '\nthis.Preview=TmElectronicsPreview;this.escapeHtml=escape;', context);
const preview = new context.Preview();
const attrs = {locale: 'ru', description: '<img onerror="alert(1)">'};
preview.getAttribute = key => attrs[key] || null;
preview.setAttribute = (key, value) => { attrs[key] = value; };
preview.style = {setProperty: () => {}};
preview.motion = {matches: false};
preview.shadowRoot = {innerHTML: '', querySelector: () => null, querySelectorAll: () => []};
preview.renderScene = () => {};
preview.updatePlayButton = () => {};
preview.syncClock = () => {};
assert.equal(preview.siteUrl(), 'https://tmelectronics.ru/');
attrs['site-url'] = 'javascript:alert(1)';
assert.equal(preview.siteUrl(), 'https://tmelectronics.ru/');
assert.equal(context.escapeHtml('<a "x">'), '&lt;a &quot;x&quot;&gt;');
preview.render();
assert.ok(/class="preview">\s*<div class="case-intro">/.test(preview.shadowRoot.innerHTML));
assert.ok(preview.shadowRoot.innerHTML.includes('<details><summary class="project-details-summary">'));
assert.equal((preview.shadowRoot.innerHTML.match(/class="case-intro"/g)||[]).length,1);
assert.ok(preview.shadowRoot.innerHTML.indexOf('href="https://tmelectronics.ru/"') < preview.shadowRoot.innerHTML.indexOf('class="feature-map"'), 'Website link precedes the work map');
assert.equal((preview.shadowRoot.innerHTML.match(/role="tab" /g) || []).length, 7);
assert.ok(preview.shadowRoot.innerHTML.includes('&lt;img onerror='));
assert.ok(!preview.shadowRoot.innerHTML.includes('<img onerror='));
for (const [value, expected] of [[0, 1], [-100, 1], ['bad', 1], [Infinity, 99], [300, 99], [3.9, 3]]) {
  preview.setQuantity(value); assert.equal(preview.quantity, expected);
}
preview.select(6); assert.equal(preview.feature, 6);
for (const value of [-1, 7, NaN, 1.5]) { preview.select(value); assert.equal(preview.feature, 6); }
preview.motion.matches = true; preview.select(1);
assert.equal(preview.wanted, false); assert.equal(preview.elapsed, 10499);
preview.motion.matches = false; preview.select(0);
assert.equal(preview.wanted, true); assert.equal(preview.elapsed, 0);
assert.ok(preview.catalog().includes('data-product="1"'));
preview.filtered = true; assert.ok(!preview.catalog().includes('data-product="1"'));
preview.filtered = false; preview.setQuantity(2);
assert.ok(preview.productPage().includes(preview.money(14278)));
preview.onClick({target: {closest: () => ({hasAttribute: () => false, dataset: {action: 'cart'}})}});
assert.equal(preview.cart, 2); assert.equal(preview.page, 'checkout');
assert.ok(preview.checkout().includes('demo@example.com'));
assert.ok(preview.bonus().includes('15%'));
preview.carrier = 'courier'; assert.ok(preview.delivery().includes('Курьерская доставка'));
assert.ok(preview.partnerApi().includes('"stock"'));
assert.ok(preview.speed().includes('без замеров времени'));
assert.ok(preview.bugs().includes('data-test="3"'));
assert.ok(preview.crm().includes('Плановый обмен'));
assert.ok(preview.syncRows(true).includes('Цена в CRM'));
assert.ok(preview.syncRows(false).includes('Наличие'));
attrs.locale = 'en';
assert.ok(preview.crm().includes('Scheduled sync'));
assert.ok(preview.bonus().includes('Customer balance'));
assert.ok(preview.layout().includes('Checkout'));
attrs.locale = 'ru';
const node = data => ({dataset: data, style: {setProperty: () => {}}, classList: {contains: () => false}});
const phase = node({phase: '0'}), reveal = node({reveal: '3'}), row = node({updateRow: '1'}), test = node({test: '3'});
const balance = {}, qty = {}, price = {}, label = {};
preview.shadowRoot = {
  querySelector: key => ({'[data-count="balance"]': balance, '[data-valid-qty]': qty, '[data-valid-price]': price, '.state-label': label})[key] || null,
  querySelectorAll: key => ({'[data-phase]': [phase], '[data-reveal]': [reveal], '[data-update-row]': [row], '[data-test]': [test]})[key] || [],
};
preview.feature = 6; preview.elapsed = 0; preview.updateAnimation();
assert.equal(phase.dataset.state, 'active'); assert.equal(row.dataset.updated, 'false');
assert.equal(reveal.dataset.ready, 'false'); assert.equal(test.dataset.passed, 'false');
assert.equal(balance.textContent, '100');
preview.elapsed = 8000; preview.updateAnimation();
assert.equal(phase.dataset.state, 'done'); assert.equal(row.dataset.updated, 'true');
assert.equal(reveal.dataset.ready, 'true'); assert.equal(test.dataset.passed, 'true');
assert.equal(balance.textContent, new Intl.NumberFormat('ru-RU').format(1600));
assert.equal(qty.textContent, '1'); assert.equal(label.textContent, 'Завершено');
preview.feature = 0; preview.elapsed = 0; preview.page = 'catalog'; preview.running = true; preview.lastTime = 0;
for (let now = 100; now <= 3800; now += 100) preview.tick(now);
assert.equal(preview.page, 'product');
for (let now = 3900; now <= 7400; now += 100) preview.tick(now);
assert.equal(preview.page, 'checkout');
preview.running = false; const stopped = preview.elapsed; preview.tick(7600); assert.equal(preview.elapsed, stopped);
assert.ok(source.includes("closest('button[data-feature]')"), 'Only feature tabs handle feature keyboard navigation');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|<iframe|localStorage/.test(source));
assert.ok(source.includes('disconnectedCallback()')); assert.ok(source.includes('prefers-reduced-motion'));
assert.ok(read('project-previews/tm-electronics.css').includes('@container tm'));
for (const file of ['index.html', '404.html']) {
  const html = read(file); assert.ok(html.includes('src="/project-previews/tm-electronics.js?v=6"'));
  const chunks = [...new Set(html.match(/app\/page-[a-f0-9]+\.js/g))]; assert.equal(chunks.length, 1);
  const chunk = read('_next/static/chunks/' + chunks[0]);
  assert.equal(chunks[0], `app/page-${crypto.createHash('sha256').update(chunk).digest('hex').slice(0, 16)}.js`);
  for (const tag of ['tm-electronics-preview', 'eicom-shop-preview', 'shifts-crm-preview', 'calls-llm-preview', 'dental-crm-preview']) assert.ok(chunk.includes(tag), tag);
}
for (const file of ['data/live-projects.json', 'data/projects.json', 'api/v1/projects/index.html', 'api/v1/projects/electronic-components/index.html']) {
  const data = JSON.parse(read(file)); const project = Array.isArray(data) ? data.find(item => item.slug === 'electronic-components') : data;
  assert.equal(project.live_url, 'https://tmelectronics.ru/');
  assert.ok(project.description_ru.includes('CRM')); assert.ok(project.description_ru.length < 180);
}
assert.ok(read('projects/electronic-components/index.html').includes('href="https://tmelectronics.ru/">Live</a>'));
for (const asset of ['gland.webp', 'nut.webp', 'connectors.webp', 'delivery.webp']) assert.ok(fs.statSync(path.join(root, 'project-previews/tm-assets', asset)).size > 100);
console.log('TM Electronics preview checks passed.');
