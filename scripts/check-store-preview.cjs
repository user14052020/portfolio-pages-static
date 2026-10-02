const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const domains = {
  'work-schedule-crm': ['horecavent.ru', 'https://shifts.maharram.ru/'],
  'radio-components': ['eicom.ru', 'https://eicom.ru/'],
  'electronic-components': ['tmelectronics.ru', 'https://tmelectronics.ru/'],
  furniture: ['imodern.ru', 'https://imodern.ru/'],
  paints: ['vertical.ru', 'https://vertical.ru/'],
};
function verify(project, slug) {
  const [title, url] = domains[slug];
  assert.equal(project.title_ru, title);
  assert.equal(project.title_en, title);
  assert.equal(project.live_url, url, 'Renaming does not change the demo destination');
  assert.equal(project.summary_ru, slug === 'work-schedule-crm' ? 'CRM' : 'МАГАЗИН');
  assert.equal(project.summary_en, slug === 'work-schedule-crm' ? 'CRM' : 'SHOP');
}
for (const file of ['data/projects.json', 'data/live-projects.json', 'api/v1/projects/index.html']) {
  const projects = JSON.parse(read(file));
  for (const slug of Object.keys(domains)) verify(projects.find(project => project.slug === slug), slug);
}
function flightProjects(html) {
  const entries = [...html.matchAll(/<script>self\.__next_f\.push\((.*?)\)<\/script>/gs)]
    .map(match => JSON.parse(match[1])).filter(entry => entry[0] === 1 && typeof entry[1] === 'string');
  const projects = [];
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (Object.hasOwn(domains, value.slug)) projects.push(value);
    for (const child of Object.values(value)) collect(child);
  }
  for (const line of entries.map(entry => entry[1]).join('').split('\n')) {
    const colon = line.indexOf(':'), raw = line.slice(colon + 1);
    if (colon < 0 || !['[', '{'].includes(raw[0])) continue;
    let data;
    try { data = JSON.parse(raw); } catch { continue; }
    collect(data);
  }
  return projects;
}
for (const file of ['index.html', '404.html']) {
  const projects = flightProjects(read(file));
  assert.equal(projects.length, 5);
  for (const project of projects) verify(project, project.slug);
}
for (const [slug, [domain]] of Object.entries(domains)) {
  verify(JSON.parse(read(`api/v1/projects/${slug}/index.html`)), slug);
  const html = read(`projects/${slug}/index.html`);
  assert.ok(html.match(/<h1\b[^>]*>.*?<\/h1>/s)[0].includes(domain));
  assert.ok(html.match(/<title>.*?<\/title>/s)[0].includes(domain));
  const projects = flightProjects(html);
  assert.equal(projects.length, slug === 'work-schedule-crm' ? 0 : 1);
  if (projects.length) verify(projects[0], slug);
}
for (const file of ['furniture-1c.js', 'furniture-1c.css']) {
  assert.equal(read('project-previews/' + file), fs.readFileSync(path.resolve(root, '../apps/frontend/public/project-previews/' + file), 'utf8'));
}
assert.ok(read('project-previews/tm-host.css').includes('flex-wrap:wrap;overflow:visible;'), 'Long domain and subtitle wrap instead of clipping');
console.log('Project domain titles and website links checks passed.');
