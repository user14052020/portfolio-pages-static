import { ICONS } from './tm-icons.js';
import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';
import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=7';

const CSS = new URL('./party-1c.css?v=1', import.meta.url).href;
const DURATION = 12000;
const FEATURES = [
  ['passport', 'Партии и документы', 'Batches and documents', 'package', 'Паспорт каждой партии', 'A passport for every batch'],
  ['expiry', 'Сроки и FEFO', 'Shelf life and FEFO', 'clock', 'Подбор по сроку годности', 'Earliest expiry first'],
  ['stock', 'Остатки и резервы', 'Stock and reservations', 'database', 'От счета до отгрузки', 'From invoice to shipment'],
  ['trace', 'Прослеживаемость и CRM', 'Traceability and CRM', 'sync', 'История и разрешенные данные', 'History and permitted data'],
];
const AS_OF = '2026-08-20';
// One fictional dataset drives receipt, FEFO, stock, shipment and CRM projections.
const LOTS = [
  { id: 'B-024', receipt: 'П-024', made: '2026-06-17', expiry: '2026-09-15', gtd: 'ДТ-024', stock: 12, reserved: 2, warehouse: 0 },
  { id: 'B-025', receipt: 'П-025', made: '2026-07-04', expiry: '2026-12-31', gtd: 'ДТ-025', stock: 8, reserved: 0, warehouse: 0 },
  { id: 'B-023', receipt: 'П-023', made: '2026-05-03', expiry: '2026-08-01', gtd: 'ДТ-023', stock: 5, reserved: 0, warehouse: 0 },
  { id: 'B-024', receipt: 'П-024', made: '2026-06-17', expiry: '2026-09-15', gtd: 'ДТ-024', stock: 3, reserved: 0, warehouse: 1 },
];
const DOCUMENTS = [
  { name: ['Сертификат соответствия', 'Conformity certificate'], file: 'certificate-B024.pdf', allowed: true },
  { name: ['Паспорт качества', 'Quality passport'], file: 'quality-B024.pdf', allowed: true },
  { name: ['ГТД', 'Customs declaration'], file: 'customs-B024.pdf', allowed: false },
];
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const available = lot => lot.stock - lot.reserved;
function allocate(quantity, warehouse) {
  let remaining = quantity;
  const rows = LOTS.filter(lot => lot.warehouse === warehouse && days(AS_OF, lot.expiry) >= 0 && available(lot) > 0)
    .slice().sort((a, b) => a.expiry.localeCompare(b.expiry)).map(lot => {
      const take = Math.min(remaining, available(lot)); remaining -= take;
      return { lot, take };
    }).filter(row => row.take > 0);
  return { rows, remaining };
}
const balance = (lot, take, stage) => ({ stock: lot.stock - (stage === 'sale' ? take : 0), reserved: lot.reserved + (stage === 'reserve' ? take : 0) });
function crmProjection(lot, take) {
  const state = balance(lot, take, 'sale');
  return { batch: lot.id, warehouse: lot.warehouse, stock: state.stock, available: state.stock - state.reserved,
    made: lot.made, expiry: lot.expiry, gtd: lot.gtd, documents: DOCUMENTS.filter(doc => doc.allowed).map(doc => doc.file.replace('B024', lot.id.replace('-', ''))) };
}
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = name => ICONS[name] || '';

class Party1cPreview extends HTMLElement {
  static observedAttributes = ['locale', 'description'];
  constructor() {
    super(); this.attachShadow({ mode: 'open' });
    this.feature = 0; this.quantity = 4; this.warehouse = 0; this.documentIndex = 0;
    this.elapsed = 0; this.visible = false; this.running = false; this.tour = true;
    this.tick = this.tick.bind(this);
  }
  get english() { return this.getAttribute('locale') === 'en'; }
  text(ru, en) { return this.english ? en : ru; }
  local(pair) { return pair[this.english ? 1 : 0]; }
  dayCount(value) {
    if (this.english) return `${value} ${value === 1 ? 'day' : 'days'}`;
    const form = new Intl.PluralRules('ru').select(value);
    return `${value} ${{ one: 'день', few: 'дня', many: 'дней', other: 'дня' }[form]}`;
  }
  date(value) { return new Intl.DateTimeFormat(this.english ? 'en-GB' : 'ru-RU', { timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z')); }
  warehouseName(index) { return index ? this.text('Склад 2', 'Warehouse 2') : this.text('Основной склад', 'Main warehouse'); }
  get selection() { return allocate(this.quantity, this.warehouse); }
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
  disconnectedCallback() { stopPreviewLoading(this.shadowRoot); this.abort?.abort(); this.observer?.disconnect(); cancelAnimationFrame(this.frame); this.running = false; }
  attributeChangedCallback(name, before, after) { if (before !== after && this.isConnected && this.abort) this.render(); }
  render() {
    renderPreview(this.shadowRoot, [CSS, DIAGRAM_STYLESHEET], `<div class="preview">
      <div class="case-intro"><details>${projectSummary(this.english)}<p>${esc(this.getAttribute('description') || '')}</p></details></div>
      ${projectHeading('party', this.english)}
      <nav class="feature-map" role="tablist" aria-label="${this.text('Учет партий товаров', 'Inventory batch accounting')}">${FEATURES.map(([id, ru, en, glyph, subRu, subEn], index) => `<div class="feature-node"><button type="button" role="tab" id="party-${id}" aria-controls="party-detail" data-feature="${index}"><span class="node-icon">${icon(glyph)}</span><strong>${this.text(ru, en)}</strong><small>${this.text(subRu, subEn)}</small><span class="node-number">0${index + 1}</span></button><i class="node-wire"></i></div>`).join('')}</nav>
      <div class="bridge" aria-hidden="true">${icon('down')}</div>
      <section class="workspace" aria-label="${this.text('Партии товаров в 1С', 'Inventory batches in 1C')}">
        <header class="window-header"><b class="one-c">1C</b><strong>${this.text('Расширение: учет партий товаров', 'Extension: inventory batch accounting')}</strong><span class="demo">DEMO</span></header>
        <div class="scene" id="party-detail" role="tabpanel"></div>
        <footer class="window-footer"><span>${icon('test')}${this.text('Демонстрационные данные', 'Sample data')} · ${this.date(AS_OF)}</span><span data-playback-state></span></footer>
      </section>
      <div class="playback"><span data-counter></span><div class="progress"><i></i></div>${[['previous', 'Предыдущая задача', 'Previous task', 'right'], ['replay', 'Повторить анимацию', 'Replay animation', 'replay'], ['play', '', '', 'play'], ['next', 'Следующая задача', 'Next task', 'right']].map(([action, ru, en, glyph]) => `<button type="button" class="tool ${action}" data-action="${action}" title="${this.text(ru, en)}" aria-label="${this.text(ru, en)}">${icon(glyph)}</button>`).join('')}</div>
    </div>`, this.english);
    this.renderScene(); this.updatePlayButton();
  }
  heading(ru, en, subRu, subEn) { return `<div class="scene-heading"><h3>${this.text(ru, en)}</h3><p>${this.text(subRu, subEn)}</p></div>`; }
  flow(items) {
    return `<div class="flow">${items.map(([ru, en, glyph], index) => `<div class="flow-step" data-phase="${index}"><span>${icon(glyph)}</span><strong>${this.text(ru, en)}</strong><b>${icon('check')}</b></div>${index < items.length - 1 ? `<div class="flow-wire" aria-hidden="true"><i></i>${icon('right')}</div>` : ''}`).join('')}</div>`;
  }
  field(ru, en, value) { return `<div><span>${this.text(ru, en)}</span><strong>${esc(value)}</strong></div>`; }
  toolbar() {
    return `<div class="order-toolbar"><label>${this.text('Склад отгрузки', 'Shipment warehouse')}<select data-warehouse aria-label="${this.text('Склад отгрузки', 'Shipment warehouse')}">${[0, 1].map(index => `<option value="${index}"${index === this.warehouse ? ' selected' : ''}>${this.warehouseName(index)}</option>`).join('')}</select></label><label>${this.text('Количество в счете', 'Invoice quantity')}<select data-quantity aria-label="${this.text('Количество в счете', 'Invoice quantity')}">${[4, 12].map(value => `<option value="${value}"${value === this.quantity ? ' selected' : ''}>${value} ${this.text('шт.', 'units')}</option>`).join('')}</select></label><button class="command" type="button" data-action="fill">${icon('sync')}${this.text('Заполнить FEFO', 'Fill using FEFO')}</button></div>`;
  }
  result() {
    const selection = this.selection;
    return `<div class="result ${selection.remaining ? 'warning' : ''}" data-reveal="4">${icon(selection.remaining ? 'clock' : 'check')}<div><strong>${selection.remaining ? this.text(`Не хватает ${selection.remaining} шт. на выбранном складе`, `${selection.remaining} units missing in this warehouse`) : this.text(`Подобрано ${this.quantity} шт. по срокам годности`, `${this.quantity} units allocated by expiry date`)}</strong><small>${this.text('Просроченные партии и чужие резервы не используются.', 'Expired batches and other reservations are excluded.')}</small></div></div>`;
  }
  passportScene() {
    const lot = LOTS[0], doc = DOCUMENTS[this.documentIndex];
    return `${this.heading('У каждой партии — свой паспорт и комплект документов', 'Every batch has a passport and supporting documents', 'Реквизиты партии вводятся при поступлении и остаются связаны с товаром.', 'Batch details are entered on receipt and remain linked to the goods.')}
      ${this.flow([['Поступление', 'Goods receipt', 'truck'], ['Учетная партия', 'Accounting batch', 'package'], ['ГТД и сертификаты', 'Customs and certificates', 'shield'], ['Паспорт партии', 'Batch passport', 'list']])}
      <div class="passport-layout"><div class="receipt-source"><div class="pane-title">${icon('truck')}<strong>${this.text('Поступление товаров', 'Goods receipt')} ${lot.receipt}</strong></div><dl><div><dt>${this.text('Поставщик', 'Supplier')}</dt><dd>${this.text('ООО «Техно-Демо»', 'Techno Demo LLC')}</dd></div><div><dt>${this.text('Номенклатура', 'Item')}</dt><dd>${this.text('Контроллер M10', 'M10 controller')}</dd></div><div><dt>${this.text('Принято', 'Received')}</dt><dd>15 ${this.text('шт.', 'units')}</dd></div></dl><div class="warehouse-split" data-reveal="1"><span>${this.warehouseName(0)}<b>12</b></span><span>${this.warehouseName(1)}<b>3</b></span></div><div class="receipt-link">${icon('right')}<strong>${lot.id}</strong></div></div>
      <div class="batch-passport" data-reveal="1"><div class="pane-title">${icon('package')}<strong>${this.text('Партия', 'Batch')} ${lot.id}</strong><span class="badge">${this.text('Контроллер M10', 'M10 controller')}</span></div><div class="document-fields">${this.field('Дата производства', 'Production date', this.date(lot.made))}${this.field('Годен до', 'Expiry date', this.date(lot.expiry))}${this.field('Срок годности', 'Shelf life', this.dayCount(days(lot.made, lot.expiry)))}${this.field('Остаточный срок', 'Remaining shelf life', this.dayCount(days(AS_OF, lot.expiry)))}${this.field('Номер ГТД', 'Customs declaration', lot.gtd)}${this.field('Документ-основание', 'Source document', lot.receipt)}</div></div></div>
      <div class="documents-layout" data-reveal="2"><div><div class="pane-title">${icon('layers')}<strong>${this.text('Документы партии', 'Batch documents')}</strong><span class="badge">03</span></div><div class="document-list" role="group" aria-label="${this.text('Выбор документа партии', 'Select batch document')}">${DOCUMENTS.map((item, index) => `<button type="button" data-document="${index}" aria-pressed="${index === this.documentIndex}">${icon('list')}<span><strong>${this.local(item.name)}</strong><small>${item.file}</small></span>${icon('right')}</button>`).join('')}</div></div><div class="document-preview" data-reveal="3"><div class="paper-header"><span>PDF</span><strong>${this.local(doc.name)}</strong></div><h4>${this.local(doc.name)}</h4><p>${this.text('Контроллер M10', 'M10 controller')} · ${lot.id}</p><div class="paper-lines" aria-hidden="true"><i></i><i></i><i></i></div><div class="document-binding">${icon('check')}${this.text('Привязан к партии и поступлению', 'Linked to the batch and receipt')}</div></div></div>`;
  }
  expiryScene() {
    const picks = this.selection.rows;
    return `${this.heading('Первой отгружается партия с ближайшим сроком годности', 'The earliest-expiring batch ships first', 'FEFO (First Expired, First Out) учитывает срок годности и доступное количество.', 'FEFO (First Expired, First Out) uses expiry dates and available quantities.')}
      ${this.flow([['Сроки партий', 'Batch expiry dates', 'clock'], ['Доступный остаток', 'Available stock', 'database'], ['Подбор FEFO', 'FEFO allocation', 'sync'], ['Партии к отгрузке', 'Batches to ship', 'truck']])}${this.toolbar()}
      <div class="expiry-list">${LOTS.filter(lot => lot.warehouse === this.warehouse).slice().sort((a, b) => a.expiry.localeCompare(b.expiry)).map(lot => {
        const left = days(AS_OF, lot.expiry), pick = picks.find(row => row.lot === lot);
        return `<div class="expiry-row ${left < 0 ? 'expired' : ''}" data-picked="${!!pick}" data-reveal="1"><div class="lot-label">${icon('package')}<strong>${lot.id}</strong><small>${left < 0 ? this.text('Срок истек', 'Expired') : `${this.dayCount(left)}${this.text(' до истечения', ' left')}`}</small></div><div class="life-track"><span>${this.date(lot.made)}</span><div><i style="width:${Math.max(0, Math.min(100, left / days(lot.made, lot.expiry) * 100))}%"></i></div><span>${this.date(lot.expiry)}</span></div><div class="lot-availability"><span>${this.text('Доступно', 'Available')}</span><strong>${available(lot)} ${this.text('шт.', 'units')}</strong></div><div class="allocation" data-reveal="3">${left < 0 ? this.text('Не подбирать', 'Exclude') : pick ? `${icon('check')}${pick.take} ${this.text('шт. в счет', 'units to invoice')}` : this.text('Следующая партия', 'Next batch')}</div></div>`;
      }).join('')}</div>${this.result()}`;
  }
  stockScene() {
    const { rows, remaining } = this.selection;
    return `${this.heading('Резерв и отгрузка меняют остатки именно выбранной партии', 'Reservations and shipments update the selected batch', 'Счет резервирует доступный товар. Реализация списывает партию и снимает ее резерв.', 'An invoice reserves available goods. A sale deducts the batch quantity and releases its reservation.')}
      ${this.flow([['Остатки по складам', 'Stock by warehouse', 'database'], ['Счет и резерв', 'Invoice and reservation', 'list'], ['Реализация', 'Sale', 'truck'], ['Новый остаток', 'Updated balance', 'package']])}${this.toolbar()}
      <div class="table-wrap" tabindex="0" aria-label="${this.text('Остатки партий по складам', 'Batch balances by warehouse')}"><table><thead><tr>${[['Партия / склад', 'Batch / warehouse'], ['На складе', 'On hand'], ['Чужой резерв', 'Other reservations'], ['Доступно', 'Available'], ['В текущий счет', 'To this invoice']].map(([ru, en]) => `<th>${this.text(ru, en)}</th>`).join('')}</tr></thead><tbody>${LOTS.map(lot => { const pick = rows.find(row => row.lot === lot); return `<tr class="${pick ? 'selected-row' : ''}"><td><strong>${lot.id}</strong><small>${this.warehouseName(lot.warehouse)}</small></td><td>${lot.stock}</td><td>${lot.reserved}</td><td>${available(lot)}${days(AS_OF, lot.expiry) < 0 ? `<small class="expired-text">${this.text('Срок истек', 'Expired')}</small>` : ''}</td><td><b data-reveal="1">${pick?.take || '—'}</b></td></tr>`; }).join('')}</tbody></table></div>
      ${remaining ? this.result() : `<div class="ledger-grid">${rows.map(({ lot, take }) => { const reserve = balance(lot, take, 'reserve'), sale = balance(lot, take, 'sale'); return `<div class="ledger"><div class="pane-title">${icon('package')}<strong>${lot.id}</strong><span class="badge">${this.warehouseName(lot.warehouse)}</span></div><div class="ledger-stage" data-reveal="2"><span>${this.text('Счет С-041 · резерв до 22.08', 'Invoice I-041 · reserved until 22 Aug')}</span><div><strong>${reserve.stock}<small>${this.text('Остаток', 'Stock')}</small></strong><strong>${reserve.reserved}<small>${this.text('Резерв', 'Reserved')}</small></strong><strong>${reserve.stock - reserve.reserved}<small>${this.text('Доступно', 'Available')}</small></strong></div></div><div class="ledger-arrow">${icon('down')}<b>−${take} ${this.text('шт. отгружено', 'units shipped')}</b></div><div class="ledger-stage after" data-reveal="3"><span>${this.text('Реализация Р-041 · ООО «Вектор-Демо»', 'Sale S-041 · Vector Demo LLC')}</span><div><strong>${sale.stock}<small>${this.text('Остаток', 'Stock')}</small></strong><strong>${sale.reserved}<small>${this.text('Резерв', 'Reserved')}</small></strong><strong>${sale.stock - sale.reserved}<small>${this.text('Доступно', 'Available')}</small></strong></div></div></div>`; }).join('')}</div><div class="result" data-reveal="4">${icon('check')}<strong>${this.text('Чужие резервы сохранены. Остатки других складов не изменились.', 'Other reservations are preserved. Other warehouses remain unchanged.')}</strong></div>`}`;
  }
  traceScene() {
    const selection = this.selection, lot = selection.rows[0]?.lot || LOTS.find(item => item.warehouse === this.warehouse);
    const take = selection.remaining ? 0 : selection.rows[0]?.take || 0, data = crmProjection(lot, take);
    return `${this.heading('От покупателя можно пройти назад до партии и поступления', 'Trace a customer shipment back to its batch and receipt', 'История изменений остается в 1С. В CRM передаются только разрешенные сведения.', 'Change history stays in 1C. Only permitted information is passed to the CRM.')}
      ${this.flow([['Поступление', 'Receipt', 'truck'], ['Партия и история', 'Batch and history', 'package'], ['Отгрузка покупателю', 'Customer shipment', 'user'], ['Разрешенные данные CRM', 'Permitted CRM data', 'shield']])}
      <div class="trace-chain"><div data-reveal="0"><small>${this.text('Поступление', 'Receipt')}</small><strong>${lot.receipt}</strong><span>${this.text('ООО «Техно-Демо»', 'Techno Demo LLC')}</span></div>${icon('right')}<div data-reveal="1"><small>${this.text('Учетная партия', 'Accounting batch')}</small><strong>${lot.id}</strong><span>${this.warehouseName(lot.warehouse)}</span></div>${icon('right')}<div data-reveal="2"><small>${take ? this.text('Реализация Р-041', 'Sale S-041') : this.text('Отгрузка не проведена', 'Shipment not posted')}</small><strong>${take} ${this.text('шт.', 'units')}</strong><span>${this.text('ООО «Вектор-Демо»', 'Vector Demo LLC')}</span></div></div>
      <div class="trace-layout"><div class="history"><div class="pane-title">${icon('clock')}<strong>${this.text('История партии', 'Batch history')} ${lot.id}</strong></div><ol class="timeline"><li data-reveal="1"><i></i><time>09:10</time><div><strong>${this.text('Поступление и создание партии', 'Receipt and batch creation')}</strong><small>${lot.receipt} · ${this.text('Оператор Демо', 'Demo operator')}</small></div></li><li data-reveal="1"><i></i><time>09:15</time><div><strong>${this.text('Добавлены сопроводительные документы', 'Supporting documents attached')}</strong><small>${DOCUMENTS.length} PDF · ${this.text('Оператор Демо', 'Demo operator')}</small></div></li><li data-reveal="2"><i></i><time>10:00</time><div><strong>${this.text('Перемещение между складами', 'Transfer between warehouses')}</strong><small>B-024 · ${this.text('Основной склад → Склад 2 · 3 шт.', 'Main warehouse → Warehouse 2 · 3 units')}</small></div></li><li data-reveal="2"><i></i><time>11:20</time><div><strong>${take ? this.text('Резерв снят, партия отгружена', 'Reservation released, batch shipped') : this.text('Недостаточно для полной отгрузки', 'Insufficient stock for full shipment')}</strong><small>${this.text('Счет С-041 → Реализация Р-041', 'Invoice I-041 → Sale S-041')} · ${take} ${this.text('шт.', 'units')}</small></div></li></ol><div class="internal-only">${icon('shield')}${this.text('Журнал и служебные данные остаются в 1С', 'Audit log and internal data stay in 1C')}</div></div>
      <div class="crm-view" data-reveal="3"><div class="crm-header"><strong>CRM</strong><span>${icon('check')}${this.text('Разрешенная информация', 'Permitted information')}</span></div><div class="crm-body"><h4>${this.text('Контроллер M10', 'M10 controller')}<b>${lot.id}</b></h4><div class="crm-fields">${this.field('Склад', 'Warehouse', this.warehouseName(data.warehouse))}${this.field('Остаток / доступно', 'Stock / available', `${data.stock} / ${data.available}`)}${this.field('Дата производства', 'Production date', this.date(data.made))}${this.field('Годен до', 'Expiry date', this.date(data.expiry))}${this.field('Остаточный срок', 'Remaining shelf life', this.dayCount(days(AS_OF, data.expiry)))}${this.field('Номер ГТД', 'Customs declaration', data.gtd)}</div><div class="crm-documents">${DOCUMENTS.filter(doc => doc.allowed).map(doc => `<span>${icon('list')}<strong>${this.local(doc.name)}</strong><small>PDF</small></span>`).join('')}</div></div></div></div>`;
  }
  renderScene() {
    const scene = this.shadowRoot.querySelector('.scene');
    scene.innerHTML = [() => this.passportScene(), () => this.expiryScene(), () => this.stockScene(), () => this.traceScene()][this.feature]();
    scene.setAttribute('aria-labelledby', 'party-' + FEATURES[this.feature][0]);
    this.shadowRoot.querySelectorAll('[data-feature]').forEach((tab, index) => { tab.setAttribute('aria-selected', String(index === this.feature)); tab.tabIndex = index === this.feature ? 0 : -1; });
    this.shadowRoot.querySelector('[data-counter]').textContent = `0${this.feature + 1} / 04`; this.updateAnimation();
  }
  restart() { this.elapsed = this.motion.matches ? DURATION - 1 : 0; this.wanted = !this.motion.matches; this.tour = false; this.updatePlayButton(); this.syncClock(); }
  select(index) {
    if (!Number.isInteger(index) || index < 0 || index >= FEATURES.length) return;
    this.tour = false; if (index === this.feature) return;
    this.feature = index; this.restart(); this.renderScene();
  }
  onChange(event) {
    const target = event.target, value = Number(target.value); let selector;
    if (target.matches('[data-quantity]') && [4, 12].includes(value)) { this.quantity = value; selector = '[data-quantity]'; }
    else if (target.matches('[data-warehouse]') && [0, 1].includes(value)) { this.warehouse = value; selector = '[data-warehouse]'; }
    else return;
    this.restart(); this.renderScene(); this.shadowRoot.querySelector(selector)?.focus();
  }
  onClick(event) {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-feature')) return this.select(Number(button.dataset.feature));
    if (button.hasAttribute('data-document')) {
      const index = Number(button.dataset.document); if (!Number.isInteger(index) || !DOCUMENTS[index]) return;
      this.documentIndex = index; this.renderScene(); this.shadowRoot.querySelector(`[data-document="${index}"]`).focus(); return;
    }
    const action = button.dataset.action;
    if (action === 'previous' || action === 'next') return this.select((this.feature + (action === 'next' ? 1 : 3)) % 4);
    if (['fill', 'replay'].includes(action)) { this.restart(); this.updateAnimation(); }
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
    const label = this.wanted ? this.text('Остановить анимацию партий', 'Pause batch animation') : this.text('Продолжить анимацию партий', 'Resume batch animation');
    button.innerHTML = icon(this.wanted ? 'pause' : 'play'); button.title = label; button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', String(!!this.wanted)); this.setAttribute('data-playing', String(!!this.wanted));
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
    const phase = Math.min(4, Math.floor(this.elapsed / 2200)); this.style.setProperty('--progress', String(this.elapsed / DURATION));
    this.shadowRoot.querySelectorAll('[data-phase]').forEach(node => { node.dataset.state = Number(node.dataset.phase) < phase ? 'done' : Number(node.dataset.phase) === phase ? 'active' : 'waiting'; });
    this.shadowRoot.querySelectorAll('[data-reveal]').forEach(node => { node.dataset.ready = String(phase >= Number(node.dataset.reveal)); });
    this.shadowRoot.querySelector('[data-playback-state]').textContent = phase >= 4 ? this.text('Готово', 'Complete') : this.text('Обработка партии', 'Processing batch');
  }
}

if (!customElements.get('party-1c-preview')) customElements.define('party-1c-preview', Party1cPreview);
