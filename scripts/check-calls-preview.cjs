const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('project-previews/calls-llm.js');
const icons = read('project-previews/calls-icons.js');
const context = vm.createContext({
  HTMLElement: class { attachShadow() {} },
  customElements: { get: () => true },
  requestAnimationFrame: () => 42,
  URL,
});
vm.runInContext(source.replace("import { ICONS } from './calls-icons.js';", icons.replace('export const ICONS', 'const ICONS'))
  .replace("import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';", 'const renderPreview = (root, urls, markup) => { root.innerHTML = markup; }; const stopPreviewLoading = () => {};')
  .replace("new URL('./calls-llm.css', import.meta.url).href", "'calls-llm.css'")
  + '\nthis.Preview = CallsLlmPreview; this.escapeText = esc; this.formatTime = time;', context);
const preview = new context.Preview();
const attrs = { locale: 'ru' };
preview.getAttribute = key => attrs[key] || null;
preview.setPlaying = value => { preview.requestedPlay = value; };
preview.update = () => {};
let renders = 0;
preview.renderCustomer = () => { renders++; };
preview.shadowRoot = { querySelector: () => ({ value: '' }) };
for (const [stage, count] of [[0, 0], [1, 6], [2, 6], [3, 6]]) {
  preview.selectStage(stage);
  assert.equal(preview.analysisCount(), count);
  assert.equal(preview.requestedPlay, false);
}
preview.stage = 1;
preview.elapsed = 1500;
assert.equal(preview.analysisCount(), 1);
preview.stage = 0;
preview.elapsed = 0;
preview.running = true;
preview.lastTime = 0;
for (let now = 100; now <= 19400; now += 100) preview.tick(now);
assert.equal(preview.stage, 0);
assert.equal(preview.example, 1, 'One full cycle starts the next sample call');
assert.equal(renders, 1);
preview.running = false;
const elapsed = preview.elapsed;
preview.tick(20000);
assert.equal(preview.elapsed, elapsed, 'Paused playback does not advance');
assert.equal(context.formatTime(324), '05:24');
assert.equal(context.escapeText('<script>"&'), '&lt;script&gt;&quot;&amp;');
assert.equal(preview.local(preview.call.name), 'Денис Орлов');
attrs.locale = 'en';
assert.equal(preview.local(preview.call.name), 'Denis Orlov');
preview.shadowRoot = { innerHTML: '' };
preview.updatePlayButton = () => {};
attrs.description = '<script>Sample & description';
for (const locale of ['ru', 'en']) {
  attrs.locale = locale;
  preview.render();
  const markup = preview.shadowRoot.innerHTML;
  assert.ok(/class="preview">\s*<details class="case-intro"><summary>/.test(markup), 'Calls description is a top-level disclosure');
  assert.equal((markup.match(/class="description"/g) || []).length, 1, 'Description is not repeated below the animation');
  assert.ok(markup.indexOf('class="description"') < markup.indexOf('class="pipeline"'));
  assert.ok(!markup.includes('<details class="case-intro" open'), 'Description is collapsed by default');
  assert.ok(markup.includes('&lt;script&gt;Sample &amp; description'));
  assert.ok(markup.includes(locale === 'ru' ? 'Подробнее о проекте' : 'More about the project'));
}
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|<iframe|localStorage/.test(source));
assert.ok(source.includes('disconnectedCallback()'));
assert.ok(source.includes('IntersectionObserver'));
assert.ok(read('project-previews/calls-llm.css').includes('prefers-reduced-motion'));
for (const file of ['index.html', '404.html']) {
  const html = read(file);
  assert.ok(html.includes('src="/project-previews/calls-llm.js"'));
  assert.ok(html.includes('href="/project-previews/calls-host.css"'));
  const chunks = [...new Set(html.match(/app\/page-[a-f0-9]+\.js/g))];
  assert.equal(chunks.length, 1);
  const chunk = read(`_next/static/chunks/${chunks[0]}`);
  const hash = crypto.createHash('sha256').update(chunk).digest('hex').slice(0, 16);
  assert.equal(chunks[0], `app/page-${hash}.js`);
  assert.ok(chunk.includes('"calls"===n.slug?(0,r.jsx)("calls-llm-preview",{locale:a,description:m})'));
  assert.ok(chunk.includes('"web-app-demo"===n.slug?'), 'Dental preview is preserved');
}
console.log('Calls/LLM preview checks passed.');
