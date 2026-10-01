import { ICONS } from './eicom-icons.js';

const STYLESHEET = new URL('./eicom-shop.css', import.meta.url).href;
const ASSETS = new URL('./eicom-assets/', import.meta.url).href;
const STEP_MS = 7200;
const PAGES = [
  ['home', 'Витрина', 'Storefront', 'home'],
  ['catalog', 'Каталог', 'Catalog', 'grid'],
  ['product', 'Товар', 'Product', 'chip'],
  ['account', 'Личный кабинет', 'Account', 'user'],
  ['bom', 'BOM', 'BOM', 'file'],
  ['compare', 'Сравнение', 'Compare', 'compare'],
  ['chat', 'ИИ-консультант', 'AI assistant', 'chat'],
];
const ACCOUNT = [
  ['account', 'Главная', 'Overview', 'home'],
  ['promos', 'Промокоды', 'Promo codes', 'ticket'],
  ['points', 'Баллы', 'Points', 'coins'],
  ['pickup', 'Мои пункты выдачи', 'Pickup locations', 'pin'],
  ['addresses', 'Адреса доставки', 'Delivery addresses', 'truck'],
  ['companies', 'Мои компании', 'My companies', 'building'],
  ['basket', 'Моя корзина', 'My basket', 'cart'],
  ['orders', 'Мои заказы', 'My orders', 'package'],
  ['bom', 'BOM спецификации', 'BOM specifications', 'file'],
  ['favorites', 'Избранное', 'Favorites', 'heart'],
  ['compare', 'Сравнение товаров', 'Product comparison', 'compare'],
  ['profile', 'Мой профиль', 'My profile', 'user'],
];
const PRODUCTS = [
  { id: 'D2F-F', image: 'd2f-f.webp', maker: 'OMRON OCB', price: 401, bulk: 333, stock: 285, voltage: '125 V', current: '1 A', mount: ['В отверстия (THT)', 'Through hole (THT)'], circuit: 'SPDT', summary: ['Концевой переключатель · 125 В AC · 1 А · THT', 'Limit switch · 125 V AC · 1 A · THT'] },
  { id: 'SS-5GL', image: 'ss-5gl.webp', maker: 'Omron Electronic Components', price: 189, bulk: 189, stock: 261, voltage: '125 V', current: '5 A', mount: ['На шасси', 'Chassis mount'], circuit: 'SPDT', summary: ['Концевой переключатель · рычаг · монтаж на шасси', 'Limit switch · lever · chassis mount'] },
  { id: 'D2HW-BR211DR', image: 'd2hw.webp', maker: 'OMRON OCB', price: 582, bulk: 539, stock: 108, voltage: '125 V', current: '100 mA', mount: ['В отверстия, угловой', 'Through hole, right angle'], circuit: 'SPDT', summary: ['Концевой переключатель · IP67 · угловой THT', 'Limit switch · IP67 · right-angle THT'] },
];
const SAMPLE_BOM = [{ mpn: 'D2F-F', qty: 10 }, { mpn: 'SS-5GL', qty: 20 }, { mpn: 'D2HW-BR211DR', qty: 5 }];
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = name => ICONS[name] || '';

class EicomShopPreview extends HTMLElement {
  static observedAttributes = ['locale', 'description', 'site-url'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.index = 0;
    this.view = 'home';
    this.productIndex = 0;
    this.quantity = 1;
    this.cart = new Map();
    this.favorites = new Set([0, 2]);
    this.compared = new Set([0, 1, 2]);
    this.bomImported = false;
    this.query = '';
    this.sort = 'popular';
    this.mountFilter = 'all';
    this.compareMode = 'all';
    this.chatTopic = 'search';
    this.addedAddresses = false;
    this.elapsed = 0;
    this.visible = false;
    this.running = false;
    this.tick = this.tick.bind(this);
  }

  get english() { return this.getAttribute('locale') === 'en'; }
  text(ru, en) { return this.english ? en : ru; }
  local(pair) { return pair[this.english ? 1 : 0]; }
  money(value) { return new Intl.NumberFormat(this.english ? 'en-US' : 'ru-RU').format(value) + ' ₽'; }
  get product() { return PRODUCTS[this.productIndex]; }
  get cartCount() { return [...this.cart.values()].reduce((sum, qty) => sum + qty, 0); }
  get cartTotal() { return [...this.cart].reduce((sum, [index, qty]) => sum + qty * (qty >= 10 ? PRODUCTS[index].bulk : PRODUCTS[index].price), 0); }
  siteUrl() {
    try { const url = new URL(this.getAttribute('site-url') || 'https://eicom.ru/'); return ['https:', 'http:'].includes(url.protocol) ? url.href : 'https://eicom.ru/'; }
    catch { return 'https://eicom.ru/'; }
  }

  connectedCallback() {
    this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.requestedPlay = !this.motion.matches;
    this.shadowRoot.addEventListener('click', event => this.onClick(event), options);
    this.shadowRoot.addEventListener('keydown', event => this.onKey(event), options);
    this.shadowRoot.addEventListener('submit', event => {
      event.preventDefault();
      this.query = event.target.querySelector('input').value.trim().slice(0, 100);
      this.select(1, true);
    }, options);
    this.shadowRoot.addEventListener('change', event => {
      if (event.target.matches('[data-account-select]')) this.openView(event.target.value);
      if (event.target.matches('[data-sort]')) { this.sort = event.target.value; this.setPlaying(false); this.renderScene(); }
      if (event.target.matches('[data-mount]')) { this.mountFilter = event.target.value; this.setPlaying(false); this.renderScene(); }
      if (event.target.matches('[data-compare-mode]')) { this.compareMode = event.target.value; this.setPlaying(false); this.renderScene(); }
    }, options);
    this.shadowRoot.addEventListener('input', event => {
      if (event.target.matches('[data-quantity]')) {
        this.quantity = this.clampQuantity(event.target.value);
        this.setPlaying(false);
        this.updatePrice();
      }
    }, options);
    this.motion.addEventListener('change', () => { if (this.motion.matches) this.setPlaying(false); }, options);
    document.addEventListener('visibilitychange', () => this.syncClock(), options);
    this.render();
    this.observer = new IntersectionObserver(entries => { this.visible = entries[0].isIntersecting; this.syncClock(); }, { threshold: .12 });
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.abort?.abort();
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    this.running = false;
  }

  attributeChangedCallback(name, oldValue, value) { if (oldValue !== value && this.isConnected && this.abort) this.render(); }

  render() {
    this.shadowRoot.innerHTML = `<link rel="stylesheet" href="${STYLESHEET}"><div class="preview">
      <section class="app-window" aria-label="${this.text('Эиком: интерактивный макет магазина', 'Eicom: interactive store preview')}">
        <header class="brand-bar"><button class="brand" data-page="0" aria-label="${this.text('Главная Эиком', 'Eicom home')}"><img src="${ASSETS}logo.svg" alt=""><strong>Эиком</strong></button><span class="brand-caption">${this.text('Электронные компоненты', 'Electronic components')}</span><span class="demo-badge">DEMO</span><button class="header-icon" data-view="basket" title="${this.text('Корзина', 'Basket')}" aria-label="${this.text('Корзина', 'Basket')}">${icon('cart')}<b data-cart-count>${this.cartCount}</b></button><button class="account-link" data-page="3">${icon('user')}<span>${this.text('Личный кабинет', 'My account')}</span></button></header>
        <nav class="tour-nav" role="tablist" aria-label="${this.text('Страницы Эиком', 'Eicom pages')}">${PAGES.map(([id, ru, en, glyph], index) => `<button role="tab" id="eicom-${id}" data-page="${index}" aria-controls="eicom-panel">${icon(glyph)}<span>${this.text(ru, en)}</span></button>`).join('')}</nav>
        <div class="workspace"><div class="scene" id="eicom-panel" role="tabpanel"></div></div>
        <footer class="app-footer"><span>${icon('check')}${this.text('Демонстрационные данные', 'Sample data')}</span><span data-view-title></span></footer>
      </section>
      <div class="playback"><span data-counter></span><div class="progress"><i></i></div><button class="tool" data-action="previous" aria-label="${this.text('Предыдущая страница Эиком', 'Previous Eicom page')}" title="${this.text('Предыдущая страница', 'Previous page')}">${icon('left')}</button><button class="tool play-toggle" data-action="play"></button><button class="tool" data-action="next" aria-label="${this.text('Следующая страница Эиком', 'Next Eicom page')}" title="${this.text('Следующая страница', 'Next page')}">${icon('right')}</button></div>
      <div class="case-footer"><p>${esc(this.getAttribute('description') || '')}</p><a href="${esc(this.siteUrl())}" target="_blank" rel="noopener noreferrer">${this.text('Открыть сайт', 'Visit website')}${icon('external')}</a></div>
    </div>`;
    this.renderScene(false);
    this.updatePlayButton();
  }

  button(label, action, glyph = '', className = 'primary') { return `<button type="button" class="${className}" data-action="${action}">${glyph ? icon(glyph) : ''}${label}</button>`; }
  image(product, className = '') { return `<img class="${className}" src="${ASSETS}${product.image}" alt="${esc(product.id)}" width="256" height="256">`; }
  heading(title, actions = '') {
    if (this.view === 'catalog') actions = `<select data-mount aria-label="${this.text('Фильтр по монтажу', 'Mounting filter')}">${[['all','Любой монтаж','Any mounting'],['tht','THT','THT'],['chassis','На шасси','Chassis']].map(([value,ru,en])=>`<option value="${value}"${this.mountFilter===value?' selected':''}>${this.text(ru,en)}</option>`).join('')}</select>`;
    return `<div class="page-heading"><h3>${title}</h3>${actions}</div>`;
  }
  searchBar() { return `<form class="search-bar"><label>${icon('search')}<input name="search" value="${esc(this.query)}" aria-label="${this.text('Поиск компонентов', 'Search components')}" placeholder="${this.text('Поиск по артикулу или названию', 'Search by part number or name')}"></label><button class="search-bom" type="button" data-page="4" title="${this.text('Загрузить BOM', 'Upload BOM')}" aria-label="${this.text('Загрузить BOM', 'Upload BOM')}">${icon('file')}</button><button type="submit" class="search-submit" aria-label="${this.text('Найти компоненты', 'Find components')}" title="${this.text('Найти', 'Search')}">${icon('right')}</button></form>`; }

  home() {
    return `<div class="shop-page">${this.searchBar()}<div class="category-strip">${[['Переключатели', 'Switches'], ['Микросхемы', 'ICs'], ['Реле', 'Relays'], ['Разъемы', 'Connectors'], ['Конденсаторы', 'Capacitors']].map(pair => `<button data-page="1">${this.local(pair)}</button>`).join('')}</div>
      <button class="promotion" data-page="1" aria-label="${this.text('Открыть каталог электронных компонентов', 'Open electronic components catalog')}"><img src="${ASSETS}catalog-banner.webp" width="1170" height="200" alt="${this.text('Каталог электронных компонентов Эиком', 'Eicom electronic components catalog')}"></button>
      ${this.heading(this.text('Электронные компоненты, приборы и радиодетали', 'Electronic components and parts'), `<button class="text-button" data-page="1">${this.text('Все товары', 'All products')}${icon('right')}</button>`)}
      <div class="product-grid">${PRODUCTS.map((product, index) => `<article class="product-tile" data-beat-row="${index}"><button class="product-image" data-product="${index}">${this.image(product)}</button><small>${product.maker}</small><button class="product-name" data-product="${index}">${product.id}</button><p>${this.local(product.summary)}</p><div class="tile-price"><strong>${this.money(product.price)}</strong><button class="tool" data-add="${index}" title="${this.text('В корзину', 'Add to basket')}" aria-label="${this.text('В корзину', 'Add to basket')} ${product.id}">${icon('cart')}</button></div></article>`).join('')}</div></div>`;
  }

  catalog() {
    const filtered = PRODUCTS.map((product, index) => ({ product, index })).filter(({ product, index }) => `${product.id} ${product.maker} ${this.local(product.summary)}`.toLowerCase().includes(this.query.toLowerCase()) && (this.mountFilter === 'all' || (this.mountFilter === 'chassis' ? index === 1 : index !== 1)));
    if (this.sort !== 'popular') filtered.sort((a, b) => (a.product.price - b.product.price) * (this.sort === 'price-desc' ? -1 : 1));
    return `<div class="shop-page">${this.searchBar()}<div class="breadcrumbs">${this.text('Каталог / Переключатели', 'Catalog / Switches')}</div>${this.heading(this.text('Концевые переключатели', 'Limit switches'))}<div class="catalog-layout"><aside class="filters"><strong>${this.text('Производитель', 'Manufacturer')}</strong><span>Omron</span><strong>${this.text('Монтаж', 'Mounting')}</strong><span>THT</span><span>${this.text('На шасси', 'Chassis')}</span><strong>${this.text('Напряжение AC', 'AC voltage')}</strong><span>125 V</span><strong>${this.text('Схема', 'Circuit')}</strong><span>SPDT</span></aside><div class="catalog-results"><div class="result-toolbar"><span>${this.text('Найдено', 'Found')}: ${filtered.length}</span><select data-sort aria-label="${this.text('Сортировка товаров', 'Product sorting')}">${[['popular','Популярные','Popular'],['price','Дешевле','Price: low to high'],['price-desc','Дороже','Price: high to low']].map(([value,ru,en])=>`<option value="${value}"${this.sort===value?' selected':''}>${this.text(ru,en)}</option>`).join('')}</select></div>${filtered.map(({ product, index }) => `<article class="catalog-row" data-beat-row="${index}"><button class="product-image" data-product="${index}">${this.image(product)}</button><div><small>${product.maker}</small><button class="product-name" data-product="${index}">${product.id}</button><p>${this.local(product.summary)}</p><span class="in-stock">${icon('check')}${product.stock} ${this.text('шт. в наличии', 'in stock')}</span></div><div class="row-purchase"><strong>${this.money(product.price)}</strong><button class="primary" data-add="${index}">${icon('cart')}${this.text('В корзину', 'Add to basket')}</button><div class="row-tools">${this.choiceButton('favorite', index, 'heart', this.favorites.has(index))}${this.choiceButton('compare', index, 'compare', this.compared.has(index))}</div></div></article>`).join('') || `<div class="empty">${this.text('Ничего не найдено', 'No matching components')}${this.button(this.text('Сбросить поиск', 'Clear search'), 'clear-search', 'search', 'secondary')}</div>`}</div></div></div>`;
  }

  choiceButton(action, index, glyph, selected) { const label = action === 'favorite' ? this.text('Избранное', 'Favorite') : this.text('Сравнить', 'Compare'); return `<button class="tool${selected ? ' selected' : ''}" data-${action}="${index}" aria-pressed="${selected}" aria-label="${label} ${PRODUCTS[index].id}" title="${label}">${icon(glyph)}</button>`; }
  quantityControl() { return `<div class="quantity"><button data-action="minus" aria-label="${this.text('Уменьшить количество', 'Decrease quantity')}" title="${this.text('Уменьшить', 'Decrease')}">${icon('minus')}</button><input data-quantity type="number" min="1" max="999" value="${this.quantity}" aria-label="${this.text('Количество компонентов', 'Component quantity')}"><button data-action="plus" aria-label="${this.text('Увеличить количество', 'Increase quantity')}" title="${this.text('Увеличить', 'Increase')}">${icon('plus')}</button></div>`; }

  productPage() {
    const product = this.product;
    return `<div class="shop-page"><div class="breadcrumbs">${this.text('Каталог / Переключатели', 'Catalog / Switches')} / ${product.id}</div>${this.heading(product.id, `<div class="row-tools">${this.choiceButton('favorite', this.productIndex, 'heart', this.favorites.has(this.productIndex))}${this.choiceButton('compare', this.productIndex, 'compare', this.compared.has(this.productIndex))}</div>`)}<div class="product-detail"><div class="detail-photo">${this.image(product)}<small>${product.maker}</small></div><div class="detail-description"><span class="muted">${this.text('Описание', 'Description')}</span><p>${this.local(product.summary)}</p><dl><dt>${this.text('Схема', 'Circuit')}</dt><dd>${product.circuit}</dd><dt>${this.text('Напряжение', 'Voltage')}</dt><dd>${product.voltage}</dd><dt>${this.text('Ток', 'Current')}</dt><dd>${product.current}</dd><dt>${this.text('Монтаж', 'Mounting')}</dt><dd>${this.local(product.mount)}</dd></dl><button class="text-button" data-page="5">${this.text('Сравнить характеристики', 'Compare specifications')}${icon('compare')}</button></div><div class="purchase-panel"><span class="in-stock">${icon('check')}${product.stock} ${this.text('шт. в наличии', 'in stock')}</span>${this.quantityControl()}<small data-unit-price></small><strong class="total-price" data-total-price></strong><button class="primary" data-add="${this.productIndex}">${icon('cart')}${this.text('Добавить в корзину', 'Add to basket')}</button><div class="tier-prices"><span>1 ${this.text('шт.', 'pc')}</span><b>${this.money(product.price)}</b><span>10 ${this.text('шт.', 'pcs')}</span><b>${this.money(product.bulk)}</b></div><span class="loyalty">${icon('coins')}${this.text('Кешбэк', 'Cashback')} <b data-cashback></b></span></div></div></div>`;
  }

  accountShell(content) {
    return `<div class="account-shell"><aside class="account-sidebar"><small>${this.text('Личная информация', 'Personal information')}</small>${ACCOUNT.map(([id, ru, en, glyph], index) => `${index === 6 ? `<small>${this.text('Заказы', 'Orders')}</small>` : index === 11 ? `<small>${this.text('Настройки аккаунта', 'Account settings')}</small>` : ''}<button class="account-item${this.view === id ? ' active' : ''}" data-view="${id}" aria-current="${this.view === id ? 'page' : 'false'}">${icon(glyph)}<span>${this.text(ru, en)}</span>${id === 'points' ? '<b class="green-badge">213</b>' : id === 'basket' ? `<b class="red-badge">${this.cartCount}</b>` : ''}</button>`).join('')}<div class="manager">${icon('user')}<span>${this.text('Ваш менеджер', 'Your manager')}<strong>${this.text('Иван Демонов', 'Ivan Demo')}</strong></span></div></aside><div class="account-main"><label class="mobile-account">${icon('user')}<select data-account-select aria-label="${this.text('Раздел личного кабинета', 'Account section')}">${ACCOUNT.map(([id,ru,en])=>`<option value="${id}"${this.view===id?' selected':''}>${this.text(ru,en)}</option>`).join('')}</select></label>${content}</div></div>`;
  }

  accountOverview() {
    const tile = (title, glyph, content, view, label) => `<article class="account-tile"><h4>${icon(glyph)}${title}</h4><div>${content}</div><button class="text-button" data-view="${view}">${label || this.text('Подробнее', 'Details')}</button></article>`;
    return this.heading(this.text('Личный кабинет', 'My account')) + `<div class="account-grid">${[
      tile(this.text('Мои заказы', 'My orders'), 'package', `<div class="order-tabs"><span>${this.text('Все', 'All')} 108</span><span>${this.text('Текущие', 'Current')} 99</span></div><div class="mini-products">${PRODUCTS.map(p=>this.image(p)).join('')}</div><small>${this.text('Создан · В обработке · Доставлен', 'Created · Processing · Delivered')}</small>`, 'orders'),
      tile(this.text('213 баллов', '213 points'), 'coins', `<p>${this.text('Оплачивайте баллами часть покупки', 'Use points toward your purchase')}</p><div class="point-history"><b>−35</b><small>${this.text('За заказ №1024', 'Order #1024')}</small><b>−446</b><small>${this.text('За заказ №1023', 'Order #1023')}</small></div>`, 'points'),
      tile(this.text('Промокоды', 'Promo codes'), 'ticket', `<div class="point-history"><b>DEMO10</b><small>${this.text('Скидка 10%', '10% discount')}</small><b>BOM2026</b><small>${this.text('Скидка на комплектующие', 'Component discount')}</small></div>`, 'promos'),
      tile(this.text('Пункт самовывоза', 'Pickup location'), 'pin', `<p class="muted">${this.text('Новоград, ул. Примерная, 12', 'Novograd, 12 Example Street')}</p>`, 'pickup', this.text('Изменить', 'Edit')),
      tile(this.text('Адреса для доставки', 'Delivery addresses'), 'truck', `<p class="muted">${this.text('Укажите адрес для доставки', 'Choose a delivery address')}</p>`, 'addresses', this.text('Добавить', 'Add')),
      tile(this.text('Покупатель', 'Customer'), 'user', `<p>${this.text('Алексей Примеров', 'Alexey Example')}<br><small>demo@example.com</small><br><small>+7 (000) 000-00-00</small></p>`, 'profile', this.text('Личные данные', 'Profile')),
      tile(`${this.text('Корзина', 'Basket')} (${this.cartCount})`, 'cart', `<div class="mini-products">${this.image(PRODUCTS[0])}</div>`, 'basket', this.text('В корзину', 'Open basket')),
      tile(`${this.text('Сравнение', 'Compare')} (${this.compared.size})`, 'compare', `<div class="mini-products">${[...this.compared].map(i=>this.image(PRODUCTS[i])).join('')}</div>`, 'compare', this.text('В сравнение', 'Compare')),
      tile(`${this.text('Избранное', 'Favorites')} (${this.favorites.size})`, 'heart', `<div class="mini-products">${[...this.favorites].map(i=>this.image(PRODUCTS[i])).join('')}</div>`, 'favorites', this.text('В избранное', 'Favorites')),
    ].join('')}</div>`;
  }

  bom() {
    return this.heading(this.text('BOM спецификации', 'BOM specifications')) + `<div class="account-content"><p>${this.text('Загрузите список, чтобы не искать каждый товар отдельно.', 'Upload a list instead of searching for each component.')}<br>${this.text('Найденные позиции можно добавить в корзину одним действием.', 'Add matched components to your basket in one step.')}</p><div class="bom-actions">${this.button(this.text('Загрузить пример', 'Import sample'), 'import-bom', 'upload', 'blue-button')}${this.button(this.text('Скачать шаблон', 'Download template'), 'template', 'download', 'secondary')}</div><div class="bom-file">${icon('file')}<div><strong>components.csv</strong><small>3 ${this.text('артикула', 'part numbers')} · CSV</small></div><span class="file-status">${this.bomImported ? icon('check') + this.text('Обработан', 'Matched') : this.text('Готов к загрузке', 'Ready to import')}</span></div><div class="import-flow"><span class="done">${icon('file')}${this.text('Спецификация', 'Specification')}</span>${icon('right')}<span class="${this.bomImported ? 'done' : ''}">${icon('search')}${this.text('Сопоставление', 'Matching')}</span>${icon('right')}<span class="${this.bomImported ? 'done' : ''}">${icon('cart')}${this.text('Корзина', 'Basket')}</span></div>${this.bomImported ? `<div class="table-scroll"><table class="bom-table"><thead><tr>${[this.text('Артикул', 'Part number'),this.text('Количество', 'Quantity'),this.text('Наличие', 'Availability'),this.text('Цена / шт.', 'Unit price'),this.text('Сумма', 'Total')].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${SAMPLE_BOM.map((row,index)=>{const p=PRODUCTS[index]; const price=row.qty>=10?p.bulk:p.price;return `<tr data-beat-row="${index}"><td>${row.mpn}</td><td>${row.qty}</td><td><span class="in-stock">${icon('check')}${this.text('Найден', 'Matched')}</span></td><td>${this.money(price)}</td><td>${this.money(price*row.qty)}</td></tr>`;}).join('')}</tbody></table></div><div class="bom-total"><span>3 / 3 ${this.text('позиции найдены', 'parts matched')}</span>${this.button(this.text('Добавить всё в корзину', 'Add all to basket'), 'bom-cart', 'cart')}</div>` : `<div class="bom-empty">${icon('upload')}<span>${this.text('Артикулы и количество', 'Part numbers and quantities')}</span><small>D2F-F · SS-5GL · D2HW-BR211DR</small></div>`}</div>`;
  }

  compare() {
    const columns = [...this.compared];
    const specs = [['Схема','Circuit','circuit'], ['Напряжение AC','AC voltage','voltage'], ['Ток контактов','Contact current','current'], ['Вид монтажа','Mounting','mount']];
    const rows = specs.filter(([, , key]) => { const same = new Set(columns.map(i=>JSON.stringify(PRODUCTS[i][key]))).size<=1; return this.compareMode==='all'||(this.compareMode==='different'?!same:same); });
    return this.heading(this.text('Сравнение товаров', 'Product comparison')) + `<div class="account-content"><div class="compare-filter">${[['all','Все параметры','All parameters'],['different','Различающиеся','Differences'],['same','Одинаковые','Identical']].map(([value,ru,en])=>`<label><input type="radio" name="compare-mode" data-compare-mode value="${value}"${this.compareMode===value?' checked':''}>${this.text(ru,en)}</label>`).join('')}</div>${columns.length ? `<div class="table-scroll"><table class="compare-table"><thead><tr><th>${this.text('Концевые переключатели', 'Limit switches')}</th>${columns.map(index=>`<th>${this.image(PRODUCTS[index])}<strong>${PRODUCTS[index].id}</strong><small>${PRODUCTS[index].maker}</small><button class="primary" data-add="${index}">${this.text('В корзину', 'Add to basket')}</button><button class="text-button" data-compare="${index}">${this.text('Удалить', 'Remove')}</button></th>`).join('')}</tr></thead><tbody>${rows.map(([ru,en,key])=>`<tr><td>${this.text(ru,en)}</td>${columns.map(index=>`<td>${Array.isArray(PRODUCTS[index][key])?this.local(PRODUCTS[index][key]):PRODUCTS[index][key]}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${columns.length+1}">${this.text('Нет параметров в этой группе', 'No parameters in this group')}</td></tr>`}</tbody></table></div>` : `<div class="empty">${this.text('Список сравнения пуст', 'Comparison is empty')}${this.button(this.text('Вернуть товары', 'Restore products'),'restore-compare','compare','secondary')}</div>`}</div>`;
  }

  promos() { return this.heading(this.text('Промокоды', 'Promo codes')) + `<div class="coupon-grid">${['DEMO10','BOM2026','SPRING10','DELIVERY'].map((code,index)=>`<article class="coupon" data-beat-row="${index}"><div class="coupon-symbol">${icon(index===3?'truck':'ticket')}<b>${index===3?'': '10%'}</b></div><strong>${code}</strong><p>${this.text(index===3?'Бесплатная доставка':'Скидка на комплектующие',index===3?'Free delivery':'Component discount')}</p><small>${this.text('Демонстрационный промокод', 'Sample promo code')}</small><button class="secondary" data-copy="${code}">${icon('copy')}${this.text('Скопировать', 'Copy')}</button></article>`).join('')}</div>`; }
  points() { return this.heading(this.text('Баллы', 'Points')) + `<div class="account-content points-layout"><div><div class="balance"><span>${this.text('Текущий баланс', 'Current balance')}</span><strong><b>e</b>213</strong><small>1 ${this.text('балл', 'point')} = 1 ₽</small></div><h4>${this.text('История', 'History')}</h4><div class="point-transactions">${[['−35','№1024'],['−446','№1023'],['−306','№1022'],['+1000',this.text('Регистрация','Registration')]].map(([amount,label],i)=>`<div data-beat-row="${i}"><b>${amount}</b><span>${label}</span></div>`).join('')}</div></div><div><img class="cashback-banner" src="${ASSETS}cashback-banner.webp" alt="${this.text('Кешбэк 15% в Эиком', '15% Eicom cashback')}"><p>${this.text('Баллы начисляются за покупки и используются при следующих заказах.', 'Earn points with purchases and redeem them on future orders.')}</p></div></div>`; }
  addressPage(pickup = false) { return this.heading(this.text(pickup?'Мои пункты выдачи':'Адреса доставки',pickup?'Pickup locations':'Delivery addresses')) + `<div class="account-content"><div class="address-row">${icon(pickup?'pin':'truck')}<div><strong>${this.text(pickup?'Пункт выдачи':'Адрес доставки',pickup?'Pickup point':'Delivery address')}</strong><small>${this.text('Новоград, ул. Примерная, 12', 'Novograd, 12 Example Street')}</small></div></div>${this.addedAddresses?`<div class="address-row">${icon('pin')}<div><strong>${this.text('Дополнительный адрес','Additional address')}</strong><small>${this.text('Новоград, ул. Макетная, 8', 'Novograd, 8 Sample Street')}</small></div><button class="tool" data-action="remove-address" aria-label="${this.text('Удалить дополнительный адрес','Remove additional address')}" title="${this.text('Удалить','Remove')}">${icon('trash')}</button></div>`:''}${this.button(this.text(this.addedAddresses?'Адрес добавлен':'Добавить адрес',this.addedAddresses?'Address added':'Add address'),'add-address','plus')}</div>`; }
  companies() { return this.heading(this.text('Мои компании', 'My companies')) + `<div class="account-content"><p>${this.text('Сохраненные реквизиты используются при оформлении заказа.', 'Saved company details are used during checkout.')}</p><div class="address-row">${icon('building')}<div><strong>${this.text('ООО «Демо Электроника»','Demo Electronics LLC')}</strong><small>${this.text('Демонстрационная организация · Новоград','Sample company · Novograd')}</small></div></div></div>`; }
  profile() { return this.heading(this.text('Мой профиль','My profile'))+`<div class="account-content"><dl class="profile-details"><dt>${this.text('Имя','Name')}</dt><dd>${this.text('Алексей Примеров','Alexey Example')}</dd><dt>Email</dt><dd>demo@example.com</dd><dt>${this.text('Телефон','Phone')}</dt><dd>+7 (000) 000-00-00</dd><dt>${this.text('Город','City')}</dt><dd>${this.text('Новоград','Novograd')}</dd></dl></div>`; }
  orders() { return this.heading(this.text('Мои заказы','My orders'))+`<div class="account-content">${PRODUCTS.map((p,i)=>`<div class="order-row" data-beat-row="${i}">${this.image(p)}<div><strong>№${1024-i}</strong><small>${p.id} · ${i+1} ${this.text('шт.','pcs')}</small></div><span class="in-stock">${this.text(['Создан','В обработке','Доставлен'][i],['Created','Processing','Delivered'][i])}</span><button class="secondary" data-add="${i}">${icon('copy')}${this.text('Повторить','Reorder')}</button></div>`).join('')}</div>`; }
  basket(favorite = false) {
    const items = favorite ? [...this.favorites].map(index=>[index,1]) : [...this.cart];
    const rows = items.map(([index, qty]) => {
      const product = PRODUCTS[index];
      const price = qty >= 10 ? product.bulk : product.price;
      return `<div class="order-row">${this.image(product)}<div><button class="product-name" data-product="${index}">${product.id}</button><small>${qty} ${this.text('шт.','pcs')} · ${this.money(price)}</small></div>${favorite?`<button class="primary" data-add="${index}">${icon('cart')}${this.text('В корзину','Add to basket')}</button>`:''}<button class="tool" data-${favorite?'favorite':'remove'}="${index}" aria-label="${this.text('Удалить','Remove')} ${product.id}" title="${this.text('Удалить','Remove')}">${icon('trash')}</button></div>`;
    }).join('');
    const empty = `<div class="empty">${this.text('Пока нет товаров','No products yet')}<button class="secondary" data-page="1">${icon('grid')}${this.text('В каталог','Browse catalog')}</button></div>`;
    const total = !favorite&&items.length ? `<div class="basket-total"><span>${this.text('Итого','Total')} <strong>${this.money(this.cartTotal)}</strong></span><small>${this.text('Заказ не отправляется: демонстрационный макет', 'Preview only: no order is submitted')}</small></div>` : '';
    return this.heading(this.text(favorite?'Избранное':'Моя корзина',favorite?'Favorites':'My basket'))+`<div class="account-content">${rows||empty}${total}</div>`;
  }

  chat() {
    const topic = this.chatTopic;
    const question = topic==='order'?this.text('Где мой заказ №1024?','Where is my order #1024?'):topic==='repeat'?this.text('Повтори предыдущий заказ','Repeat my previous order'):topic==='operator'?this.text('Нужна помощь менеджера','I need a manager'):this.text('Нужен концевой переключатель на 125 В, монтаж на плату.','I need a 125 V limit switch for PCB mounting.');
    const answer = topic==='order'?this.text('Заказ №1024 передан в обработку. В личном кабинете доступны состав и история заказа.','Order #1024 is processing. Your account shows its items and history.'):topic==='repeat'?this.text('В предыдущем заказе был D2F-F. Позицию можно снова добавить в корзину.','Your previous order included D2F-F. You can add it to your basket again.'):topic==='operator'?this.text('Запрос менеджеру подготовлен. В этом макете сообщения не отправляются.','Manager request prepared. This preview does not send messages.'):this.text('Посмотрите D2F-F от OMRON: 125 В AC, схема SPDT, монтаж THT. Перед заказом проверьте характеристики в документации.','Consider OMRON D2F-F: 125 V AC, SPDT, THT. Verify the datasheet before ordering.');
    return `<div class="chat-page"><div class="chat-context"><span class="context-label">${this.text('Каталог / Подбор компонентов','Catalog / Component selection')}</span>${this.image(PRODUCTS[0])}<strong>D2F-F</strong><span>OMRON OCB</span><dl><dt>AC</dt><dd>125 V</dd><dt>${this.text('Монтаж','Mounting')}</dt><dd>THT</dd><dt>${this.text('Схема','Circuit')}</dt><dd>SPDT</dd></dl></div><section class="chat-panel" aria-label="${this.text('Демонстрация ИИ-чата','AI chat demonstration')}"><header><img src="${ASSETS}logo.svg" alt=""><div><strong>${this.text('Онлайн-консультант','Online assistant')}</strong><small>${this.text('ИИ-помощник Эиком','Eicom AI assistant')}</small></div><span class="chat-demo">DEMO</span></header><div class="messages"><div class="message bot greeting">${this.text('Здравствуйте! Помогу найти компонент или проверить заказ.','Hello! I can help find a component or check an order.')}</div><div class="message customer">${question}</div><div class="message bot"><span data-answer="${esc(answer)}">${answer}</span><div class="typing" hidden><i></i><i></i><i></i></div>${['search','repeat'].includes(topic)?`<div class="chat-product">${this.image(PRODUCTS[0])}<div><strong>D2F-F</strong><small>OMRON · 125 V · THT</small></div><button class="tool" data-product="0" aria-label="${this.text('Открыть D2F-F','Open D2F-F')}" title="${this.text('Открыть товар','Open product')}">${icon('external')}</button></div>`:''}</div></div><div class="chat-topics">${[['search','Поиск товара','Find a product'],['order','Статус заказа','Order status'],['repeat','Повторить заказ','Reorder'],['operator','Оператор','Operator']].map(([id,ru,en])=>`<button data-topic="${id}" aria-pressed="${topic===id}">${this.text(ru,en)}</button>`).join('')}</div><footer>${icon('chat')}<span>${this.text('Пример диалога · без подключения к ИИ','Sample conversation · no AI connection')}</span></footer></section></div>`;
  }

  renderScene(animate = true) {
    const scene = this.shadowRoot.querySelector('.scene');
    const content = this.view==='home'?this.home():this.view==='catalog'?this.catalog():this.view==='product'?this.productPage():this.view==='chat'?this.chat():this.accountShell(this.view==='account'?this.accountOverview():this.view==='bom'?this.bom():this.view==='compare'?this.compare():this.view==='promos'?this.promos():this.view==='points'?this.points():this.view==='pickup'||this.view==='addresses'?this.addressPage(this.view==='pickup'):this.view==='companies'?this.companies():this.view==='orders'?this.orders():this.view==='profile'?this.profile():this.basket(this.view==='favorites'));
    scene.innerHTML = content + `<div class="toast" role="status" hidden></div>`;
    scene.scrollTop = 0;
    const title = (ACCOUNT.find(item=>item[0]===this.view)||PAGES.find(item=>item[0]===this.view));
    this.shadowRoot.querySelector('[data-view-title]').textContent = title ? this.text(title[1],title[2]) : '';
    scene.setAttribute('aria-labelledby', `eicom-${PAGES[this.index][0]}`);
    this.shadowRoot.querySelectorAll('.tour-nav [data-page]').forEach((tab,index)=>{ tab.setAttribute('aria-selected',String(index===this.index)); tab.tabIndex=index===this.index?0:-1; });
    this.shadowRoot.querySelector('[data-counter]').textContent = `${String(this.index+1).padStart(2,'0')} / ${String(PAGES.length).padStart(2,'0')}`;
    this.shadowRoot.querySelector('[data-cart-count]').textContent = this.cartCount;
    this.updatePrice();
    if (animate && !this.motion?.matches) scene.animate([{opacity:.25,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,easing:'ease-out'});
  }

  clampQuantity(value) { return Math.max(1,Math.min(999,Math.floor(Number(value)||1))); }
  updatePrice() {
    const unit = this.shadowRoot.querySelector('[data-unit-price]');
    if (!unit) return;
    const price = this.quantity>=10 ? this.product.bulk : this.product.price;
    this.shadowRoot.querySelector('[data-quantity]').value = this.quantity;
    unit.textContent = `${this.quantity} ${this.text('шт. по','pcs at')} ${this.money(price)}`;
    this.shadowRoot.querySelector('[data-total-price]').textContent = this.money(price*this.quantity);
    this.shadowRoot.querySelector('[data-cashback]').textContent = `${Math.floor(price*this.quantity*.15)} ${this.text('баллов','points')}`;
  }
  select(index, manual = false) {
    this.index = (index+PAGES.length)%PAGES.length;
    this.view = PAGES[this.index][0];
    this.elapsed = 0;
    this.beat = -1;
    this.style.setProperty('--elapsed','0');
    if (manual) this.setPlaying(false);
    this.renderScene();
  }
  openView(view) {
    if (!ACCOUNT.some(item=>item[0]===view)) return;
    const index = PAGES.findIndex(item=>item[0]===view);
    this.select(index>=0?index:3,true);
    this.view=view;
    this.renderScene();
  }
  advance(direction, manual = false) { this.select(this.index+direction,manual); }
  toast(message) { const toast=this.shadowRoot.querySelector('.toast'); toast.textContent=message; toast.hidden=false; }
  addToCart(index, quantity = 1) {
    const total=this.clampQuantity((this.cart.get(index)||0)+quantity);
    this.cart.set(index,total);
  }

  onClick(event) {
    const button=event.target.closest('button');
    if (!button) return;
    if (button.dataset.page!==undefined) return this.select(Number(button.dataset.page),true);
    if (button.dataset.view) return this.openView(button.dataset.view);
    if (button.dataset.product!==undefined) { this.productIndex=Number(button.dataset.product); this.quantity=1; return this.select(2,true); }
    if (button.dataset.topic) { this.chatTopic=button.dataset.topic; this.setPlaying(false); this.renderScene(); return; }
    const action=button.dataset.action;
    if (action==='play') return this.setPlaying(!this.requestedPlay);
    if (action==='previous'||action==='next') return this.advance(action==='next'?1:-1,true);
    this.setPlaying(false);
    if (button.dataset.add!==undefined) {
      const index=Number(button.dataset.add);
      this.addToCart(index,this.view==='product'?this.quantity:1);
      this.shadowRoot.querySelectorAll('[data-cart-count], [data-view="basket"] .red-badge').forEach(badge=>badge.textContent=this.cartCount);
      return this.toast(`${PRODUCTS[index].id} · ${this.text('добавлен в корзину','added to basket')}`);
    }
    for (const [name,set] of [['favorite',this.favorites],['compare',this.compared]]) if (button.dataset[name]!==undefined) { const index=Number(button.dataset[name]); set.has(index)?set.delete(index):set.add(index); this.renderScene(false); return; }
    if (button.dataset.remove!==undefined) { this.cart.delete(Number(button.dataset.remove)); this.renderScene(false); return; }
    if (button.dataset.copy) {
      navigator.clipboard?.writeText(button.dataset.copy).then(()=>this.isConnected&&this.toast(this.text('Промокод скопирован','Promo code copied'))).catch(()=>this.isConnected&&this.toast(this.text('Не удалось скопировать','Could not copy')));
      return;
    }
    if (action==='plus'||action==='minus') { this.quantity=this.clampQuantity(this.quantity+(action==='plus'?1:-1)); this.updatePrice(); }
    if (action==='clear-search') { this.query=''; this.renderScene(); }
    if (action==='import-bom') { this.bomImported=true; this.renderScene(); }
    if (action==='bom-cart') { SAMPLE_BOM.forEach((row,index)=>this.addToCart(index,row.qty)); this.openView('basket'); }
    if (action==='template') {
      const blob=new Blob(['\uFEFFАртикул;Количество\r\nD2F-F;10\r\nSS-5GL;20\r\nD2HW-BR211DR;5\r\n'],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download='components.csv'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    if (action==='restore-compare') { this.compared=new Set([0,1,2]); this.renderScene(); }
    if (action==='add-address'||action==='remove-address') { this.addedAddresses=action==='add-address'; this.renderScene(); }
  }

  onKey(event) {
    if (!event.target.matches('.tour-nav [role="tab"]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key==='Home'||event.key==='End') this.select(event.key==='Home'?0:PAGES.length-1,true);
    else this.advance(event.key==='ArrowRight'?1:-1,true);
    this.shadowRoot.querySelector(`.tour-nav [data-page="${this.index}"]`).focus();
  }
  setPlaying(value) { this.requestedPlay=value; this.updatePlayButton(); this.syncClock(); }
  updatePlayButton() {
    const button=this.shadowRoot.querySelector('.play-toggle');
    const label=this.requestedPlay?this.text('Приостановить анимацию Эиком','Pause Eicom animation'):this.text('Продолжить анимацию Эиком','Play Eicom animation');
    button.innerHTML=icon(this.requestedPlay?'pause':'play'); button.setAttribute('aria-label',label); button.setAttribute('aria-pressed',String(this.requestedPlay)); button.title=label;
  }
  syncClock() {
    const running=this.isConnected&&this.requestedPlay&&this.visible&&!document.hidden;
    this.dataset.playing=String(running);
    if (running===this.running) return;
    this.running=running; cancelAnimationFrame(this.frame);
    if (running) { this.lastTime=performance.now(); this.frame=requestAnimationFrame(this.tick); }
  }
  tick(now) {
    if (!this.running) return;
    this.elapsed+=Math.min(now-this.lastTime,100); this.lastTime=now;
    if (this.elapsed>=STEP_MS) this.advance(1);
    this.style.setProperty('--elapsed',String(this.elapsed/STEP_MS));
    const beat=Math.floor(this.elapsed/1800);
    if (beat!==this.beat) {
      this.beat=beat;
      if (this.view==='product') { this.quantity=beat>=2?10:1; this.updatePrice(); }
      if (this.view==='bom'&&beat>=1&&!this.bomImported) { this.bomImported=true; this.renderScene(); }
      const rows=[...this.shadowRoot.querySelectorAll('[data-beat-row]')];
      rows.forEach((row,index)=>row.classList.toggle('focus-row',index===beat%rows.length));
    }
    const answer=this.shadowRoot.querySelector('[data-answer]');
    if (answer) { const full=answer.dataset.answer; answer.textContent=full.slice(0,Math.max(0,Math.floor((this.elapsed-1600)/18))); const typing=this.shadowRoot.querySelector('.typing'); typing.hidden=this.elapsed>1600; }
    this.frame=requestAnimationFrame(this.tick);
  }
}

if (!customElements.get('eicom-shop-preview')) customElements.define('eicom-shop-preview',EicomShopPreview);
