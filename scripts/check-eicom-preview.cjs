const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'..');
const read = file=>fs.readFileSync(path.join(root,file),'utf8');
const source=read('project-previews/eicom-shop.js');
const icons=read('project-previews/eicom-icons.js');
const improvements=read('project-previews/eicom-improvements.js');
const flowIcons=read('project-previews/tm-icons.js');
const bundledImprovements=improvements
  .replace("import { ICONS as FLOW_ICONS } from './tm-icons.js';",flowIcons.replace('export const ICONS','const FLOW_ICONS'))
  .replace("import { ICONS as SHOP_ICONS } from './eicom-icons.js';",'const SHOP_ICONS=ICONS;')
  .replaceAll('export const','const').replaceAll('export function','function');
const context=vm.createContext({HTMLElement:class { attachShadow(){} set role(value){throw Error('Reflected attributes are not allowed in constructors');} },customElements:{get:()=>true},URL,Intl,requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},document:{hidden:false},performance:{now:()=>0}});
vm.runInContext(source.replace("import { ICONS } from './eicom-icons.js';",icons.replace('export const ICONS','const ICONS'))
  .replace("import { renderPreview, stopPreviewLoading } from './preview-styles.js?v=2';", 'const renderPreview = (root, urls, markup) => { root.innerHTML = markup; }; const stopPreviewLoading = () => {};')
  .replace("import { FEATURES, FEATURE_MS, featureMap, featureScene, updateFeature } from './eicom-improvements.js';",bundledImprovements)
  .replaceAll('import.meta.url',"'https://example.com/project-previews/eicom-shop.js'")+'\nthis.Preview=EicomShopPreview;this.esc=esc;this.FEATURES=FEATURES;this.featureScene=featureScene;this.featureMap=featureMap;this.updateFeature=updateFeature;',context);
const preview=new context.Preview();
const attrs={locale:'ru'};
preview.getAttribute=key=>attrs[key]||null;
preview.style={setProperty:()=>{}};
preview.renderScene=()=>{};
preview.updatePlayButton=()=>{};
preview.syncClock=()=>{};
preview.shadowRoot={innerHTML:'',querySelector:()=>({setAttribute:()=>{}})};
attrs.description='Sample <script> description';
preview.render();
assert.ok(/class="preview">\s*<div class="case-intro">/.test(preview.shadowRoot.innerHTML));
assert.ok(preview.shadowRoot.innerHTML.includes('<details><summary>Подробнее о проекте</summary>'));
assert.equal((preview.shadowRoot.innerHTML.match(/class="case-intro"/g)||[]).length,1);
assert.ok(preview.shadowRoot.innerHTML.indexOf('href="https://eicom.ru/"') < preview.shadowRoot.innerHTML.indexOf('class="ef-map"'), 'Website actions precede the feature map');
assert.ok(preview.shadowRoot.innerHTML.includes('Sample &lt;script&gt; description'));
assert.equal(preview.siteUrl(),'https://eicom.ru/');
attrs['site-url']='javascript:alert(1)';
assert.equal(preview.siteUrl(),'https://eicom.ru/');
assert.equal(context.esc('<img "x">'),'&lt;img &quot;x&quot;&gt;');
assert.ok(preview.chat().includes('без подключения к ИИ'));
preview.chatTopic='order';
assert.ok(preview.chat().includes('Заказ №1024'));
preview.chatTopic='specs';
assert.ok(preview.chat().includes('один общий контакт'));
preview.chatTopic='checkout';
assert.ok(preview.chat().includes('data-action="chat-checkout"'));
attrs.locale='en';
assert.ok(preview.chat().includes('Help me order'));
preview.shadowRoot={querySelector:()=>null,querySelectorAll:()=>[]};
preview.running=true; preview.lastTime=0; preview.elapsed=0;
for(let now=100;now<=7200;now+=100) preview.tick(now);
assert.equal(preview.feature,0,'Selected feature stays selected');
preview.running=false; const elapsed=preview.elapsed; preview.tick(7500);
assert.equal(preview.elapsed,elapsed,'Paused animation does not advance');
assert.equal(context.FEATURES.length,9);
assert.equal(context.FEATURES[0][0],'spin','360 replaces new layout');
assert.equal(context.FEATURES[7][0],'chat');
assert.equal(context.FEATURES[8][0],'account');
attrs.locale='ru';
assert.equal((context.featureMap(preview).match(/role="tab"/g)||[]).length,9);
assert.ok(!source.includes('tour-nav'),'No whole-site page tour');
for (let i=0;i<9;i++) {
  preview.selectFeature(i);
  assert.equal(preview.feature,i);
  const scene=context.featureScene(preview);
  assert.equal((scene.match(/data-phase=/g)||[]).length,4);
  assert.ok(scene.includes('ef-detail'));
}
assert.ok(context.featureScene(preview).includes('components.xlsx'),'Account includes BOM matching');
assert.ok(context.featureScene(preview).includes('Мои заказы'));
preview.motion={matches:true};
preview.selectFeature(0);
assert.equal(preview.requestedPlay,false,'Reduced motion has manual playback');
assert.equal(preview.elapsed,11999,'Reduced motion displays completed flow');
preview.selectFeature(99); preview.selectFeature(NaN); preview.selectFeature(1.5);
assert.equal(preview.feature,0,'Invalid features are ignored');
preview.setSpinFrame(-1); assert.equal(preview.spinFrame,23);
preview.setSpinFrame(24); assert.equal(preview.spinFrame,0);
preview.setSpinFrame(Infinity); assert.equal(preview.spinFrame,0);
let contains=true;
const featureButton={dataset:{feature:'7'},contains:()=>contains};
const hover={pointerType:'touch',target:{closest:()=>featureButton},relatedTarget:{}};
preview.onFeatureHover(hover); assert.equal(preview.feature,0,'Touch does not trigger hover');
hover.pointerType='mouse'; preview.onFeatureHover(hover); assert.equal(preview.feature,0,'Nested pointer events do not restart');
contains=false; preview.onFeatureHover(hover); assert.equal(preview.feature,7,'Mouse hover selects a feature');
let focused=false, prevented=false;
preview.shadowRoot.querySelector=()=>({focus:()=>{focused=true;}});
preview.onKey({target:{matches:()=>true,dataset:{feature:'8'}},key:'ArrowRight',preventDefault:()=>{prevented=true;}});
assert.equal(preview.feature,0); assert.ok(focused&&prevented,'Keyboard wraps and focuses selected tab');
preview.shadowRoot.querySelector=()=>null;
preview.motion.matches=false; preview.selectFeature(1);
preview.running=true; preview.lastTime=0; preview.elapsed=0;
for(let now=100;now<=12500;now+=100) preview.tick(now);
assert.equal(preview.feature,1,'Automatic animation loops the selected feature');
assert.equal(preview.elapsed,500);
preview.selectFeature(0); preview.running=true; preview.lastTime=0;
for(let now=100;now<=1000;now+=100) preview.tick(now);
assert.equal(preview.spinFrame,2,'360 advances real photography frames');
preview.running=false;
preview.chatTopic='checkout';
preview.onClick({target:{closest:()=>({dataset:{action:'chat-checkout'}})}});
assert.equal(preview.cartCount,10);
assert.ok(preview.chat().includes('disabled'),'Sample checkout has a visible local result');
preview.cartCount=0;
assert.ok(!/\bfetch\s*\(|XMLHttpRequest|<iframe|localStorage/.test(source+improvements),'Preview must work offline without a service');
const frameHashes=new Set();
for(let i=1;i<=24;i++) {
  const name=`N1-${String(i).padStart(2,'0')}.jpg`;
  const bytes=fs.readFileSync(path.join(root,'project-previews/eicom-assets/spin-d2d-1000',name));
  assert.equal(bytes.readUInt16BE(0),0xffd8,name+' is a JPEG');
  frameHashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));
}
assert.equal(frameHashes.size,24,'24 distinct real product angles');
const bonusBalance={textContent:''};
const phaseNodes=[0,1,2,3].map(i=>({dataset:{phase:String(i)}}));
const readyNode={dataset:{ready:'2'}};
preview.shadowRoot={querySelector:sel=>sel==='[data-bonus-balance]'?bonusBalance:null,querySelectorAll:sel=>sel==='[data-phase]'?phaseNodes:sel==='[data-ready]'?[readyNode]:[]};
preview.elapsed=1000;context.updateFeature(preview);
assert.equal(bonusBalance.textContent,'213');assert.equal(readyNode.dataset.visible,'false');
preview.elapsed=11999;context.updateFeature(preview);
assert.equal(bonusBalance.textContent,new Intl.NumberFormat('ru-RU').format(1713));
assert.equal(readyNode.dataset.visible,'true');assert.equal(phaseNodes[3].dataset.state,'active');
attrs.locale='en'; preview.feature=0;
assert.ok(context.featureScene(preview).includes('Product angle'));
preview.feature=7; preview.chatTopic='checkout';
assert.ok(context.featureScene(preview).includes('Add 10 to basket'));
for(const file of ['eicom-shop.js','eicom-shop.css','eicom-improvements.js','eicom-improvements.css']) {
  const canonical=path.join(root,'../apps/frontend/public/project-previews',file);
  if(fs.existsSync(canonical)) assert.equal(read('project-previews/'+file),fs.readFileSync(canonical,'utf8'),'Source and Pages mirror match: '+file);
}
preview.dataset={}; preview.isConnected=true; preview.visible=true; preview.requestedPlay=true;
const readyQuery=preview.shadowRoot.querySelector;
preview.shadowRoot.querySelector=selector=>selector==='[data-preview-content][hidden]'?{}:readyQuery(selector);
context.Preview.prototype.syncClock.call(preview);
assert.equal(preview.dataset.playing,'false','Playback does not advance behind pending styles');
preview.shadowRoot.querySelector=readyQuery;
context.Preview.prototype.syncClock.call(preview);
assert.equal(preview.dataset.playing,'true');
preview.visible=false;
context.Preview.prototype.syncClock.call(preview);
assert.equal(preview.dataset.playing,'false','Offscreen playback pauses');
preview.visible=true; context.document.hidden=true;
context.Preview.prototype.syncClock.call(preview);
assert.equal(preview.dataset.playing,'false','Hidden documents do not animate');
context.document.hidden=false;
assert.ok(source.includes('disconnectedCallback()'));
assert.ok(source.includes('prefers-reduced-motion'));
assert.ok(read('project-previews/eicom-shop.css').includes('@container eicom'));
for(const file of ['index.html','404.html']) {
  const html=read(file);
  assert.ok(html.includes('src="/project-previews/eicom-shop.js"'));
  const chunks=[...new Set(html.match(/app\/page-[a-f0-9]+\.js/g))]; assert.equal(chunks.length,1);
  const chunk=read('_next/static/chunks/'+chunks[0]);
  assert.equal(chunks[0],`app/page-${crypto.createHash('sha256').update(chunk).digest('hex').slice(0,16)}.js`);
  for(const tag of ['eicom-shop-preview','shifts-crm-preview','calls-llm-preview','dental-crm-preview']) assert.ok(chunk.includes(tag),tag);
}
for(const file of ['data/live-projects.json','data/projects.json','api/v1/projects/index.html','api/v1/projects/radio-components/index.html']) {
  const data=JSON.parse(read(file));const p=Array.isArray(data)?data.find(p=>p.slug==='radio-components'):data;
  assert.equal(p.live_url,'https://eicom.ru/');
  assert.ok(p.description_ru.includes('С нуля'));
  assert.ok(p.description_ru.includes('Next.js'));
  assert.ok(p.description_ru.includes('BOM (Bill of Materials'));
  assert.ok(p.description_ru.includes('Создал ИИ-чат-бота'));
  assert.equal(p.stack[0],'Next.js');
}
assert.ok(read('projects/radio-components/index.html').includes('С нуля разработал'));
assert.ok(read('projects/radio-components/index.html').includes('href="https://eicom.ru/">Live</a>'),'Project detail SSR matches its live URL');
for(const name of ['logo.svg','d2f-f.webp','ss-5gl.webp','d2hw.webp','catalog-banner.webp','cashback-banner.webp','fira-sans.ttf','OFL-FiraSans.txt']) assert.ok(fs.statSync(path.join(root,'project-previews/eicom-assets',name)).size>100,name);
console.log('Eicom preview checks passed.');
