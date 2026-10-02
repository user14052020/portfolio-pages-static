const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('project-previews/furniture-1c.js');
const icons = read('project-previews/tm-icons.js');
let frames = 0, cancelled = 0;
const doc = { hidden: false };
const context = vm.createContext({
  HTMLElement: class { attachShadow() {} }, customElements: { get: () => true }, URL,
  requestAnimationFrame: () => ++frames, cancelAnimationFrame: () => cancelled++, document: doc,
});
vm.runInContext(source.replace("import { ICONS } from './tm-icons.js';", icons.replace('export const ICONS', 'const ICONS'))
  .replace("import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';", 'const renderPreview = (root, urls, markup) => { root.innerHTML = markup; }; const stopPreviewLoading = () => {};')
  .replace("import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=2';", require('./project-diagram-fixture.cjs'))
  .replaceAll('import.meta.url', "'https://example.com/project-previews/furniture-1c.js'")
  + '\nthis.Preview=Furniture1cPreview;this.escapeHtml=esc;', context);
const preview = new context.Preview();
const attrs = { locale: 'ru', description: '<img onerror="alert(1)">' };
preview.getAttribute = key => attrs[key] || null;
preview.setAttribute = (key, value) => { attrs[key] = value; };
const properties = {};
preview.style = { setProperty: (key, value) => { properties[key] = value; } };
preview.motion = { matches: false };
preview.shadowRoot = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
const renderScene = preview.renderScene, updatePlayButton = preview.updatePlayButton, syncClock = preview.syncClock;
preview.renderScene = preview.updatePlayButton = preview.syncClock = () => {};
preview.render();
const html = preview.shadowRoot.innerHTML;
assert.ok(/class="preview">\s*<div class="case-intro">/.test(html));
assert.ok(html.includes('<details><summary class="project-details-summary">'));
assert.ok(!html.includes('Сопровождение существующей 1С'));
assert.ok(!html.includes('class="engagement"'));
assert.equal((html.match(/role="tab" /g) || []).length, 5);
assert.ok(html.includes('&lt;img onerror='));
assert.ok(!html.includes('<img onerror='));
assert.equal(context.escapeHtml('<a "x">'), '&lt;a &quot;x&quot;&gt;');
assert.ok(!/href=/.test(html), 'No invented demo link');
for (const [method, expected] of [['bitrix', 'Битрикс'], ['sheets', 'Google Таблицы'], ['closing', 'Автоматическое закрытие'], ['delivery', 'Служба доставки'], ['maps', 'Яндекс Карты']]) {
  const scene = preview[method]();
  assert.ok(scene.includes(expected), method);
  assert.equal((scene.match(/class="flow-step"/g) || []).length, 4, method);
}
assert.ok(preview.bitrix().includes('/media/uploads/4e/55fdc83c5782458bbe96e2461e844cf8.png'));
assert.ok(preview.maps().includes('Схематичная карта · демоданные'));
preview.select(4);
assert.equal(preview.feature, 4);
for (const value of [-1, 5, NaN, 1.5]) { preview.select(value); assert.equal(preview.feature, 4); }
preview.motion.matches = true;
preview.select(1);
assert.equal(preview.wanted, false);
assert.equal(preview.elapsed, 9999);
preview.motion.matches = false;
preview.select(0);
assert.equal(preview.wanted, true);
assert.equal(preview.elapsed, 0);
let focused;
preview.shadowRoot.querySelector = selector => ({ focus: () => { focused = selector; } });
let prevented = false;
preview.onKey({ key: 'End', target: { closest: () => ({ dataset: { feature: '0' } }) }, preventDefault: () => { prevented = true; } });
assert.equal(preview.feature, 4);
assert.equal(focused, '[data-feature="4"]');
assert.ok(prevented);
preview.onClick({ target: { closest: () => ({ hasAttribute: key => key === 'data-address', dataset: { address: '1' } }) } });
assert.equal(preview.address, 1);
assert.equal(preview.wanted, false);
assert.ok(preview.maps().includes('data-location="1"'));
assert.ok(preview.maps().includes('пр-т Учебный, 8'));
attrs.locale = 'en';
preview.render();
assert.ok(preview.shadowRoot.innerHTML.includes('More about the project'));
assert.ok(!preview.shadowRoot.innerHTML.includes('Support for an existing 1C system'));
assert.ok(preview.sheets().includes('Customer orders'));
assert.ok(preview.closing().includes('Closing conditions checked'));
assert.ok(preview.delivery().includes('Delivery service'));
assert.ok(preview.maps().includes('8 Demo Avenue'));
attrs.locale = 'ru';
const phase = { dataset: { phase: '0' } }, reveal = { dataset: { reveal: '3' } };
const final = { dataset: { before: 'В работе', after: 'Закрыт' } };
const status = {}, play = { setAttribute: (key, value) => { play[key] = value; } };
let gated = false;
preview.shadowRoot = {
  querySelector: key => ({ '[data-playback-state]': status, '.play': play, '[data-preview-content][hidden]': gated ? {} : null })[key] || null,
  querySelectorAll: key => ({ '[data-phase]': [phase], '[data-reveal]': [reveal], '[data-final-text]': [final] })[key] || [],
};
preview.elapsed = 0;
preview.updateAnimation();
assert.equal(phase.dataset.state, 'active');
assert.equal(reveal.dataset.ready, 'false');
assert.equal(final.textContent, 'В работе');
preview.elapsed = 8000;
preview.updateAnimation();
assert.equal(phase.dataset.state, 'done');
assert.equal(reveal.dataset.ready, 'true');
assert.equal(final.textContent, 'Закрыт');
assert.equal(status.textContent, 'Завершено');
preview.updatePlayButton = updatePlayButton;
preview.syncClock = syncClock;
preview.visible = true;
preview.wanted = true;
gated = true;
preview.syncClock();
assert.equal(preview.running, false, 'Clock waits for styles');
gated = false;
preview.syncClock();
assert.equal(preview.running, true);
assert.equal(frames, 1);
preview.elapsed = 0;
preview.lastTime = 0;
preview.tick(100);
preview.tick(3100);
assert.equal(preview.elapsed, 100, 'Background gaps cannot skip the animation');
doc.hidden = true;
preview.syncClock();
assert.equal(preview.running, false);
assert.ok(cancelled > 0);
const stopped = preview.elapsed;
preview.tick(4000);
assert.equal(preview.elapsed, stopped);
doc.hidden = false;
preview.updatePlayButton();
assert.equal(play['aria-label'], 'Остановить анимацию 1С');
preview.onClick({ target: { closest: () => ({ hasAttribute: () => false, dataset: { action: 'play' } }) } });
assert.equal(preview.wanted, false);
assert.equal(play['aria-label'], 'Продолжить анимацию 1С');
preview.elapsed = 5000;
preview.onClick({ target: { closest: () => ({ hasAttribute: () => false, dataset: { action: 'replay' } }) } });
assert.equal(preview.elapsed, 0);
assert.equal(preview.wanted, true);
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|<iframe|localStorage/.test(source));
assert.ok(source.includes("closest('button[data-feature]')"));
assert.ok(!source.includes("querySelector('[data-state]')"), 'Playback label cannot overwrite a flow node');
assert.ok(source.includes('stopPreviewLoading(this.shadowRoot)'));
assert.ok(read('project-previews/furniture-1c.css').includes('@container furniture'));
assert.ok(fs.statSync(path.join(root, 'media/uploads/4e/55fdc83c5782458bbe96e2461e844cf8.png')).size > 100);
for (const file of ['index.html', '404.html']) {
  const html = read(file);
  assert.ok(html.includes('src="/project-previews/furniture-1c.js?v=5"'), 'New project data cannot use a cached furniture-only module');
  assert.ok(html.includes('href="/project-previews/furniture-host.css?v=2"'));
  const chunks = [...new Set(html.match(/app\/page-[a-f0-9]+\.js/g))];
  assert.equal(chunks.length, 1);
  const chunk = read('_next/static/chunks/' + chunks[0]);
  assert.equal(chunks[0], `app/page-${crypto.createHash('sha256').update(chunk).digest('hex').slice(0, 16)}.js`);
  for (const tag of ['furniture-1c-preview', 'tm-electronics-preview', 'eicom-shop-preview', 'shifts-crm-preview', 'calls-llm-preview', 'dental-crm-preview']) assert.ok(chunk.includes(tag), tag);
  assert.ok(chunk.includes('"paints"===n.slug?(0,r.jsx)("furniture-1c-preview",{locale:a,description:m,project:"paints"})'));
}
for (const file of ['data/live-projects.json', 'data/projects.json', 'api/v1/projects/index.html', 'api/v1/projects/furniture/index.html']) {
  const data = JSON.parse(read(file));
  const project = Array.isArray(data) ? data.find(item => item.slug === 'furniture') : data;
  assert.equal(project.live_url, null);
  assert.ok(project.description_ru.includes('сопровождением 1С'));
  assert.ok(project.description_en.includes('existing 1C system'));
}
assert.ok(read('projects/furniture/index.html').includes('Клиент обратился за сопровождением 1С'));
attrs.project = 'paints';
assert.equal(preview.orderNumber(), 'К-1024');
assert.equal(preview.orderNumber(1), 'К-1025');
for (const locale of ['ru', 'en']) {
  attrs.locale = locale;
  preview.render();
  assert.ok(preview.shadowRoot.innerHTML.includes(locale === 'ru' ? 'КРАСКИ' : 'PAINTS'));
  assert.equal((preview.shadowRoot.innerHTML.match(/role="tab" /g) || []).length, 5);
  const scenes = ['bitrix', 'sheets', 'closing', 'delivery', 'maps'].map(name => preview[name]()).join('');
  assert.ok(scenes.includes(locale === 'ru' ? 'Интерьерная краска, 9 л' : 'Interior paint, 9 L'));
  assert.ok(scenes.includes(locale === 'ru' ? 'Грунтовка, 5 л' : 'Primer, 5 L'));
  assert.ok(scenes.includes(locale === 'ru' ? '2 банки краски и грунтовка' : '2 cans of paint and primer'));
  assert.ok(scenes.includes('/media/uploads/3f/e8f817443c804710b993d6791708a6ee.png'));
  assert.ok(scenes.includes('К-1024'));
  assert.ok(!/Стол «Линия»|Кресло «Сфера»|Linea table|Sphere armchair|М-1024|55fdc83c5782458bbe96e2461e844cf8/.test(scenes), 'Paints scenes do not leak furniture data');
}
attrs.project = '__proto__';
assert.equal(preview.project.title[0], 'МЕБЕЛЬ', 'Unknown project attributes fall back to the original profile');
delete attrs.project;
attrs.locale = 'ru';
assert.ok(preview.bitrix().includes('Стол «Линия»'), 'The original furniture preview is retained');
for (const file of ['data/live-projects.json', 'data/projects.json', 'api/v1/projects/index.html', 'api/v1/projects/paints/index.html']) {
  const data = JSON.parse(read(file));
  const project = Array.isArray(data) ? data.find(item => item.slug === 'paints') : data;
  assert.equal(project.live_url, null);
  assert.ok(project.description_ru.includes('магазина красок обратился за сопровождением 1С'));
  assert.ok(project.description_en.includes('paint retailer’s existing 1C system'));
}
assert.ok(read('projects/paints/index.html').includes('Клиент магазина красок'));
assert.ok(fs.statSync(path.join(root, 'media/uploads/3f/e8f817443c804710b993d6791708a6ee.png')).size > 100);
console.log('Furniture and Paints / 1C preview checks passed.');
