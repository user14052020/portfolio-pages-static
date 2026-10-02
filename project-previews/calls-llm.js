import { ICONS } from './calls-icons.js';
import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';
import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=3';

const STYLESHEET = new URL('./calls-llm.css', import.meta.url).href;
const DURATIONS = [4000, 6000, 2600, 6800];
const STAGES = [
  { icon: 'phone', name: ['Телефония', 'Telephony'], detail: ['Входящие и исходящие звонки', 'Incoming and outgoing calls'] },
  { icon: 'brain', name: ['Сервер с LLM', 'LLM server'], detail: ['Распознавание речи и анализ', 'Speech recognition and analysis'] },
  { icon: 'lock', name: ['API', 'API'], detail: ['Передача результатов', 'Transferring results'] },
  { icon: 'contact', name: ['Арбис', 'Arbis'], detail: ['Карточка клиента', 'Customer profile'] },
];
const CALLS = [
  {
    name: ['Марина Волкова', 'Marina Volkova'], company: ['Северные решения', 'North Solutions'], initials: 'МВ', duration: 324,
    subject: ['Условия поставки', 'Delivery terms'], status: ['Лид', 'Lead'], emotion: ['Интерес', 'Interest'], rating: ['Позитивно', 'Positive'],
    summary: ['Клиент уточнил стоимость и сроки поставки. Просит отправить коммерческое предложение.', 'The customer asked about pricing and delivery times and requested a quotation.'],
    tags: [['поставка', 'стоимость', 'предложение'], ['delivery', 'pricing', 'quotation']],
    transcript: ['Подскажите, сколько стоит поставка? Нам нужно получить заказ на следующей неделе. Пришлите, пожалуйста, коммерческое предложение.', 'What is the delivery cost? We need the order next week. Please send us a quotation.'],
  },
  {
    name: ['Денис Орлов', 'Denis Orlov'], company: ['Вектор Проект', 'Vector Project'], initials: 'ДО', duration: 271,
    subject: ['Демонстрация продукта', 'Product demo'], status: ['Переговоры', 'Negotiation'], emotion: ['Заинтересованность', 'Engagement'], rating: ['Позитивно', 'Positive'],
    summary: ['Клиент заинтересован в продукте. Договорились о демонстрации для команды в четверг.', 'The customer is interested in the product. A team demonstration is scheduled for Thursday.'],
    tags: [['демонстрация', 'встреча', 'команда'], ['demo', 'meeting', 'team']],
    transcript: ['Решение нам подходит. Хотелось бы посмотреть его вместе с командой. Давайте назначим демонстрацию на четверг.', 'The solution looks right for us. We would like to see it with the team. Let us schedule a demo for Thursday.'],
  },
  {
    name: ['Алексей Крылов', 'Alex Krylov'], company: ['Маяк Сервис', 'Beacon Service'], initials: 'АК', duration: 198,
    subject: ['Статус заказа', 'Order status'], status: ['Действующий клиент', 'Existing customer'], emotion: ['Беспокойство', 'Concern'], rating: ['Требует внимания', 'Needs attention'], attention: true,
    summary: ['Клиент ожидает заказ и просит уточнить дату доставки. Менеджер проверит статус и перезвонит.', 'The customer is waiting for an order and asked for a delivery date. The manager will check the status and call back.'],
    tags: [['заказ', 'доставка', 'обратный звонок'], ['order', 'delivery', 'callback']],
    transcript: ['Заказ еще не приехал. Мне важно понять точную дату доставки. Уточните, пожалуйста, статус и перезвоните сегодня.', 'The order has not arrived. I need the exact delivery date. Please check the status and call me back today.'],
  },
];
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = name => ICONS[name] || '';
const time = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

class CallsLlmPreview extends HTMLElement {
  static observedAttributes = ['locale', 'description'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.stage = 0;
    this.example = 0;
    this.elapsed = 0;
    this.visible = false;
    this.running = false;
    this.requestedPlay = false;
    this.view = 'calls';
    this.tick = this.tick.bind(this);
  }

  get english() { return this.getAttribute('locale') === 'en'; }
  text(ru, en) { return this.english ? en : ru; }
  local(pair) { return pair[this.english ? 1 : 0]; }
  get call() { return CALLS[this.example]; }

  connectedCallback() {
    this.abort = new AbortController();
    const options = { signal: this.abort.signal };
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.stage = this.motion.matches ? 3 : 0;
    this.elapsed = this.motion.matches ? DURATIONS[3] : 0;
    this.requestedPlay = !this.motion.matches;
    this.shadowRoot.addEventListener('click', event => this.onClick(event), options);
    this.shadowRoot.addEventListener('keydown', event => {
      if (!event.target.matches('[data-view]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      this.shadowRoot.querySelector(`[data-view="${event.key === 'Home' ? 'calls' : event.key === 'End' ? 'history' : this.view === 'calls' ? 'history' : 'calls'}"]`).click();
    }, options);
    this.shadowRoot.addEventListener('change', event => {
      if (!event.target.matches('[data-example]')) return;
      this.example = Number(event.target.value);
      this.selectStage(3);
      this.renderCustomer();
      this.update();
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
    }, { threshold: .12 });
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

  render() {
    renderPreview(this.shadowRoot, [STYLESHEET, DIAGRAM_STYLESHEET], `
      <div class="preview">
        <details class="case-intro">${projectSummary(this.english)}<p class="description">${esc(this.getAttribute('description') || '')}</p></details>
        ${projectHeading('calls', this.english)}
        <div class="pipeline" role="group" aria-label="${this.text('Обработка звонка', 'Call processing')}">
          ${STAGES.map((stage, index) => `<div class="stage-wrap"><button type="button" class="stage stage-${index}" data-stage="${index}" aria-label="${this.text('Этап', 'Stage')} ${index + 1}: ${this.local(stage.name)}" title="${this.local(stage.name)}"><span class="stage-icon">${icon(stage.icon)}</span><span class="stage-text"><strong>${this.local(stage.name)}</strong><small>${this.local(stage.detail)}</small></span><span class="stage-index">0${index + 1}</span><i class="stage-progress"></i></button>${index < 3 ? `<span class="connector" aria-hidden="true">${icon('arrow')}<i></i></span>` : ''}</div>`).join('')}
        </div>
        <div class="transfer-strip">
          <span class="signal-icon">${icon('audio')}</span>
          <div class="signal-copy"><strong data-status aria-live="polite"></strong><p data-transcript></p></div>
          <div class="waveform" aria-hidden="true">${Array.from({ length: 28 }, (_, index) => `<i style="--level:${18 + (index * 37 % 68)}%;--delay:${index * 45}ms"></i>`).join('')}</div>
          <span class="recording-time" data-time></span>
        </div>
        <section class="arbis-window" aria-label="${this.text('Арбис: карточка клиента', 'Arbis: customer profile')}">
          <header class="crm-header"><strong class="arbis-brand">АРБИС</strong><span>${this.text('Карточка клиента', 'Customer profile')}</span><span class="demo-mark">DEMO</span><span class="save-state" data-save></span></header>
          <div class="crm-body">
            <aside class="crm-nav" aria-label="${this.text('Навигация Арбис', 'Arbis navigation')}">${[['users', 'Клиенты', 'Clients'], ['phone', 'Звонки', 'Calls'], ['tasks', 'Задачи', 'Tasks'], ['files', 'Документы', 'Documents'], ['chart', 'Отчеты', 'Reports']].map(([name, ru, en], index) => `<span class="${index === 0 ? 'selected' : ''}" title="${this.text(ru, en)}">${icon(name)}<small>${this.text(ru, en)}</small></span>`).join('')}</aside>
            <div class="customer" data-customer></div>
            <aside class="call-detail"><div class="detail-heading"><span>${icon('brain')}${this.text('Разметка (LLM)', 'LLM analysis')}</span><small data-analysis-state></small></div><dl>${[['subject','Тема','Topic'], ['status','Статус','Status'], ['emotion','Эмоция','Emotion']].map(([key, ru, en], index) => `<div class="field" data-field-row="${index}"><dt>${this.text(ru, en)}</dt><dd data-field="${key}"></dd></div>`).join('')}</dl><div class="summary-block" data-field-row="3"><h4>${this.text('Суть разговора', 'Call summary')}</h4><p data-field="summary"></p></div><div class="tags-block" data-field-row="4"><h4>${this.text('Теги', 'Tags')}</h4><div data-field="tags"></div></div><div class="rating-line" data-field-row="5"><span>${this.text('Оценка', 'Assessment')}</span><strong data-field="rating"></strong></div></aside>
          </div>
          <footer class="crm-footer"><span class="api-state" data-api></span><span>${this.text('Демонстрационные данные', 'Sample data')}</span></footer>
        </section>
        <div class="playback-controls"><label class="scenario-select"><span>${this.text('Звонок', 'Call')}</span><select data-example aria-label="${this.text('Пример звонка', 'Call example')}">${CALLS.map((call, index) => `<option value="${index}"${index === this.example ? ' selected' : ''}>${this.local(call.subject)}</option>`).join('')}</select></label><span class="step-counter" data-counter></span><div class="progress-track"><i></i></div><button type="button" class="icon-button" data-action="replay" title="${this.text('Повторить', 'Replay')}" aria-label="${this.text('Повторить обработку звонка', 'Replay call processing')}">${icon('replay')}</button><button type="button" class="icon-button play-toggle" data-action="play"></button></div>
      </div>`, this.english);
    this.renderCustomer();
    this.update();
    this.updatePlayButton();
  }

  renderCustomer() {
    const call = this.call;
    this.shadowRoot.querySelector('[data-customer]').innerHTML = `<div class="profile"><span class="avatar">${this.english ? ['MV', 'DO', 'AK'][this.example] : call.initials}</span><div><h3>${this.local(call.name)}</h3><p>${this.local(call.company)} <span>·</span> +7 000 000-00-0${this.example + 1}</p><small>${this.text('Активный клиент', 'Active customer')}</small></div></div><div class="customer-tabs" role="tablist" aria-label="${this.text('Разделы карточки клиента', 'Customer profile sections')}"><button type="button" role="tab" aria-selected="${this.view === 'calls'}" aria-controls="customer-panel" id="calls-tab" data-view="calls">${this.text('Звонки', 'Calls')}</button><button type="button" role="tab" aria-selected="${this.view === 'history'}" aria-controls="customer-panel" id="history-tab" data-view="history">${this.text('История', 'History')}</button></div><div class="customer-panel" id="customer-panel" role="tabpanel" aria-labelledby="${this.view}-tab"><div class="table-wrap"${this.view === 'calls' ? '' : ' hidden'}><table><thead><tr><th>${this.text('Дата и время', 'Date and time')}</th><th>${this.text('Тип', 'Type')}</th><th>${this.text('Длительность', 'Duration')}</th><th>${this.text('Разметка (LLM)', 'LLM analysis')}</th></tr></thead><tbody><tr class="new-call"><td>01.10.2026<small>10:24</small></td><td>${this.text('Входящий', 'Incoming')}</td><td>${time(call.duration)}</td><td data-call-tags></td></tr><tr><td>30.09.2026<small>14:10</small></td><td>${this.text('Исходящий', 'Outgoing')}</td><td>04:12</td><td><span class="tag muted">${this.text('Презентация', 'Presentation')}</span></td></tr><tr><td>29.09.2026<small>11:02</small></td><td>${this.text('Входящий', 'Incoming')}</td><td>03:18</td><td><span class="tag muted">${this.text('Консультация', 'Consultation')}</span></td></tr></tbody></table></div><ol class="history-list"${this.view === 'history' ? '' : ' hidden'}>${STAGES.map((stage, index) => `<li data-event="${index}"><span>${icon(index === 3 ? 'contact' : stage.icon)}</span><div><strong>${this.local(stage.name)}</strong><p>${this.local(stage.detail)}</p></div><b>${icon('check')}</b></li>`).join('')}</ol></div>`;
    this.signature = '';
  }

  analysisCount() {
    if (this.stage < 1) return 0;
    if (this.stage > 1) return 6;
    return Math.min(6, Math.floor(this.elapsed / DURATIONS[1] * 7));
  }

  update() {
    const fraction = Math.min(this.elapsed / DURATIONS[this.stage], 1);
    const root = this.shadowRoot;
    this.style.setProperty('--progress', String(fraction));
    this.style.setProperty('--total-progress', String((DURATIONS.slice(0, this.stage).reduce((sum, value) => sum + value, 0) + this.elapsed) / DURATIONS.reduce((sum, value) => sum + value, 0)));
    root.querySelectorAll('button[data-stage]').forEach((button, index) => {
      button.dataset.state = index < this.stage ? 'done' : index === this.stage ? 'active' : 'waiting';
      button.setAttribute('aria-pressed', String(index === this.stage));
    });
    root.querySelector('[data-counter]').textContent = `0${this.stage + 1} / 04`;
    root.querySelector('[data-time]').textContent = `${time(this.stage === 0 ? this.call.duration * fraction : this.call.duration)} / ${time(this.call.duration)}`;
    const count = this.analysisCount();
    const signature = `${this.stage}:${count}:${this.example}:${this.english}:${this.view}`;
    if (signature === this.signature) return;
    this.signature = signature;
    root.querySelector('[data-status]').textContent = this.text(...[
      ['Получение записи звонка', 'Receiving the call recording'],
      ['LLM распознает речь и извлекает данные', 'LLM transcribes speech and extracts data'],
      ['Результат передается через API', 'The result is being transferred via API'],
      ['Данные сохранены в карточке Арбис', 'Data saved to the Arbis customer profile'],
    ][this.stage]);
    root.querySelector('[data-transcript]').textContent = this.stage === 0 ? this.text('Входящий звонок · запись разговора', 'Incoming call · conversation recording') : `«${this.local(this.call.transcript)}»`;
    root.querySelector('[data-analysis-state]').textContent = this.text(count === 6 ? 'Готово' : 'Анализ', count === 6 ? 'Ready' : 'Analyzing');
    root.querySelector('[data-save]').innerHTML = `${icon(this.stage === 3 ? 'check' : 'sync')}${this.text(this.stage === 3 ? 'Сохранено' : 'Обработка', this.stage === 3 ? 'Saved' : 'Processing')}`;
    root.querySelector('[data-save]').dataset.saved = String(this.stage === 3);
    const keys = ['subject', 'status', 'emotion', 'summary', 'tags', 'rating'];
    keys.forEach((key, index) => {
      const field = root.querySelector(`[data-field="${key}"]`);
      const revealed = index < count;
      field.closest('[data-field-row]').classList.toggle('revealed', revealed);
      if (key === 'tags') field.innerHTML = revealed ? this.local(this.call.tags).map(tag => `<span class="tag">${esc(tag)}</span>`).join('') : '<span class="placeholder-line"></span>';
      else field.textContent = revealed ? this.local(this.call[key]) : '—';
    });
    root.querySelector('[data-call-tags]').innerHTML = this.stage === 3 ? `<span class="tag">${this.local(this.call.subject)}</span><span class="tag green">${this.local(this.call.status)}</span>` : `<span class="pending">${this.text('Обработка…', 'Processing…')}</span>`;
    root.querySelector('.new-call').classList.toggle('saved', this.stage === 3);
    root.querySelector('[data-api]').innerHTML = `${icon(this.stage === 3 ? 'check' : 'lock')}<span>${this.stage === 3 ? 'POST /calls/analysis · 200 OK' : this.stage === 2 ? 'POST /calls/analysis · …' : this.text('Защищенная передача через API', 'Secure transfer via API')}</span>`;
    root.querySelector('.rating-line').dataset.tone = this.call.attention ? 'attention' : 'positive';
    root.querySelectorAll('[data-event]').forEach((event, index) => {
      event.dataset.done = String(index < this.stage || this.stage === 3 || (index === 1 && count === 6));
    });
  }

  selectStage(stage) {
    this.stage = stage;
    this.elapsed = stage === 1 ? DURATIONS[1] * .95 : stage === 3 ? DURATIONS[3] : 0;
    this.setPlaying(false);
    this.update();
  }

  onClick(event) {
    const stage = event.target.closest('button[data-stage]');
    if (stage) return this.selectStage(Number(stage.dataset.stage));
    const view = event.target.closest('[data-view]');
    if (view) {
      this.setPlaying(false);
      this.view = view.dataset.view;
      this.renderCustomer();
      this.update();
      this.shadowRoot.querySelector(`[data-view="${this.view}"]`).focus();
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'replay') {
      this.stage = 0;
      this.elapsed = 0;
      this.view = 'calls';
      this.renderCustomer();
      this.update();
      this.setPlaying(true);
    }
    if (action === 'play') {
      if (!this.requestedPlay && this.stage === 3 && this.elapsed >= DURATIONS[3]) {
        this.stage = 0;
        this.elapsed = 0;
        this.update();
      }
      this.setPlaying(!this.requestedPlay);
    }
  }

  setPlaying(value) {
    this.requestedPlay = value;
    this.updatePlayButton();
    this.syncClock();
  }

  updatePlayButton() {
    const button = this.shadowRoot.querySelector('.play-toggle');
    const label = this.text(this.requestedPlay ? 'Приостановить обработку звонка' : 'Продолжить обработку звонка', this.requestedPlay ? 'Pause call processing' : 'Play call processing');
    button.innerHTML = icon(this.requestedPlay ? 'pause' : 'play');
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-pressed', String(this.requestedPlay));
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
    if (this.elapsed >= DURATIONS[this.stage]) {
      this.elapsed = 0;
      this.stage = (this.stage + 1) % STAGES.length;
      if (this.stage === 0) {
        this.example = (this.example + 1) % CALLS.length;
        this.shadowRoot.querySelector('[data-example]').value = String(this.example);
        this.renderCustomer();
      }
    }
    this.update();
    this.frame = requestAnimationFrame(this.tick);
  }
}

if (!customElements.get('calls-llm-preview')) customElements.define('calls-llm-preview', CallsLlmPreview);
