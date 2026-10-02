import { ICONS } from './eicom-icons.js';
import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';
import { projectHeading, projectSummary, DIAGRAM_STYLESHEET } from './project-diagram.js?v=2';
import { FEATURES, FEATURE_MS, featureMap, featureScene, updateFeature } from './eicom-improvements.js';

const STYLESHEET = new URL('./eicom-shop.css', import.meta.url).href;
const FEATURE_STYLESHEET = new URL('./eicom-improvements.css', import.meta.url).href;
const ASSETS = new URL('./eicom-assets/', import.meta.url).href;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const icon = name => ICONS[name] || '';
const CHAT_TOPICS = ['search','specs','checkout','order'];
const CHAT_DIALOGS = {
  search: ['Нужен концевой переключатель на 125 В, монтаж на плату.','I need a 125 V limit switch for PCB mounting.','Посмотрите D2F-F от OMRON: 125 В AC, схема SPDT, монтаж THT. Перед заказом проверьте характеристики в документации.','Consider OMRON D2F-F: 125 V AC, SPDT, THT. Verify the datasheet before ordering.'],
  specs: ['Что означает схема SPDT?','What does SPDT mean?','SPDT — один общий контакт и два переключаемых. D2F-F поддерживает эту схему; его номинал 1 А при 125 В AC. Для вашей цепи проверьте нагрузку и условия в даташите.','SPDT means one common contact and two switched contacts. D2F-F uses this circuit and is rated 1 A at 125 V AC. Check load and operating conditions in the datasheet.'],
  checkout: ['Помоги оформить заказ на 10 штук D2F-F.','Help me order 10 D2F-F switches.','Добавьте 10 штук в корзину, укажите получателя и выберите доставку. Цена за 10 штук: 3 330 ₽. Перед оплатой проверьте состав заказа и адрес.','Add 10 units to your basket, enter the recipient and choose delivery. Ten units cost 3,330 RUB. Check the items and address before payment.'],
  order: ['Где мой заказ №1024?','Where is my order #1024?','Заказ №1024 передан в обработку. В личном кабинете доступны состав и история заказа.','Order #1024 is processing. Your account shows its items and history.'],
};

class EicomShopPreview extends HTMLElement {
  static observedAttributes = ['locale','description','site-url'];
  constructor() {
    super(); this.attachShadow({mode:'open'});
    this.feature=0; this.spinFrame=0; this.deliveryMode='pickup';
    this.chatTopic='search'; this.cartCount=0; this.elapsed=0;
    this.visible=false; this.running=false; this.tick=this.tick.bind(this);
  }
  get english() { return this.getAttribute('locale')==='en'; }
  text(ru,en) { return this.english?en:ru; }
  local(pair) { return pair[this.english?1:0]; }
  money(value) { return new Intl.NumberFormat(this.english?'en-US':'ru-RU').format(value)+' ₽'; }
  chatIcon() { return icon('chat'); }
  siteUrl() {
    try { const url=new URL(this.getAttribute('site-url')||'https://eicom.ru/'); return ['https:','http:'].includes(url.protocol)?url.href:'https://eicom.ru/'; }
    catch { return 'https://eicom.ru/'; }
  }
  connectedCallback() {
    this.abort=new AbortController(); const options={signal:this.abort.signal};
    this.motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    this.requestedPlay=!this.motion.matches;
    if (this.motion.matches) this.elapsed=FEATURE_MS-1;
    this.shadowRoot.addEventListener('click',event=>this.onClick(event),options);
    this.shadowRoot.addEventListener('keydown',event=>this.onKey(event),options);
    this.shadowRoot.addEventListener('pointerover',event=>this.onFeatureHover(event),options);
    this.shadowRoot.addEventListener('focusin',event=>{
      const tab=event.target.closest('.ef-map [data-feature]');
      if (tab) this.selectFeature(Number(tab.dataset.feature));
    },options);
    this.shadowRoot.addEventListener('pointerdown',event=>{
      const stage=event.target.closest('[data-spin-stage]');
      if (!stage||!event.isPrimary||event.button!==0) return;
      this.setPlaying(false); this.spinDrag={x:event.clientX,frame:this.spinFrame,id:event.pointerId};
      stage.setPointerCapture(event.pointerId);
    },options);
    this.shadowRoot.addEventListener('pointermove',event=>{
      if (this.spinDrag?.id===event.pointerId) this.setSpinFrame(this.spinDrag.frame+Math.round((event.clientX-this.spinDrag.x)/12));
    },options);
    for (const type of ['pointerup','pointercancel','lostpointercapture']) this.shadowRoot.addEventListener(type,()=>{this.spinDrag=null;},options);
    this.shadowRoot.addEventListener('input',event=>{
      if (event.target.matches('[data-spin-range]')) { this.setPlaying(false); this.setSpinFrame(Number(event.target.value)); }
    },options);
    this.shadowRoot.addEventListener('change',event=>{
      if (event.target.matches('[data-delivery]')) { this.deliveryMode=event.target.value==='courier'?'courier':'pickup'; this.setPlaying(false); this.elapsed=FEATURE_MS-1; this.renderScene(); }
    },options);
    this.motion.addEventListener('change',()=>{
      if (this.motion.matches) { this.setPlaying(false); this.elapsed=FEATURE_MS-1; updateFeature(this); }
    },options);
    document.addEventListener('visibilitychange',()=>this.syncClock(),options);
    this.shadowRoot.addEventListener('previewstylesready',()=>this.syncClock(),options);
    this.render();
    this.observer=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.syncClock();},{threshold:.12});
    this.observer.observe(this);
  }
  disconnectedCallback() { stopPreviewLoading(this.shadowRoot); this.abort?.abort(); this.observer?.disconnect(); cancelAnimationFrame(this.frame); this.running=false; }
  attributeChangedCallback(name,oldValue,value) { if (oldValue!==value&&this.isConnected&&this.abort) this.render(); }
  render() {
    renderPreview(this.shadowRoot, [STYLESHEET, FEATURE_STYLESHEET, DIAGRAM_STYLESHEET], `<div class="preview"><div class="case-intro"><details>${projectSummary(this.english)}<p>${esc(this.getAttribute('description')||'')}</p></details><a href="${esc(this.siteUrl())}" target="_blank" rel="noopener noreferrer">${this.text('Открыть сайт','Visit website')}${icon('external')}</a></div>${projectHeading('eicom', this.english)}${featureMap(this)}<section class="app-window" aria-label="${this.text('Эиком: выполненные работы','Eicom: delivered improvements')}"><header class="brand-bar"><div class="brand"><img src="${ASSETS}logo.svg" alt=""><strong>Эиком</strong></div><span class="brand-caption" data-detail-title></span><span class="demo-badge">DEMO</span><button class="account-link" data-action="account">${icon('user')}<span>${this.text('Личный кабинет','My account')}</span></button></header><div class="workspace"><div class="scene" id="eicom-panel" role="tabpanel"></div></div><footer class="app-footer"><span>${icon('check')}${this.text('Демонстрационные данные','Sample data')}</span><span data-view-title></span></footer></section><div class="playback"><span data-counter></span><div class="progress"><i></i></div><button class="tool" data-action="previous" aria-label="${this.text('Предыдущий блок Эиком','Previous Eicom feature')}" title="${this.text('Предыдущий блок','Previous feature')}">${icon('left')}</button><button class="tool play-toggle" data-action="play"></button><button class="tool" data-action="next" aria-label="${this.text('Следующий блок Эиком','Next Eicom feature')}" title="${this.text('Следующий блок','Next feature')}">${icon('right')}</button></div></div>`, this.english);
    this.shadowRoot.querySelector('.account-link').setAttribute('aria-label',this.text('Личный кабинет Эиком','Eicom customer account'));
    this.renderScene(false); this.updatePlayButton();
  }
  renderScene(animate=true) {
    const scene=this.shadowRoot.querySelector('.scene');
    scene.innerHTML=featureScene(this); scene.scrollTop=0;
    scene.setAttribute('aria-labelledby',`eicom-feature-${FEATURES[this.feature][0]}`);
    const title=this.text(FEATURES[this.feature][1],FEATURES[this.feature][2]);
    this.shadowRoot.querySelector('[data-detail-title]').textContent=title;
    this.shadowRoot.querySelector('[data-view-title]').textContent=title;
    this.shadowRoot.querySelectorAll('.ef-map [data-feature]').forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===this.feature));tab.tabIndex=i===this.feature?0:-1;});
    this.shadowRoot.querySelector('[data-counter]').textContent=`${String(this.feature+1).padStart(2,'0')} / ${String(FEATURES.length).padStart(2,'0')}`;
    updateFeature(this);
    if (animate&&!this.motion?.matches) scene.animate([{opacity:.25,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'ease-out'});
  }
  selectFeature(index) {
    if (!Number.isInteger(index)||index<0||index>=FEATURES.length||this.feature===index) return;
    this.feature=index; this.spinFrame=0; this.chatTopic='search';
    this.elapsed=this.motion?.matches?FEATURE_MS-1:0;
    this.style.setProperty('--elapsed','0'); this.renderScene(); this.setPlaying(!this.motion?.matches);
  }
  advance(direction) { this.selectFeature((this.feature+direction+FEATURES.length)%FEATURES.length); }
  onFeatureHover(event) {
    if (event.pointerType==='touch') return;
    const button=event.target.closest('.ef-map [data-feature]');
    if (button&&!button.contains(event.relatedTarget)) this.selectFeature(Number(button.dataset.feature));
  }
  setSpinFrame(value) { if (Number.isFinite(value)) { this.spinFrame=((Math.round(value)%24)+24)%24; updateFeature(this); } }
  onClick(event) {
    const button=event.target.closest('button'); if (!button) return;
    if (button.dataset.feature!==undefined) return this.selectFeature(Number(button.dataset.feature));
    if (button.dataset.topic&&CHAT_TOPICS.includes(button.dataset.topic)) { this.chatTopic=button.dataset.topic; this.setPlaying(false); this.renderScene(); return; }
    const action=button.dataset.action;
    if (action==='play') return this.setPlaying(!this.requestedPlay);
    if (action==='previous'||action==='next') return this.advance(action==='next'?1:-1);
    if (action==='account') return this.selectFeature(8);
    this.setPlaying(false);
    if (action==='spin-left'||action==='spin-right') return this.setSpinFrame(this.spinFrame+(action==='spin-right'?1:-1));
    if (action==='chat-checkout') { this.cartCount=10; this.renderScene(false); }
    if (action==='bom-replay') this.setPlaying(true);
  }
  onKey(event) {
    if (!event.target.matches('.ef-map [data-feature]')||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault(); const current=Number(event.target.dataset.feature);
    const index=event.key==='Home'?0:event.key==='End'?FEATURES.length-1:(current+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+FEATURES.length)%FEATURES.length;
    this.selectFeature(index); this.shadowRoot.querySelector(`.ef-map [data-feature="${index}"]`).focus();
  }
  setPlaying(value) {
    if (value&&!this.requestedPlay) { this.elapsed=0; this.spinFrame=0; this.chatTopic='search'; }
    this.requestedPlay=value;
    if (value) this.renderScene(false);
    this.updatePlayButton(); this.syncClock();
  }
  updatePlayButton() {
    const button=this.shadowRoot.querySelector('.play-toggle');
    const label=this.requestedPlay?this.text('Приостановить анимацию Эиком','Pause Eicom animation'):this.text('Продолжить анимацию Эиком','Play Eicom animation');
    button.innerHTML=icon(this.requestedPlay?'pause':'play'); button.setAttribute('aria-label',label); button.setAttribute('aria-pressed',String(this.requestedPlay)); button.title=label;
  }
  syncClock() {
    const running=this.isConnected&&this.requestedPlay&&this.visible&&!document.hidden&&!this.shadowRoot.querySelector('[data-preview-content][hidden]');
    this.dataset.playing=String(running);
    if (running===this.running) return;
    this.running=running; cancelAnimationFrame(this.frame);
    if (running) { this.lastTime=performance.now(); this.frame=requestAnimationFrame(this.tick); }
  }
  tick(now) {
    if (!this.running) return;
    this.elapsed=(this.elapsed+Math.min(now-this.lastTime,100))%FEATURE_MS; this.lastTime=now;
    if (FEATURES[this.feature][0]==='spin') this.spinFrame=Math.floor(this.elapsed/500)%24;
    if (FEATURES[this.feature][0]==='chat') {
      const topic=CHAT_TOPICS[Math.floor(this.elapsed/3000)];
      if (topic!==this.chatTopic) { this.chatTopic=topic; this.renderScene(false); }
    }
    this.style.setProperty('--elapsed',String(this.elapsed/FEATURE_MS));
    updateFeature(this); this.frame=requestAnimationFrame(this.tick);
  }
  chat() {
    const topic=this.chatTopic, dialog=CHAT_DIALOGS[topic];
    const question=this.text(dialog[0],dialog[1]),answer=this.text(dialog[2],dialog[3]);
    return `<div class="chat-page"><div class="chat-context"><span class="context-label">${this.text('Каталог / Подбор компонентов','Catalog / Component selection')}</span><img src="${ASSETS}d2f-f.webp" alt="D2F-F" width="256" height="256"><strong>D2F-F</strong><span>OMRON OCB</span><dl><dt>AC</dt><dd>125 V</dd><dt>${this.text('Монтаж','Mounting')}</dt><dd>THT</dd><dt>${this.text('Схема','Circuit')}</dt><dd>SPDT</dd></dl></div><section class="chat-panel" aria-label="${this.text('Демонстрация ИИ-чата','AI chat demonstration')}"><header><img src="${ASSETS}logo.svg" alt=""><div><strong>${this.text('Онлайн-консультант','Online assistant')}</strong><small>${this.text('ИИ-помощник Эиком','Eicom AI assistant')}</small></div><span class="chat-demo">DEMO</span></header><div class="messages"><div class="message bot greeting">${this.text('Здравствуйте! Помогу найти компонент или проверить заказ.','Hello! I can help find a component or check an order.')}</div><div class="message customer">${question}</div><div class="message bot"><span data-answer="${esc(answer)}">${answer}</span><div class="typing" hidden><i></i><i></i><i></i></div>${topic==='search'?`<div class="chat-product"><img src="${ASSETS}d2f-f.webp" alt="" width="48" height="48"><div><strong>D2F-F</strong><small>OMRON · 125 V · THT</small></div></div>`:topic==='checkout'?`<button class="secondary" data-action="chat-checkout"${this.cartCount?' disabled':''}>${icon('cart')}${this.cartCount?this.text('В корзине: 10 × D2F-F','In basket: 10 × D2F-F'):this.text('10 штук в корзину','Add 10 to basket')}</button>`:topic==='order'?`<div class="ef-order-status">${icon('package')}№1024 · ${this.text('В обработке','Processing')}</div>`:''}</div></div><div class="chat-topics">${[['search','Подбор','Selection'],['specs','Вопрос о товаре','Product question'],['checkout','Оформление','Checkout'],['order','Статус заказа','Order status']].map(([id,ru,en])=>`<button data-topic="${id}" aria-pressed="${topic===id}">${this.text(ru,en)}</button>`).join('')}</div><footer>${icon('chat')}<span>${this.text('Пример диалога · без подключения к ИИ','Sample conversation · no AI connection')}</span></footer></section></div>`;
  }
}
if (!customElements.get('eicom-shop-preview')) customElements.define('eicom-shop-preview',EicomShopPreview);
