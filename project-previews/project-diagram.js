import { ICONS as DIAGRAM_ICONS } from './tm-icons.js';

export const DIAGRAM_STYLESHEET = new URL('./project-diagram.css?v=3', import.meta.url).href;
const COLUMNS = { dental: 4, calls: 4, shifts: 4, tm: 7, eicom: 9, furniture: 5, payments: 4 };

export function projectHeading(project, english = false) {
  const columns = COLUMNS[project];
  if (!columns) throw new TypeError('Unknown project diagram');
  return `<div class="project-diagram-heading" data-diagram="${project}"><h3>${english ? 'What was delivered' : 'Что было сделано'}</h3><div class="diagram-branches" aria-hidden="true">${Array.from({ length: columns }, () => `<span>${DIAGRAM_ICONS.down}</span>`).join('')}</div></div>`;
}

export function projectSummary(english = false) {
  return `<summary class="project-details-summary"><span class="project-details-arrow" aria-hidden="true">${DIAGRAM_ICONS.down}</span><span>${english ? 'More about the project' : 'Подробнее о проекте'}</span></summary>`;
}
