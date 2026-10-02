const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('project-previews/contracts-1c.js');
const context = vm.createContext({ HTMLElement: class { attachShadow() {} }, customElements: { get: () => true }, Intl, Date, requestAnimationFrame: () => 1 });
vm.runInContext(source.replace("import { ICONS } from './tm-icons.js';", read('project-previews/tm-icons.js').replace('export const ICONS', 'const ICONS'))
  .replace("import { CONTRACT_ICONS } from './contracts-icons.js';", read('project-previews/contracts-icons.js').replace('export const CONTRACT_ICONS', 'const CONTRACT_ICONS'))
  .replace("import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';", 'const renderPreview = () => {}; const stopPreviewLoading = () => {};')
  .replace("import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=6';", require('./project-diagram-fixture.cjs'))
  .replace("new URL('./contracts-1c.css?v=1', import.meta.url).href", "'contracts-1c.css'")
  + '\nthis.Preview = Contracts1cPreview; this.invoices = INVOICES; this.layouts = LAYOUTS; this.total = total; this.heading = projectHeading;', context);
assert.equal(context.heading('contracts').match(/<svg /g).length, 4);
assert.deepEqual(Array.from(context.invoices, context.total), [40800, 63000]);
const before = JSON.stringify(context.invoices);
context.invoices.forEach(invoice => { Object.freeze(invoice); invoice.items.forEach(Object.freeze); });
const preview = new context.Preview();
const attrs = { locale: 'ru' };
preview.getAttribute = name => attrs[name] || null;
preview.style = { setProperty() {} }; preview.setAttribute = () => {};
preview.motion = { matches: false }; preview.syncClock = () => {}; preview.updatePlayButton = () => {};
const scene = { innerHTML: '', setAttribute() {} }, counter = {}, playback = {}, cell = { style: {} };
const focusNode = { focus() {} };
const formatNodes = ['bold', 'italic', 'left', 'center'].map(name => ({ dataset: { format: name }, setAttribute(key, value) { this[key] = value; } }));
preview.shadowRoot = {
  querySelector: selector => selector === '.scene' ? scene : selector === '[data-counter]' ? counter : selector === '[data-playback-state]' ? playback : selector === '[data-cell-title]' ? cell : focusNode,
  querySelectorAll: selector => selector === '[data-format]' ? formatNodes : [],
};
for (const locale of ['ru', 'en']) {
  attrs.locale = locale;
  for (let feature = 0; feature < 4; feature++) {
    preview.feature = feature; preview.renderScene();
    assert.ok(scene.innerHTML.includes('class="flow"'));
    assert.ok(!/undefined|Invalid Date|NaN/.test(scene.innerHTML));
    assert.equal(counter.textContent, `0${feature + 1} / 04`);
  }
  for (let invoice = 0; invoice < 2; invoice++) {
    preview.invoice = invoice;
    for (let layout = 0; layout < 2; layout++) {
      preview.layout = layout;
      const paper = preview.paper({ word: true });
      assert.ok(paper.includes(preview.data.contract));
      assert.ok(paper.includes(preview.money(context.total(preview.data))));
      assert.equal(paper.includes('class="table-wrap compact"'), layout === 1, 'Selected layout changes the generated document');
      assert.ok(!/undefined|Invalid Date|NaN/.test(preview.specificationScene()));
      assert.ok(preview.wordScene().includes('contract-' + preview.data.id + '.docx'));
    }
  }
}
assert.equal(JSON.stringify(context.invoices), before, 'Rendering leaves invoice data unchanged');
function click(dataset, attribute) {
  const button = { dataset, hasAttribute: name => name === attribute };
  preview.onClick({ target: { closest: () => button } });
}
click({ format: 'bold' }, 'data-format'); assert.equal(preview.format.bold, false); assert.equal(cell.style.fontWeight, '400');
click({ format: 'italic' }, 'data-format'); assert.equal(cell.style.fontStyle, 'italic');
click({ format: 'left' }, 'data-format'); assert.equal(cell.style.textAlign, 'left');
assert.ok(preview.paper({ word: true }).includes('font-weight:400;font-style:italic;text-align:left'), 'Word preview retains the selected heading format');
assert.equal(formatNodes[2]['aria-pressed'], 'true'); assert.equal(formatNodes[3]['aria-pressed'], 'false');
click({ template: '0' }, 'data-template'); assert.equal(preview.layout, 0);
click({ template: '1' }, 'data-template'); assert.equal(preview.layout, 1);
click({ template: '9' }, 'data-template'); assert.equal(preview.layout, 1);
click({ field: 'customer' }, 'data-field'); assert.equal(preview.field, 'customer');
assert.ok(preview.paper().includes('data-parameter="customer" data-highlight="true"'));
function change(value, selector) { preview.onChange({ target: { value, matches: rule => rule === selector } }); }
change('0', '[data-invoice]'); assert.equal(preview.invoice, 0);
change('1', '[data-invoice]'); assert.equal(preview.invoice, 1);
change('bad', '[data-invoice]'); assert.equal(preview.invoice, 1);
preview.feature = 0; preview.tour = true; preview.elapsed = 0; preview.running = true;
for (let now = 100; now <= 12200; now += 100) preview.tick(now);
assert.equal(preview.feature, 1, 'Initial autoplay tours all delivered tasks');
preview.select(3); assert.equal(preview.feature, 3); assert.equal(preview.tour, false);
preview.select(-1); assert.equal(preview.feature, 3);
preview.motion.matches = true; preview.select(2);
assert.equal(preview.elapsed, 11999); assert.equal(preview.wanted, false);
preview.running = false; preview.tick(25000); assert.equal(preview.elapsed, 11999);
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|<iframe|localStorage|contenteditable/i.test(source), 'This is a visual demo, not a real contract system');
for (const file of ['contracts-1c.js', 'contracts-1c.css', 'contracts-host.css', 'contracts-icons.js']) {
  assert.equal(read('project-previews/' + file), fs.readFileSync(path.resolve(root, '../apps/frontend/public/project-previews/' + file), 'utf8'));
}
assert.ok(read('project-previews/contracts-1c.css').includes('prefers-reduced-motion'));
const canonical = fs.readFileSync(path.resolve(root, '../apps/frontend/src/widgets/home-showcase/ui/HomeShowcase.tsx'), 'utf8');
assert.ok(canonical.includes('project.slug === "buh-contracts-templates"'));
assert.ok(canonical.includes('<Contracts1cPreview locale={locale} description={projectDescription} />'));
for (const file of ['index.html', '404.html']) {
  const html = read(file);
  assert.ok(html.includes('src="/project-previews/contracts-1c.js?v=1"'));
  assert.ok(html.includes('contracts-host.css?v=1'));
  const chunkPath = [...new Set(html.match(/app\/page-[a-f0-9]+\.js/g))];
  assert.equal(chunkPath.length, 1);
  const chunk = read('_next/static/chunks/' + chunkPath[0]);
  assert.equal(chunkPath[0], 'app/page-' + crypto.createHash('sha256').update(chunk).digest('hex').slice(0, 16) + '.js');
  assert.ok(chunk.includes('"buh-contracts-templates"===n.slug?(0,r.jsx)("contracts-1c-preview",{locale:a,description:m})'));
  assert.ok(chunk.includes('payments-1c-preview') && chunk.includes('receipts-1c-preview'));
  new vm.Script(chunk);
}
const project = JSON.parse(read('data/projects.json')).find(item => item.slug === 'buh-contracts-templates');
assert.equal(project.media_items.length, 2, 'Original screenshots remain as evidence');
assert.ok(read('projects/buh-contracts-templates/index.html').includes(project.media_items[0].url));
console.log('Contracts / 1C formatting, templates, invoice totals, four scenes, playback and static integration checks passed.');
