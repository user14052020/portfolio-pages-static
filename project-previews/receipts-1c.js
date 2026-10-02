import { ICONS } from './tm-icons.js';
import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';
import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=5';

const CSS = new URL('./receipts-1c.css?v=1', import.meta.url).href;
const DURATION = 12000;
const FEATURES = [
  ['settings', 'Настройки поиска', 'Search settings', 'search', 'Источник, период и дата', 'Source, period and date'],
  ['job', 'Регламентное задание', 'Scheduled task', 'clock', 'Обработка в фоне', 'Background processing'],
  ['attach', 'Чек → реестр', 'Receipt → register', 'layers', 'Автоматическое прикрепление', 'Automatic attachment'],
  ['journal', 'Журнал результатов', 'Result log', 'list', 'Итоги и предупреждения', 'Results and warnings'],
];
const RUN_DATE = '2026-06-01';
const REGISTERS = [
  { id: '101', date: '2026-05-30', person: ['Морозов Алексей', 'Alexey Morozov'], amount: 12500 },
  { id: '102', date: '2026-05-31', person: ['Романова Анна', 'Anna Romanova'], amount: 8400 },
  { id: '103', date: '2026-05-31', person: ['Котов Денис', 'Denis Kotov'], amount: 6200 },
  { id: '090', date: '2026-04-15', person: ['Лебедева Ирина', 'Irina Lebedeva'], amount: 9600 },
];
const FILES = ['RS_101_2026-05-30.pdf', 'RS_102_2026-06-01.pdf', 'RS_090_2026-04-15.pdf'];
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = name => ICONS[name] || '';
const daysBetween = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);

// Fictional file names illustrate the configurable period and date tolerance seen in 1C.
function resultFor(register, settings) {
  const age = daysBetween(RUN_DATE, register.date);
  if (age < 0 || age > settings.period) return { status: 'outside', file: null };
  const file = FILES.map(name => ({ name, parts: /^RS_(\d+)_(\d{4}-\d{2}-\d{2})\.pdf$/.exec(name) })).find(item => item.parts?.[1] === register.id);
  if (!file) return { status: 'missing', file: null };
  const difference = Math.abs(daysBetween(file.parts[2], register.date));
  return { status: difference <= settings.tolerance ? 'attached' : 'date', file: file.name, receiptDate: file.parts[2], difference };
}

class Receipts1cPreview extends HTMLElement {
  static observedAttributes = ['locale', 'description'];
  constructor() {
    super(); this.attachShadow({ mode: 'open' });
    this.feature = 0; this.sample = 0; this.filter = 'all';
    this.settings = { source: 'folder', period: 30, tolerance: 1 };
    this.elapsed = 0; this.visible = false; this.running = false; this.tour = true;
    this.tick = this.tick.bind(this);
  }
  get english() { return this.getAttribute('locale') === 'en'; }
  text(ru, en) { return this.english ? en : ru; }
  local(pair) { return pair[this.english ? 1 : 0]; }
  date(value) { return new Intl.DateTimeFormat(this.english ? 'en-GB' : 'ru-RU', { timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z')); }
  money(value) { return new Intl.NumberFormat(this.english ? 'en-US' : 'ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value); }
  status(value) { return this.local({ attached: ['Прикреплен', 'Attached'], missing: ['Не найден', 'Not found'], date: ['Дата вне допуска', 'Date outside tolerance'], outside: ['Вне периода', 'Outside period'], waiting: ['В очереди', 'Queued'], active: ['Поиск чека', 'Finding receipt'] }[value]); }
  reason(value) { return this.local({ attached: ['Чек прикреплен к реестру выплат', 'Receipt attached to the payment register'], missing: ['Файл чека не найден в источнике', 'Receipt file not found in the source'], date: ['Дата чека не соответствует заданному допуску', 'Receipt date exceeds the configured tolerance'], outside: ['Документ не входит в период поиска', 'Document is outside the search period'] }[value]); }
  result(register) { return resultFor(register, this.settings); }
  completedCount() { return Math.max(0, Math.min(REGISTERS.length, Math.floor((this.elapsed - 2400) / 1200) + 1)); }
  connectedCallback() {
    this.abort = new AbortController(); const options = { signal: this.abort.signal };
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.wanted = !this.motion.matches; if (!this.wanted) this.elapsed = DURATION - 1;
    this.shadowRoot.addEventListener('pointerover', event => {
      const tab = event.target.closest('button[data-feature]');
      if (tab && event.pointerType !== 'touch' && !tab.contains(event.relatedTarget)) this.select(Number(tab.dataset.feature));
    }, options);
    this.shadowRoot.addEventListener('focusin', event => { const tab = event.target.closest('button[data-feature]'); if (tab) this.select(Number(tab.dataset.feature)); }, options);
    this.shadowRoot.addEventListener('click', event => this.onClick(event), options);
    this.shadowRoot.addEventListener('change', event => this.onChange(event), options);
    this.shadowRoot.addEventListener('keydown', event => this.onKey(event), options);
    this.shadowRoot.addEventListener('previewstylesready', () => this.syncClock(), options);
    document.addEventListener('visibilitychange', () => this.syncClock(), options);
    this.motion.addEventListener('change', () => {
      if (this.motion.matches) { this.wanted = false; this.elapsed = DURATION - 1; this.updateAnimation(); this.updatePlayButton(); this.syncClock(); }
    }, options);
    this.render();
    this.observer = new IntersectionObserver(entries => { this.visible = entries[0].isIntersecting; this.syncClock(); }, { threshold: .1 });
    this.observer.observe(this);
  }
  disconnectedCallback() {
    stopPreviewLoading(this.shadowRoot); this.abort?.abort(); this.observer?.disconnect(); cancelAnimationFrame(this.frame); this.running = false;
  }
  attributeChangedCallback(name, before, after) { if (before !== after && this.isConnected && this.abort) this.render(); }
  render() {
    renderPreview(this.shadowRoot, [CSS, DIAGRAM_STYLESHEET], `<div class="preview">
      <div class="case-intro"><details>${projectSummary(this.english)}<p>${esc(this.getAttribute('description') || '')}</p></details></div>
      ${projectHeading('receipts', this.english)}
      <nav class="feature-map" role="tablist" aria-label="${this.text('Автоматическое прикрепление чеков', 'Automatic receipt attachment')}">${FEATURES.map(([id, ru, en, glyph, subRu, subEn], index) => `<div class="feature-node"><button type="button" role="tab" id="receipts-${id}" aria-controls="receipts-detail" data-feature="${index}"><span class="node-icon">${icon(glyph)}</span><strong>${this.text(ru, en)}</strong><small>${this.text(subRu, subEn)}</small><span class="node-number">0${index + 1}</span></button><i class="node-wire"></i></div>`).join('')}</nav>
      <div class="bridge" aria-hidden="true">${icon('down')}</div>
      <section class="workspace" aria-label="${this.text('Чеки самозанятых в 1С', 'Self-employed receipts in 1C')}">
        <header class="window-header"><b class="one-c">1C</b><strong>${this.text('Автоматическое прикрепление чеков самозанятых', 'Automatic self-employed receipt attachment')}</strong><span class="demo">DEMO</span></header>
        <div class="scene" id="receipts-detail" role="tabpanel"></div>
        <footer class="window-footer"><span>${icon('test')}${this.text('Демонстрационные данные', 'Sample data')} · ${this.date(RUN_DATE)}</span><span data-playback-state></span></footer>
      </section>
      <div class="playback"><span data-counter></span><div class="progress"><i></i></div>${[['previous', 'Предыдущая задача', 'Previous task', 'right'], ['replay', 'Повторить анимацию', 'Replay animation', 'replay'], ['play', '', '', 'play'], ['next', 'Следующая задача', 'Next task', 'right']].map(([action, ru, en, glyph]) => `<button type="button" class="tool ${action}" data-action="${action}" title="${this.text(ru, en)}" aria-label="${this.text(ru, en)}">${icon(glyph)}</button>`).join('')}</div>
    </div>`, this.english);
    this.renderScene(); this.updatePlayButton();
  }
  heading(ru, en, subRu, subEn) { return `<div class="scene-heading"><h3>${this.text(ru, en)}</h3><p>${this.text(subRu, subEn)}</p></div>`; }
  flow(items) {
    return `<div class="flow">${items.map(([ru, en, glyph], index) => `<div class="flow-step" data-phase="${index}"><span>${icon(glyph)}</span><strong>${this.text(ru, en)}</strong><b>${icon('check')}</b></div>${index < items.length - 1 ? `<div class="flow-wire" aria-hidden="true"><i></i>${icon('right')}</div>` : ''}`).join('')}</div>`;
  }
  controls() {
    return `<div class="setting-controls"><label>${this.text('Период поиска, дней', 'Search period, days')}<select data-setting="period" aria-label="${this.text('Период поиска, дней', 'Search period, days')}">${[7, 30, 60].map(value => `<option value="${value}"${value === this.settings.period ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label>${this.text('Допуск даты чека, дней', 'Receipt date tolerance, days')}<select data-setting="tolerance" aria-label="${this.text('Допуск даты чека, дней', 'Receipt date tolerance, days')}">${[0, 1, 3].map(value => `<option value="${value}"${value === this.settings.tolerance ? ' selected' : ''}>${value}</option>`).join('')}</select></label></div>`;
  }
  settingsScene() {
    return `${this.heading('Поиск управляется настройками 1С', 'Search is controlled by 1C settings', 'Источник, форматы имен и допустимое отклонение даты задаются в расширении.', 'The extension configures the source, file name formats and allowed date deviation.')}
      ${this.flow([['Источник чеков', 'Receipt source', 'database'], ['Формат имени', 'File name format', 'code'], ['Период поиска', 'Search period', 'clock'], ['Допуск даты', 'Date tolerance', 'search']])}
      <div class="split"><div class="pane"><div class="pane-title">${icon('layout')}<strong>${this.text('Параметры расширения', 'Extension settings')}</strong></div><div class="source-modes" role="group" aria-label="${this.text('Источник чеков', 'Receipt source')}">${[['folder', 'Папка чеков', 'Receipt folder'], ['log', 'Файл лога', 'Log file']].map(([source, ru, en]) => `<button type="button" data-source="${source}" aria-pressed="${this.settings.source === source}">${this.text(ru, en)}</button>`).join('')}</div><div class="source-path">${icon('database')}<code>${this.settings.source === 'folder' ? 'C:/Demo/Receipts/' : 'C:/Demo/receipts.log'}</code></div>${this.controls()}<dl class="settings-list"><div><dt>${this.text('Формат имени файла', 'File name format')}</dt><dd><code>RS_{${this.text('номер', 'number')}}_{${this.text('дата', 'date')}}.pdf</code></dd></div><div><dt>${this.text('Последнее изменение лога', 'Last processed log change')}</dt><dd>01.06.2026 11:30</dd></div></dl></div>
      <div class="pane"><div class="pane-title">${icon('layers')}<strong>${this.settings.source === 'log' ? this.text('Файлы из лога', 'Files from the log') : this.text('Источник и документы', 'Source and documents')}</strong></div><div class="file-list">${FILES.map((file, index) => `<div data-reveal="${Math.min(index + 1, 3)}">${icon('list')}<code>${file}</code><span>PDF</span></div>`).join('')}</div><div class="period-note">${icon('clock')}<span>${this.text('Реестры за последние', 'Registers from the last')} <b>${this.settings.period}</b> ${this.text('дней', 'days')}</span></div>${this.registerTable()}</div></div>`;
  }
  registerTable() {
    return `<div class="table-wrap" tabindex="0" aria-label="${this.text('Реестры выплат', 'Payment registers')}"><table><thead><tr>${[['Реестр / дата', 'Register / date'], ['Самозанятый', 'Payee'], ['Результат', 'Result']].map(([ru, en]) => `<th>${this.text(ru, en)}</th>`).join('')}</tr></thead><tbody>${REGISTERS.map((register, index) => `<tr data-register="${index}"><td><strong>РС-${register.id}</strong><small>${this.date(register.date)}</small></td><td>${this.local(register.person)}</td><td><span class="status" data-status-label></span></td></tr>`).join('')}</tbody></table></div>`;
  }
  jobScene() {
    return `${this.heading('Регламентное задание выполняет работу в фоне', 'A scheduled task processes receipts in the background', '1С находит реестры за заданный период и запускает прикрепление без ручного обхода документов.', '1C finds registers for the configured period and attaches receipts without opening documents manually.')}
      ${this.flow([['По расписанию', 'Scheduled start', 'clock'], ['Фоновое задание', 'Background task', 'sync'], ['Поиск реестров', 'Register search', 'search'], ['Итоги запуска', 'Run results', 'list']])}
      <div class="job-layout"><div class="job-clock"><div class="clock-face" aria-hidden="true">${icon('clock')}<i></i></div><span>${this.text('Регламентные и фоновые задания', 'Scheduled and background tasks')}</span><strong data-job-state></strong><small>${this.text('Пример запуска', 'Example run')} · 01.06.2026 11:30</small></div><div class="pane"><div class="pane-title">${icon('sync')}<strong>${this.text('Прикрепление чеков самозанятых', 'Self-employed receipt attachment')}</strong><span class="badge">1C</span></div><div class="job-meter"><i></i></div><div class="run-steps">${[['Поиск источника чеков', 'Locating the receipt source'], ['Отбор реестров за период', 'Selecting registers for the period'], ['Поиск и прикрепление файлов', 'Finding and attaching files'], ['Запись результата в лог', 'Recording the result in the log']].map(([ru, en], index) => `<div data-run-step="${index}"><b>0${index + 1}</b><span>${this.text(ru, en)}</span>${icon('check')}</div>`).join('')}</div><div class="batch-toolbar"><button type="button" data-action="run">${icon('replay')}${this.text('Повторить демонстрацию запуска', 'Replay the sample run')}</button></div></div></div>${this.metrics()}`;
  }
  attachScene() {
    const register = REGISTERS[this.sample], result = this.result(register);
    return `${this.heading('Чек попадает в нужный реестр выплат', 'The receipt reaches the corresponding payment register', 'Поиск учитывает источник, период документов и допустимое отклонение даты чека.', 'Matching uses the configured source, document period and receipt date tolerance.')}
      ${this.flow([['Файл чека', 'Receipt file', 'list'], ['Условия поиска', 'Search conditions', 'search'], ['Реестр выплат', 'Payment register', 'database'], ['Присоединенный файл', 'Attached file', 'check']])}
      <div class="sample-toolbar"><label>${this.text('Реестр выплат', 'Payment register')}<select data-sample aria-label="${this.text('Реестр выплат', 'Payment register')}">${REGISTERS.map((item, index) => `<option value="${index}"${this.sample === index ? ' selected' : ''}>РС-${item.id} · ${this.local(item.person)}</option>`).join('')}</select></label>${this.controls()}</div>
      <div class="attachment-grid"><div class="receipt-paper" data-reveal="1"><div class="paper-heading">${icon('list')}<strong>${this.text('Чек самозанятого', 'Self-employed receipt')}</strong><span>PDF</span></div>${result.file ? `<code>${result.file}</code><dl><div><dt>${this.text('Исполнитель', 'Payee')}</dt><dd>${this.local(register.person)}</dd></div><div><dt>${this.text('Дата чека', 'Receipt date')}</dt><dd>${this.date(result.receiptDate)}</dd></div></dl><div class="receipt-amount">${this.money(register.amount)}</div><div class="paper-lines" aria-hidden="true"><i></i><i></i><i></i></div>` : `<div class="empty-file">${icon('search')}<strong>${this.text(result.status === 'outside' ? 'Документ вне периода' : 'Файл не найден', result.status === 'outside' ? 'Document outside period' : 'File not found')}</strong><small>${this.reason(result.status)}</small></div>`}</div>
      <div class="attachment-transfer" data-outcome="${result.status}" aria-hidden="true"><i></i>${icon('right')}</div>
      <div class="pane register-document"><div class="pane-title"><b class="one-c">1C</b><strong>${this.text('Реестр выплат самозанятым', 'Self-employed payment register')}</strong></div><dl><div><dt>${this.text('Документ', 'Document')}</dt><dd>РС-${register.id}</dd></div><div><dt>${this.text('Дата', 'Date')}</dt><dd>${this.date(register.date)}</dd></div><div><dt>${this.text('Самозанятый', 'Payee')}</dt><dd>${this.local(register.person)}</dd></div><div><dt>${this.text('Сумма выплаты', 'Payout amount')}</dt><dd>${this.money(register.amount)}</dd></div></dl><div class="match-check" data-reveal="2" data-outcome="${result.status}">${icon(result.status === 'attached' ? 'check' : 'search')}<span>${this.reason(result.status)}</span></div><div class="attached-file" data-reveal="3" data-outcome="${result.status}">${icon(result.status === 'attached' ? 'check' : 'list')}<div><small>${this.text('Присоединенные файлы', 'Attachments')}</small><strong>${result.status === 'attached' ? result.file : this.text('Чек не прикреплен', 'Receipt not attached')}</strong></div><span>${result.status === 'attached' ? '1' : '0'}</span></div></div></div>`;
  }
  metrics() {
    return `<div class="metrics">${[['checked', 'Реестров в периоде', 'Registers in period', 'database'], ['attached', 'Чеков прикреплено', 'Receipts attached', 'check'], ['warning', 'Требуют внимания', 'Need attention', 'search']].map(([status, ru, en, glyph]) => `<div data-metric="${status}">${icon(glyph)}<strong>0</strong><span>${this.text(ru, en)}</span></div>`).join('')}</div>`;
  }
  journalScene() {
    return `${this.heading('Пропущенные чеки не теряются из виду', 'Missing receipts remain visible', 'Журнал показывает дату события, уровень и результат. Завершение задания записывается отдельно.', 'The log shows the event date, level and result. Task completion is recorded separately.')}
      ${this.flow([['Обработка реестров', 'Register processing', 'layers'], ['Результат по чеку', 'Receipt result', 'check'], ['Предупреждения', 'Warnings', 'search'], ['Задание завершено', 'Task completed', 'clock']])}${this.metrics()}
      <div class="filter-row" role="group" aria-label="${this.text('Фильтр журнала', 'Log filter')}">${[['all', 'Все события', 'All events'], ['warning', 'Предупреждения', 'Warnings']].map(([filter, ru, en]) => `<button type="button" data-filter="${filter}" aria-pressed="${this.filter === filter}">${this.text(ru, en)}</button>`).join('')}</div>
      <div class="table-wrap" tabindex="0" aria-label="${this.text('Лог прикрепления чеков самозанятых', 'Self-employed receipt attachment log')}"><table class="journal"><thead><tr>${[['Дата события', 'Event date'], ['Уровень', 'Level'], ['Документ / событие', 'Document / event'], ['Результат', 'Result']].map(([ru, en]) => `<th>${this.text(ru, en)}</th>`).join('')}</tr></thead><tbody>${REGISTERS.map((register, index) => {
        const result = this.result(register), warning = ['missing', 'date'].includes(result.status);
        return `<tr data-log="${index}" data-outcome="${result.status}"><td>01.06.2026<small>11:30:${String(41 + index).padStart(2, '0')}</small></td><td>${this.text(warning ? 'Предупреждение' : 'Информация', warning ? 'Warning' : 'Information')}</td><td><strong>РС-${register.id}</strong><small>${warning ? this.text('ЧекНеНайден', 'ReceiptNotFound') : this.text('Прикрепление', 'Attachment')}</small></td><td><span class="status" data-outcome="${result.status}">${this.status(result.status)}</span><small>${this.reason(result.status)}</small></td></tr>`;
      }).join('')}<tr class="job-finished" data-reveal="4"><td>01.06.2026<small>11:30:48</small></td><td>${this.text('Информация', 'Information')}</td><td><strong>${this.text('ЗаданиеЗавершено', 'TaskCompleted')}</strong></td><td data-log-summary></td></tr></tbody></table></div>`;
  }
  renderScene() {
    const scene = this.shadowRoot.querySelector('.scene');
    scene.innerHTML = [() => this.settingsScene(), () => this.jobScene(), () => this.attachScene(), () => this.journalScene()][this.feature]();
    scene.setAttribute('aria-labelledby', 'receipts-' + FEATURES[this.feature][0]);
    this.shadowRoot.querySelectorAll('[data-feature]').forEach((tab, index) => { tab.setAttribute('aria-selected', String(index === this.feature)); tab.tabIndex = index === this.feature ? 0 : -1; });
    this.shadowRoot.querySelector('[data-counter]').textContent = `0${this.feature + 1} / 04`;
    this.updateAnimation();
  }
  restart() { this.elapsed = this.motion.matches ? DURATION - 1 : 0; this.wanted = !this.motion.matches; this.tour = false; this.updatePlayButton(); this.syncClock(); }
  select(index) {
    if (!Number.isInteger(index) || index < 0 || index >= FEATURES.length) return;
    this.tour = false; if (index === this.feature) return;
    this.feature = index; this.filter = 'all'; this.restart(); this.renderScene();
  }
  onChange(event) {
    const target = event.target;
    if (target.matches('[data-setting]')) {
      const values = target.dataset.setting === 'period' ? [7, 30, 60] : [0, 1, 3];
      if (!values.includes(Number(target.value))) return;
      this.settings[target.dataset.setting] = Number(target.value);
    } else if (target.matches('[data-sample]')) {
      const index = Number(target.value); if (!Number.isInteger(index) || !REGISTERS[index]) return; this.sample = index;
    } else return;
    this.restart(); this.renderScene();
    this.shadowRoot.querySelector(target.matches('[data-sample]') ? '[data-sample]' : `[data-setting="${target.dataset.setting}"]`)?.focus();
  }
  onClick(event) {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-feature')) return this.select(Number(button.dataset.feature));
    if (button.hasAttribute('data-source')) { this.settings.source = button.dataset.source; this.restart(); this.renderScene(); this.shadowRoot.querySelector(`[data-source="${this.settings.source}"]`).focus(); return; }
    if (button.hasAttribute('data-filter')) {
      this.filter = button.dataset.filter; this.elapsed = DURATION - 1; this.wanted = false;
      this.shadowRoot.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.filter === this.filter)));
      this.updateAnimation(); this.updatePlayButton(); return this.syncClock();
    }
    const action = button.dataset.action;
    if (action === 'previous' || action === 'next') return this.select((this.feature + (action === 'next' ? 1 : 3)) % 4);
    if (action === 'run' || action === 'replay') { this.restart(); this.updateAnimation(); }
    if (action === 'play') { this.wanted = !this.wanted; this.updatePlayButton(); this.syncClock(); }
  }
  onKey(event) {
    const tab = event.target.closest('button[data-feature]'); if (!tab) return;
    let index = Number(tab.dataset.feature);
    if (['ArrowRight', 'ArrowDown'].includes(event.key)) index = (index + 1) % 4;
    else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) index = (index + 3) % 4;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = 3;
    else return;
    event.preventDefault(); this.select(index); this.shadowRoot.querySelector(`[data-feature="${index}"]`).focus();
  }
  updatePlayButton() {
    const button = this.shadowRoot.querySelector('.play');
    const label = this.wanted ? this.text('Остановить анимацию чеков', 'Pause receipt animation') : this.text('Продолжить анимацию чеков', 'Resume receipt animation');
    button.innerHTML = icon(this.wanted ? 'pause' : 'play'); button.title = label; button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', String(!!this.wanted));
    this.setAttribute('data-playing', String(!!this.wanted));
  }
  syncClock() {
    const running = !!(this.wanted && this.visible && !document.hidden && !this.shadowRoot.querySelector('[data-preview-content][hidden]'));
    if (running === this.running) return;
    this.running = running; this.lastTime = 0; cancelAnimationFrame(this.frame); this.setAttribute('data-running', String(running));
    if (running) this.frame = requestAnimationFrame(this.tick);
  }
  tick(now) {
    if (!this.running) return;
    this.elapsed += this.lastTime ? Math.min(now - this.lastTime, 100) : 0; this.lastTime = now;
    if (this.elapsed >= DURATION) { this.elapsed = 0; if (this.tour) { this.feature = (this.feature + 1) % 4; this.renderScene(); } }
    this.updateAnimation(); this.frame = requestAnimationFrame(this.tick);
  }
  updateAnimation() {
    const phase = Math.min(4, Math.floor(this.elapsed / 2200)), complete = this.completedCount();
    this.style.setProperty('--progress', String(this.elapsed / DURATION));
    this.style.setProperty('--job-progress', String(Math.min(1, this.elapsed / 8800)));
    this.shadowRoot.querySelectorAll('[data-phase]').forEach(node => { node.dataset.state = Number(node.dataset.phase) < phase ? 'done' : Number(node.dataset.phase) === phase ? 'active' : 'waiting'; });
    this.shadowRoot.querySelectorAll('[data-reveal]').forEach(node => { node.dataset.ready = String(phase >= Number(node.dataset.reveal)); });
    this.shadowRoot.querySelectorAll('[data-run-step]').forEach(node => { node.dataset.state = Number(node.dataset.runStep) < phase ? 'done' : Number(node.dataset.runStep) === phase ? 'active' : 'waiting'; });
    this.shadowRoot.querySelectorAll('[data-register]').forEach(row => {
      const index = Number(row.dataset.register), result = this.result(REGISTERS[index]);
      const status = index < complete ? result.status : index === complete && this.elapsed >= 1300 ? 'active' : 'waiting';
      row.dataset.outcome = status; const label = row.querySelector('[data-status-label]'); label.textContent = this.status(status); label.dataset.outcome = status;
    });
    const results = REGISTERS.slice(0, complete).map(register => this.result(register));
    const checked = results.filter(result => result.status !== 'outside').length;
    const attached = results.filter(result => result.status === 'attached').length;
    const warnings = checked - attached;
    this.shadowRoot.querySelectorAll('[data-metric]').forEach(node => { node.querySelector('strong').textContent = String({ checked, attached, warning: warnings }[node.dataset.metric]); });
    this.shadowRoot.querySelectorAll('[data-log]').forEach(row => { row.hidden = row.dataset.outcome === 'outside' || Number(row.dataset.log) >= complete || (this.filter === 'warning' && row.dataset.outcome === 'attached'); });
    const summary = this.shadowRoot.querySelector('[data-log-summary]');
    if (summary) summary.textContent = this.text(`Прикреплено: ${attached}. Предупреждений: ${warnings}.`, `Attached: ${attached}. Warnings: ${warnings}.`);
    const finished = this.shadowRoot.querySelector('.job-finished'); if (finished) finished.hidden = this.filter === 'warning' || phase < 4;
    const job = this.shadowRoot.querySelector('[data-job-state]'); if (job) job.textContent = phase >= 4 ? this.text('Задание завершено', 'Task completed') : phase === 0 ? this.text('Ожидание запуска', 'Waiting to start') : this.text('Выполняется', 'Running');
    this.shadowRoot.querySelector('[data-playback-state]').textContent = phase >= 4 ? this.text('Обработка завершена', 'Processing complete') : this.text('Обработка реестров', 'Processing registers');
  }
}

if (!customElements.get('receipts-1c-preview')) customElements.define('receipts-1c-preview', Receipts1cPreview);
