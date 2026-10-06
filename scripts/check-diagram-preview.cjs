const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = vm.createContext({});
vm.runInContext(require('./project-diagram-fixture.cjs') + '\nthis.heading = projectHeading; this.summary = projectSummary;', context);
for (const english of [false, true]) {
  const html = context.summary(english);
  const label = english ? 'More about the project' : 'Подробнее о проекте';
  assert.ok(html.includes(label));
  assert.ok(html.indexOf('<svg ') < html.indexOf(label), 'Disclosure arrow is left of the label');
  assert.equal((html.match(/<svg /g) || []).length, 1);
}
const profiles = { dental: ['dental-crm', 4], calls: ['calls-llm', 4], shifts: ['shifts-crm', 4], tm: ['tm-electronics', 7], eicom: ['eicom-shop', 9], furniture: ['furniture-1c', 5] };
for (const [profile, [module, columns]] of Object.entries(profiles)) {
  for (const english of [false, true]) {
    const html = context.heading(profile, english);
    assert.equal((html.match(/<h3>/g) || []).length, 1);
    assert.ok(html.includes(english ? 'What was delivered' : 'Что было сделано'));
    assert.equal((html.match(/<svg /g) || []).length, columns);
    assert.ok(html.includes('class="diagram-branches" aria-hidden="true"'));
    assert.ok(html.includes(`data-diagram="${profile}"`));
  }
  const source = read(`project-previews/${module}.js`);
  assert.ok(source.includes(`projectHeading('${profile}', this.english)`));
  assert.equal((source.match(/projectSummary\(this.english\)/g) || []).length, 1, 'Every preview uses the shared disclosure');
  assert.ok(/renderPreview\(this\.shadowRoot, \[[^\]]*DIAGRAM_STYLESHEET\]/.test(source), 'Header styles participate in the paint-readiness gate');
  assert.ok(source.indexOf('class="case-intro"') < source.indexOf(`projectHeading('${profile}'`), 'Project actions stay above the diagram');
  const canonical = fs.readFileSync(path.resolve(root, `../apps/frontend/public/project-previews/${module}.js`), 'utf8');
  assert.equal(source, canonical);
}
assert.throws(() => context.heading('unknown'), /Unknown project diagram/);
for (const file of ['project-diagram.js', 'project-diagram.css']) {
  assert.equal(read(`project-previews/${file}`), fs.readFileSync(path.resolve(root, `../apps/frontend/public/project-previews/${file}`), 'utf8'));
}
const css = read('project-previews/project-diagram.css');
assert.ok(css.includes('.project-details-summary::-webkit-details-marker { display: none; }'));
assert.ok(css.includes('transform: rotate(-90deg)'));
assert.ok(css.includes('transform: rotate(0deg)'));
assert.ok(css.includes('width: 16px; height: 16px;'), 'Icons have stable dimensions');
assert.ok(css.includes('border-top: 1px solid var(--diagram-line)'));
for (const profile of Object.keys(profiles)) assert.ok(css.includes(`@container ${profile} (`));
for (const file of ['index.html', '404.html']) {
  for (const [module] of Object.values(profiles)) {
    const version = ['furniture-1c', 'calls-llm', 'tm-electronics'].includes(module) ? 7 : 6;
    assert.ok(read(file).includes(`src="/project-previews/${module}.js?v=${version}"`));
  }
}
for (const [file, tag] of [['tm-host.css', 'tm-electronics-preview'], ['furniture-host.css', 'furniture-1c-preview']]) {
  const source = read(`project-previews/${file}`);
  assert.ok(source.includes(tag));
  assert.ok(!source.includes('--project-bg:'), 'Host styles do not override the initial per-project palette');
  assert.ok(!/article:has\([^)]*\) \{[^}]*background:/.test(source), 'No inner background rectangle');
  assert.equal(source, fs.readFileSync(path.resolve(root, `../apps/frontend/public/project-previews/${file}`), 'utf8'));
  assert.ok(read('index.html').includes(`/project-previews/${file}?v=${file === 'tm-host.css' ? 4 : 3}`));
}
console.log('Project diagram header checks passed for all seven web projects.');
