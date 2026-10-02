import { ICONS } from './dental-icons.js';
import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';
import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=3';

const STEP_MS = 6500;
const STYLESHEET = new URL('./dental-crm.css', import.meta.url).href;
const PAGES = [
  { id: 'dashboard', icon: 'dashboard', name: ['Сводка', 'Overview'], hint: ['Метрики и финансы', 'Metrics and finances'], intro: ['Ключевые показатели лаборатории', 'Key laboratory metrics'] },
  { id: 'narads', icon: 'files', name: ['Наряды', 'Orders'], hint: ['Заказы и история статусов', 'Orders and status history'], intro: ['От поступления заказа до готовой работы', 'From a new order to a finished restoration'] },
  { id: 'works', icon: 'briefcase', name: ['Работы', 'Production'], hint: ['Этапы и исполнители', 'Stages and technicians'], intro: ['Производственный цикл и контроль сроков', 'Production workflow and deadlines'] },
  { id: 'payments', icon: 'receipt', name: ['Платежи', 'Payments'], hint: ['Оплаты и взаиморасчеты', 'Payments and balances'], intro: ['Платежные документы и расчеты с клиниками', 'Payment documents and clinic balances'] },
  { id: 'materials', icon: 'flask', name: ['Материалы', 'Materials'], hint: ['Склад и расход', 'Stock and consumption'], intro: ['Остатки, резерв и расход материалов', 'Stock levels, reservations and consumption'] },
];
const ORDERS = [
  { number: 'DL-1048', clinic: ['Клиника «Север»', 'North Clinic'], item: ['Коронка из циркония', 'Zirconia crown'], doctor: ['Алексей Морозов', 'Alex Morgan'], due: '04.10', status: 'process', amount: 18500, progress: 64 },
  { number: 'DL-1047', clinic: ['Стоматология «Мята»', 'Mint Dental'], item: ['Виниры E.max', 'E.max veneers'], doctor: ['Анна Белова', 'Anna Bell'], due: '03.10', status: 'ready', amount: 42000, progress: 100 },
  { number: 'DL-1046', clinic: ['Клиника «Атлас»', 'Atlas Clinic'], item: ['Мостовидный протез', 'Dental bridge'], doctor: ['Иван Соколов', 'Ivan Stone'], due: '05.10', status: 'process', amount: 34500, progress: 38 },
  { number: 'DL-1045', clinic: ['Клиника «Север»', 'North Clinic'], item: ['Керамическая вкладка', 'Ceramic inlay'], doctor: ['Алексей Морозов', 'Alex Morgan'], due: '06.10', status: 'new', amount: 9500, progress: 12 },
];
const MATERIALS = [
  { name: ['Цирконий HT 98 × 14', 'Zirconia HT 98 × 14'], category: ['Диски', 'Discs'], stock: 18, reserved: 4, level: 76, unit: ['шт.', 'pcs'] },
  { name: ['Керамика E.max A2', 'E.max ceramic A2'], category: ['Керамика', 'Ceramics'], stock: 24, reserved: 6, level: 65, unit: ['шт.', 'pcs'] },
  { name: ['Гипс IV класса', 'Class IV plaster'], category: ['Моделирование', 'Modelling'], stock: 8, reserved: 2, level: 32, unit: ['кг', 'kg'] },
  { name: ['Фреза 1,0 мм', '1.0 mm milling bur'], category: ['Инструменты', 'Tools'], stock: 3, reserved: 1, level: 14, unit: ['шт.', 'pcs'] },
];
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = name => ICONS[name] || '';

class DentalCrmPreview extends HTMLElement {
  static observedAttributes = ['locale', 'description', 'demo-url-token'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.index = 0;
    this.elapsed = 0;
    this.frame = 0;
    this.visible = false;
    this.requestedPlay = true;
    this.running = false;
    this.manualDetail = null;
    this.tick = this.tick.bind(this);
  }

  get english() { return this.getAttribute('locale') === 'en'; }
  text(ru, en) { return this.english ? en : ru; }
  local(pair) { return pair[this.english ? 1 : 0]; }
  money(value) { return `${new Intl.NumberFormat(this.english ? 'en-GB' : 'ru-RU').format(value)} ₽`; }

  connectedCallback() {
    this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.requestedPlay = !this.motion.matches;
    this.shadowRoot.addEventListener('click', event => this.onClick(event), options);
    this.shadowRoot.addEventListener('keydown', event => this.onKey(event), options);
    this.shadowRoot.addEventListener('input', () => this.filterRows(), options);
    this.shadowRoot.addEventListener('change', () => this.filterRows(), options);
    this.shadowRoot.addEventListener('focusin', event => {
      if (event.target.matches('input, select')) this.setPlaying(false);
    }, options);
    document.addEventListener('visibilitychange', () => this.syncClock(), options);
    this.shadowRoot.addEventListener('previewstylesready', () => this.syncClock(), options);
    this.motion.addEventListener('change', () => {
      if (this.motion.matches) this.setPlaying(false);
    }, options);
    this.render();
    this.observer = new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting;
      this.syncClock();
    }, { threshold: .15 });
    this.observer.observe(this);
  }

  disconnectedCallback() {
    stopPreviewLoading(this.shadowRoot);
    this.abort?.abort();
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    this.running = false;
  }

  attributeChangedCallback(name, oldValue, value) {
    if (oldValue !== value && this.isConnected && this.abort) this.render();
  }

  demoUrl() {
    const token = this.getAttribute('demo-url-token') || 'https://dental.maharram.ru/';
    try {
      const url = new URL(/^https?:\/\//.test(token) ? token : atob(token));
      if (url.protocol === 'https:' && url.hostname === 'dental.maharram.ru') return url.href;
    } catch { /* Invalid project data must not become an executable link. */ }
    return 'https://dental.maharram.ru/';
  }

  render() {
    const description = (this.getAttribute('description') || '').trim().split(/\n\s*\n/);
    renderPreview(this.shadowRoot, [STYLESHEET, DIAGRAM_STYLESHEET], `
      <div class="preview">
        <div class="case-intro">
          <div class="case-copy">${description[0] ? `<details>${projectSummary(this.english)}<p>${esc(description.join('\n\n'))}</p></details>` : ''}</div>
          <a class="demo-link" href="${esc(this.demoUrl())}" target="_blank" rel="noopener noreferrer">${this.text('Перейти к демо', 'Open demo')}${icon('external')}</a>
        </div>
        ${projectHeading('dental', this.english)}
        ${this.projectStory()}
        <section class="crm-window" aria-label="${this.text('Зуботехническая лаборатория: интерактивный макет', 'Dental laboratory: interactive preview')}">
          <header class="app-header">
            <div class="brand"><span class="brand-symbol">${icon('dental')}</span><div><strong>${this.text('Зуботехническая лаборатория', 'Dental laboratory')}</strong><small>${this.text('Операционный кабинет лаборатории', 'Laboratory operations workspace')}</small></div></div>
            <div class="header-tools"><span>${icon('users')}${this.text('Клиенты', 'Clients')}</span><span>${icon('report')}${this.text('Отчеты', 'Reports')}</span><b class="demo-mark">DEMO</b></div>
          </header>
          <div class="app-body">
            <aside class="sidebar">
              <div class="nav-list" role="tablist" aria-label="${this.text('Страницы CRM', 'CRM pages')}" aria-orientation="vertical">
                ${PAGES.map((page, index) => `<button class="nav-button" type="button" role="tab" id="tab-${page.id}" aria-controls="crm-page" data-page="${index}" title="${this.local(page.name)}" aria-selected="${index === this.index}" tabindex="${index === this.index ? 0 : -1}">${icon(page.icon)}<span><strong>${this.local(page.name)}</strong><small>${this.local(page.hint)}</small></span></button>`).join('')}
              </div>
              <div class="profile"><span class="avatar">${this.text('ДЛ', 'DL')}</span><div><strong>${this.text('Демо пользователь', 'Demo user')}</strong><small>${this.text('Администратор', 'Administrator')}</small></div></div>
            </aside>
            <div class="workspace"><section class="scene" id="crm-page" role="tabpanel" tabindex="0"></section></div>
          </div>
          <div class="viewer-controls">
            <span class="scene-count"><strong data-counter></strong> / 05</span>
            <div class="scene-track">${PAGES.map((page, index) => `<button type="button" class="scene-marker" data-page="${index}" aria-label="${this.local(page.name)}" title="${this.local(page.name)}"></button>`).join('')}</div>
            <button class="icon-button" type="button" data-action="previous" title="${this.text('Предыдущая страница', 'Previous page')}" aria-label="${this.text('Предыдущая страница CRM', 'Previous CRM page')}">${icon('left')}</button>
            <button class="icon-button play-toggle" type="button" data-action="play"></button>
            <button class="icon-button" type="button" data-action="next" title="${this.text('Следующая страница', 'Next page')}" aria-label="${this.text('Следующая страница CRM', 'Next CRM page')}">${icon('right')}</button>
          </div>
        </section>
      </div>`, this.english);
    this.renderScene(false);
    this.updatePlayButton();
  }

  projectStory() {
    const stages = [
      ['files', 'Заказ', 'Order', 'Наряд клиники', 'Clinic order', 'Конструкция, заказчик и срок', 'Restoration, client and deadline'],
      ['briefcase', 'Производство', 'Production', 'Этапы работы', 'Production stages', 'Исполнители, сроки и материалы', 'Technicians, deadlines and materials'],
      ['users', 'Обновление', 'Updates', 'Чат-бот сотрудника', 'Staff chatbot', 'Изменение статуса прямо из чата', 'Job status updates directly from chat'],
      ['receipt', 'Контроль', 'Control', 'Оплаты и сводка', 'Payments and overview', 'Расчеты с клиниками и показатели лаборатории', 'Clinic balances and laboratory metrics'],
    ];
    return `<ol class="project-story" aria-label="${this.text('Цикл работы зуботехнической лаборатории', 'Dental laboratory workflow')}">${stages.map(([glyph,ru,en,titleRu,titleEn,copyRu,copyEn],index) => `<li class="story-step" data-story-step="${index}"><span class="story-icon">${icon(glyph)}</span><div><span class="story-label">${this.text(ru,en)}</span><strong>${this.text(titleRu,titleEn)}</strong><p>${this.text(copyRu,copyEn)}</p></div>${index < stages.length - 1 ? `<span class="story-connector" aria-hidden="true"><i></i>${icon('right')}</span>` : ''}</li>`).join('')}</ol>`;
  }

  title() {
    const page = PAGES[this.index];
    return `<div class="page-title"><div><h3>${this.local(page.name)}</h3><p>${this.local(page.intro)}</p></div><span class="period">${icon('calendar')}${this.text('Октябрь 2026', 'October 2026')}</span></div>`;
  }

  stat(label, value, hint, name, warm = false) {
    const numeric = typeof value === 'number';
    return `<div class="stat${warm ? ' warm' : ''}"><div class="stat-label"><span>${label}</span>${icon(name)}</div><strong class="stat-value"${numeric ? ` data-value="${value}"` : ''}>${value}</strong><small>${hint}</small></div>`;
  }

  badge(status) {
    const values = {
      process: [this.text('В работе', 'In progress'), 'blue'],
      ready: [this.text('Готово', 'Ready'), ''],
      new: [this.text('Новый', 'New'), 'gray'],
      paid: [this.text('Оплачено', 'Paid'), ''],
      partial: [this.text('Частично', 'Partial'), 'amber'],
    };
    const [label, color] = values[status];
    return `<span class="status ${color}">${label}</span>`;
  }

  dashboard() {
    const stats = [
      this.stat(this.text('Наряды', 'Orders'), 32, this.text('18 в работе сейчас', '18 currently in progress'), 'files'),
      this.stat(this.text('Просрочено', 'Overdue'), 2, this.text('Требуют внимания', 'Need attention'), 'alert', true),
      this.stat(this.text('Выручка', 'Revenue'), this.money(486400), this.text('За текущий месяц', 'This month'), 'receipt'),
      this.stat(this.text('К оплате', 'Outstanding'), this.money(42800), this.text('По открытым нарядам', 'Open orders'), 'coin'),
    ].join('');
    const bars = [39, 54, 47, 72, 59, 89, 68];
    const days = this.english ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    return `${this.title()}<div class="stats">${stats}</div><div class="overview"><div><h4 class="section-title">${this.text('Производство за неделю', 'Weekly production')}<small>${this.text('Выполненные работы', 'Completed jobs')}</small></h4><div class="chart">${bars.map((value, index) => `<div class="chart-column"><div class="chart-bar" style="--bar:${value}%;--delay:${index * 65}ms"></div><span>${days[index]}</span></div>`).join('')}</div></div><div class="activity-list"><h4 class="section-title">${this.text('Последние наряды', 'Recent orders')}<small>${this.text('Сегодня', 'Today')}</small></h4>${ORDERS.slice(0, 3).map(order => `<div class="activity"><div><strong>${order.number}</strong><small>${this.local(order.clinic)}</small></div>${this.badge(order.status)}</div>`).join('')}</div></div>`;
  }

  toolbar() {
    return `<div class="toolbar"><label class="search">${icon('search')}<input type="search" aria-label="${this.text('Поиск по макету CRM', 'Search CRM preview')}" placeholder="${this.text('Поиск по номеру или клинике', 'Search number or clinic')}"></label><select aria-label="${this.text('Статус наряда', 'Order status')}"><option value="">${this.text('Все статусы', 'All statuses')}</option><option value="process">${this.text('В работе', 'In progress')}</option><option value="ready">${this.text('Готово', 'Ready')}</option><option value="new">${this.text('Новые', 'New')}</option></select></div>`;
  }

  orderRows(works = false) {
    return ORDERS.map((order, index) => `<tr class="demo-row" data-order="${index}" data-status="${order.status}"><td><button type="button" class="order-link" aria-label="${this.text('Открыть наряд', 'Open order')} ${order.number}">${order.number}</button><small>${this.local(order.clinic)}</small></td><td>${this.local(order.item)}</td>${works ? `<td><div class="job-progress"><i><b style="--progress:${order.progress}%"></b></i><span>${order.progress}%</span></div></td>` : `<td>${this.local(order.doctor)}</td>`}<td>${this.badge(order.status)}</td><td class="amount">${works ? order.due : this.money(order.amount)}</td></tr>`).join('') + `<tr class="empty-row" hidden><td colspan="5">${this.text('Ничего не найдено', 'No matching records')}</td></tr>`;
  }

  orders(works = false) {
    const steps = [this.text('Моделирование', 'Modelling'), this.text('Фрезеровка', 'Milling'), this.text('Обжиг', 'Firing'), this.text('Контроль', 'Quality check')];
    const flow = works ? `<div class="production-flow">${steps.map((step, index) => `<div class="production-step${index === 1 ? ' active' : ''}"><small>0${index + 1}</small><strong>${step}</strong></div>`).join('')}</div>` : '';
    return `${this.title()}${flow}${this.toolbar()}<div class="table-wrap"><table><thead><tr><th>${this.text('Наряд / Заказчик', 'Order / Client')}</th><th>${this.text('Работа', 'Restoration')}</th><th>${works ? this.text('Готовность', 'Progress') : this.text('Врач', 'Doctor')}</th><th>${this.text('Статус', 'Status')}</th><th class="amount">${works ? this.text('Срок', 'Due') : this.text('Стоимость', 'Amount')}</th></tr></thead><tbody>${this.orderRows(works)}</tbody></table></div><div class="table-meta"><span data-result-count>${this.text('Всего записей: 4', '4 records')}</span><span>01 — 04</span></div>`;
  }

  payments() {
    const stats = `<div class="stats">${this.stat(this.text('Начислено', 'Invoiced'), this.money(486400), this.text('За текущий месяц', 'This month'), 'receipt')}${this.stat(this.text('Оплачено', 'Paid'), this.money(443600), this.text('Поступило от клиник', 'Received from clinics'), 'check')}${this.stat(this.text('К оплате', 'Outstanding'), this.money(42800), this.text('Остаток задолженности', 'Balance due'), 'coin')}${this.stat(this.text('Документы', 'Documents'), 24, this.text('Платежи за месяц', 'Payments this month'), 'files')}</div>`;
    const rows = ORDERS.map((order, index) => `<tr><td><strong>ПД-00${187 - index}</strong><small>01.10.2026</small></td><td>${this.local(order.clinic)}</td><td>${order.number}</td><td>${this.badge(index === 2 ? 'partial' : 'paid')}</td><td class="amount">${this.money([12500, 42000, 20000, 9500][index])}</td></tr>`).join('');
    return `${this.title()}${stats}<h4 class="section-title" style="margin-top:22px">${this.text('Платежные документы', 'Payment documents')}</h4><div class="table-wrap"><table><thead><tr><th>${this.text('Документ', 'Document')}</th><th>${this.text('Заказчик', 'Client')}</th><th>${this.text('Наряд', 'Order')}</th><th>${this.text('Оплата', 'Payment')}</th><th class="amount">${this.text('Сумма', 'Amount')}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  materials() {
    const rows = MATERIALS.map(item => `<tr><td><strong>${this.local(item.name)}</strong><small>${this.local(item.category)}</small></td><td>${item.stock} ${this.local(item.unit)}</td><td>${item.reserved} ${this.local(item.unit)}</td><td><div class="stock-level${item.level < 20 ? ' low' : ''}"><i><b style="--stock:${item.level}%"></b></i>${item.level < 20 ? `<span class="status amber">${this.text('Заказать', 'Low stock')}</span>` : `<span class="status">${this.text('В наличии', 'In stock')}</span>`}</div></td></tr>`).join('');
    return `${this.title()}<div class="stats">${this.stat(this.text('Позиции', 'Items'), 48, this.text('В складском учете', 'Tracked in inventory'), 'flask')}${this.stat(this.text('В резерве', 'Reserved'), 12, this.text('Для текущих работ', 'For ongoing work'), 'files')}${this.stat(this.text('Мало на складе', 'Low stock'), 3, this.text('Пора пополнить', 'Ready to reorder'), 'alert', true)}${this.stat(this.text('Расход', 'Consumption'), this.money(27400), this.text('За текущий месяц', 'This month'), 'coin')}</div><h4 class="section-title" style="margin-top:22px">${this.text('Материалы на складе', 'Inventory')}</h4><div class="table-wrap"><table><thead><tr><th>${this.text('Материал', 'Material')}</th><th>${this.text('Остаток', 'Stock')}</th><th>${this.text('Резерв', 'Reserved')}</th><th>${this.text('Наличие', 'Availability')}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  detail(orderIndex = 0) {
    const order = ORDERS[orderIndex];
    return `<aside class="detail-panel" aria-hidden="true" inert><div class="detail-top"><strong>${this.text('Наряд', 'Order')} ${order.number}</strong><button type="button" class="icon-button" data-action="close" title="${this.text('Закрыть карточку', 'Close details')}" aria-label="${this.text('Закрыть карточку наряда', 'Close order details')}">${icon('close')}</button></div><p>${this.local(order.clinic)} · ${this.local(order.item)}</p><div class="tooth-formula" aria-label="${this.text('Зубная формула', 'Tooth chart')}">${[18,17,16,15,14,13,12,11].map(tooth => `<span class="${[16,15].includes(tooth) ? 'chosen' : ''}">${tooth}</span>`).join('')}</div><div class="detail-line"><span>${this.text('Статус', 'Status')}</span>${this.badge(order.status)}</div><div class="detail-line"><span>${this.text('Стоимость', 'Amount')}</span><strong>${this.money(order.amount)}</strong></div></aside>`;
  }

  renderScene(animate = true) {
    const scene = this.shadowRoot.querySelector('.scene');
    const workspace = this.shadowRoot.querySelector('.workspace');
    this.manualDetail = null;
    workspace.dataset.detail = 'hidden';
    workspace.querySelectorAll('.detail-panel, .toast').forEach(element => element.remove());
    const page = PAGES[this.index];
    scene.setAttribute('aria-labelledby', `tab-${page.id}`);
    scene.dataset.page = page.id;
    scene.innerHTML = this.index === 0 ? this.dashboard() : this.index === 1 ? this.orders() : this.index === 2 ? this.orders(true) : this.index === 3 ? this.payments() : this.materials();
    scene.scrollTop = 0;
    if (this.index === 1 || this.index === 2) workspace.insertAdjacentHTML('beforeend', this.detail());
    if (this.index === 3) workspace.insertAdjacentHTML('beforeend', `<div class="toast" role="status" aria-hidden="true">${icon('check')}${this.text('Оплата зачислена', 'Payment received')} · ${this.money(12500)}</div>`);
    if (animate && !this.motion.matches) {
      scene.getAnimations().forEach(animation => animation.cancel());
      scene.animate([{ opacity: .2, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
    this.shadowRoot.querySelectorAll('.nav-button').forEach((button, index) => {
      button.setAttribute('aria-selected', String(index === this.index));
      button.tabIndex = index === this.index ? 0 : -1;
    });
    this.shadowRoot.querySelectorAll('.scene-marker').forEach((button, index) => {
      button.classList.toggle('current', index === this.index);
      button.classList.toggle('passed', index < this.index);
      button.setAttribute('aria-current', index === this.index ? 'true' : 'false');
    });
    this.shadowRoot.querySelector('[data-counter]').textContent = String(this.index + 1).padStart(2, '0');
    this.style.setProperty('--elapsed', String(this.elapsed / STEP_MS));
  }

  select(index, manual = false) {
    this.index = (index + PAGES.length) % PAGES.length;
    this.elapsed = 0;
    if (manual) this.setPlaying(false);
    this.renderScene();
  }

  onClick(event) {
    const page = event.target.closest('button[data-page]');
    if (page) return this.select(Number(page.dataset.page), true);
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'play') return this.setPlaying(!this.requestedPlay);
    if (action === 'next') return this.select(this.index + 1, true);
    if (action === 'previous') return this.select(this.index - 1, true);
    if (action === 'close') {
      this.manualDetail = false;
      this.setDetail(false);
      return;
    }
    const row = event.target.closest('[data-order]');
    if (row) {
      this.setPlaying(false);
      const workspace = this.shadowRoot.querySelector('.workspace');
      workspace.querySelector('.detail-panel')?.remove();
      workspace.insertAdjacentHTML('beforeend', this.detail(Number(row.dataset.order)));
      this.setDetail(true);
      this.manualDetail = true;
      this.shadowRoot.querySelectorAll('[data-order]').forEach(item => item.classList.toggle('selected', item === row));
    }
  }

  onKey(event) {
    const page = event.target.closest('.nav-button');
    if (!page || !['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? PAGES.length - 1 : this.index + (['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1);
    this.select(index, true);
    this.shadowRoot.querySelectorAll('.nav-button')[this.index].focus();
  }

  filterRows() {
    const scene = this.shadowRoot.querySelector('.scene');
    const query = scene.querySelector('input')?.value.trim().toLocaleLowerCase() || '';
    const status = scene.querySelector('select')?.value || '';
    let count = 0;
    scene.querySelectorAll('[data-order]').forEach(row => {
      row.hidden = !(row.textContent.toLocaleLowerCase().includes(query) && (!status || row.dataset.status === status));
      if (!row.hidden) count++;
    });
    const counter = scene.querySelector('[data-result-count]');
    if (counter) counter.textContent = this.text(`Всего записей: ${count}`, `${count} records`);
    const empty = scene.querySelector('.empty-row');
    if (empty) empty.hidden = count !== 0;
    this.manualDetail = false;
    this.setDetail(false);
  }

  setDetail(visible) {
    const workspace = this.shadowRoot.querySelector('.workspace');
    workspace.dataset.detail = visible ? 'visible' : 'hidden';
    const panel = workspace.querySelector('.detail-panel');
    if (panel) {
      panel.inert = !visible;
      panel.setAttribute('aria-hidden', String(!visible));
    }
    workspace.querySelector('.toast')?.setAttribute('aria-hidden', String(!visible));
  }

  setPlaying(value) {
    this.requestedPlay = value;
    this.updatePlayButton();
    this.syncClock();
  }

  updatePlayButton() {
    const button = this.shadowRoot.querySelector('.play-toggle');
    const label = this.requestedPlay ? this.text('Приостановить анимацию CRM', 'Pause CRM animation') : this.text('Продолжить анимацию CRM', 'Play CRM animation');
    button.innerHTML = icon(this.requestedPlay ? 'pause' : 'play');
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(this.requestedPlay));
    button.title = label;
  }

  syncClock() {
    const running = this.isConnected && this.requestedPlay && this.visible && !document.hidden && !this.shadowRoot.querySelector('[data-preview-content][hidden]');
    this.dataset.playing = String(running);
    if (running === this.running) return;
    this.running = running;
    cancelAnimationFrame(this.frame);
    if (running) {
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  tick(now) {
    if (!this.running) return;
    this.elapsed += Math.min(now - this.lastTime, 100);
    this.lastTime = now;
    if (this.elapsed >= STEP_MS) this.select(this.index + 1);
    this.style.setProperty('--elapsed', String(this.elapsed / STEP_MS));
    if (this.manualDetail === null && this.index > 0 && this.index < 4) {
      this.setDetail(this.elapsed > 2400);
      this.shadowRoot.querySelector('[data-order="0"]')?.classList.toggle('selected', this.elapsed > 2400);
    }
    const progress = Math.min(this.elapsed / 900, 1);
    this.shadowRoot.querySelectorAll('[data-value]').forEach(element => {
      const value = Number(element.dataset.value);
      element.textContent = String(Math.round(value * (1 - (1 - progress) ** 3)));
    });
    this.frame = requestAnimationFrame(this.tick);
  }
}

if (!customElements.get('dental-crm-preview')) customElements.define('dental-crm-preview', DentalCrmPreview);
