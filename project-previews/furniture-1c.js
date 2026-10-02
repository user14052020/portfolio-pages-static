import { ICONS } from './tm-icons.js';
import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';
import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=2';

const CSS = new URL('./furniture-1c.css?v=2', import.meta.url).href;
const PROJECTS = {
  furniture: {
    title: ['МЕБЕЛЬ', 'FURNITURE'], label: ['Мебель', 'Furniture'], prefix: 'М',
    siteUrl: 'https://imodern.ru/',
    image: '/media/uploads/4e/55fdc83c5782458bbe96e2461e844cf8.png', imageSize: [2876, 1644],
    imageAlt: ['Мебельный интернет-магазин клиента', 'Client furniture store'],
    contents: ['Стол и 2 кресла', 'Table and 2 armchairs'],
    products: [
      { sku: 'M-101', name: ['Стол «Линия»', 'Linea table'], price: '24 900 ₽', stock: 8, quantity: 1 },
      { sku: 'M-205', name: ['Кресло «Сфера»', 'Sphere armchair'], price: '18 500 ₽', stock: 12, quantity: 2 },
    ],
  },
  paints: {
    title: ['КРАСКИ', 'PAINTS'], label: ['Краски', 'Paints'], prefix: 'К',
    siteUrl: 'https://vertical.ru/',
    image: '/media/uploads/3f/e8f817443c804710b993d6791708a6ee.png', imageSize: [2880, 1638],
    imageAlt: ['Интернет-магазин клиента проекта «Краски»', 'Client store for the Paints project'],
    contents: ['2 банки краски и грунтовка', '2 cans of paint and primer'],
    products: [
      { sku: 'K-101', name: ['Интерьерная краска, 9 л', 'Interior paint, 9 L'], price: '3 290 ₽', stock: 24, quantity: 2 },
      { sku: 'K-205', name: ['Грунтовка, 5 л', 'Primer, 5 L'], price: '1 250 ₽', stock: 36, quantity: 1 },
    ],
  },
};
const DURATION = 10000;
const FEATURES = [
  ['bitrix', 'Сайт на Битрикс', 'Bitrix store', 'cart', '1С ↔ магазин', '1C ↔ store'],
  ['sheets', 'Google Таблицы', 'Google Sheets', 'layout', '1С ↔ таблицы', '1C ↔ spreadsheets'],
  ['closing', 'Закрытие заказа', 'Order closing', 'shield', 'Автоматизация в 1С', 'Automation in 1C'],
  ['delivery', 'Служба доставки', 'Delivery service', 'truck', '1С ↔ доставка', '1C ↔ delivery'],
  ['maps', 'Яндекс Карты', 'Yandex Maps', 'pin', 'Адреса внутри 1С', 'Addresses inside 1C'],
];
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = name => ICONS[name] || '';

class Furniture1cPreview extends HTMLElement {
  static observedAttributes = ['locale', 'description', 'project', 'site-url'];
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.feature = 0;
    this.address = 0;
    this.elapsed = 0;
    this.visible = false;
    this.running = false;
    this.tick = this.tick.bind(this);
  }
  get english() { return this.getAttribute('locale') === 'en'; }
  get project() { return this.getAttribute('project') === 'paints' ? PROJECTS.paints : PROJECTS.furniture; }
  text(ru, en) { return this.english ? en : ru; }
  siteUrl() {
    try {
      const url = new URL(this.getAttribute('site-url') || this.project.siteUrl);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : this.project.siteUrl;
    } catch { return this.project.siteUrl; }
  }
  orderNumber(index = 0) { return `${this.project.prefix}-${1024 + index}`; }
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
    this.shadowRoot.addEventListener('keydown', event => this.onKey(event), options);
    document.addEventListener('visibilitychange', () => this.syncClock(), options);
    this.shadowRoot.addEventListener('previewstylesready', () => this.syncClock(), options);
    this.motion.addEventListener('change', () => {
      if (this.motion.matches) { this.wanted = false; this.elapsed = DURATION - 1; this.updateAnimation(); this.updatePlayButton(); this.syncClock(); }
    }, options);
    this.render();
    this.observer = new IntersectionObserver(entries => { this.visible = entries[0].isIntersecting; this.syncClock(); }, { threshold: .12 });
    this.observer.observe(this);
  }
  disconnectedCallback() {
    stopPreviewLoading(this.shadowRoot);
    this.abort?.abort();
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    this.running = false;
  }
  attributeChangedCallback(name, before, after) { if (before !== after && this.isConnected && this.abort) this.render(); }
  render() {
    renderPreview(this.shadowRoot, [CSS, DIAGRAM_STYLESHEET], `<div class="preview">
      <div class="case-intro"><details>${projectSummary(this.english)}<p>${esc(this.getAttribute('description') || '')}</p></details><a href="${esc(this.siteUrl())}" target="_blank" rel="noopener noreferrer">${this.text('Открыть сайт', 'Visit website')}${icon('external')}</a></div>
      ${projectHeading('furniture', this.english)}
      <nav class="feature-map" role="tablist" aria-label="${this.text('Задачи сопровождения 1С', '1C support tasks')}">${FEATURES.map(([id, ru, en, glyph, subRu, subEn], index) => `<div class="feature-node"><button type="button" role="tab" id="furniture-${id}" aria-controls="furniture-detail" data-feature="${index}"><span class="node-icon">${icon(glyph)}</span><strong>${this.text(ru, en)}</strong><small>${this.text(subRu, subEn)}</small><span class="node-number">0${index + 1}</span></button><i class="node-wire"></i></div>`).join('')}</nav>
      <div class="bridge" aria-hidden="true">${icon('down')}</div>
      <section class="detail-window" aria-label="${this.text(this.project.label[0] + ': сопровождение и интеграции 1С', this.project.label[1] + ': 1C support and integrations')}">
        <header class="window-header"><span class="brand"><b>1C</b><strong>${this.text(...this.project.title)}</strong></span><span data-title></span><span class="sample">DEMO</span></header>
        <div class="scene" id="furniture-detail" role="tabpanel"></div>
        <footer class="window-footer"><span>${icon('check')}${this.text('Демонстрационные данные', 'Sample data')}</span><span data-playback-state></span></footer>
      </section>
      <div class="playback"><span data-counter></span><div class="progress"><i></i></div><button type="button" class="tool" data-action="previous" aria-label="${this.text('Предыдущая задача 1С', 'Previous 1C task')}" title="${this.text('Предыдущая задача', 'Previous task')}">${icon('right')}</button><button type="button" class="tool" data-action="replay" aria-label="${this.text('Повторить анимацию', 'Replay animation')}" title="${this.text('Повторить', 'Replay')}">${icon('replay')}</button><button type="button" class="tool play" data-action="play"></button><button type="button" class="tool" data-action="next" aria-label="${this.text('Следующая задача 1С', 'Next 1C task')}" title="${this.text('Следующая задача', 'Next task')}">${icon('right')}</button></div>
    </div>`, this.english);
    this.renderScene();
    this.updatePlayButton();
  }
  flow(items) {
    return `<div class="flow">${items.map(([glyph, ru, en], index) => `<div class="flow-step" data-phase="${index}"><span>${icon(glyph)}</span><strong>${this.text(ru, en)}</strong><b>${icon('check')}</b></div>${index < items.length - 1 ? `<div class="flow-wire" aria-hidden="true"><i></i>${icon('right')}</div>` : ''}`).join('')}</div>`;
  }
  heading(ru, en, subRu, subEn) { return `<div class="scene-heading"><h3>${this.text(ru, en)}</h3><p>${this.text(subRu, subEn)}</p></div>`; }
  bitrix() {
    const rows = this.project.products.map(item => `<tr><td>${item.sku}<small>${this.text(...item.name)}</small></td><td>${item.price}</td><td>${item.stock}</td></tr>`).join('');
    const catalog = this.project.products.map((item, index) => `<div class="catalog-row" data-reveal="${index + 2}"><strong>${item.sku}</strong><span>${item.price}</span><small>${this.text(item.stock + ' в наличии', item.stock + ' available')}</small>${icon('check')}</div>`).join('');
    return `${this.heading('1С и интернет-магазин', '1C and the online store', 'Обмен данными между учетной системой и сайтом на Битрикс.', 'Data exchange between the accounting system and the Bitrix website.')}${this.flow([['database', 'Данные 1С', '1C data'], ['sync', 'Обмен', 'Exchange'], ['cart', 'Битрикс', 'Bitrix'], ['check', 'Данные актуальны', 'Data up to date']])}<div class="split"><div class="system"><div class="system-title"><b class="one-c">1C</b><strong>${this.text('Номенклатура', 'Products')}</strong><small>${this.text('Источник данных', 'Source')}</small></div><table><thead><tr><th>${this.text('Артикул / товар', 'SKU / product')}</th><th>${this.text('Цена', 'Price')}</th><th>${this.text('Остаток', 'Stock')}</th></tr></thead><tbody>${rows}</tbody></table><div class="sync-result" data-reveal="3">${icon('check')}${this.text('Обмен завершен', 'Exchange complete')}</div></div><div class="system shop"><div class="system-title"><strong>${this.text('Битрикс', 'Bitrix')}</strong><small>${this.text('Интернет-магазин', 'Online store')}</small></div><img class="shop-image" src="${this.project.image}" alt="${esc(this.text(...this.project.imageAlt))}" width="${this.project.imageSize[0]}" height="${this.project.imageSize[1]}">${catalog}</div></div>`;
  }
  sheets() {
    const orders = [['Отгружен', 'Shipped'], ['Готов', 'Ready'], ['В работе', 'In progress']];
    const rows = orders.map(([ru, en], index) => `<tr><td>${this.orderNumber(index)}</td><td>${this.text(ru, en)}</td></tr>`).join('');
    const sheetRows = orders.map(([ru, en], index) => `<tr data-reveal="${index < 2 ? 2 : 3}"><td>${index + 1}</td><td>${this.orderNumber(index)}</td><td>${this.text(ru, en)} ${icon('check')}</td></tr>`).join('');
    return `${this.heading('1С и Google Таблицы', '1C and Google Sheets', 'Обмен с рабочими таблицами клиента.', 'Data exchange with the client’s working spreadsheets.')}${this.flow([['database', 'Заказы 1С', '1C orders'], ['sync', 'Обмен', 'Exchange'], ['layout', 'Google Таблицы', 'Google Sheets'], ['check', 'Данные обновлены', 'Data updated']])}<div class="split"><div class="system"><div class="system-title"><b class="one-c">1C</b><strong>${this.text('Заказы покупателей', 'Customer orders')}</strong></div><table><thead><tr><th>${this.text('Заказ', 'Order')}</th><th>${this.text('Статус', 'Status')}</th></tr></thead><tbody>${rows}</tbody></table></div><div class="system sheet"><div class="system-title"><span class="sheet-logo">${icon('layout')}</span><strong>${this.text('Google Таблицы', 'Google Sheets')}</strong><small>${this.text('Заказы', 'Orders')}</small></div><div class="sheet-formula"><span>fx</span><span>${this.text('Статус заказа', 'Order status')}</span></div><table><thead><tr><th></th><th>A / ${this.text('Заказ', 'Order')}</th><th>B / ${this.text('Статус', 'Status')}</th></tr></thead><tbody>${sheetRows}</tbody></table><div class="sheet-tab">${this.text('Заказы', 'Orders')}<span data-reveal="3">${icon('check')}${this.text('Синхронизировано', 'Synchronized')}</span></div></div></div>`;
  }
  closing() {
    const rows = this.project.products.map(item => `<tr><td>${this.text(...item.name)}</td><td>${item.quantity}</td></tr>`).join('');
    return `${this.heading('Автоматическое закрытие заказа', 'Automatic order closing', 'Логика закрытия заказа выполняется внутри 1С.', 'Order-closing logic runs inside 1C.')}${this.flow([['cart', 'Заказ', 'Order'], ['code', 'Логика 1С', '1C logic'], ['shield', 'Проверка условий', 'Condition checks'], ['check', 'Закрытие', 'Closing']])}<div class="order-document"><div class="document-heading"><span class="one-c">1C</span><div><h4>${this.text('Заказ покупателя ', 'Customer order ') + this.orderNumber()}</h4><small>${this.text(this.project.label[0] + ' · 2 позиции', this.project.label[1] + ' · 2 items')}</small></div><span class="status-badge" data-final-text data-before="${this.text('В работе', 'In progress')}" data-after="${this.text('Закрыт', 'Closed')}"></span></div><table><thead><tr><th>${this.text('Номенклатура', 'Product')}</th><th>${this.text('Количество', 'Quantity')}</th></tr></thead><tbody>${rows}</tbody></table><div class="closing-checks">${[['Логика заказа выполнена', 'Order logic processed'], ['Условия закрытия проверены', 'Closing conditions checked'], ['Статус обновлен в 1С', '1C status updated']].map(([ru, en], index) => `<div data-reveal="${index + 1}">${icon('check')}<span>${this.text(ru, en)}</span></div>`).join('')}</div></div>`;
  }
  delivery() {
    const order = this.text('Заказ ', 'Order ') + this.orderNumber();
    return `${this.heading('Доставка связана с заказом в 1С', 'Delivery linked to the 1C order', 'Обмен данными заказа и доставки без переключения между системами.', 'Order and delivery data exchange without switching between systems.')}${this.flow([['cart', 'Заказ 1С', '1C order'], ['truck', 'Служба доставки', 'Delivery service'], ['package', 'Отправление', 'Shipment'], ['sync', 'Статус в 1С', '1C status']])}<div class="split"><div class="system"><div class="system-title"><b class="one-c">1C</b><strong>${order}</strong></div><dl><dt>${this.text('Получатель', 'Recipient')}</dt><dd>${this.text('Алексей Морозов', 'Alex Morgan')}</dd><dt>${this.text('Адрес доставки', 'Delivery address')}</dt><dd>${this.text('Новоград, ул. Примерная, 12', 'Novograd, 12 Sample Street')}</dd><dt>${this.text('Состав заказа', 'Order contents')}</dt><dd>${this.text(...this.project.contents)}</dd></dl></div><div class="system shipment"><div class="system-title">${icon('truck')}<strong>${this.text('Служба доставки', 'Delivery service')}</strong></div><div class="shipment-ticket" data-reveal="2"><small>${this.text('Отправление', 'Shipment')}</small><strong>DEMO-08412</strong><span>${order}</span><div class="barcode" aria-hidden="true"></div></div><div class="delivery-status" data-reveal="3">${icon('check')}<div><strong>${this.text('Передан в доставку', 'Handed to delivery')}</strong><small>${this.text('Статус получен в 1С', 'Status received in 1C')}</small></div></div></div></div>`;
  }
  maps() {
    const addresses = this.english ? ['12 Sample Street', '8 Demo Avenue'] : ['ул. Примерная, 12', 'пр-т Учебный, 8'];
    return `${this.heading('Яндекс Карты внутри 1С', 'Yandex Maps inside 1C', 'Работа с адресом заказа прямо в учетной системе.', 'Order addresses directly in the accounting system.')}${this.flow([['cart', 'Заказ 1С', '1C order'], ['search', 'Адрес', 'Address'], ['pin', 'Яндекс Карты', 'Yandex Maps'], ['check', 'Точка на карте', 'Map location']])}<div class="map-workspace"><div class="address-panel"><div class="system-title"><b class="one-c">1C</b><strong>${this.text('Адреса заказов', 'Order addresses')}</strong></div>${addresses.map((address, index) => `<button type="button" class="address" data-address="${index}" aria-pressed="${this.address === index}">${icon('pin')}<span><strong>${this.orderNumber(index)}</strong><small>${this.text('Новоград', 'Novograd')}, ${address}</small></span></button>`).join('')}</div><div class="map" data-location="${this.address}" aria-label="${this.text('Схематичная карта с вымышленными адресами', 'Schematic map with fictional addresses')}"><div class="map-brand"><b>Я</b> ${this.text('Карты', 'Maps')}</div><div class="map-block block-a"></div><div class="map-block block-b"></div><div class="map-block block-c"></div><div class="map-block block-d"></div><div class="park"></div><span class="street street-a">${this.text('Примерная улица', 'Sample Street')}</span><span class="street street-b">${this.text('Учебный проспект', 'Demo Avenue')}</span><div class="map-pin" data-reveal="2">${icon('pin')}<div class="map-label"><strong>${this.orderNumber(this.address)}</strong><small>${addresses[this.address]}</small></div></div><div class="map-caption">${this.text('Схематичная карта · демоданные', 'Schematic map · sample data')}</div></div></div>`;
  }
  renderScene() {
    const scene = this.shadowRoot.querySelector('.scene');
    scene.innerHTML = [() => this.bitrix(), () => this.sheets(), () => this.closing(), () => this.delivery(), () => this.maps()][this.feature]();
    scene.scrollTop = 0;
    scene.setAttribute('aria-labelledby', 'furniture-' + FEATURES[this.feature][0]);
    this.shadowRoot.querySelectorAll('[data-feature]').forEach((tab, index) => { tab.setAttribute('aria-selected', String(index === this.feature)); tab.tabIndex = index === this.feature ? 0 : -1; });
    this.shadowRoot.querySelector('[data-title]').textContent = this.text(FEATURES[this.feature][1], FEATURES[this.feature][2]);
    this.shadowRoot.querySelector('[data-counter]').textContent = `0${this.feature + 1} / 05`;
    this.updateAnimation();
  }
  select(index) {
    if (!Number.isInteger(index) || index < 0 || index >= FEATURES.length || index === this.feature) return;
    this.feature = index;
    this.elapsed = this.motion.matches ? DURATION - 1 : 0;
    this.wanted = !this.motion.matches;
    this.renderScene(); this.updatePlayButton(); this.syncClock();
  }
  onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-feature')) return this.select(Number(button.dataset.feature));
    if (button.hasAttribute('data-address')) { this.address = Number(button.dataset.address); this.elapsed = DURATION - 1; this.wanted = false; this.renderScene(); this.updatePlayButton(); return this.syncClock(); }
    const action = button.dataset.action;
    if (action === 'previous' || action === 'next') return this.select((this.feature + (action === 'next' ? 1 : FEATURES.length - 1)) % FEATURES.length);
    if (action === 'replay') { this.elapsed = this.motion.matches ? DURATION - 1 : 0; this.wanted = !this.motion.matches; this.updateAnimation(); }
    if (action === 'play') this.wanted = !this.wanted;
    this.updatePlayButton(); this.syncClock();
  }
  onKey(event) {
    const tab = event.target.closest('button[data-feature]');
    if (!tab) return;
    let index = Number(tab.dataset.feature);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') index = (index + 1) % FEATURES.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') index = (index + FEATURES.length - 1) % FEATURES.length;
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = FEATURES.length - 1;
    else return;
    event.preventDefault(); this.select(index); this.shadowRoot.querySelector(`[data-feature="${index}"]`).focus();
  }
  updatePlayButton() {
    const button = this.shadowRoot.querySelector('.play');
    const title = this.wanted ? this.text('Остановить анимацию 1С', 'Pause 1C animation') : this.text('Продолжить анимацию 1С', 'Resume 1C animation');
    button.innerHTML = icon(this.wanted ? 'pause' : 'play'); button.title = title; button.setAttribute('aria-label', title); button.setAttribute('aria-pressed', String(!!this.wanted));
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
    if (this.elapsed >= DURATION) this.elapsed = 0;
    this.updateAnimation(); this.frame = requestAnimationFrame(this.tick);
  }
  updateAnimation() {
    const phase = Math.min(4, Math.floor(this.elapsed / 2000));
    this.style.setProperty('--progress', String(this.elapsed / DURATION));
    this.shadowRoot.querySelectorAll('[data-phase]').forEach(node => { node.dataset.state = Number(node.dataset.phase) < phase ? 'done' : Number(node.dataset.phase) === phase ? 'active' : 'waiting'; });
    this.shadowRoot.querySelectorAll('[data-reveal]').forEach(node => { node.dataset.ready = String(phase >= Number(node.dataset.reveal)); });
    this.shadowRoot.querySelectorAll('[data-final-text]').forEach(node => { node.textContent = phase >= 3 ? node.dataset.after : node.dataset.before; node.dataset.ready = String(phase >= 3); });
    this.shadowRoot.querySelector('[data-playback-state]').textContent = this.text(phase >= 4 ? 'Завершено' : 'Обработка', phase >= 4 ? 'Completed' : 'Processing');
  }
}

if (!customElements.get('furniture-1c-preview')) customElements.define('furniture-1c-preview', Furniture1cPreview);
