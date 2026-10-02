import { ICONS } from './tm-icons.js';
import { CONTRACT_ICONS } from './contracts-icons.js';
import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';
import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=6';

const CSS = new URL('./contracts-1c.css?v=1', import.meta.url).href;
const DURATION = 12000;
const FEATURES = [
  ['editor', 'Табличный редактор', 'Tabular editor', 'layout', 'Вместо типового текста', 'Beyond plain text'],
  ['templates', 'Шаблоны договоров', 'Contract templates', 'layers', 'Структура и параметры', 'Structure and parameters'],
  ['specification', 'Договор и спецификация', 'Contract and specification', 'database', 'Заполнение по счету', 'Populate from an invoice'],
  ['word', 'Печать в Word', 'Print to Word', 'printer', 'Готовые макеты DOCX', 'Ready-to-use DOCX layouts'],
];
const LAYOUTS = [
  ['supply', 'Договор поставки', 'Supply agreement'],
  ['specification', 'Договор со спецификацией', 'Agreement with specification'],
];
// The examples explain the photographed workflow, not the customer's real contracts.
const INVOICES = [
  { id: '00041', contract: 'Д-041', date: '2026-06-01', customer: ['ООО «Контур-Тест»', 'Contour Test LLC'], items: [
    { name: ['Принтер M12', 'M12 printer'], spec: ['Лазерный, A4', 'Laser, A4'], quantity: 2, price: 18000 },
    { name: ['Картридж K8', 'K8 cartridge'], spec: ['Черный, 3 000 страниц', 'Black, 3,000 pages'], quantity: 4, price: 1200 },
  ] },
  { id: '00042', contract: 'Д-042', date: '2026-06-02', customer: ['ООО «Вектор-Демо»', 'Vector Demo LLC'], items: [
    { name: ['Сканер S20', 'S20 scanner'], spec: ['Планшетный, A4', 'Flatbed, A4'], quantity: 1, price: 24000 },
    { name: ['МФУ P10', 'P10 multifunction printer'], spec: ['Печать / сканирование', 'Print / scan'], quantity: 2, price: 19500 },
  ] },
];
const total = invoice => invoice.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = name => CONTRACT_ICONS[name] || ICONS[name] || '';

class Contracts1cPreview extends HTMLElement {
  static observedAttributes = ['locale', 'description'];
  constructor() {
    super(); this.attachShadow({ mode: 'open' });
    this.feature = 0; this.layout = 0; this.invoice = 0; this.field = 'number';
    this.format = { bold: true, italic: false, align: 'center' };
    this.elapsed = 0; this.visible = false; this.running = false; this.tour = true;
    this.tick = this.tick.bind(this);
  }
  get english() { return this.getAttribute('locale') === 'en'; }
  text(ru, en) { return this.english ? en : ru; }
  local(pair) { return pair[this.english ? 1 : 0]; }
  get data() { return INVOICES[this.invoice]; }
  date(value) { return new Intl.DateTimeFormat(this.english ? 'en-GB' : 'ru-RU', { timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z')); }
  money(value) { return new Intl.NumberFormat(this.english ? 'en-US' : 'ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value); }
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
      ${projectHeading('contracts', this.english)}
      <nav class="feature-map" role="tablist" aria-label="${this.text('Расширение шаблонов договоров', 'Contract template extension')}">${FEATURES.map(([id, ru, en, glyph, subRu, subEn], index) => `<div class="feature-node"><button type="button" role="tab" id="contracts-${id}" aria-controls="contracts-detail" data-feature="${index}"><span class="node-icon">${icon(glyph)}</span><strong>${this.text(ru, en)}</strong><small>${this.text(subRu, subEn)}</small><span class="node-number">0${index + 1}</span></button><i class="node-wire"></i></div>`).join('')}</nav>
      <div class="bridge" aria-hidden="true">${icon('down')}</div>
      <section class="workspace" aria-label="${this.text('Шаблоны договоров в 1С', 'Contract templates in 1C')}">
        <header class="window-header"><b class="one-c">1C</b><strong>${this.text('Расширение: шаблоны и печать договоров', 'Extension: contract templates and printing')}</strong><span class="demo">DEMO</span></header>
        <div class="scene" id="contracts-detail" role="tabpanel"></div>
        <footer class="window-footer"><span>${icon('test')}${this.text('Демонстрационные данные', 'Sample data')}</span><span data-playback-state></span></footer>
      </section>
      <div class="playback"><span data-counter></span><div class="progress"><i></i></div>${[['previous', 'Предыдущая задача', 'Previous task', 'right'], ['replay', 'Повторить анимацию', 'Replay animation', 'replay'], ['play', '', '', 'play'], ['next', 'Следующая задача', 'Next task', 'right']].map(([action, ru, en, glyph]) => `<button type="button" class="tool ${action}" data-action="${action}" title="${this.text(ru, en)}" aria-label="${this.text(ru, en)}">${icon(glyph)}</button>`).join('')}</div>
    </div>`, this.english);
    this.renderScene(); this.updatePlayButton();
  }
  heading(ru, en, subRu, subEn) { return `<div class="scene-heading"><h3>${this.text(ru, en)}</h3><p>${this.text(subRu, subEn)}</p></div>`; }
  flow(items) {
    return `<div class="flow">${items.map(([ru, en, glyph], index) => `<div class="flow-step" data-phase="${index}"><span>${icon(glyph)}</span><strong>${this.text(ru, en)}</strong><b>${icon('check')}</b></div>${index < items.length - 1 ? `<div class="flow-wire" aria-hidden="true"><i></i>${icon('right')}</div>` : ''}`).join('')}</div>`;
  }
  layoutControl() {
    return `<label class="layout-control">${this.text('Макет договора', 'Contract layout')}<select data-layout aria-label="${this.text('Макет договора', 'Contract layout')}">${LAYOUTS.map(([, ru, en], index) => `<option value="${index}"${index === this.layout ? ' selected' : ''}>${this.text(ru, en)}</option>`).join('')}</select></label>`;
  }
  parameter(name, ru, en, value) {
    return `<span class="parameter" data-parameter="${name}" data-highlight="${name === this.field}"><span class="parameter-token">{${this.text(ru, en)}}</span><span class="parameter-value">${esc(value)}</span></span>`;
  }
  paper({ template = false, word = false } = {}) {
    const invoice = this.data;
    return `<div class="contract-paper${template ? ' template-paper' : ''}${word ? ' word-paper' : ''}">
      <div class="paper-meta"><span>${word ? 'DOCX' : this.text('ДОГОВОР', 'AGREEMENT')}</span><span>${this.layout ? '02' : '01'}</span></div>
      <h4 style="font-weight:${this.format.bold ? 700 : 400};font-style:${this.format.italic ? 'italic' : 'normal'};text-align:${this.format.align}">${this.text('ДОГОВОР ПОСТАВКИ', 'SUPPLY AGREEMENT')} № ${this.parameter('number', 'Номер', 'Number', invoice.contract)}</h4>
      <div class="paper-date">${this.parameter('date', 'Дата', 'Date', this.date(invoice.date))}</div>
      <p>${this.text('ООО «Техно-Пример», именуемое «Поставщик», и', 'Techno Example LLC, the Supplier, and')} ${this.parameter('customer', 'Контрагент', 'Customer', this.local(invoice.customer))}${this.text(', именуемое «Покупатель», заключили договор поставки.', ', the Buyer, enter into a supply agreement.')}</p>
      <h5>1. ${this.text('Предмет договора', 'Subject of the agreement')}</h5>
      <p>${this.text('Поставщик передает товар, а Покупатель принимает и оплачивает его.', 'The Supplier delivers the goods, and the Buyer accepts and pays for them.')}</p>
      <h5>2. ${this.text('Стоимость и порядок оплаты', 'Price and payment terms')}</h5>
      <p>${this.text('Сумма договора:', 'Agreement total:')} ${this.parameter('amount', 'Сумма', 'Amount', this.money(total(invoice)))}. ${this.text('Постоплата 100%.', '100% post-payment.')}</p>
      ${this.layout === 1 ? `<h5>3. ${this.text('Спецификация', 'Specification')}</h5>${this.itemsTable(true)}` : `<h5>3. ${this.text('Поставка и приемка', 'Delivery and acceptance')}</h5><p>${this.text('Срок поставки: 10 дней. Место поставки указано в договоре.', 'Delivery period: 10 days. The delivery location is specified in the agreement.')}</p>`}
      <div class="signatures"><div>${this.text('Поставщик', 'Supplier')}<i></i></div><div>${this.text('Покупатель', 'Buyer')}<i></i></div></div>
    </div>`;
  }
  itemsTable(compact = false) {
    return `<div class="table-wrap${compact ? ' compact' : ''}" tabindex="0" aria-label="${this.text('Спецификация договора', 'Contract specification')}"><table><thead><tr>${(compact ? [['Товар', 'Item'], ['Кол-во', 'Qty'], ['Сумма', 'Amount']] : [['Номенклатура', 'Item'], ['Характеристики', 'Specifications'], ['Кол-во', 'Qty'], ['Цена', 'Price'], ['Сумма', 'Amount']]).map(([ru, en]) => `<th>${this.text(ru, en)}</th>`).join('')}</tr></thead><tbody>${this.data.items.map((item, index) => `<tr data-item="${index}"><td>${this.local(item.name)}</td>${compact ? '' : `<td>${this.local(item.spec)}</td>`}<td>${item.quantity}</td>${compact ? '' : `<td>${this.money(item.price)}</td>`}<td>${this.money(item.price * item.quantity)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="${compact ? 2 : 4}">${this.text('Итого', 'Total')}</td><td>${this.money(total(this.data))}</td></tr></tfoot></table></div>`;
  }
  editorScene() {
    return `${this.heading('Вместо простого текста — полноценный макет', 'From plain text to a complete layout', 'Табличный документ сохраняет структуру договора: заголовки, абзацы, таблицы и выравнивание.', 'A tabular document preserves headings, paragraphs, tables and alignment.')}
      ${this.flow([['Типовой текст', 'Plain text', 'list'], ['Табличный документ', 'Tabular document', 'layout'], ['Форматирование', 'Formatting', 'bold'], ['Шаблон договора', 'Contract template', 'layers']])}
      <div class="editor-comparison"><div class="plain-document"><div class="pane-title">${icon('list')}<strong>${this.text('Было: типовой редактор', 'Before: standard editor')}</strong></div><div class="plain-copy">${this.text('ДОГОВОР ПОСТАВКИ № ___\n\n1. Предмет договора\nПоставщик передает товар покупателю.\n\n2. Стоимость и порядок оплаты\nСумма договора: ______\n\n3. Поставка и приемка\nСрок поставки: ______', 'SUPPLY AGREEMENT No. ___\n\n1. Subject\nThe Supplier delivers goods to the Buyer.\n\n2. Price and payment\nAgreement total: ______\n\n3. Delivery and acceptance\nDelivery period: ______')}</div><span class="plain-label">${this.text('Текст договора', 'Agreement text')}</span></div>
      <div class="sheet-editor" data-reveal="1"><div class="pane-title">${icon('layout')}<strong>${this.text('Стало: табличный редактор', 'After: tabular editor')}</strong><span class="badge">1C</span></div>
        <div class="format-toolbar" role="group" aria-label="${this.text('Форматирование заголовка', 'Heading formatting')}">${[['bold', 'Полужирный', 'Bold'], ['italic', 'Курсив', 'Italic'], ['left', 'Выровнять слева', 'Align left'], ['center', 'Выровнять по центру', 'Align center']].map(([name, ru, en]) => `<button type="button" data-format="${name}" title="${this.text(ru, en)}" aria-label="${this.text(ru, en)}" aria-pressed="${name === 'bold' || name === 'italic' ? this.format[name] : this.format.align === name}">${icon(name)}</button>`).join('')}<span>12 pt</span><b>A1:F1</b></div>
        <div class="sheet-ruler"><span></span>${['A', 'B', 'C', 'D', 'E', 'F'].map(letter => `<span>${letter}</span>`).join('')}</div>
        <div class="sheet-row title-row"><b>1</b><div data-cell-title style="font-weight:${this.format.bold ? 700 : 400};font-style:${this.format.italic ? 'italic' : 'normal'};text-align:${this.format.align}">${this.text('ДОГОВОР ПОСТАВКИ № ___', 'SUPPLY AGREEMENT No. ___')}</div></div>
        <div class="sheet-row"><b>2</b><div class="sheet-date">${this.text('«___» __________ 2026 г.', 'Date: ______________ 2026')}</div></div>
        <div class="sheet-row" data-reveal="2"><b>3</b><div><strong>1. ${this.text('Предмет договора', 'Subject of the agreement')}</strong><p>${this.text('Поставщик передает товар, а Покупатель принимает и оплачивает его.', 'The Supplier delivers the goods, and the Buyer accepts and pays for them.')}</p></div></div>
        <div class="sheet-row" data-reveal="3"><b>4</b><div><strong>2. ${this.text('Спецификация', 'Specification')}</strong>${this.itemsTable(true)}</div></div>
        <div class="sheet-row" data-reveal="4"><b>5</b><div class="sheet-signatures">${this.text('Поставщик __________', 'Supplier __________')}<span>${this.text('Покупатель __________', 'Buyer __________')}</span></div></div>
      </div></div>`;
  }
  templatesScene() {
    return `${this.heading('Шаблон связывает оформление и параметры договора', 'A template connects the layout and agreement parameters', 'В шаблоне задаются разделы, условия оплаты и места для реквизитов.', 'Templates define sections, payment terms and positions for document fields.')}
      ${this.flow([['Макет', 'Layout', 'layers'], ['Параметры договора', 'Agreement parameters', 'tag'], ['Подстановка данных', 'Populate fields', 'sync'], ['Оформленный договор', 'Formatted agreement', 'file']])}
      <div class="template-layout"><div class="template-sidebar"><div class="pane-title">${icon('layers')}<strong>${this.text('Шаблоны договоров', 'Contract templates')}</strong></div><div class="layout-list" role="group" aria-label="${this.text('Выбор шаблона', 'Template selection')}">${LAYOUTS.map(([, ru, en], index) => `<button type="button" data-template="${index}" aria-pressed="${index === this.layout}"><span class="template-thumbnail" aria-hidden="true">${icon('file')}<i></i><i></i><i></i></span><span><strong>${this.text(ru, en)}</strong><small>${this.text('Постоплата 100%', '100% post-payment')}</small></span>${icon('check')}</button>`).join('')}</div><div class="pane-title parameter-title">${icon('tag')}<strong>${this.text('Вставить в текст', 'Insert into text')}</strong></div><div class="parameter-list" role="group" aria-label="${this.text('Параметры шаблона', 'Template parameters')}">${[['number', 'Номер', 'Number', this.data.contract], ['date', 'Дата', 'Date', this.date(this.data.date)], ['customer', 'Контрагент', 'Customer', this.local(this.data.customer)], ['amount', 'Сумма', 'Amount', this.money(total(this.data))]].map(([name, ru, en, value]) => `<button type="button" data-field="${name}" aria-pressed="${name === this.field}"><span>{${this.text(ru, en)}}</span><small>${esc(value)}</small>${icon('right')}</button>`).join('')}</div></div><div class="paper-stage" data-reveal="1">${this.paper({ template: true })}</div></div>`;
  }
  specificationScene() {
    return `${this.heading('Счет становится основой договора и спецификации', 'An invoice becomes the basis for the agreement and specification', 'В карточке договора собраны сумма, условия поставки, вариант оплаты и номенклатура.', 'The agreement contains the total, delivery terms, payment option and item specification.')}
      ${this.flow([['Счет покупателя', 'Customer invoice', 'file'], ['Заполнить по счету', 'Populate from invoice', 'sync'], ['Условия договора', 'Agreement terms', 'list'], ['Спецификация', 'Specification', 'layout']])}
      <div class="invoice-toolbar"><label>${this.text('Счет-основание', 'Source invoice')}<select data-invoice aria-label="${this.text('Счет-основание', 'Source invoice')}">${INVOICES.map((item, index) => `<option value="${index}"${index === this.invoice ? ' selected' : ''}>№ ${item.id} · ${this.local(item.customer)}</option>`).join('')}</select></label><button class="command" type="button" data-action="fill">${icon('sync')}${this.text('Заполнить по счету', 'Populate from invoice')}</button></div>
      <div class="document-fields"><div><span>${this.text('Контрагент', 'Customer')}</span><strong data-fill="1">${this.local(this.data.customer)}</strong></div><div><span>${this.text('Сумма договора', 'Agreement total')}</span><strong data-fill="1">${this.money(total(this.data))}</strong></div><div><span>${this.text('Правовое основание', 'Legal basis')}</span><strong>${this.text('Без ФЗ', 'No federal procurement law')}</strong></div><div><span>${this.text('Вариант оплаты', 'Payment option')}</span><strong>${this.text('Постоплата 100%', '100% post-payment')}</strong></div><div><span>${this.text('Срок поставки', 'Delivery period')}</span><strong>${this.text('10 дней', '10 days')}</strong></div><div><span>${this.text('Вариант спецификации', 'Specification option')}</span><strong>${this.text('С характеристиками', 'With specifications')}</strong></div></div>
      <div class="specification-title">${icon('layout')}<strong>${this.text('Спецификация договора', 'Contract specification')}</strong><span data-fill="3">${this.data.items.length} ${this.text('позиции', 'items')}</span></div><div data-fill="2">${this.itemsTable()}</div><div class="completion" data-reveal="4">${icon('check')}${this.text('Сумма и позиции перенесены из счета', 'Total and items populated from the invoice')}</div>`;
  }
  wordScene() {
    return `${this.heading('Готовый договор печатается сразу в Word', 'The completed agreement prints directly to Word', 'Дополнительные макеты DOCX доступны в меню печати договора.', 'Additional DOCX layouts are available in the agreement print menu.')}
      ${this.flow([['Карточка договора', 'Agreement form', 'database'], ['Выбор макета', 'Select layout', 'layers'], ['Печать DOCX', 'Print DOCX', 'printer'], ['Документ Word', 'Word document', 'file']])}
      <div class="word-layout"><div class="print-source"><div class="pane-title"><b class="one-c">1C</b><strong>${this.text('Договор', 'Agreement')} ${this.data.contract}</strong></div><dl><div><dt>${this.text('Контрагент', 'Customer')}</dt><dd>${this.local(this.data.customer)}</dd></div><div><dt>${this.text('Сумма', 'Total')}</dt><dd>${this.money(total(this.data))}</dd></div></dl>${this.layoutControl()}<div class="print-menu"><div>${icon('printer')}<strong>${this.text('Печать', 'Print')}</strong>${icon('down')}</div><button class="command" type="button" data-action="print">${icon('file')}${this.text(LAYOUTS[this.layout][1], LAYOUTS[this.layout][2])} (DOCX)</button></div><div class="export-status" data-reveal="3"><span class="word-icon">W</span><div><strong>contract-${this.data.id}.docx</strong><small>${this.text('Договор сформирован', 'Agreement generated')}</small></div>${icon('check')}</div></div><div class="word-transfer" aria-hidden="true"><i>${icon('file')}</i>${icon('right')}</div><div class="word-preview" data-reveal="2"><div class="word-chrome"><span class="word-icon">W</span><strong>${this.text('Документ Word', 'Word document')}</strong><small>.docx</small></div>${this.paper({ word: true })}</div></div>`;
  }
  renderScene() {
    const scene = this.shadowRoot.querySelector('.scene');
    scene.innerHTML = [() => this.editorScene(), () => this.templatesScene(), () => this.specificationScene(), () => this.wordScene()][this.feature]();
    scene.setAttribute('aria-labelledby', 'contracts-' + FEATURES[this.feature][0]);
    this.shadowRoot.querySelectorAll('[data-feature]').forEach((tab, index) => { tab.setAttribute('aria-selected', String(index === this.feature)); tab.tabIndex = index === this.feature ? 0 : -1; });
    this.shadowRoot.querySelector('[data-counter]').textContent = `0${this.feature + 1} / 04`;
    this.updateAnimation();
  }
  restart() { this.elapsed = this.motion.matches ? DURATION - 1 : 0; this.wanted = !this.motion.matches; this.tour = false; this.updatePlayButton(); this.syncClock(); }
  select(index) {
    if (!Number.isInteger(index) || index < 0 || index >= FEATURES.length) return;
    this.tour = false; if (index === this.feature) return;
    this.feature = index; this.restart(); this.renderScene();
  }
  onChange(event) {
    const target = event.target, index = Number(target.value);
    if (!Number.isInteger(index)) return;
    if (target.matches('[data-invoice]') && INVOICES[index]) this.invoice = index;
    else if (target.matches('[data-layout]') && LAYOUTS[index]) this.layout = index;
    else return;
    this.restart(); this.renderScene();
    this.shadowRoot.querySelector(target.matches('[data-invoice]') ? '[data-invoice]' : '[data-layout]')?.focus();
  }
  onClick(event) {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-feature')) return this.select(Number(button.dataset.feature));
    if (button.hasAttribute('data-template')) {
      const index = Number(button.dataset.template); if (!Number.isInteger(index) || !LAYOUTS[index]) return;
      this.layout = index; this.restart(); this.renderScene(); this.shadowRoot.querySelector(`[data-template="${index}"]`).focus(); return;
    }
    if (button.hasAttribute('data-field')) {
      this.field = button.dataset.field; this.restart(); this.renderScene(); this.shadowRoot.querySelector(`[data-field="${this.field}"]`).focus(); return;
    }
    if (button.hasAttribute('data-format')) {
      const name = button.dataset.format;
      if (name === 'bold' || name === 'italic') this.format[name] = !this.format[name];
      else this.format.align = name;
      const cell = this.shadowRoot.querySelector('[data-cell-title]');
      cell.style.fontWeight = this.format.bold ? '700' : '400'; cell.style.fontStyle = this.format.italic ? 'italic' : 'normal'; cell.style.textAlign = this.format.align;
      this.shadowRoot.querySelectorAll('[data-format]').forEach(node => node.setAttribute('aria-pressed', String(['bold', 'italic'].includes(node.dataset.format) ? this.format[node.dataset.format] : this.format.align === node.dataset.format)));
      return;
    }
    const action = button.dataset.action;
    if (action === 'previous' || action === 'next') return this.select((this.feature + (action === 'next' ? 1 : 3)) % 4);
    if (['fill', 'print', 'replay'].includes(action)) { this.restart(); this.updateAnimation(); }
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
    const label = this.wanted ? this.text('Остановить анимацию договоров', 'Pause contract animation') : this.text('Продолжить анимацию договоров', 'Resume contract animation');
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
    const phase = Math.min(4, Math.floor(this.elapsed / 2200));
    this.style.setProperty('--progress', String(this.elapsed / DURATION));
    this.shadowRoot.querySelectorAll('[data-phase]').forEach(node => { node.dataset.state = Number(node.dataset.phase) < phase ? 'done' : Number(node.dataset.phase) === phase ? 'active' : 'waiting'; });
    this.shadowRoot.querySelectorAll('[data-reveal]').forEach(node => { node.dataset.ready = String(phase >= Number(node.dataset.reveal)); });
    this.shadowRoot.querySelectorAll('[data-fill]').forEach(node => { node.dataset.filled = String(phase >= Number(node.dataset.fill)); });
    this.shadowRoot.querySelectorAll('.contract-paper').forEach(node => { node.dataset.filled = String(phase >= 2); });
    this.shadowRoot.querySelector('[data-playback-state]').textContent = phase >= 4 ? this.text('Готово', 'Complete') : this.text('Подготовка договора', 'Preparing agreement');
  }
}

if (!customElements.get('contracts-1c-preview')) customElements.define('contracts-1c-preview', Contracts1cPreview);
