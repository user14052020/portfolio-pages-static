const previews = new WeakMap();
const criticalStyles = `
  :host { display: block; min-width: 0; }
  [data-preview-content][hidden], [data-preview-status][hidden] { display: none !important; }
  [data-preview-content] { min-width: 0; }
  [data-preview-status] { box-sizing: border-box; padding: 24px; min-height: 400px; border: 1px solid #d9e3e5; border-radius: 8px; background: #fff; color: #52666e; font: 14px/1.5 system-ui, sans-serif; }
  [data-preview-skeleton] { display: grid; gap: 20px; }
  [data-preview-skeleton] i { display: block; height: 64px; border-radius: 4px; background: #edf2f3; }
  [data-preview-skeleton] i:nth-child(2) { height: 220px; }
  [data-preview-error] { margin: 0 0 16px; }
  [data-preview-retry] { padding: 8px 14px; border: 1px solid #b7cbd0; border-radius: 4px; background: #f4f8f9; color: inherit; font: inherit; cursor: pointer; }
`;

function updateStatus(root, state) {
  const pending = [...state.sheets.values()].some(sheet => sheet.status === 'pending');
  const failed = [...state.sheets.values()].some(sheet => sheet.status === 'error');
  const ready = !pending && !failed;
  const becameReady = ready && !state.ready;
  state.ready = ready;
  state.content.hidden = !ready;
  state.content.inert = !ready;
  state.placeholder.hidden = ready;
  state.placeholder.setAttribute('aria-busy', String(pending));
  state.placeholder.setAttribute('aria-label', failed && !pending
    ? (state.english ? 'Preview unavailable' : 'Проект недоступен')
    : (state.english ? 'Loading preview' : 'Загрузка проекта'));
  if (pending) {
    state.placeholder.innerHTML = '<div data-preview-skeleton aria-hidden="true"><i></i><i></i><i></i></div>';
  } else if (failed) {
    state.placeholder.innerHTML = `<p data-preview-error>${state.english ? 'Unable to load the preview styles.' : 'Не удалось загрузить оформление проекта.'}</p><button type="button" data-preview-retry>${state.english ? 'Retry' : 'Повторить'}</button>`;
    state.placeholder.querySelector('button').addEventListener('click', () => {
      for (const [url, sheet] of state.sheets) {
        if (sheet.status === 'error') attachSheet(root, state, url, sheet.node);
      }
      updateStatus(root, state);
    }, { once: true });
  }
  if (becameReady) root.dispatchEvent(new Event('previewstylesready'));
}

function attachSheet(root, state, url, previous) {
  const node = root.ownerDocument.createElement('link');
  const sheet = { node, status: 'pending' };
  state.sheets.set(url, sheet);
  node.rel = 'stylesheet';
  node.href = url;
  const settle = status => {
    if (state.sheets.get(url) !== sheet || sheet.status !== 'pending') return;
    sheet.status = status;
    updateStatus(root, state);
  };
  node.addEventListener('load', () => settle('loaded'), { once: true });
  node.addEventListener('error', () => settle('error'), { once: true });
  if (previous) previous.replaceWith(node);
  else root.append(node);
}

// Shadow-root stylesheets do not block paint. Retain them across renders and
// reveal the content only when every stylesheet has been parsed successfully.
export function renderPreview(root, urls, markup, english = false) {
  let state = previews.get(root);
  if (!state) {
    const doc = root.ownerDocument;
    const critical = doc.createElement('style');
    critical.textContent = criticalStyles;
    const placeholder = doc.createElement('div');
    placeholder.setAttribute('data-preview-status', '');
    placeholder.setAttribute('role', 'status');
    const content = doc.createElement('div');
    content.setAttribute('data-preview-content', '');
    content.hidden = true;
    content.inert = true;
    state = { placeholder, content, sheets: new Map(), english };
    previews.set(root, state);
    root.replaceChildren(critical, placeholder, content);
    for (const url of new Set(urls)) attachSheet(root, state, url);
  }
  state.english = english;
  state.content.innerHTML = markup;
  updateStatus(root, state);
}
