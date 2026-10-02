const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const moduleSource = read('project-previews/dental-crm.js');
const icons = read('project-previews/dental-icons.js');
const styles = read('project-previews/dental-crm.css');

// Exercise data rendering and URL validation without a browser or application build.
const context = vm.createContext({
  HTMLElement: class { attachShadow() {} },
  customElements: { get: () => true },
  URL,
  atob,
  Intl,
});
vm.runInContext(
  moduleSource.replace("import { ICONS } from './dental-icons.js';", icons.replace('export const ICONS', 'const ICONS'))
    .replace("import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';", 'const renderPreview = (root, urls, markup) => { root.innerHTML = markup; }; const stopPreviewLoading = () => {};')
    .replace("import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=2';", require('./project-diagram-fixture.cjs'))
    .replace("new URL('./dental-crm.css', import.meta.url).href", "'dental-crm.css'")
    + '\nthis.Preview = DentalCrmPreview; this.escapeText = esc;',
  context,
);
const preview = new context.Preview();
const attrs = { locale: 'ru' };
preview.getAttribute = key => attrs[key] || null;
assert.equal(preview.demoUrl(), 'https://dental.maharram.ru/');
attrs['demo-url-token'] = btoa('https://dental.maharram.ru/');
assert.equal(preview.demoUrl(), 'https://dental.maharram.ru/');
for (const token of ['javascript:alert(1)', 'https://example.com/', 'bad-token']) {
  attrs['demo-url-token'] = token;
  assert.equal(preview.demoUrl(), 'https://dental.maharram.ru/');
}
assert.equal(context.escapeText('<script>"&'), '&lt;script&gt;&quot;&amp;');
for (const name of ['dashboard', 'orders', 'payments', 'materials']) {
  assert.ok(preview[name]().includes('page-title'), `${name} renders a page title`);
}
assert.equal((preview.orderRows().match(/class="demo-row"/g) || []).length, 4);
assert.ok(preview.orderRows().includes('class="empty-row" hidden'));
assert.ok(preview.detail(1).includes('DL-1047'));
assert.ok(preview.detail(1).includes('aria-hidden="true" inert'));
const story = preview.projectStory();
assert.equal((story.match(/data-story-step=/g) || []).length, 4);
assert.equal((story.match(/class="story-connector"/g) || []).length, 3);
assert.ok(story.includes('<ol class="project-story"'));
for (const text of ['Наряд клиники', 'Этапы работы', 'Чат-бот сотрудника', 'Оплаты и сводка']) {
  assert.ok(story.includes(text));
}
assert.ok(!story.includes('<button'));
preview.shadowRoot = { innerHTML: '' };
preview.renderScene = () => {};
preview.updatePlayButton = () => {};
attrs.description = 'Project <script>\n\nAdditional details';
preview.render();
const rendered = preview.shadowRoot.innerHTML;
assert.ok(/class="preview">\s*<div class="case-intro">/.test(rendered), 'Project actions come first');
assert.equal((rendered.match(/class="case-intro"/g) || []).length, 1);
assert.ok(rendered.indexOf('href="https://dental.maharram.ru/"') < rendered.indexOf('class="project-story"'), 'Demo link is above the diagram');
assert.ok(rendered.indexOf('class="project-story"') < rendered.indexOf('class="crm-window"'));
assert.ok(rendered.includes('href="https://dental.maharram.ru/"'));
assert.ok(rendered.includes('<details><summary class="project-details-summary">'));
assert.ok(rendered.includes('Project &lt;script&gt;\n\nAdditional details'));
assert.ok(!rendered.includes('class="case-copy"><p>'));
attrs.locale = 'en';
assert.ok(preview.dashboard().includes('Overview'));
assert.ok(preview.orders().includes('Mint Dental'));
assert.ok(preview.projectStory().includes('Staff chatbot'));
assert.ok(!preview.projectStory().includes('Чат-бот'));

assert.ok(styles.includes('prefers-reduced-motion'));
assert.ok(styles.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
assert.ok(styles.includes('@container dental (max-width: 600px)'));
assert.ok(styles.includes('grid-template-columns: minmax(0, 1fr)'));
assert.ok(styles.includes(':host(:not([data-playing="true"])) .story-connector i'));
assert.ok(!/\bfetch\s*\(|<iframe|XMLHttpRequest/.test(moduleSource));
assert.ok(moduleSource.includes('disconnectedCallback()'));

for (const file of ['index.html', '404.html']) {
  const html = read(file);
  assert.equal((html.match(/<dental-crm-preview\b/g) || []).length, 1);
  assert.ok(html.includes('src="/project-previews/dental-crm.js?v=5"'));
  assert.ok(html.includes('href="/project-previews/dental-host.css"'));
  const chunks = [...new Set(html.match(/app\/page-[a-f0-9]+\.js/g))];
  assert.equal(chunks.length, 1);
  const chunk = read(`_next/static/chunks/${chunks[0]}`);
  const hash = crypto.createHash('sha256').update(chunk).digest('hex').slice(0, 16);
  assert.equal(chunks[0], `app/page-${hash}.js`);
  assert.ok(chunk.includes('"web-app-demo"===n.slug?'));
  assert.ok(chunk.includes('"dental-crm-preview",{locale:a,description:m,"demo-url-token":n.live_url||""}'));
}

console.log('Dental CRM preview checks passed.');
