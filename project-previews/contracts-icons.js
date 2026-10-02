// Lucide icons. See third-party-licenses.txt.
const paths = {
  bold: '<path d="M6 12h9a4 4 0 0 1 0 8H6z"/><path d="M6 4h8a4 4 0 0 1 0 8H6z"/>',
  italic: '<path d="M19 4h-9"/><path d="M14 20H5"/><path d="m15 4-6 16"/>',
  left: '<path d="M15 12H3"/><path d="M17 18H3"/><path d="M21 6H3"/>',
  center: '<path d="M17 12H7"/><path d="M19 18H5"/><path d="M21 6H3"/>',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/>',
};
export const CONTRACT_ICONS = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`]));
