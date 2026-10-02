const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('project-previews/receipts-1c.js');
const context = vm.createContext({ HTMLElement: class { attachShadow() {} }, customElements: { get: () => true }, Intl, Date, requestAnimationFrame: () => 1 });
vm.runInContext(source.replace("import { ICONS } from './tm-icons.js';", read('project-previews/tm-icons.js').replace('export const ICONS', 'const ICONS'))
  .replace("import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';", 'const renderPreview = () => {}; const stopPreviewLoading = () => {};')
  .replace("import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=5';", require('./project-diagram-fixture.cjs'))
  .replace("new URL('./receipts-1c.css?v=1', import.meta.url).href", "'receipts-1c.css'")
  + '\nthis.Preview = Receipts1cPreview; this.registers = REGISTERS; this.files = FILES; this.result = resultFor; this.heading = projectHeading;', context);
assert.equal(context.heading('receipts').match(/<svg /g).length, 4);
const settings = { source: 'folder', period: 30, tolerance: 1 };
assert.deepEqual(Array.from(context.registers, register => context.result(register, settings).status), ['attached', 'attached', 'missing', 'outside']);
assert.equal(context.result(context.registers[1], { ...settings, tolerance: 0 }).status, 'date');
assert.equal(context.result(context.registers[1], { ...settings, tolerance: 1 }).difference, 1);
assert.equal(context.result(context.registers[3], { ...settings, period: 60 }).status, 'attached');
assert.equal(context.result(context.registers[3], { ...settings, period: 47 }).status, 'attached', 'Period boundary is inclusive');
assert.equal(context.result(context.registers[3], { ...settings, period: 46 }).status, 'outside');
assert.equal(context.result({ ...context.registers[0], date: '2026-06-02' }, settings).status, 'outside', 'Future registers are not searched');
assert.equal(context.result(context.registers[0], { ...settings, source: 'log' }).file, context.files[0]);
const before = JSON.stringify(context.registers);
for (const register of context.registers) { Object.freeze(register); context.result(register, settings); context.result(register, settings); }
assert.equal(JSON.stringify(context.registers), before, 'Sample matching does not modify source records');

const preview = new context.Preview();
const attrs = { locale: 'ru' };
preview.getAttribute = name => attrs[name] || null;
preview.style = { setProperty() {} }; preview.setAttribute = () => {};
preview.motion = { matches: false }; preview.syncClock = () => {}; preview.updatePlayButton = () => {};
const scene = { innerHTML: '', setAttribute() {} }, counter = {}, playback = {};
preview.shadowRoot = { querySelector: selector => selector === '.scene' ? scene : selector === '[data-counter]' ? counter : selector === '[data-playback-state]' ? playback : null, querySelectorAll: () => [] };
for (const [elapsed, count] of [[0, 0], [2399, 0], [2400, 1], [4800, 3], [6000, 4], [11999, 4]]) {
  preview.elapsed = elapsed; assert.equal(preview.completedCount(), count);
}
for (const locale of ['ru', 'en']) {
  attrs.locale = locale;
  for (let feature = 0; feature < 4; feature++) {
    preview.feature = feature; preview.renderScene();
    assert.ok(scene.innerHTML.includes('class="flow"'));
    assert.ok(!/undefined|Invalid Date/.test(scene.innerHTML));
    assert.equal(counter.textContent, `0${feature + 1} / 04`);
  }
  for (let sample = 0; sample < 4; sample++) {
    preview.sample = sample; assert.ok(!/undefined|Invalid Date/.test(preview.attachScene()));
  }
}
attrs.locale = 'ru';
preview.sample = 1; preview.settings.tolerance = 0;
assert.ok(preview.attachScene().includes('Чек не прикреплен'));
preview.settings.tolerance = 1;
assert.ok(preview.attachScene().includes('RS_102_2026-06-01.pdf'));
assert.ok(preview.journalScene().includes('ЧекНеНайден'));
assert.ok(preview.journalScene().includes('ЗаданиеЗавершено'));
preview.feature = 0; preview.tour = true; preview.elapsed = 0; preview.running = true;
for (let now = 100; now <= 12200; now += 100) preview.tick(now);
assert.equal(preview.feature, 1, 'Initial autoplay tours the delivered tasks');
preview.select(3); assert.equal(preview.feature, 3); assert.equal(preview.tour, false);
preview.select(-1); assert.equal(preview.feature, 3);
preview.motion.matches = true; preview.select(2);
assert.equal(preview.elapsed, 11999); assert.equal(preview.wanted, false);
preview.running = false; preview.tick(25000); assert.equal(preview.elapsed, 11999);
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|<iframe|localStorage/.test(source), 'Demo makes no real file or financial side effects');
for (const file of ['receipts-1c.js', 'receipts-1c.css', 'receipts-host.css']) {
  assert.equal(read('project-previews/' + file), fs.readFileSync(path.resolve(root, '../apps/frontend/public/project-previews/' + file), 'utf8'));
}
assert.ok(read('project-previews/receipts-1c.css').includes('prefers-reduced-motion'));
const canonical = fs.readFileSync(path.resolve(root, '../apps/frontend/src/widgets/home-showcase/ui/HomeShowcase.tsx'), 'utf8');
assert.ok(canonical.includes('project.slug === "buh-self-employed-receipt"'));
assert.ok(canonical.includes('<Receipts1cPreview locale={locale} description={projectDescription} />'));
for (const file of ['index.html', '404.html']) {
  const html = read(file);
  assert.ok(html.includes('src="/project-previews/receipts-1c.js?v=1"'));
  assert.ok(html.includes('receipts-host.css?v=1'));
  const chunkPath = [...new Set(html.match(/app\/page-[a-f0-9]+\.js/g))];
  assert.equal(chunkPath.length, 1);
  const chunk = read('_next/static/chunks/' + chunkPath[0]);
  assert.equal(chunkPath[0], 'app/page-' + crypto.createHash('sha256').update(chunk).digest('hex').slice(0, 16) + '.js');
  assert.ok(chunk.includes('"buh-self-employed-receipt"===n.slug?(0,r.jsx)("receipts-1c-preview",{locale:a,description:m})'));
  assert.ok(chunk.includes('payments-1c-preview'));
  new vm.Script(chunk);
}
const project = JSON.parse(read('data/projects.json')).find(item => item.slug === 'buh-self-employed-receipt');
assert.equal(project.media_items.length, 2, 'Original screenshot evidence is retained');
assert.ok(read('projects/buh-self-employed-receipt/index.html').includes(project.media_items[0].url));
console.log('Receipts / 1C matching, dates, periods, four scenes, autoplay, reduced motion and static integration checks passed.');
