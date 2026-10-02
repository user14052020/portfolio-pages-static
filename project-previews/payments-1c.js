import { ICONS } from './tm-icons.js';
import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';
import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=4';

const CSS = new URL('./payments-1c.css?v=1', import.meta.url).href;
const DURATION = 12000;
const FEATURES = [
  ['rules', 'Правила распознавания', 'Matching rules', 'search', 'Комментарий → правило', 'Comment → rule'],
  ['batch', 'Массовое заполнение', 'Batch autofill', 'layers', 'Правило → реквизиты', 'Rule → document fields'],
  ['states', 'Контроль обработки', 'Processing status', 'gauge', 'Результат по документам', 'Results by document'],
  ['journal', 'Журнал и защита', 'Log and protection', 'shield', 'История без повторных правок', 'History without duplicate edits'],
];
const RULES = [
  { id: 'R-01', name: ['Эквайринг', 'Acquiring'], direction: 'in', token: 'POS-17', division: ['Магазин Север', 'North store'], contract: ['Договор эквайринга', 'Acquiring agreement'], article: ['Розничная выручка', 'Retail revenue'] },
  { id: 'R-02', name: ['Комиссия банка', 'Bank commission'], direction: 'out', token: 'Комиссия', division: ['Магазин Север', 'North store'], contract: ['Договор с банком', 'Bank agreement'], article: ['Расходы на услуги банка', 'Bank service expenses'] },
  { id: 'R-03', name: ['СБП', 'Instant payments'], direction: 'in', token: 'QR-24', division: ['Магазин Центр', 'Central store'], contract: ['Договор СБП', 'Instant payment agreement'], article: ['Розничная выручка', 'Retail revenue'] },
];
const PAYMENTS = [
  { id: 'П-104', direction: 'in', amount: 24500, comment: ['Эквайринг POS-17 · Магазин Север', 'Acquiring POS-17 · North store'] },
  { id: 'П-105', direction: 'out', amount: 735, comment: ['Комиссия эквайринга · POS-17', 'Acquiring commission · POS-17'] },
  { id: 'П-106', direction: 'in', amount: 12800, comment: ['СБП QR-24 · Магазин Центр', 'Instant payment QR-24 · Central store'] },
  { id: 'П-107', direction: 'out', amount: 5000, comment: ['Перевод средств', 'Funds transfer'] },
  { id: 'П-103', direction: 'out', amount: 250, comment: ['Комиссия эквайринга · POS-17', 'Acquiring commission · POS-17'], processed: true },
];
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = name => ICONS[name] || '';

// The same matching model drives the rule, batch, status and log scenes.
function resultFor(payment) {
  if (payment.processed) return { status: 'protected', rule: null };
  const rule = RULES.find(item => item.direction === payment.direction && payment.comment[0].includes(item.token));
  return { status: rule ? 'done' : 'skipped', rule: rule || null };
}

class Payments1cPreview extends HTMLElement {
  static observedAttributes = ['locale', 'description'];
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.feature = 0;
    this.sample = 0;
    this.filter = 'all';
    this.elapsed = 0;
    this.visible = false;
    this.running = false;
    this.tour = true;
    this.tick = this.tick.bind(this);
  }
  get english() { return this.getAttribute('locale') === 'en'; }
  text(ru, en) { return this.english ? en : ru; }
  local(pair) { return pair[this.english ? 1 : 0]; }
  money(value) { return new Intl.NumberFormat(this.english ? 'en-US' : 'ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value); }
  direction(value) { return value === 'in' ? this.text('Поступление', 'Incoming') : this.text('Списание', 'Outgoing'); }
  status(value) { return this.local({ waiting: ['В очереди', 'Queued'], active: ['Обработка', 'Processing'], done: ['Обработан', 'Processed'], skipped: ['Пропущен', 'Skipped'], protected: ['Без изменений', 'Unchanged'] }[value]); }
  reason(value) { return this.local({ done: ['Правило подобрано и применено', 'Rule matched and applied'], skipped: ['Подходящее правило не найдено', 'No matching rule found'], protected: ['Уже обработан: повторная правка исключена', 'Already processed: duplicate changes prevented'] }[value]); }
  completedCount() { return Math.max(0, Math.min(PAYMENTS.length, Math.floor((this.elapsed - 2400) / 1100) + 1)); }
  connectedCallback() {
    this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.wanted = !this.motion.matches;
    if (!this.wanted) this.elapsed = DURATION - 1;
    this.shadowRoot.addEventListener('pointerover', event => {
      const tab = event.target.closest('button[data-feature]');
      if (tab && event.pointerType !== 'touch' && !tab.contains(event.relatedTarget)) this.select(Number(tab.dataset.feature));
    }, options);
    this.shadowRoot.addEventListener('focusin', event => {
      const tab = event.target.closest('button[data-feature]');
      if (tab) this.select(Number(tab.dataset.feature));
    }, options);
    this.shadowRoot.addEventListener('click', event => this.onClick(event), options);
    this.shadowRoot.addEventListener('change', event => {
      if (event.target.matches('[data-sample]')) {
        this.sample = Number(event.target.value);
        this.restart();
        this.renderScene();
      }
    }, options);
    this.shadowRoot.addEventListener('keydown', event => this.onKey(event), options);
    this.shadowRoot.addEventListener('previewstylesready', () => this.syncClock(), options);
    document.addEventListener('visibilitychange', () => this.syncClock(), options);
    this.motion.addEventListener('change', () => {
      if (this.motion.matches) {
        this.wanted = false; this.elapsed = DURATION - 1;
        this.updateAnimation(); this.updatePlayButton(); this.syncClock();
      }
    }, options);
    this.render();
    this.observer = new IntersectionObserver(entries => { this.visible = entries[0].isIntersecting; this.syncClock(); }, { threshold: .1 });
    this.observer.observe(this);
  }
  disconnectedCallback() {
    stopPreviewLoading(this.shadowRoot);
    this.abort?.abort(); this.observer?.disconnect(); cancelAnimationFrame(this.frame);
    this.running = false;
  }
  attributeChangedCallback(name, before, after) { if (before !== after && this.isConnected && this.abort) this.render(); }
  render() {
    renderPreview(this.shadowRoot, [CSS, DIAGRAM_STYLESHEET], `<div class="preview">
      <div class="case-intro"><details>${projectSummary(this.english)}<p>${esc(this.getAttribute('description') || '')}</p></details></div>
      ${projectHeading('payments', this.english)}
      <nav class="feature-map" role="tablist" aria-label="${this.text('Автоматизация платежей', 'Payment automation')}">${FEATURES.map(([id, ru, en, glyph, subRu, subEn], index) => `<div class="feature-node"><button type="button" role="tab" id="payments-${id}" aria-controls="payments-detail" data-feature="${index}"><span class="node-icon">${icon(glyph)}</span><strong>${this.text(ru, en)}</strong><small>${this.text(subRu, subEn)}</small><span class="node-number">0${index + 1}</span></button><i class="node-wire"></i></div>`).join('')}</nav>
      <div class="bridge" aria-hidden="true">${icon('down')}</div>
      <section class="workspace" aria-label="${this.text('Автозаполнение банковских документов в 1С', 'Bank document autofill in 1C')}">
        <header class="window-header"><b class="one-c">1C</b><strong>${this.text('Автозаполнение банковских документов', 'Bank document autofill')}</strong><span class="demo">DEMO</span></header>
        <div class="scene" id="payments-detail" role="tabpanel"></div>
        <footer class="window-footer"><span>${icon('shield')}${this.text('Демонстрационные данные', 'Sample data')}</span><span data-playback-state></span></footer>
      </section>
      <div class="playback"><span data-counter></span><div class="progress"><i></i></div>${[['previous', 'Предыдущая задача', 'Previous task', 'right'], ['replay', 'Повторить анимацию', 'Replay animation', 'replay'], ['play', '', '', 'play'], ['next', 'Следующая задача', 'Next task', 'right']].map(([action, ru, en, glyph]) => `<button type="button" class="tool ${action}" data-action="${action}" title="${this.text(ru, en)}" aria-label="${this.text(ru, en)}">${icon(glyph)}</button>`).join('')}</div>
    </div>`, this.english);
    this.renderScene(); this.updatePlayButton();
  }
  flow(items) {
    return `<div class="flow">${items.map(([ru, en, glyph], index) => `<div class="flow-step" data-phase="${index}"><span>${icon(glyph)}</span><strong>${this.text(ru, en)}</strong><b>${icon('check')}</b></div>${index < items.length - 1 ? `<div class="flow-wire" aria-hidden="true"><i></i>${icon('right')}</div>` : ''}`).join('')}</div>`;
  }
  heading(ru, en, subRu, subEn) { return `<div class="scene-heading"><h3>${this.text(ru, en)}</h3><p>${this.text(subRu, subEn)}</p></div>`; }
  rulesScene() {
    const payment = PAYMENTS[this.sample], result = resultFor(payment);
    const comment = esc(this.local(payment.comment));
    const token = result.rule ? esc(this.english && result.rule.token === 'Комиссия' ? 'commission' : result.rule.token) : '';
    return `${this.heading('Реквизиты определяются по правилам', 'Saved rules determine the fields', 'Входящие и исходящие платежи распознаются по комментарию и сохраненным условиям.', 'Incoming and outgoing payments are matched by their comment and saved conditions.')}
      ${this.flow([['Комментарий платежа', 'Payment comment', 'card'], ['Поиск условий', 'Condition matching', 'search'], ['Сохраненное правило', 'Saved rule', 'list'], ['Реквизиты 1С', '1C fields', 'check']])}
      <div class="split"><div class="pane"><div class="pane-title">${icon('card')}<strong>${this.text('Банковский документ', 'Bank document')}</strong><select data-sample aria-label="${this.text('Пример платежа', 'Sample payment')}">${PAYMENTS.map((item, index) => `<option value="${index}"${this.sample === index ? ' selected' : ''}>${item.id} · ${this.direction(item.direction)}</option>`).join('')}</select></div><div class="payment-total"><span>${this.direction(payment.direction)}</span><strong>${this.money(payment.amount)}</strong></div><small class="field-label">${this.text('Комментарий', 'Comment')}</small><div class="comment" data-reveal="1">${token ? comment.replace(token, `<mark>${token}</mark>`) : comment}</div><div class="match-result" data-reveal="2" data-status="${result.status}">${icon(result.rule ? 'check' : 'shield')}<strong>${result.rule ? result.rule.id + ' · ' + this.local(result.rule.name) : this.reason(result.status)}</strong></div></div>
      <div class="pane"><div class="pane-title">${icon('list')}<strong>${this.text('Правила автозаполнения', 'Autofill rules')}</strong><span class="badge">3</span></div><div class="rule-list">${RULES.map(rule => `<div class="rule-row${result.rule === rule ? ' matched' : ''}" data-reveal="2"><span class="rule-code">${rule.id}</span><div><strong>${this.local(rule.name)}</strong><small>${this.direction(rule.direction)} · ${this.english && rule.token === 'Комиссия' ? 'commission' : rule.token}</small></div>${icon('check')}</div>`).join('')}</div><div class="rule-fields" data-reveal="3">${result.rule ? this.fields(result.rule) : `<p>${this.reason(result.status)}</p>`}</div></div></div>`;
  }
  fields(rule) {
    return `<dl>${[['Подразделение', 'Division', rule.division], ['Договор', 'Agreement', rule.contract], ['Статья доходов / расходов', 'Income / expense item', rule.article]].map(([ru, en, value], index) => `<div data-reveal="${index + 2}"><dt>${this.text(ru, en)}</dt><dd>${icon('check')}${this.local(value)}</dd></div>`).join('')}</dl>`;
  }
  table(journal = false) {
    return `<div class="table-wrap" tabindex="0" aria-label="${this.text('Банковские документы', 'Bank documents')}"><table><thead><tr>${(journal ? [['Время', 'Time'], ['Документ', 'Document'], ['Статус', 'Status'], ['Правило / результат', 'Rule / result']] : [['Документ / комментарий', 'Document / comment'], ['Сумма', 'Amount'], ['Статус', 'Status'], ['Правило / результат', 'Rule / result']]).map(([ru, en]) => `<th>${this.text(ru, en)}</th>`).join('')}</tr></thead><tbody>${PAYMENTS.map((payment, index) => {
      const result = resultFor(payment);
      return `<tr data-payment="${index}" data-result="${result.status}">${journal ? `<td class="time">11:31:${String(50 + index).padStart(2, '0')}<small>${this.text('Бухгалтер', 'Accountant')}</small></td><td><strong>${payment.id}</strong><small>${this.direction(payment.direction)}</small></td>` : `<td><strong>${payment.id} · ${this.direction(payment.direction)}</strong><small>${this.local(payment.comment)}</small></td><td class="amount">${this.money(payment.amount)}</td>`}<td><span class="status" data-status-label></span></td><td><span data-result-label></span><small data-reason></small></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  batchScene() {
    return `${this.heading('Пакет платежей обрабатывается автоматически', 'A payment batch is processed automatically', 'Правила заполняют реквизиты документов за выбранный период.', 'Rules populate document fields for the selected period.')}
      ${this.flow([['Банковские документы', 'Bank documents', 'layers'], ['Подбор правил', 'Rule matching', 'search'], ['Заполнение реквизитов', 'Field autofill', 'database'], ['Результат обработки', 'Processing results', 'check']])}
      <div class="batch-toolbar"><span>${icon('clock')}01.06.2026 — 04.06.2026</span><button type="button" data-action="run">${icon('play')}${this.text('Обработать новые платежи', 'Process new payments')}</button></div>
      <div class="batch-grid"><div class="pane">${this.table()}</div><div class="pane document"><div class="pane-title"><b class="one-c">1C</b><strong>${this.text('Поступление П-104', 'Incoming payment П-104')}</strong></div><div class="document-fields"><div><span>${this.text('До обработки', 'Before processing')}</span><small>${this.text('Реквизиты не заполнены', 'Fields are empty')}</small></div><div class="document-arrow">${icon('down')}</div><div><span>${this.text('После обработки', 'After processing')}</span>${this.fields(RULES[0])}</div></div></div></div>`;
  }
  metrics() {
    return `<div class="metrics">${[['done', 'Обработано', 'Processed', 'check'], ['skipped', 'Без правила', 'No rule', 'search'], ['protected', 'Защищено', 'Protected', 'shield']].map(([status, ru, en, glyph]) => `<div data-metric="${status}">${icon(glyph)}<strong>0</strong><span>${this.text(ru, en)}</span></div>`).join('')}</div>`;
  }
  statesScene() {
    return `${this.heading('Каждый документ имеет понятный результат', 'Every document has a clear outcome', 'Пропущенные платежи остаются на контроле: причина видна в списке.', 'Skipped payments remain visible with their reason.')}
      ${this.flow([['Платежи', 'Payments', 'card'], ['Проверка правил', 'Rule checks', 'search'], ['Статусы', 'Statuses', 'gauge'], ['Контроль исключений', 'Exception review', 'list']])}
      ${this.metrics()}<div class="filter-row" role="group" aria-label="${this.text('Фильтр документов', 'Document filter')}">${[['all', 'Все документы', 'All documents'], ['skipped', 'Без правила', 'No rule'], ['protected', 'Уже обработаны', 'Already processed']].map(([filter, ru, en]) => `<button type="button" data-filter="${filter}" aria-pressed="${this.filter === filter}">${this.text(ru, en)}</button>`).join('')}</div>${this.table()}`;
  }
  journalScene() {
    return `${this.heading('История обработки и защита от повторной правки', 'Processing history and duplicate-edit protection', 'В журнале сохраняются документ, правило и результат каждого запуска.', 'The log records each document, matched rule and processing result.')}
      ${this.flow([['Новый запуск', 'New run', 'play'], ['Проверка состояния', 'State check', 'shield'], ['Только новые платежи', 'New payments only', 'layers'], ['Запись в журнал', 'Log entry', 'clock']])}
      <div class="protection"><span>${icon('shield')}</span><div><strong>${this.text('П-103 уже обработан', 'П-103 is already processed')}</strong><p>${this.text('Повторный запуск не меняет заполненные реквизиты.', 'Running again leaves the completed document fields unchanged.')}</p></div><b data-reveal="2">${icon('check')}${this.text('Без изменений', 'Unchanged')}</b></div>${this.table(true)}`;
  }
  renderScene() {
    const scene = this.shadowRoot.querySelector('.scene');
    scene.innerHTML = [() => this.rulesScene(), () => this.batchScene(), () => this.statesScene(), () => this.journalScene()][this.feature]();
    scene.setAttribute('aria-labelledby', 'payments-' + FEATURES[this.feature][0]);
    this.shadowRoot.querySelectorAll('[data-feature]').forEach((tab, index) => { tab.setAttribute('aria-selected', String(index === this.feature)); tab.tabIndex = index === this.feature ? 0 : -1; });
    this.shadowRoot.querySelector('[data-counter]').textContent = `0${this.feature + 1} / 04`;
    this.updateAnimation();
  }
  restart() {
    this.elapsed = this.motion.matches ? DURATION - 1 : 0;
    this.wanted = !this.motion.matches; this.tour = false;
    this.updatePlayButton(); this.syncClock();
  }
  select(index) {
    if (!Number.isInteger(index) || index < 0 || index >= FEATURES.length) return;
    this.tour = false;
    if (index === this.feature) return;
    this.feature = index; this.filter = 'all'; this.restart(); this.renderScene();
  }
  onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-feature')) return this.select(Number(button.dataset.feature));
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
    const tab = event.target.closest('button[data-feature]');
    if (!tab) return;
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
    const label = this.wanted ? this.text('Остановить анимацию платежей', 'Pause payment animation') : this.text('Продолжить анимацию платежей', 'Resume payment animation');
    button.innerHTML = icon(this.wanted ? 'pause' : 'play'); button.title = label;
    button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', String(!!this.wanted));
    this.setAttribute('data-playing', String(!!this.wanted));
  }
  syncClock() {
    const running = !!(this.wanted && this.visible && !document.hidden && !this.shadowRoot.querySelector('[data-preview-content][hidden]'));
    if (running === this.running) return;
    this.running = running; this.lastTime = 0; cancelAnimationFrame(this.frame);
    this.setAttribute('data-running', String(running));
    if (running) this.frame = requestAnimationFrame(this.tick);
  }
  tick(now) {
    if (!this.running) return;
    this.elapsed += this.lastTime ? Math.min(now - this.lastTime, 100) : 0; this.lastTime = now;
    if (this.elapsed >= DURATION) {
      this.elapsed = 0;
      if (this.tour) { this.feature = (this.feature + 1) % 4; this.renderScene(); }
    }
    this.updateAnimation(); this.frame = requestAnimationFrame(this.tick);
  }
  updateAnimation() {
    const phase = Math.min(4, Math.floor(this.elapsed / 2200));
    const complete = this.completedCount();
    this.style.setProperty('--progress', String(this.elapsed / DURATION));
    this.shadowRoot.querySelectorAll('[data-phase]').forEach(node => { node.dataset.state = Number(node.dataset.phase) < phase ? 'done' : Number(node.dataset.phase) === phase ? 'active' : 'waiting'; });
    this.shadowRoot.querySelectorAll('[data-reveal]').forEach(node => { node.dataset.ready = String(phase >= Number(node.dataset.reveal)); });
    this.shadowRoot.querySelectorAll('[data-payment]').forEach(row => {
      const index = Number(row.dataset.payment), payment = PAYMENTS[index], result = resultFor(payment);
      const status = index < complete ? result.status : index === complete && this.elapsed >= 1300 ? 'active' : 'waiting';
      row.hidden = this.filter !== 'all' && result.status !== this.filter;
      row.dataset.state = status;
      const label = row.querySelector('[data-status-label]'); label.textContent = this.status(status); label.dataset.status = status;
      row.querySelector('[data-result-label]').textContent = index < complete ? result.rule ? result.rule.id + ' · ' + this.local(result.rule.name) : '—' : '—';
      row.querySelector('[data-reason]').textContent = index < complete ? this.reason(result.status) : '';
    });
    this.shadowRoot.querySelectorAll('[data-metric]').forEach(node => {
      node.querySelector('strong').textContent = String(PAYMENTS.slice(0, complete).filter(payment => resultFor(payment).status === node.dataset.metric).length);
    });
    this.shadowRoot.querySelector('[data-playback-state]').textContent = phase >= 4 ? this.text('Обработка завершена', 'Processing complete') : this.text('Обработка документов', 'Processing documents');
  }
}

if (!customElements.get('payments-1c-preview')) customElements.define('payments-1c-preview', Payments1cPreview);
