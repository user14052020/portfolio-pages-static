const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = vm.createContext({});
vm.runInContext(require('./project-diagram-fixture.cjs') + '\nthis.heading = projectHeading;', context);
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
assert.ok(css.includes('width: 16px; height: 16px;'), 'Icons have stable dimensions');
assert.ok(css.includes('border-top: 1px solid var(--diagram-line)'));
for (const profile of Object.keys(profiles)) assert.ok(css.includes(`@container ${profile} (`));
for (const file of ['index.html', '404.html']) {
  for (const [module] of Object.values(profiles)) assert.ok(read(file).includes(`src="/project-previews/${module}.js?v=4"`));
}
console.log('Project diagram header checks passed for all seven web projects.');
