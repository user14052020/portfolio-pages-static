const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const rootPath = path.resolve(__dirname, '..');
const sourcePath = path.resolve(rootPath, '../apps/frontend/public/project-previews');
const read = name => fs.readFileSync(path.join(rootPath, 'project-previews', name), 'utf8');

class Element extends EventTarget {
  constructor(tagName, doc) {
    super();
    this.tagName = tagName;
    this.ownerDocument = doc;
    this.children = [];
    this.attributes = new Map();
    this.hidden = false;
    this.inert = false;
    this.host = { isConnected: true };
    this.htmlWrites = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  append(...nodes) {
    nodes.forEach(node => { node.parent = this; this.children.push(node); });
  }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  replaceWith(node) {
    const parent = this.parent;
    parent.children.splice(parent.children.indexOf(this), 1, node);
    node.parent = parent;
  }
  set innerHTML(value) {
    this.html = value;
    this.htmlWrites++;
    this.button = value.includes('<button') ? new Element('button', this.ownerDocument) : null;
    this.loadingNodes = value.includes('data-preview-loading') ? {
      '[data-preview-label]': [new Element('span', this.ownerDocument)],
      '[data-preview-spinner]': [new Element('span', this.ownerDocument)],
      '[data-preview-sweep]': [new Element('i', this.ownerDocument)],
      '[data-preview-dots] i': Array.from({ length: 3 }, () => new Element('i', this.ownerDocument)),
      '[data-preview-shimmer]': Array.from({ length: 3 }, () => new Element('b', this.ownerDocument)),
    } : {};
  }
  get innerHTML() { return this.html; }
  querySelector(selector) { return selector === 'button' ? this.button : this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) { return this.loadingNodes?.[selector] || []; }
  animate(frames, options) {
    const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } };
    this.ownerDocument.animations.push(animation);
    return animation;
  }
}
function createDocument() {
  const document = new EventTarget();
  document.animations = [];
  document.motion = new EventTarget();
  document.motion.matches = false;
  document.hidden = false;
  document.defaultView = { matchMedia: () => document.motion };
  document.createElement = tag => new Element(tag, document);
  return document;
}
const doc = createDocument();
const context = vm.createContext({ WeakMap, Map, Set, Event });
vm.runInContext(read('preview-styles.js').replace(/export function/g, 'function') + '\nthis.renderPreview = renderPreview; this.stopPreviewLoading = stopPreviewLoading;', context);
const render = context.renderPreview;
const root = new Element('shadow-root', doc);
let readyEvents = 0;
root.addEventListener('previewstylesready', () => readyEvents++);
render(root, ['base.css', 'features.css', 'base.css'], '<svg></svg>');
const [critical, placeholder, content, base, features] = root.children;
assert.equal(root.children.length, 5, 'Duplicate stylesheets are not inserted');
assert.ok(critical.textContent.includes('display: none !important'), 'The paint gate is inline, not another async stylesheet');
assert.ok(content.hidden && content.inert, 'Unstyled icons and controls cannot be painted or focused');
assert.equal(placeholder.hidden, false);
assert.equal(placeholder.attributes.get('aria-busy'), 'true');
assert.equal(placeholder.querySelector('[data-preview-label]').textContent, 'Загрузка проекта');
const firstAnimations = [...doc.animations];
assert.equal(firstAnimations.length, 8, 'Spinner, progress sweep, dots and skeleton highlights animate through JS');
assert.ok(firstAnimations.every(animation => animation.options.iterations === Infinity));
base.dispatchEvent(new Event('load'));
assert.equal(content.hidden, true, 'All stylesheets are required before showing content');
assert.equal(readyEvents, 0, 'Playback cannot start with incomplete styles');
render(root, ['base.css', 'features.css'], '<svg>latest</svg>', true);
assert.equal(root.children[3], base, 'Attribute updates preserve stylesheet nodes');
assert.equal(root.children[4], features);
assert.equal(content.innerHTML, '<svg>latest</svg>', 'The latest render is retained while CSS is pending');
assert.equal(placeholder.attributes.get('aria-label'), 'Loading preview');
assert.equal(placeholder.querySelector('[data-preview-label]').textContent, 'Loading preview');
assert.equal(placeholder.htmlWrites, 1, 'Pending sheet events and locale updates do not restart the loading animation');
assert.equal(doc.animations.length, firstAnimations.length);
features.dispatchEvent(new Event('load'));
assert.ok(!content.hidden && !content.inert);
assert.equal(placeholder.hidden, true);
assert.equal(placeholder.attributes.get('aria-busy'), 'false');
assert.equal(readyEvents, 1, 'Playback starts when all styles become ready');
assert.ok(firstAnimations.every(animation => animation.cancelled), 'Loading animations stop before revealing the preview');
doc.motion.dispatchEvent(new Event('change'));
doc.dispatchEvent(new Event('visibilitychange'));
assert.equal(doc.animations.length, firstAnimations.length, 'Ready previews remove loading listeners');
render(root, ['base.css', 'features.css'], '<svg>cached</svg>');
assert.equal(content.hidden, false, 'Cached styles remain applied during re-render');
assert.equal(root.children[3], base);
assert.equal(root.children[4], features);
assert.equal(readyEvents, 1, 'A re-render does not restart playback');

const failedRoot = new Element('shadow-root', doc);
render(failedRoot, ['base.css', 'missing.css'], '<svg>unsafe without CSS</svg>');
const [, failedStatus, failedContent, loaded, failed] = failedRoot.children;
const failedAnimations = doc.animations.slice(firstAnimations.length);
loaded.dispatchEvent(new Event('load'));
failed.dispatchEvent(new Event('error'));
assert.ok(failedContent.hidden && failedContent.inert, 'A CSS error never exposes an unstyled preview');
assert.equal(failedStatus.attributes.get('aria-busy'), 'false');
assert.ok(failedStatus.innerHTML.includes('data-preview-error'), 'A CSS error has a recoverable state');
assert.ok(failedAnimations.every(animation => animation.cancelled), 'Failed previews stop loading instead of spinning forever');
failedStatus.button.dispatchEvent(new Event('click'));
const retry = failedRoot.children[4];
assert.notEqual(retry, failed);
assert.equal(failedRoot.children[3], loaded, 'Retry only reloads failed stylesheets');
assert.equal(failedStatus.querySelector('[data-preview-label]').textContent, 'Загрузка проекта');
assert.equal(doc.animations.length, firstAnimations.length + failedAnimations.length + 8, 'Retry restarts loading animation');
failed.dispatchEvent(new Event('load'));
assert.equal(failedContent.hidden, true, 'Late events from obsolete links cannot bypass the gate');
retry.dispatchEvent(new Event('load'));
assert.equal(failedContent.hidden, false);
assert.equal(failedContent.inert, false);

const motionDoc = createDocument();
motionDoc.motion.matches = true;
const motionRoot = new Element('shadow-root', motionDoc);
render(motionRoot, ['motion.css'], '<svg></svg>');
assert.equal(motionDoc.animations.length, 0, 'Reduced motion preserves a readable static loading indicator');
motionDoc.motion.matches = false;
motionDoc.motion.dispatchEvent(new Event('change'));
assert.equal(motionDoc.animations.length, 8, 'Motion preference changes apply while loading');
motionDoc.hidden = true;
motionDoc.dispatchEvent(new Event('visibilitychange'));
assert.ok(motionDoc.animations.every(animation => animation.cancelled), 'Background tabs do not keep loading animations running');
motionDoc.hidden = false;
motionDoc.dispatchEvent(new Event('visibilitychange'));
assert.equal(motionDoc.animations.length, 16, 'Returning to a pending preview resumes animation');
motionRoot.host.isConnected = false;
context.stopPreviewLoading(motionRoot);
assert.ok(motionDoc.animations.every(animation => animation.cancelled), 'Unmounting a preview cancels its animations');
motionDoc.dispatchEvent(new Event('visibilitychange'));
assert.equal(motionDoc.animations.length, 16, 'Unmounting removes animation listeners');
motionRoot.host.isConnected = true;
render(motionRoot, ['motion.css'], '<svg>remounted</svg>');
assert.equal(motionDoc.animations.length, 24, 'Remounting a pending preview restarts animation without replacing styles');
motionRoot.children[3].dispatchEvent(new Event('load'));
assert.ok(motionDoc.animations.every(animation => animation.cancelled));

// Completion while detached and remounting must retain both content and CSS.
const detachedRoot = new Element('shadow-root', doc);
render(detachedRoot, ['slow.css'], '<svg>first</svg>');
const slowLink = detachedRoot.children[3];
slowLink.dispatchEvent(new Event('load'));
render(detachedRoot, ['slow.css'], '<svg>remounted</svg>');
assert.equal(detachedRoot.children[3], slowLink);
assert.equal(detachedRoot.children[2].hidden, false);
assert.equal(root.children[2].hidden, false, 'Separate previews have independent state');

for (const file of ['preview-styles.js', 'calls-llm.js', 'dental-crm.js', 'shifts-crm.js', 'eicom-shop.js', 'tm-electronics.js', 'furniture-1c.js', 'payments-1c.js', 'receipts-1c.js']) {
  const source = read(file);
  assert.equal(source, fs.readFileSync(path.join(sourcePath, file), 'utf8'), `${file}: source and static mirror match`);
  if (file !== 'preview-styles.js') {
    assert.ok(source.includes("import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';"), 'Updated modules do not request an incompatible cached loader');
    assert.ok(source.includes('stopPreviewLoading(this.shadowRoot)'), 'Every preview cleans up its loading animation on unmount');
    assert.ok(source.includes('renderPreview(this.shadowRoot,'));
    assert.ok(source.includes("addEventListener('previewstylesready'"));
    assert.ok(source.includes("querySelector('[data-preview-content][hidden]')"), 'Playback waits for styling');
    assert.ok(!source.includes('this.shadowRoot.innerHTML'), 'Full renders cannot replace or reload stylesheet nodes');
  }
}
assert.ok(read('eicom-shop.js').includes('[STYLESHEET, FEATURE_STYLESHEET, DIAGRAM_STYLESHEET]'), 'Eicom waits for all three style layers');
for (const file of ['calls-llm.css', 'dental-crm.css', 'shifts-crm.css', 'tm-electronics.css', 'eicom-shop.css', 'eicom-improvements.css', 'furniture-1c.css', 'payments-1c.css', 'receipts-1c.css']) {
  assert.equal(read(file), fs.readFileSync(path.join(sourcePath, file), 'utf8'), `${file}: source and static styles match`);
  assert.ok(read(file).includes('.case-intro'), `${file}: top project actions are styled`);
  assert.ok(!/\.case-footer|\.case-note/.test(read(file)), `${file}: no obsolete bottom action styling`);
}
console.log('Preview stylesheet readiness checks passed.');
