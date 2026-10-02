const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('project-previews/payments-1c.js');
const context = vm.createContext({ HTMLElement: class { attachShadow() {} }, customElements: { get: () => true }, Intl, requestAnimationFrame: () => 1 });
vm.runInContext(source.replace("import { ICONS } from './tm-icons.js';", read('project-previews/tm-icons.js').replace('export const ICONS', 'const ICONS'))
  .replace("import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';", 'const renderPreview = () => {}; const stopPreviewLoading = () => {};')
  .replace("import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=4';", require('./project-diagram-fixture.cjs'))
  .replace("new URL('./payments-1c.css?v=1', import.meta.url).href", "'payments-1c.css'")
  + '\nthis.Preview = Payments1cPreview; this.payments = PAYMENTS; this.rules = RULES; this.result = resultFor; this.heading = projectHeading;', context);
assert.equal(context.heading('payments').match(/<svg /g).length, 4);
assert.deepEqual(Array.from(context.payments, payment => context.result(payment).status), ['done', 'done', 'done', 'skipped', 'protected']);
assert.deepEqual(Array.from(context.payments, payment => context.result(payment).rule?.id || null), ['R-01', 'R-02', 'R-03', null, null]);
const before = JSON.stringify(context.payments);
for (const payment of context.payments) { Object.freeze(payment); context.result(payment); context.result(payment); }
assert.equal(JSON.stringify(context.payments), before, 'Repeated processing cannot mutate sample payments');
assert.equal(context.result({ ...context.payments[0], direction: 'out' }).status, 'skipped', 'Direction is part of the matching condition');
const preview = new context.Preview();
const attrs = { locale: 'ru' };
preview.getAttribute = name => attrs[name] || null;
preview.style = { setProperty() {} };
preview.setAttribute = () => {};
preview.motion = { matches: false };
preview.syncClock = () => {};
preview.updatePlayButton = () => {};
const scene = { innerHTML: '', setAttribute() {} }, counter = {}, playback = {};
preview.shadowRoot = { querySelector: selector => selector === '.scene' ? scene : selector === '[data-counter]' ? counter : playback, querySelectorAll: () => [] };
for (const [elapsed, count] of [[0, 0], [2399, 0], [2400, 1], [4600, 3], [6800, 5], [11999, 5]]) {
  preview.elapsed = elapsed; assert.equal(preview.completedCount(), count);
}
for (const locale of ['ru', 'en']) {
  attrs.locale = locale;
  for (let feature = 0; feature < 4; feature++) {
    preview.feature = feature; preview.renderScene();
    assert.ok(scene.innerHTML.includes('class="flow"'));
    assert.ok(!scene.innerHTML.includes('undefined'));
    assert.equal(counter.textContent, `0${feature + 1} / 04`);
  }
  preview.feature = 0;
  for (let sample = 0; sample < 5; sample++) {
    preview.sample = sample;
    assert.ok(!preview.rulesScene().includes('undefined'));
  }
}
preview.feature = 0; preview.tour = true; preview.elapsed = 0; preview.running = true;
for (let now = 100; now <= 12200; now += 100) preview.tick(now);
assert.equal(preview.feature, 1, 'Initial autoplay tours the four delivered tasks');
preview.select(3);
assert.equal(preview.feature, 3); assert.equal(preview.tour, false);
preview.select(7); assert.equal(preview.feature, 3, 'Invalid scene is ignored');
preview.motion.matches = true; preview.select(2);
assert.equal(preview.elapsed, 11999); assert.equal(preview.wanted, false);
preview.running = false;
preview.tick(25000); assert.equal(preview.elapsed, 11999, 'Paused clocks do not advance');
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|<iframe|localStorage/.test(source));
for (const file of ['payments-1c.js', 'payments-1c.css', 'payments-host.css']) {
  assert.equal(read('project-previews/' + file), fs.readFileSync(path.resolve(root, '../apps/frontend/public/project-previews/' + file), 'utf8'));
}
assert.ok(read('project-previews/payments-1c.css').includes('prefers-reduced-motion'));
for (const file of ['index.html', '404.html']) {
  const html = read(file);
  assert.ok(html.includes('src="/project-previews/payments-1c.js?v=1"'));
  assert.equal((html.match(/<payments-1c-preview /g) || []).length, 1);
  const chunkPath = [...new Set(html.match(/app\/page-[a-f0-9]+\.js/g))];
  assert.equal(chunkPath.length, 1);
  const chunk = read('_next/static/chunks/' + chunkPath[0]);
  assert.equal(chunkPath[0], 'app/page-' + crypto.createHash('sha256').update(chunk).digest('hex').slice(0, 16) + '.js');
  assert.ok(chunk.includes('"buh-payments-auto"===n.slug?(0,r.jsx)("payments-1c-preview",{locale:a,description:m})'));
  for (const tag of ['dental-crm-preview', 'calls-llm-preview', 'shifts-crm-preview', 'eicom-shop-preview', 'tm-electronics-preview', 'furniture-1c-preview']) assert.ok(chunk.includes(tag));
  new vm.Script(chunk);
}
assert.equal(JSON.parse(read('data/projects.json')).find(item => item.slug === 'buh-payments-auto').media_items.length, 4, 'Original screenshot evidence is retained');
console.log('Payments / 1C rules, batch, states, journal, autoplay, reduced motion and static integration checks passed.');
