const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const chunkName = [...new Set(read('index.html').match(/app\/page-[a-f0-9]+\.js/g))][0];
const chunk = read('_next/static/chunks/' + chunkName);
assert.ok(chunkName.includes(crypto.createHash('sha256').update(chunk).digest('hex').slice(0, 16)));
new vm.Script(chunk);
const literal = chunk.match(/const projectPalettes=(\{[\s\S]*?\n\});/)[1];
const palettes = vm.runInNewContext('(' + literal + ')');
const projects = JSON.parse(read('data/projects.json'));
assert.deepEqual(Object.keys(palettes).sort(), projects.map(project => project.slug).sort());
assert.equal(new Set(Object.values(palettes).map(colors => colors[0])).size, projects.length, 'Every project has its own canvas');
function luminance(hex) {
  return hex.slice(1).match(/../g).map(pair => parseInt(pair, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, index) => sum + c * [.2126, .7152, .0722][index], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
for (const [slug, [background, ink, accent, accentInk]] of Object.entries(palettes)) {
  assert.ok(contrast(background, ink) >= 4.5, slug + ': canvas contrast');
  assert.ok(contrast(accent, accentInk) >= 4.5, slug + ': selected block contrast');
}
for (const file of ['index.html', '404.html']) {
  const html = read(file);
  assert.ok(html.includes('project-presentation.css?v=4'));
  assert.ok(html.includes('class="portfolio-shell w-full py-7"'));
  assert.ok(html.includes('class="portfolio-projects py-6"'));
  const bands = [...html.matchAll(/<section class="project-band[^"\n]*" data-project="([^"]*)" style="([^"]*)"/g)];
  assert.equal(bands.length, 4);
  for (const [, slug, style] of bands) assert.ok(style.includes('--project-bg:' + palettes[slug][0]), 'SSR palette matches hydrated project');
  assert.ok(!html.includes('left-1/2 w-screen -translate-x-1/2'), 'No viewport-width scrollbar overflow');
}
assert.ok(chunk.includes('N={...ea[t.value],...projectTheme(_.slug)}'));
assert.ok(chunk.includes('"data-project":_.slug'));
for (const file of ['project-presentation.css', 'project-diagram.css']) {
  assert.equal(read('project-previews/' + file), fs.readFileSync(path.resolve(root, '../apps/frontend/public/project-previews/' + file), 'utf8'));
}
assert.ok(read('project-previews/project-diagram.css').includes('--diagram-line: var(--project-divider)'));
assert.ok(read('project-previews/project-diagram.js').includes('project-diagram.css?v=3'));
console.log('14 unique accessible palettes, full-width layout, SSR parity, and cache versions passed.');
