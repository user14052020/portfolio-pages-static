const previews = new WeakMap();
const criticalStyles = `
  :host { display: block; min-width: 0; }
  [data-preview-content][hidden], [data-preview-status][hidden] { display: none !important; }
  [data-preview-content] { min-width: 0; }
  [data-preview-status] { --loading-accent: var(--project-control-fill, #498f98); box-sizing: border-box; padding: 24px; min-height: 400px; border: 1px solid #d9e3e5; border-radius: 8px; background: #fff; color: #52666e; font: 14px/1.5 system-ui, sans-serif; }
  [data-preview-loading] { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
  [data-preview-spinner] { box-sizing: border-box; flex: 0 0 20px; width: 20px; height: 20px; border: 2px solid #e2ecee; border-top-color: var(--loading-accent); border-right-color: var(--loading-accent); border-radius: 50%; }
  [data-preview-label] { font-size: 13px; font-weight: 500; }
  [data-preview-dots] { display: flex; align-items: center; gap: 4px; width: 24px; height: 20px; }
  [data-preview-dots] i { display: block; width: 4px; height: 4px; border-radius: 50%; background: var(--loading-accent); opacity: .4; }
  [data-preview-track] { overflow: hidden; height: 3px; margin-bottom: 20px; background: #edf2f3; border-radius: 2px; }
  [data-preview-sweep] { display: block; width: 35%; height: 100%; background: var(--loading-accent); opacity: .6; }
  [data-preview-skeleton] { display: grid; gap: 20px; }
  [data-preview-skeleton] > i { position: relative; display: block; overflow: hidden; height: 64px; border-radius: 4px; background: #edf2f3; }
  [data-preview-skeleton] i:nth-child(2) { height: 220px; }
  [data-preview-shimmer] { position: absolute; inset: 0 auto 0 0; width: 40%; background: #fff; opacity: .45; transform: translateX(-100%); }
  [data-preview-error] { margin: 0 0 16px; }
  [data-preview-retry] { padding: 8px 14px; border: 1px solid #b7cbd0; border-radius: 4px; background: #f4f8f9; color: inherit; font: inherit; cursor: pointer; }
  @media (max-width: 480px) { [data-preview-status] { padding: 18px; } }
  @media (prefers-reduced-motion: reduce) { [data-preview-shimmer] { display: none; } }
`;

function animateLoading(root, state) {
  if (state.stopLoading || !root.host.isConnected || typeof state.placeholder.animate !== 'function') return;
  const doc = root.ownerDocument;
  const motion = doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
  const cancel = () => {
    state.animations?.forEach(animation => animation.cancel());
    state.animations = [];
  };
  const sync = () => {
    cancel();
    if (doc.hidden || motion?.matches || !root.host.isConnected) return;
    const animate = (selector, frames, options) => {
      state.placeholder.querySelectorAll(selector).forEach((node, index) => {
        state.animations.push(node.animate(frames, { iterations: Infinity, ...options(index) }));
      });
    };
    animate('[data-preview-spinner]', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], () => ({ duration: 1300 }));
    animate('[data-preview-sweep]', [{ transform: 'translateX(-110%)' }, { transform: 'translateX(300%)' }], () => ({ duration: 1800, easing: 'ease-in-out' }));
    animate('[data-preview-dots] i', [{ opacity: .3, transform: 'translateY(0)' }, { opacity: 1, transform: 'translateY(-3px)' }, { opacity: .3, transform: 'translateY(0)' }], index => ({ duration: 1100, delay: index * 150, easing: 'ease-in-out' }));
    animate('[data-preview-shimmer]', [{ transform: 'translateX(-100%)' }, { transform: 'translateX(350%)' }], index => ({ duration: 2100, delay: index * 180, easing: 'ease-in-out' }));
  };
  state.stopLoading = () => {
    cancel();
    motion?.removeEventListener('change', sync);
    doc.removeEventListener('visibilitychange', sync);
    state.stopLoading = null;
  };
  motion?.addEventListener('change', sync);
  doc.addEventListener('visibilitychange', sync);
  sync();
}

export function stopPreviewLoading(root) {
  previews.get(root)?.stopLoading?.();
}

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
    if (state.view !== 'loading') {
      state.placeholder.innerHTML = '<div data-preview-loading><span data-preview-spinner aria-hidden="true"></span><span data-preview-label></span><span data-preview-dots aria-hidden="true"><i></i><i></i><i></i></span></div><div data-preview-track aria-hidden="true"><i data-preview-sweep></i></div><div data-preview-skeleton aria-hidden="true"><i><b data-preview-shimmer></b></i><i><b data-preview-shimmer></b></i><i><b data-preview-shimmer></b></i></div>';
    }
    state.view = 'loading';
    state.placeholder.querySelector('[data-preview-label]').textContent = state.english ? 'Loading preview' : 'Загрузка проекта';
    animateLoading(root, state);
  } else if (failed) {
    stopPreviewLoading(root);
    state.view = 'error';
    state.placeholder.innerHTML = `<p data-preview-error>${state.english ? 'Unable to load the preview styles.' : 'Не удалось загрузить оформление проекта.'}</p><button type="button" data-preview-retry>${state.english ? 'Retry' : 'Повторить'}</button>`;
    state.placeholder.querySelector('button').addEventListener('click', () => {
      for (const [url, sheet] of state.sheets) {
        if (sheet.status === 'error') attachSheet(root, state, url, sheet.node);
      }
      updateStatus(root, state);
    }, { once: true });
  } else {
    stopPreviewLoading(root);
    state.view = 'ready';
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
