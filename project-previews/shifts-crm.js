import { ICONS } from './shifts-icons.js';

const STYLESHEET = new URL('./shifts-crm.css', import.meta.url).href;
const STEP_MS = 6500;
const PAGES = [
  ['schedule', 'График бригады', 'Crew schedule', 'calendar'],
  ['directory', 'Справочники', 'Directories', 'users'],
  ['search', 'Поиск', 'Search', 'search'],
  ['vacations', 'Отпуска', 'Vacations', 'sun'],
  ['archive', 'Архив', 'Archive', 'archive'],
  ['audit', 'Журнал действий', 'Activity log', 'history'],
];
const EMPLOYEES = [
  ['Никитин Павел', 'Pavel Nikitin', 'Павел Н', 'PN', 'Бригадир', 'Crew leader', 1],
  ['Волков Игорь', 'Igor Volkov', 'Игорь В', 'IV', 'Техник', 'Technician', 1],
  ['Орлов Денис', 'Denis Orlov', 'Орлов Д.', 'DO', 'Техник', 'Technician', 1],
  ['Крылов Сергей', 'Sergey Krylov', 'Сергей К', 'SK', 'Бригадир', 'Crew leader', 4],
  ['Романов Михаил', 'Mikhail Romanov', 'Романов М.', 'MR', 'Техник', 'Technician', 3],
  ['Соколов Максим', 'Maxim Sokolov', 'Максим С', 'MS', 'Менеджер', 'Manager', 0],
  ['Фомин Олег', 'Oleg Fomin', 'Олег Ф', 'OF', 'Бригадир', 'Crew leader', 3],
  ['Белова Анна', 'Anna Belova', 'Анна Б', 'AB', 'Менеджер', 'Manager', 0],
];
const JOBS = [
  { crew: 1, leader: 0, partner: 1, day: 30, time: '23:00', hours: 6, site: ['ГРИЛЬ · ТЦ СЕВЕРНЫЙ ПАРК', 'GRILL · NORTH PARK'], address: ['ул. Примерная, 12к2', '12 Example Street'], task: ['Осмотр вентиляции, доступ к оборудованию', 'Ventilation inspection and equipment access'], contact: ['Марина', 'Marina'] },
  { crew: 1, leader: 0, partner: 2, day: 29, time: '22:30', hours: 4, site: ['АЗИЯ КАФЕ · ТЦ ГОРИЗОНТ', 'ASIA CAFE · HORIZON MALL'], address: ['г. Новоград, ул. Учебная, 24/3', 'Novograd, 24 Training Street'], task: ['Очистка зонтов и воздуховодов', 'Hood and air duct cleaning'], contact: ['Вадим', 'Vadim'] },
  { crew: 1, leader: 0, partner: 1, day: 28, time: '21:00', hours: 7, site: ['ЛАПША ВОК · ЧК ДЕНИС Л.', 'NOODLE WOK · DENIS L.'], address: ['ул. Демонстрационная, 8', '8 Demo Street'], task: ['Плановое обслуживание системы', 'Scheduled system maintenance'], contact: ['Денис', 'Denis'] },
  { crew: 2, leader: 0, partner: 2, day: 28, time: '20:00', hours: 5, site: ['АЗИЯ КАФЕ · ТЦ ГОРИЗОНТ', 'ASIA CAFE · HORIZON MALL'], address: ['г. Новоград, ул. Учебная, 24/3', 'Novograd, 24 Training Street'], task: ['Проверка вентиляции кухни', 'Kitchen ventilation check'], contact: ['Вадим', 'Vadim'] },
  { crew: 3, leader: 6, partner: 4, day: 28, time: '22:00', hours: 6, site: ['КАФЕ МАЯК', 'BEACON CAFE'], address: ['ул. Тестовая, 15', '15 Test Street'], task: ['Обслуживание вытяжной системы', 'Exhaust system maintenance'], contact: ['Анна', 'Anna'] },
  { crew: 4, leader: 3, partner: 4, day: 28, time: '19:00', hours: 4, site: ['РЕСТОРАН СЕВЕР', 'NORTH RESTAURANT'], address: ['ул. Макетная, 5', '5 Sample Street'], task: ['Диагностика оборудования', 'Equipment diagnostics'], contact: ['Игорь', 'Igor'] },
];
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const icon = name => ICONS[name] || '';
const matching = (value, query) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
const csvCell = value => `"${String(value).replaceAll('"', '""')}"`;

class ShiftsCrmPreview extends HTMLElement {
  static observedAttributes = ['locale', 'description', 'demo-url'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.index = 0;
    this.crew = 1;
    this.accessRole = 'manager';
    this.year = 2026;
    this.elapsed = 0;
    this.visible = false;
    this.running = false;
    this.requestedPlay = false;
    this.extraLeave = false;
    this.tick = this.tick.bind(this);
  }

  get english() { return this.getAttribute('locale') === 'en'; }
  text(ru, en) { return this.english ? en : ru; }
  local(pair) { return pair[this.english ? 1 : 0]; }
  name(index, short = false) { return EMPLOYEES[index][(short ? 2 : 0) + (this.english ? 1 : 0)]; }
  get allowed() { return this.accessRole === 'employee' ? [0, 3] : PAGES.map((_, index) => index); }
  get jobs() { return JOBS.filter(job => this.accessRole === 'employee' ? job.partner === 1 : job.crew === this.crew); }

  connectedCallback() {
    this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.requestedPlay = !this.motion.matches;
    this.shadowRoot.addEventListener('click', event => this.onClick(event), options);
    this.shadowRoot.addEventListener('keydown', event => this.onKey(event), options);
    this.shadowRoot.addEventListener('input', event => {
      if (event.target.matches('[data-filter]')) { this.setPlaying(false); this.filterRows(event.target); }
    }, options);
    this.shadowRoot.addEventListener('submit', event => {
      event.preventDefault();
      this.setPlaying(false);
      this.filterRows(event.target.querySelector('[data-filter]'));
    }, options);
    this.shadowRoot.addEventListener('change', event => {
      if (event.target.matches('[data-role]')) {
        this.accessRole = event.target.value;
        this.index = 0;
        this.elapsed = 0;
        this.setPlaying(false);
        this.render();
      }
      if (event.target.matches('[data-crew]')) { this.crew = Number(event.target.value); this.select(0, true); }
    }, options);
    this.motion.addEventListener('change', () => { if (this.motion.matches) this.setPlaying(false); }, options);
    document.addEventListener('visibilitychange', () => this.syncClock(), options);
    this.render();
    this.observer = new IntersectionObserver(entries => {
      this.visible = entries[0].isIntersecting;
      this.syncClock();
    }, { threshold: .12 });
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.abort?.abort();
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    this.running = false;
  }

  attributeChangedCallback(name, oldValue, value) {
    if (oldValue !== value && this.isConnected && this.abort) this.render();
  }

  demoUrl() {
    try {
      const url = new URL(this.getAttribute('demo-url') || 'https://shifts.maharram.ru/');
      return ['https:', 'http:'].includes(url.protocol) ? url.href : 'https://shifts.maharram.ru/';
    } catch { return 'https://shifts.maharram.ru/'; }
  }

  render() {
    const description = (this.getAttribute('description') || '').trim().split(/\n\s*\n/);
    this.shadowRoot.innerHTML = `<link rel="stylesheet" href="${STYLESHEET}"><div class="preview">
      <section class="app-window" aria-label="${this.text('График: интерактивный макет CRM', 'Schedule: interactive CRM preview')}">
        <header class="app-header"><strong class="brand">${icon('calendar')}${this.text('график', 'schedule')}</strong><span class="app-caption">${this.text('Учет работы бригад', 'Crew scheduling')}</span><span class="demo-badge">DEMO</span><label class="role-select">${icon('user')}<select data-role aria-label="${this.text('Роль пользователя', 'User role')}"><option value="manager"${this.accessRole === 'manager' ? ' selected' : ''}>${this.text('Менеджер', 'Manager')}</option><option value="employee"${this.accessRole === 'employee' ? ' selected' : ''}>${this.text('Сотрудник · Игорь В', 'Employee · Igor V')}</option></select></label></header>
        <nav class="app-nav" role="tablist" aria-label="${this.text('Страницы графика работ', 'Work schedule pages')}">${PAGES.map(([id, ru, en, glyph], index) => this.allowed.includes(index) ? `<button type="button" role="tab" id="shifts-${id}" class="page-tab" data-page="${index}" aria-controls="shifts-panel">${icon(glyph)}<span>${index === 0 && this.accessRole === 'employee' ? this.text('Мой график', 'My schedule') : this.text(ru, en)}</span></button>` : '').join('')}</nav>
        <div class="workspace"><div class="scene" id="shifts-panel" role="tabpanel"></div></div>
        <footer class="app-footer"><span>${icon('check')}${this.text('Демонстрационные данные', 'Sample data')}</span><span data-page-title></span></footer>
      </section>
      <div class="playback"><span class="page-counter" data-counter></span><div class="markers">${this.allowed.map(index => `<button type="button" data-page="${index}" class="marker" aria-label="${this.text(PAGES[index][1], PAGES[index][2])}" title="${this.text(PAGES[index][1], PAGES[index][2])}"></button>`).join('')}</div><div class="progress"><i></i></div><button type="button" class="icon-button" data-action="previous" aria-label="${this.text('Предыдущая страница графика', 'Previous schedule page')}" title="${this.text('Предыдущая страница', 'Previous page')}">${icon('left')}</button><button type="button" class="icon-button play-toggle" data-action="play"></button><button type="button" class="icon-button" data-action="next" aria-label="${this.text('Следующая страница графика', 'Next schedule page')}" title="${this.text('Следующая страница', 'Next page')}">${icon('right')}</button></div>
      <div class="case-footer"><div class="case-copy"><p>${esc(description[0] || '')}</p>${description.length > 1 ? `<details><summary>${this.text('Подробнее о проекте', 'More about the project')}${icon('down')}</summary><p>${esc(description.slice(1).join('\n\n'))}</p></details>` : ''}</div><a class="demo-link" href="${esc(this.demoUrl())}" target="_blank" rel="noopener noreferrer">${this.text('Перейти к демо', 'Open demo')}${icon('external')}</a></div>
    </div>`;
    this.renderScene(false);
    this.updatePlayButton();
  }

  heading(title, subtitle, actions = '') {
    return `<div class="page-heading"><div><h3>${title}</h3><p>${subtitle}</p></div><div class="page-actions">${actions}</div></div>`;
  }

  schedule() {
    const personal = this.accessRole === 'employee';
    const heading = this.heading(personal ? this.text('Мой график', 'My schedule') : this.text('График бригады', 'Crew schedule'), `${this.text('Сентябрь', 'September')} ${this.year}`, `<button type="button" class="small-icon" data-action="export" title="${this.text('Скачать график CSV', 'Download schedule CSV')}" aria-label="${this.text('Скачать график CSV', 'Download schedule CSV')}">${icon('download')}</button>`);
    const crews = personal ? `<div class="personal-band">${icon('user')}<div><strong>${this.name(1)}</strong><small>${this.text('Только мои смены и задания', 'My shifts and tasks only')}</small></div><span class="status-pill">${this.text('Техник', 'Technician')}</span></div>` : `<div class="crew-overview">${[1,2,3,4].map(crew => {
      const job = JOBS.find(item => item.crew === crew);
      return `<button type="button" class="crew-mini${this.crew === crew ? ' selected' : ''}" data-crew-choice="${crew}" aria-pressed="${this.crew === crew}"><strong>${this.text('Б', 'C')}${crew}<span>28–30.09</span></strong><span class="mini-columns"><i>${this.text('Дата', 'Date')}</i><i>${this.text('Бригадир', 'Leader')}</i><i>${this.text('Напарник', 'Partner')}</i></span><span class="mini-row"><i>30.09</i><i>${crew === 1 ? this.name(job.leader, true) : '—'}</i><i>${crew === 1 ? this.name(job.partner, true) : '—'}</i></span><span class="mini-row"><i>28.09</i><i>${this.name(job.leader, true)}</i><i>${this.name(job.partner, true)}</i></span></button>`;
    }).join('')}</div>`;
    const first = this.jobs[0];
    const band = personal ? '' : `<div class="crew-band"><label class="crew-pick"><small>${this.text('Бригада', 'Crew')}</small><select data-crew aria-label="${this.text('Бригада', 'Crew')}">${[1,2,3,4].map(i => `<option value="${i}"${i === this.crew ? ' selected' : ''}>${this.text('Бригада', 'Crew')} ${i}</option>`).join('')}</select></label><div class="leader-cell"><small>${this.text('Бригадир', 'Crew leader')}</small><strong>${this.name(first.leader, true)}</strong></div><div class="partner-cell"><small>${this.text('Осн. напарник', 'Main partner')}</small><strong>${this.name(first.partner, true)}</strong></div><div class="extra-cell"><small>${this.text('Доп. напарник №1', 'Additional partner')}</small><strong>${this.crew === 1 ? this.name(2, true) : '—'}</strong></div><div class="hours-cell"><small>${this.text('Часов за месяц', 'Monthly hours')}</small><strong>${this.crew === 1 ? '120,95' : '96,00'} ${this.text('ч', 'h')}</strong></div></div>`;
    return heading + crews + band + `<div class="table-caption"><strong>${personal ? this.text('Мои ближайшие работы', 'My upcoming jobs') : `${this.text('Б', 'C')}${this.crew} · ${this.text('Календарь работ', 'Work calendar')}`}</strong><span>${this.text('Состав смены и задачи', 'Shift members and tasks')}</span></div><div class="table-scroll"><table class="schedule-table"><thead><tr>${[this.text('Дата / время','Date / time'),this.text('Бригадир','Leader'),this.text('Осн. напарник','Main partner'),this.text('Часы','Hours'),this.text('Объект','Site'),this.text('Телефон работ','Site contact'),this.text('ТЗ на работы','Job instructions')].map((label,i) => `<th class="${i === 1 ? 'leader-cell' : i === 2 ? 'partner-cell' : ''}">${label}</th>`).join('')}</tr></thead><tbody>${this.jobs.map((job,i) => `<tr data-beat-row="${i}"><td><strong>${job.day}.09</strong><small>${job.time}</small></td><td class="leader-cell">${this.name(job.leader,true)}</td><td class="partner-cell">${this.name(job.partner,true)}</td><td>${job.hours}</td><td><strong>${this.local(job.site)}</strong><small>${this.local(job.address)}</small></td><td>${this.local(job.contact)}<small>+7 000 000-00-0${i + 1}</small></td><td>${this.local(job.task)}<small>${this.text('Вход через пост охраны. Доступ согласован.', 'Enter via security. Access confirmed.')}</small></td></tr>`).join('')}</tbody></table></div>`;
  }

  directory() {
    return this.heading(this.text('Справочники', 'Directories'), this.text('Сотрудники, бригады и роли', 'Employees, crews and roles')) + `<div class="directory-tabs"><span class="active">${this.text('Сотрудники','Employees')}</span><span>${this.text('Бригады','Crews')}</span><span>${this.text('Должности','Positions')}</span><span>${this.text('Виды работ','Job types')}</span><span>${this.text('Роли','Roles')}</span></div><div class="filter-line"><strong>${this.text('Сотрудники','Employees')}</strong><label>${icon('search')}<input data-filter placeholder="${this.text('Найти сотрудника','Find an employee')}" aria-label="${this.text('Найти сотрудника','Find an employee')}"></label><span data-result-count></span></div><div class="table-scroll"><table class="directory-table"><thead><tr>${[this.text('ФИО','Full name'),this.text('Краткое имя','Short name'),this.text('Группа','Group'),this.text('Должность','Position'),this.text('Роль учетной записи','Account role'),this.text('Состояние','Status')].map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>${EMPLOYEES.map((employee,index) => `<tr data-filter-row data-beat-row="${index}"><td>${this.name(index)}</td><td>${this.name(index,true)}</td><td>${employee[6] ? this.text('Поля','Field') : this.text('Офис','Office')}</td><td>${employee[this.english ? 5 : 4]}</td><td>${employee[6] ? this.text('Сотрудник','Employee') : this.text('Менеджер','Manager')}</td><td><span class="status-dot"></span>${this.text('Активна','Active')}</td></tr>`).join('')}<tr data-empty hidden><td colspan="6">${this.text('Ничего не найдено','No matching records')}</td></tr></tbody></table></div>`;
  }

  search() {
    return this.heading(this.text('Поиск по графикам','Search schedules'), this.text('Работы и объекты с учетом прав доступа','Jobs and sites within your access scope')) + `<form class="search-form"><label><small>${this.text('Объект или сотрудник','Site or employee')}</small><input data-filter value="${this.text('АЗИЯ','ASIA')}" aria-label="${this.text('Поиск работ','Search jobs')}"></label><button type="submit" class="primary-button">${icon('search')}${this.text('Найти','Search')}</button></form><div class="table-caption"><span data-result-count></span></div><div class="table-scroll"><table class="search-table"><thead><tr>${[this.text('Бригадир','Crew leader'),this.text('Напарник','Partner'),this.text('Часы','Hours'),this.text('Объект','Site'),this.text('Телефон работ','Site contact'),this.text('ТЗ на работы','Job instructions')].map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>${JOBS.map((job,index) => `<tr data-filter-row data-beat-row="${index}"><td>${this.name(job.leader,true)}</td><td>${this.name(job.partner,true)}</td><td>${job.hours}</td><td><strong>${this.local(job.site)}</strong><small>${this.local(job.address)}</small></td><td>${this.local(job.contact)}<small>+7 000 000-00-0${index + 1}</small></td><td>${this.local(job.task)}<small>${this.text('Парковка есть. Подписать акт у охраны.','Parking available. Sign the report with security.')}</small></td></tr>`).join('')}<tr data-empty hidden><td colspan="6">${this.text('Ничего не найдено','No matching records')}</td></tr></tbody></table></div>`;
  }

  vacations() {
    return this.heading(this.text('Отпуска','Vacations'), `${this.year} · ${this.accessRole === 'employee' ? this.name(1) : this.text('Все сотрудники','All employees')}`, `<button type="button" class="small-icon" data-action="leave" aria-label="${this.text(this.extraLeave ? 'Убрать пример отпуска' : 'Добавить пример отпуска', this.extraLeave ? 'Remove sample leave' : 'Add sample leave')}" title="${this.text('Добавить / убрать пример отпуска','Add / remove sample leave')}">${icon(this.extraLeave ? 'minus' : 'plus')}</button>`) + `<div class="calendar-tools"><span class="legend"><i></i>${this.text('Период отпуска','Vacation period')}</span><span>${this.text('Календарь','Calendar')} · 12 ${this.text('месяцев','months')}</span></div><div class="calendar-scroll"><div class="year-calendar"><div class="calendar-month calendar-head">${this.year}</div>${Array.from({length:31},(_,i)=>`<div class="calendar-head">${i+1}</div>`).join('')}${MONTHS.map((month,m) => `<div class="calendar-month"><strong>${this.english ? EN_MONTHS[m] : month}</strong><small>${new Date(Date.UTC(this.year,m+1,0)).getUTCDate()} ${this.text('дн.','days')}</small></div>${Array.from({length:31},(_,i)=> {
      const day=i+1;
      const days=new Date(Date.UTC(this.year,m+1,0)).getUTCDate();
      const weekend=new Date(Date.UTC(this.year,m,day)).getUTCDay() % 6 === 0;
      const vacation=(m===8 && day>=7 && day<=18) || (m===10 && day>=2 && day<=6 && this.extraLeave);
      return `<div class="calendar-day${day>days ? ' unavailable' : weekend ? ' weekend' : ''}${vacation ? ' leave' : ''}"${vacation ? ` title="${esc(this.name(1))} · ${day}.${String(m+1).padStart(2,'0')}"` : ''}>${vacation && (day===7 || day===2) ? `<span>${this.name(1,true)}</span>` : ''}</div>`;
    }).join('')}`).join('')}</div></div><div class="leave-summary">${icon('sun')}<strong>${this.name(1)}</strong><span>07.09.${this.year} — 18.09.${this.year}</span><span class="status-pill">12 ${this.text('дней','days')}</span></div>`;
  }

  archive() {
    return this.heading(this.text('Архив по годам','Yearly archive'), this.text('Закрытые периоды доступны для просмотра и выгрузки','Closed periods are available for viewing and export')) + `<div class="archive-list">${[2026,2025].map(year => `<article class="year-item"><span class="year-icon">${icon('archive')}</span><h4>${year}</h4><span class="status-pill${year===2025 ? ' muted' : ''}">${year===2026 ? this.text('Открыт','Open') : this.text('Закрыт','Closed')}</span><p>${year===2026 ? '4' : '3'} ${this.text('бригады','crews')} · 12 ${this.text('месяцев','months')}</p><button type="button" class="outline-button" data-open-year="${year}">${this.text('Открыть графики','Open schedules')}${icon('right')}</button><button type="button" class="archive-export" data-export-year="${year}">${icon('download')}${this.text('Графики CSV','Schedules CSV')}</button></article>`).join('')}</div>`;
  }

  audit() {
    return this.heading(this.text('Журнал действий','Activity log'), this.text('История изменений графика и состава смен','Schedule and shift membership changes')) + `<div class="table-scroll"><table class="audit-table"><thead><tr>${[this.text('Когда','When'),this.text('Пользователь','User'),this.text('Действие','Action'),this.text('Где','Where'),this.text('Изменения','Changes')].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody><tr data-beat-row="0"><td>30.09.2026<small>14:51:26</small></td><td>${this.text('Менеджер','Manager')}<small>demo</small></td><td>${this.text('Вход в систему','Signed in')}</td><td>${this.text('Пользователи','Users')}</td><td>${this.text('Вход в систему','Signed in')}</td></tr><tr data-beat-row="1"><td>29.09.2026<small>15:20:14</small></td><td>${this.text('Система','System')}</td><td>${this.text('Сохранена смена','Shift saved')}</td><td>${this.text('Бригада 1','Crew 1')}<small>30.09.2026</small></td><td><details open><summary>${this.text('Изменения (3)','Changes (3)')}</summary><div class="change-grid"><span>${this.text('Поле','Field')}</span><span>${this.text('Было','Before')}</span><span>${this.text('Стало','After')}</span><span>${this.text('Доп. напарник №1','Additional partner')}</span><span class="before">—</span><span class="after">${this.name(2,true)}</span><span>${this.text('Статус','Status')}</span><span class="before">—</span><span class="after">${this.text('Рабочий день','Workday')}</span><span>${this.text('Часы бригады','Crew hours')}</span><span class="before">4</span><span class="after">6</span></div></details></td></tr>${[28,27,26].map((day,index)=>`<tr data-beat-row="${index+2}"><td>29.09.2026<small>15:20:14</small></td><td>${this.text('Система','System')}</td><td>${this.text('Сохранена смена','Shift saved')}</td><td>${this.text('Бригада 1','Crew 1')}<small>${day}.09.2026</small></td><td><details><summary>${this.text('Изменения (2)','Changes (2)')}</summary><p>${this.text('Обновлены состав смены и время работ.','Shift members and working hours updated.')}</p></details></td></tr>`).join('')}</tbody></table></div>`;
  }

  renderScene(animate = true) {
    const scene = this.shadowRoot.querySelector('.scene');
    scene.innerHTML = this[PAGES[this.index][0]]();
    scene.scrollTop = 0;
    scene.setAttribute('aria-labelledby', `shifts-${PAGES[this.index][0]}`);
    scene.dataset.page = PAGES[this.index][0];
    this.shadowRoot.querySelectorAll('.page-tab').forEach(tab => {
      const current = Number(tab.dataset.page) === this.index;
      tab.setAttribute('aria-selected', String(current));
      tab.tabIndex = current ? 0 : -1;
    });
    this.shadowRoot.querySelectorAll('.marker').forEach(marker => marker.setAttribute('aria-current', String(Number(marker.dataset.page) === this.index)));
    this.shadowRoot.querySelector('[data-counter]').textContent = `${String(this.allowed.indexOf(this.index)+1).padStart(2,'0')} / ${String(this.allowed.length).padStart(2,'0')}`;
    this.shadowRoot.querySelector('[data-page-title]').textContent = this.text(PAGES[this.index][1], PAGES[this.index][2]);
    const filter = scene.querySelector('[data-filter]');
    if (filter) this.filterRows(filter);
    this.beat = -1;
    this.style.setProperty('--elapsed', String(this.elapsed / STEP_MS));
    if (animate && !this.motion.matches) scene.animate([{opacity:.2,transform:'translateY(7px)'},{opacity:1,transform:'none'}],{duration:380,easing:'ease-out'});
  }

  filterRows(input) {
    const rows = this.shadowRoot.querySelectorAll('[data-filter-row]');
    let count = 0;
    rows.forEach(row => { row.hidden = !matching(row.textContent, input.value); if (!row.hidden) count++; });
    this.shadowRoot.querySelector('[data-result-count]').textContent = this.text(`Найдено: ${count}`, `Found: ${count}`);
    this.shadowRoot.querySelector('[data-empty]').hidden = count !== 0;
  }

  select(index, manual = false) {
    if (!this.allowed.includes(index)) return;
    this.index = index;
    this.elapsed = 0;
    if (manual) this.setPlaying(false);
    this.renderScene();
  }

  advance(direction, manual = false) {
    const pages = this.allowed;
    this.select(pages[(pages.indexOf(this.index) + direction + pages.length) % pages.length], manual);
  }

  onKey(event) {
    if (!event.target.matches('.page-tab') || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home' || event.key === 'End') this.select(this.allowed[event.key === 'Home' ? 0 : this.allowed.length-1],true);
    else this.advance(event.key === 'ArrowRight' ? 1 : -1,true);
    this.shadowRoot.querySelector(`.page-tab[data-page="${this.index}"]`).focus();
  }

  onClick(event) {
    const page = event.target.closest('button[data-page]');
    if (page) return this.select(Number(page.dataset.page),true);
    const crew = event.target.closest('[data-crew-choice]');
    if (crew) { this.crew = Number(crew.dataset.crewChoice); return this.select(0,true); }
    const archive = event.target.closest('[data-open-year]');
    if (archive) { this.year = Number(archive.dataset.openYear); this.select(0,true); return; }
    const exportYear = event.target.closest('[data-export-year]');
    if (exportYear) return this.exportCsv(Number(exportYear.dataset.exportYear),true);
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'play') this.setPlaying(!this.requestedPlay);
    if (action === 'previous' || action === 'next') this.advance(action === 'next' ? 1 : -1,true);
    if (action === 'export') this.exportCsv(this.year);
    if (action === 'leave') { this.extraLeave = !this.extraLeave; this.select(3,true); }
    if (event.target.closest('details')) this.setPlaying(false);
  }

  exportCsv(year, all = false) {
    this.setPlaying(false);
    const rows = all && this.accessRole === 'manager' ? JOBS : this.jobs;
    const header = [this.text('Дата','Date'),this.text('Бригадир','Leader'),this.text('Напарник','Partner'),this.text('Объект','Site'),this.text('Часы','Hours')];
    const csv = [header,...rows.map(job=>[`${job.day}.09.${year}`,this.name(job.leader),this.name(job.partner),this.local(job.site),job.hours])].map(row=>row.map(csvCell).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;
    link.download=`schedule-${year}.csv`;
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  setPlaying(value) { this.requestedPlay=value; this.updatePlayButton(); this.syncClock(); }

  updatePlayButton() {
    const button=this.shadowRoot.querySelector('.play-toggle');
    const label=this.requestedPlay ? this.text('Приостановить анимацию графика','Pause schedule animation') : this.text('Продолжить анимацию графика','Play schedule animation');
    button.innerHTML=icon(this.requestedPlay ? 'pause' : 'play');
    button.setAttribute('aria-label',label);
    button.setAttribute('aria-pressed',String(this.requestedPlay));
    button.title=label;
  }

  syncClock() {
    const running=this.isConnected && this.requestedPlay && this.visible && !document.hidden;
    this.dataset.playing=String(running);
    if (running===this.running) return;
    this.running=running;
    cancelAnimationFrame(this.frame);
    if (running) { this.lastTime=performance.now(); this.frame=requestAnimationFrame(this.tick); }
  }

  tick(now) {
    if (!this.running) return;
    this.elapsed+=Math.min(now-this.lastTime,100);
    this.lastTime=now;
    if (this.elapsed>=STEP_MS) this.advance(1);
    this.style.setProperty('--elapsed',String(this.elapsed/STEP_MS));
    const beat=Math.floor(this.elapsed/1600);
    if (beat!==this.beat) {
      this.beat=beat;
      const rows=[...this.shadowRoot.querySelectorAll('[data-beat-row]')].filter(row=>!row.hidden);
      rows.forEach((row,i)=>row.classList.toggle('focus-row',i===beat % rows.length));
    }
    this.frame=requestAnimationFrame(this.tick);
  }
}

if (!customElements.get('shifts-crm-preview')) customElements.define('shifts-crm-preview',ShiftsCrmPreview);
