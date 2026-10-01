import { ICONS } from './tm-icons.js';
import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';
import { projectHeading, DIAGRAM_STYLESHEET } from './project-diagram.js';

const CSS = new URL('./tm-electronics.css', import.meta.url).href;
const ASSETS = new URL('./tm-assets/', import.meta.url).href;
const DURATION = 10500;
const FEATURES = [
  ['layout', 'Новая верстка', 'New layout', 'layout', 'Каталог · товар · заказ', 'Catalog · product · checkout'],
  ['bonus', 'Бонусная система', 'Loyalty points', 'coins', 'Покупка → бонусы', 'Purchase → points'],
  ['delivery', 'Доставка', 'Delivery', 'truck', 'Тарифы и пункты выдачи', 'Rates and pickup points'],
  ['api', 'API партнеров', 'Partner APIs', 'globe', 'Товары и наличие', 'Products and availability'],
  ['speed', 'Оптимизация', 'Optimization', 'gauge', 'Быстрая выдача каталога', 'Faster catalog responses'],
  ['bugs', 'Исправление багов', 'Bug fixes', 'shield', 'Стабильные сценарии', 'Reliable workflows'],
  ['crm', 'Интеграция с CRM', 'CRM integration', 'sync', 'Регулярное обновление цен', 'Regular price updates'],
];
const PRODUCTS = [
  { sku:'1695.2100.01', image:'gland.webp', price:7139, name:['Кабельный ввод · PG21 · IP68', 'Cable gland · PG21 · IP68'], maker:'HUMMEL' },
  { sku:'1.262.2100.11', image:'nut.webp', price:149, name:['Гайка · PG21 · полиамид', 'Locknut · PG21 · polyamide'], maker:'HUMMEL' },
];
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const icon = name => ICONS[name] || '';

class TmElectronicsPreview extends HTMLElement {
  static observedAttributes = ['locale', 'description', 'site-url'];
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this.feature = 0;
    this.page = 'catalog';
    this.productIndex = 0;
    this.quantity = 1;
    this.cart = 0;
    this.filtered = false;
    this.carrier = 'pickup';
    this.elapsed = 0;
    this.visible = false;
    this.running = false;
    this.tick = this.tick.bind(this);
  }
  get english() { return this.getAttribute('locale') === 'en'; }
  text(ru,en) { return this.english ? en : ru; }
  money(value) { return new Intl.NumberFormat(this.english?'en-US':'ru-RU').format(value)+' ₽'; }
  get product() { return PRODUCTS[this.productIndex]; }
  siteUrl() {
    try { const url=new URL(this.getAttribute('site-url')||'https://tmelectronics.ru/'); return ['http:','https:'].includes(url.protocol)?url.href:'https://tmelectronics.ru/'; }
    catch { return 'https://tmelectronics.ru/'; }
  }
  connectedCallback() {
    this.abort = new AbortController();
    const options = {signal:this.abort.signal};
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.wanted = !this.motion.matches;
    if (!this.wanted) this.elapsed = DURATION-1;
    this.shadowRoot.addEventListener('pointerover', event => {
      const target=event.target.closest('button[data-feature]');
      if(target && event.pointerType!=='touch' && !target.contains(event.relatedTarget)) this.select(Number(target.dataset.feature));
    },options);
    this.shadowRoot.addEventListener('focusin',event=>{
      const target=event.target.closest('button[data-feature]');
      if(target) this.select(Number(target.dataset.feature));
    },options);
    this.shadowRoot.addEventListener('click',event=>this.onClick(event),options);
    this.shadowRoot.addEventListener('keydown',event=>this.onKey(event),options);
    this.shadowRoot.addEventListener('change',event=>{
      if(event.target.matches('[data-filter]')) {this.filtered=event.target.checked;this.pause();this.renderScene();}
      if(event.target.matches('[data-carrier]')) {this.carrier=event.target.value;this.pause();this.renderScene();}
      if(event.target.matches('[data-quantity]')) this.setQuantity(event.target.value);
    },options);
    document.addEventListener('visibilitychange',()=>this.syncClock(),options);
    this.shadowRoot.addEventListener('previewstylesready',()=>this.syncClock(),options);
    this.motion.addEventListener('change',()=>{if(this.motion.matches){this.pause();this.elapsed=DURATION-1;this.updateAnimation();}},options);
    this.render();
    this.observer = new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.syncClock();},{threshold:.12});
    this.observer.observe(this);
  }
  disconnectedCallback() {stopPreviewLoading(this.shadowRoot);this.abort?.abort();this.observer?.disconnect();cancelAnimationFrame(this.frame);this.running=false;}
  attributeChangedCallback(name,before,after) {if(before!==after && this.isConnected && this.abort) this.render();}
  render() {
    renderPreview(this.shadowRoot, [CSS, DIAGRAM_STYLESHEET], `<div class="preview">
      <div class="case-intro"><details><summary>${this.text('Подробнее о проекте','More about the project')}</summary><p>${escape(this.getAttribute('description')||'')}</p></details><a href="${escape(this.siteUrl())}" target="_blank" rel="noopener noreferrer">${this.text('Открыть сайт','Visit website')}${icon('external')}</a></div>
      ${projectHeading('tm', this.english)}
      <nav class="feature-map" role="tablist" aria-label="${this.text('Доработки ТМ Электроникс','TM Electronics improvements')}">${FEATURES.map(([id,ru,en,glyph,subRu,subEn],index)=>`<div class="feature-node"><button role="tab" id="tm-${id}" aria-controls="tm-detail" data-feature="${index}"><span class="node-icon">${icon(glyph)}</span><strong>${this.text(ru,en)}</strong><small>${this.text(subRu,subEn)}</small><span class="node-number">0${index+1}</span></button><i class="node-wire"></i></div>`).join('')}</nav>
      <div class="bridge"><span>${icon('down')}</span></div>
      <section class="detail-window" aria-label="${this.text('ТМ Электроникс: схема доработок','TM Electronics: improvement diagram')}">
        <header class="window-header"><span class="tm-brand"><b>TM</b><strong>${this.text('ЭЛЕКТРОНИКС','ELECTRONICS')}</strong></span><span class="detail-title"></span><span class="sample">DEMO</span></header>
        <div id="tm-detail" class="scene" role="tabpanel"></div>
        <footer class="window-footer"><span>${icon('check')}${this.text('Демонстрационные данные','Sample data')}</span><span class="state-label"></span></footer>
      </section>
      <div class="playback"><span class="feature-counter"></span><div class="progress"><i></i></div><button class="tool" data-action="replay" aria-label="${this.text('Повторить анимацию','Replay animation')}" title="${this.text('Повторить','Replay')}">${icon('replay')}</button><button class="tool play" data-action="play"></button></div>
    </div>`, this.english);
    this.renderScene();
    this.updatePlayButton();
  }
  flow(items) {
    return `<div class="flow">${items.map(([glyph,ru,en],index)=>`<div class="flow-step" data-phase="${index}"><span>${icon(glyph)}</span><strong>${this.text(ru,en)}</strong><b>${icon('check')}</b></div>${index<items.length-1?`<div class="flow-wire"><i></i>${icon('right')}</div>`:''}`).join('')}</div>`;
  }
  image(product,cls='') {return `<img class="${cls}" src="${ASSETS+product.image}" alt="${escape(product.sku)}" width="320" height="320">`;}
  siteHeader() {
    return `<div class="site-ribbon">${this.text('Бесплатная доставка по России','Delivery across Russia')}</div><div class="site-header"><span class="tm-brand"><b>TM</b><strong>${this.text('ЭЛЕКТРОНИКС','ELECTRONICS')}</strong></span><span>${this.text('Каталог электронных компонентов','Electronic components catalog')}</span><span class="site-icons">${icon('user')}${icon('heart')}${icon('cart')}<b data-cart>${this.cart}</b></span></div>`;
  }
  layout() {
    return `${this.siteHeader()}<nav class="page-tabs" aria-label="${this.text('Страницы магазина','Store pages')}">${[['catalog','Каталог','Catalog'],['product','Товар','Product'],['checkout','Оформление','Checkout']].map(([id,ru,en])=>`<button data-page="${id}" aria-pressed="${this.page===id}">${this.text(ru,en)}</button>`).join('')}</nav><div class="site-content">${this.page==='catalog'?this.catalog():this.page==='product'?this.productPage():this.checkout()}</div>`;
  }
  catalog() {
    return `<div class="catalog-heading"><h3>${this.text('Кабельные вводы и аксессуары','Cable glands and accessories')}</h3><span>${this.filtered?'1':'2'} ${this.text('товара','products')}</span></div><div class="catalog-filters"><label><input type="checkbox" data-filter${this.filtered?' checked':''}>IP68</label><span>HUMMEL</span><span>PG21</span><span>${this.text('В наличии','In stock')}</span></div><div class="catalog-products">${PRODUCTS.map((p,index)=>this.filtered&&index!==0?'':`<article><button class="product-photo" data-product="${index}">${this.image(p)}</button><small>${p.maker}</small><button class="product-name" data-product="${index}">${p.sku}</button><p>${p.name[this.english?1:0]}</p><div class="stock">${icon('check')}${this.text('В наличии','Available')}</div><div class="catalog-price"><strong>${this.money(p.price)}</strong><button class="secondary" data-product="${index}">${this.text('Подробнее','Details')}${icon('right')}</button></div></article>`).join('')}<div class="catalog-promise"><span>${icon('truck')}</span><strong>${this.text('Доставка по России','Nationwide delivery')}</strong><img src="${ASSETS}connectors.webp" alt="${this.text('Электронные разъемы','Electronic connectors')}" width="100" height="100"><small>${this.text('Параметры · наличие · цены','Parameters · stock · prices')}</small></div></div>`;
  }
  productPage() {
    const p=this.product;
    return `<h3>${p.sku}</h3><div class="product-detail">${this.image(p,'detail-photo')}<div class="purchase"><span class="stock">${icon('check')}${this.text('Товар доступен','Product available')}</span><strong>${this.money(p.price)}</strong><div class="quantity"><button class="tool" data-action="minus" aria-label="${this.text('Уменьшить количество','Decrease quantity')}">${icon('minus')}</button><input type="number" min="1" max="99" value="${this.quantity}" data-quantity aria-label="${this.text('Количество','Quantity')}"><button class="tool" data-action="plus" aria-label="${this.text('Увеличить количество','Increase quantity')}">${icon('plus')}</button></div><button class="primary" data-action="cart">${icon('cart')}${this.text('В корзину','Add to basket')}</button><span class="bonus-line">${icon('coins')}+${Math.floor(p.price*this.quantity*.15)} ${this.text('баллов','points')}</span></div><dl class="product-specs"><dt>${this.text('Производитель','Manufacturer')}</dt><dd>${p.maker}</dd><dt>${this.text('Резьба','Thread')}</dt><dd>PG21</dd><dt>${this.text('Описание','Description')}</dt><dd>${p.name[this.english?1:0]}</dd><dt>${this.text('Количество','Quantity')}</dt><dd data-quantity-display>${this.quantity}</dd><dt>${this.text('Итого','Total')}</dt><dd data-total>${this.money(p.price*this.quantity)}</dd></dl></div>`;
  }
  checkout() {
    return `<h3>${this.text('Оформление заказа','Checkout')}</h3><div class="checkout"><div><h4>1. ${this.text('Данные получателя','Recipient details')}</h4><div class="demo-field">${this.text('Алексей Примеров','Alexey Example')}</div><div class="demo-field">demo@example.com</div><h4>2. ${this.text('Способ доставки','Delivery method')}</h4>${this.carrierControl()}<div class="pickup-address">${icon('pin')}<span>${this.text('Новоград, ул. Примерная, 12','Novograd, 12 Example Street')}</span></div><h4>3. ${this.text('Способ оплаты','Payment method')}</h4><span class="payment">${icon('card')}${this.text('Карта / счет для организации','Card / company invoice')}</span></div><aside class="order-total"><span>${this.text('Ваш заказ','Your order')}</span><div>${this.text('Товары','Products')}<strong>${this.money(this.product.price*this.quantity)}</strong></div><div>${this.text('Доставка','Delivery')}<strong>${this.text('Бесплатно','Free')}</strong></div><b>${this.money(this.product.price*this.quantity)}</b><span class="bonus-line">${icon('coins')}+${Math.floor(this.product.price*this.quantity*.15)} ${this.text('баллов','points')}</span></aside></div>`;
  }
  carrierControl() {return `<div class="carrier-control">${[['pickup','Пункт выдачи','Pickup point','pin'],['courier','Курьер','Courier','truck']].map(([id,ru,en,glyph])=>`<label><input type="radio" name="carrier" data-carrier value="${id}"${this.carrier===id?' checked':''}>${icon(glyph)}${this.text(ru,en)}</label>`).join('')}</div>`;}
  bonus() {
    return `${this.flow([['cart','Покупка','Purchase'],['card','Оплата','Payment'],['coins','Начисление','Credit'],['user','Баланс клиента','Customer balance']])}<div class="bonus-body"><div class="order-slip"><span class="section-label">DEMO-001</span><h3>${this.text('Заказ на','Order total')} ${this.money(10000)}</h3><div class="receipt-line"><span>${this.text('Оплата заказа','Order payment')}</span><b class="phase-text" data-after="${this.text('Оплачен','Paid')}" data-before="${this.text('Ожидание','Pending')}" data-reveal="1"></b></div><div class="receipt-line"><span>${this.text('Бонусы за покупку','Purchase rewards')}</span><b class="gold">+1 500</b></div><div class="reward-rate">${icon('coins')}<strong>15%</strong><span>${this.text('кешбэк баллами','cashback in points')}</span></div></div><div class="loyalty-account"><span class="section-label">${this.text('Личный кабинет / Баллы','Account / Points')}</span><div class="balance-value">${icon('coins')}<strong data-count="balance">100</strong><span>${this.text('баллов','points')}</span></div><div class="ledger"><div><span>${this.text('Начальный баланс','Opening balance')}</span><b>100</b></div><div data-reveal="2"><span>${this.text('Покупка · DEMO-001','Purchase · DEMO-001')}</span><b class="green">+1 500</b>${icon('check')}</div></div><div class="earned" data-reveal="3">${icon('check')}${this.text('Бонусы доступны для следующих покупок','Points available for future purchases')}</div></div></div>`;
  }
  delivery() {
    return `${this.flow([['cart','Заказ','Order'],['globe','API доставки','Delivery API'],['list','Расчет тарифа','Rate calculation'],['pin','Получение','Collection']])}<div class="delivery-body"><div><h3>${this.text('Доставка заказа','Order delivery')}</h3>${this.carrierControl()}<div class="service-row"><span class="carrier-brand">CDEK</span><div><strong>${this.text(this.carrier==='pickup'?'Пункт выдачи':'Курьерская доставка',this.carrier==='pickup'?'Pickup point':'Courier delivery')}</strong><small>${this.text('Новоград · демонстрационный адрес','Novograd · sample address')}</small></div><b class="green" data-reveal="2">${this.text('Рассчитано','Calculated')}</b></div><div class="route"><span data-phase="0">${icon('package')}<small>${this.text('Склад','Warehouse')}</small></span><i></i><span data-phase="2">${icon('truck')}<small>${this.text('Доставка','Transit')}</small></span><i></i><span data-phase="3">${icon('pin')}<small>${this.text('ПВЗ / адрес','Pickup / address')}</small></span></div></div><div class="shipping-result"><span class="section-label">${this.text('Ответ службы доставки','Delivery service response')}</span><dl><dt>${this.text('Способ','Method')}</dt><dd>${this.text(this.carrier==='pickup'?'Самовывоз':'Курьер',this.carrier==='pickup'?'Pickup':'Courier')}</dd><dt>${this.text('Тариф','Rate')}</dt><dd data-reveal="2">${this.text('Рассчитан','Calculated')}</dd><dt>${this.text('Срок','Lead time')}</dt><dd data-reveal="2">${this.text('Определен','Available')}</dd><dt>${this.text('Точка получения','Destination')}</dt><dd data-reveal="3">${this.text('Выбрана','Selected')}</dd></dl><img src="${ASSETS}delivery.webp" alt="${this.text('Доставка ТМ Электроникс','TM Electronics delivery')}" width="1170" height="300"></div></div>`;
  }
  partnerApi() {
    return `${this.flow([['globe','API партнеров','Partner APIs'],['code','Данные товаров','Product data'],['sync','Обновление','Update'],['grid','Каталог сайта','Website catalog']])}<div class="sync-body"><div class="payload"><span class="section-label">${this.text('Зарубежный партнер / API','International partner / API')}</span><pre>{
  <em>"sku"</em>: <b>"1695.2100.01"</b>,
  <em>"stock"</em>: <b>128</b>,
  <em>"price"</em>: <b>7139</b>,
  <em>"currency"</em>: <b>"RUB"</b>
}</pre><span class="payload-state" data-reveal="1">${icon('check')}JSON</span></div><div class="sync-catalog"><h3>${this.text('Обновление каталога','Catalog update')}</h3>${this.syncRows(false)}<div class="sync-result" data-reveal="3">${icon('check')}${this.text('Данные товаров актуализированы','Product data refreshed')}</div></div></div>`;
  }
  syncRows(crm) {
    return `<div class="sync-table"><div class="sync-table-heading"><span>${this.text('Артикул','Part number')}</span><span>${this.text(crm?'Цена в CRM':'Наличие',crm?'CRM price':'Stock')}</span><span>${this.text('На сайте','On website')}</span></div>${PRODUCTS.map((p,index)=>`<div class="sync-row" data-update-row="${index}">${this.image(p)}<div><strong>${p.sku}</strong><small>${p.maker}</small></div><b>${crm?this.money(p.price):128-index*64}</b><span><del>${crm?this.money(p.price+500):'—'}</del><strong class="updated-value" data-reveal="${2+index}">${crm?this.money(p.price):128-index*64}</strong></span></div>`).join('')}</div>`;
  }
  speed() {
    return `${this.flow([['search','Запрос каталога','Catalog request'],['database','Оптимизация','Optimization'],['layers','Выдача данных','Data response'],['grid','Страница готова','Page ready']])}<div class="speed-body"><div class="waterfalls"><div class="waterfall-label"><span>${this.text('Последовательная обработка','Sequential processing')}</span><small>${this.text('Схема, без замеров времени','Diagram, not measured timings')}</small></div><div class="waterfall old">${['Каталог','Цены','Наличие','Страница'].map((ru,index)=>`<div style="--offset:${index*19}%"><span>${this.text(ru,['Catalog','Prices','Stock','Page'][index])}</span><i data-slow="${index}"></i></div>`).join('')}</div><div class="waterfall-label"><strong>${this.text('После оптимизации','After optimization')}</strong>${icon('gauge')}</div><div class="waterfall optimized"><div><span>${this.text('Данные','Data')}</span><i data-fast="0"></i></div><div style="--offset:22%"><span>${this.text('Страница','Page')}</span><i data-fast="1"></i></div></div></div><div class="fast-catalog"><span class="section-label">${this.text('Результат выдачи','Response result')}</span>${this.image(PRODUCTS[0])}<strong>1695.2100.01</strong><span>${this.money(7139)}</span><span class="stock" data-reveal="2">${icon('check')}${this.text('Каталог готов','Catalog ready')}</span></div></div>`;
  }
  bugs() {
    return `${this.flow([['bug','Диагностика','Diagnosis'],['code','Исправление','Fix'],['test','Проверка','Verification'],['shield','Стабильная работа','Reliable operation']])}<div class="quality-body"><div><h3>${this.text('Проверка сценариев','Workflow checks')}</h3><div class="test-list">${[['Цена товара','Product price','tag'],['Количество в корзине','Basket quantity','cart'],['Оформление заказа','Checkout','card'],['Данные доставки','Delivery details','truck']].map(([ru,en,glyph],index)=>`<div data-test="${index}"><span>${icon(glyph)}${this.text(ru,en)}</span><b>${icon('check')}</b></div>`).join('')}</div><button class="secondary" data-action="replay">${icon('test')}${this.text('Запустить проверки','Run checks')}</button></div><div class="verified-order"><span class="section-label">${this.text('Корзина / Контроль данных','Basket / Data validation')}</span>${this.image(PRODUCTS[0])}<strong>1695.2100.01</strong><div><span>${this.text('Количество','Quantity')}</span><b data-valid-qty>—</b></div><div><span>${this.text('Стоимость','Amount')}</span><b data-valid-price>—</b></div><span class="stock" data-reveal="3">${icon('shield')}${this.text('Проверки пройдены','Checks passed')}</span></div></div>`;
  }
  crm() {
    return `${this.flow([['database','CRM компании','Company CRM'],['clock','Плановый обмен','Scheduled sync'],['sync','Обновление цен','Price update'],['grid','Каталог сайта','Website catalog']])}<div class="sync-body crm-body"><div class="crm-source"><span class="section-label">CRM / ${this.text('Прайс-лист','Price list')}</span><div class="crm-price"><span>1695.2100.01</span><strong>${this.money(7139)}</strong></div><div class="crm-price"><span>1.262.2100.11</span><strong>${this.money(149)}</strong></div><div class="schedule"><span>${icon('clock')}</span><div><strong>${this.text('Регулярная синхронизация','Regular synchronization')}</strong><small>${this.text('Каталог · цены','Catalog · prices')}</small></div></div><div class="payload-state" data-reveal="1">${icon('sync')}${this.text('Данные получены','Data received')}</div></div><div class="sync-catalog"><h3>${this.text('Цены на сайте','Website prices')}</h3>${this.syncRows(true)}<div class="sync-result" data-reveal="3">${icon('check')}${this.text('Плановое обновление завершено','Scheduled update completed')}</div></div></div>`;
  }
  renderScene() {
    const scenes=[()=>this.layout(),()=>this.bonus(),()=>this.delivery(),()=>this.partnerApi(),()=>this.speed(),()=>this.bugs(),()=>this.crm()];
    const scene=this.shadowRoot.querySelector('.scene');
    scene.innerHTML=scenes[this.feature]();
    scene.dataset.feature=FEATURES[this.feature][0];
    scene.scrollTop=0;
    scene.setAttribute('aria-labelledby','tm-'+FEATURES[this.feature][0]);
    this.shadowRoot.querySelectorAll('button[data-feature]').forEach((button,index)=>{button.setAttribute('aria-selected',String(index===this.feature));button.tabIndex=index===this.feature?0:-1;});
    this.shadowRoot.querySelector('.detail-title').textContent=this.text(FEATURES[this.feature][1],FEATURES[this.feature][2]);
    this.shadowRoot.querySelector('.feature-counter').textContent=`0${this.feature+1} / 07`;
    this.updateAnimation();
  }
  select(index) {
    if(!Number.isInteger(index)||index<0||index>=FEATURES.length||index===this.feature) return;
    this.feature=index;
    this.elapsed=this.motion.matches?DURATION-1:0;
    this.page='catalog';
    this.wanted=!this.motion.matches;
    this.renderScene();this.updatePlayButton();this.syncClock();
  }
  pause() {this.wanted=false;this.updatePlayButton();this.syncClock();}
  replay() {this.elapsed=0;this.page='catalog';this.wanted=!this.motion.matches;this.renderScene();this.updatePlayButton();this.syncClock();}
  setQuantity(value) {
    this.quantity=Math.max(1,Math.min(99,Math.floor(Number(value)||1)));
    this.pause();this.renderScene();
  }
  onClick(event) {
    const target=event.target.closest('button');if(!target) return;
    if(target.hasAttribute('data-feature')) return this.select(Number(target.dataset.feature));
    if(target.dataset.page) {this.pause();this.page=target.dataset.page;return this.renderScene();}
    if(target.dataset.product!==undefined) {this.productIndex=Number(target.dataset.product);this.quantity=1;this.page='product';this.pause();return this.renderScene();}
    const action=target.dataset.action;
    if(action==='play') {this.wanted=!this.wanted;this.updatePlayButton();this.syncClock();}
    if(action==='replay') this.replay();
    if(action==='plus'||action==='minus') this.setQuantity(this.quantity+(action==='plus'?1:-1));
    if(action==='cart') {this.cart+=this.quantity;this.page='checkout';this.pause();this.renderScene();}
  }
  onKey(event) {
    const button=event.target.closest('button[data-feature]');if(!button) return;
    let index=Number(button.dataset.feature);
    if(event.key==='ArrowRight'||event.key==='ArrowDown') index=(index+1)%7;
    else if(event.key==='ArrowLeft'||event.key==='ArrowUp') index=(index+6)%7;
    else if(event.key==='Home') index=0;
    else if(event.key==='End') index=6;
    else return;
    event.preventDefault();this.select(index);this.shadowRoot.querySelector(`[data-feature="${index}"]`).focus();
  }
  updatePlayButton() {
    const button=this.shadowRoot.querySelector('.play');if(!button) return;
    const title=this.wanted?this.text('Остановить анимацию','Pause animation'):this.text('Продолжить анимацию','Resume animation');
    button.innerHTML=icon(this.wanted?'pause':'play');button.title=title;button.setAttribute('aria-label',title);button.setAttribute('aria-pressed',String(!!this.wanted));
    this.setAttribute('data-playing',String(!!this.wanted));
  }
  syncClock() {
    const running=!!(this.wanted&&this.visible&&!document.hidden&&!this.shadowRoot.querySelector('[data-preview-content][hidden]'));
    if(running===this.running) return;
    this.running=running;this.lastTime=0;cancelAnimationFrame(this.frame);
    this.setAttribute('data-running',String(running));
    if(running) this.frame=requestAnimationFrame(this.tick);
  }
  tick(now) {
    if(!this.running) return;
    const delta=this.lastTime?Math.min(now-this.lastTime,100):0;this.lastTime=now;
    this.elapsed+=delta;
    if(this.elapsed>=DURATION){this.elapsed=0;this.page='catalog';this.renderScene();}
    if(this.feature===0){const page=['catalog','product','checkout'][Math.min(2,Math.floor(this.elapsed/3500))];if(page!==this.page){this.page=page;this.renderScene();}}
    this.updateAnimation();this.frame=requestAnimationFrame(this.tick);
  }
  updateAnimation() {
    const phase=Math.min(3,Math.floor(this.elapsed/2300));
    this.style.setProperty('--progress',String(Math.min(1,this.elapsed/DURATION)));
    this.shadowRoot.querySelectorAll('[data-phase]').forEach(el=>{el.dataset.state=Number(el.dataset.phase)<phase?'done':Number(el.dataset.phase)===phase?'active':'waiting';});
    this.shadowRoot.querySelectorAll('[data-reveal]').forEach(el=>{const ready=phase>=Number(el.dataset.reveal);el.dataset.ready=String(ready);if(el.classList.contains('phase-text')) el.textContent=ready?el.dataset.after:el.dataset.before;});
    const balance=this.shadowRoot.querySelector('[data-count="balance"]');
    if(balance) balance.textContent=new Intl.NumberFormat(this.english?'en-US':'ru-RU').format(100+Math.round(1500*Math.max(0,Math.min(1,(this.elapsed-4600)/1500))));
    this.shadowRoot.querySelectorAll('[data-update-row]').forEach(el=>el.dataset.updated=String(phase>=2+Number(el.dataset.updateRow)));
    this.shadowRoot.querySelectorAll('[data-slow]').forEach(el=>el.style.setProperty('--fill',String(Math.max(0,Math.min(1,(this.elapsed-Number(el.dataset.slow)*1700)/1600)))));
    this.shadowRoot.querySelectorAll('[data-fast]').forEach(el=>el.style.setProperty('--fill',String(Math.max(0,Math.min(1,(this.elapsed-Number(el.dataset.fast)*900)/800)))));
    this.shadowRoot.querySelectorAll('[data-test]').forEach(el=>el.dataset.passed=String(this.elapsed>=3600+Number(el.dataset.test)*900));
    const qty=this.shadowRoot.querySelector('[data-valid-qty]'),price=this.shadowRoot.querySelector('[data-valid-price]');
    if(qty) qty.textContent=phase>=2?'1':'—';if(price) price.textContent=phase>=2?this.money(7139):'—';
    this.shadowRoot.querySelector('.state-label').textContent=this.feature===0?this.text({catalog:'Каталог',product:'Карточка товара',checkout:'Оформление заказа'}[this.page],{catalog:'Catalog',product:'Product detail',checkout:'Checkout'}[this.page]):this.text(phase===3?'Завершено':'Обработка',phase===3?'Completed':'Processing');
  }
}

if(!customElements.get('tm-electronics-preview')) customElements.define('tm-electronics-preview',TmElectronicsPreview);
