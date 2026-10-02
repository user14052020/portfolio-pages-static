const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dir = path.resolve(__dirname, '../project-previews');
const icons = fs.readFileSync(path.join(dir, 'tm-icons.js'), 'utf8');
const down = vm.runInNewContext(icons.replace('export const ICONS', 'const ICONS') + '\nICONS.down');
module.exports = fs.readFileSync(path.join(dir, 'project-diagram.js'), 'utf8')
  .replace("import { ICONS as DIAGRAM_ICONS } from './tm-icons.js';", `const DIAGRAM_ICONS = { down: ${JSON.stringify(down)} };`)
  .replace("new URL('./project-diagram.css?v=2', import.meta.url).href", "'project-diagram.css?v=2'")
  .replaceAll('export const', 'const').replaceAll('export function', 'function');
