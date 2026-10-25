import assert from 'node:assert/strict';
import {testEmail,seedStudentEmail,testAccountEmail} from './auth-fixtures.js';
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {connect} from './cdp.js';

const adminCode='Theme-browser-test-code-2026';
const child=spawn(process.execPath,['tests/browser-server.js'],{
  cwd:process.cwd(),env:{...process.env,PORT:'5006',SMARTSTAY_DB:':memory:',ADMIN_SECURITY_CODE:adminCode},
  stdio:['ignore','pipe','pipe']
});
let serverErrors='';child.stderr.on('data',d=>serverErrors+=d);
await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Theme test server did not start')),15000);
  child.stdout.on('data',d=>{if(String(d).includes('running')){clearTimeout(timer);resolve();}});
  child.on('error',reject);
});
const b=await connect(9223,'http://127.0.0.1:5006'),results=[];
function log(label){results.push({label,passed:true});console.log('PASS '+label);}
async function mode(theme){
  if(await b.evaluate('document.documentElement.dataset.theme')!==theme)await b.evaluate("document.querySelector('[data-theme-toggle]').click()");
  await b.waitFor(`document.documentElement.dataset.theme==='${theme}'&&!document.documentElement.classList.contains('theme-changing')`);
  assert.equal(await b.evaluate('localStorage.getItem("smartstay-theme")'),theme);
}
async function page(path){
  await b.navigate(path);await b.waitFor(`location.pathname===${JSON.stringify(path.split('?')[0])}&&document.readyState==='complete'`);await b.waitFor("document.querySelector('[data-theme-toggle]')");
  if(path.startsWith('/app/'))await b.waitFor("document.querySelector('#page .page-heading')");
  if(path==='/register')await b.waitFor("document.querySelector('#registration-form')");
  if(path.startsWith('/login'))await b.waitFor("document.querySelector('#login-form')");
}
async function login(role){
  await b.send('Page.navigate',{url:'about:blank'});await b.waitFor("location.href==='about:blank'&&document.readyState==='complete'");
  await b.send('Network.clearBrowserCookies');await page('/login?role='+role);
  await b.waitFor("document.querySelector('#login-roles [aria-selected=\"true\"]') && document.querySelector('#login-form').dataset.role");
  await b.evaluate(`document.querySelector('#email').value=${JSON.stringify(testAccountEmail(role))};document.querySelector('#password').value=${JSON.stringify(role[0].toUpperCase()+role.slice(1)+'@123')}`);
  if(role==='admin')await b.evaluate(`document.querySelector('#admin-security-code').value=${JSON.stringify(adminCode)}`);
  await b.evaluate("document.querySelector('#login-form').requestSubmit()");
  await b.waitFor("document.querySelector('#page .page-heading')");
}
// Contrast checks use each text node's actual composited background, including overlays.
// SVG illustrations are artwork; CSS surfaces and visible interface text are audited.
const auditExpression=`(()=>{
 const failures=[],whiteSurfaces=[];
 const rgba=s=>{const n=s.match(/[\\d.]+/g)?.map(Number)||[];return n.length>=3?[...n.slice(0,3),n[3]??1]:[0,0,0,0];};
 const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
 const blend=(front,back)=>front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3]));
 const background=el=>{let c=rgba(getComputedStyle(document.documentElement).backgroundColor).slice(0,3);const ancestors=[];for(let a=el;a;a=a.parentElement)ancestors.push(a);for(const a of ancestors.reverse())c=blend(rgba(getComputedStyle(a).backgroundColor),c);return c;};
 const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&r.right>0&&r.left<innerWidth&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity)>0&&!el.closest('[hidden],[aria-hidden="true"],script,style');};
 const ratio=(fg,bg)=>{const a=lum(fg),c=lum(bg);return (Math.max(a,c)+.05)/(Math.min(a,c)+.05);};
 for(const el of document.querySelectorAll('body *')){if(!visible(el))continue;const r=el.getBoundingClientRect(),c=rgba(getComputedStyle(el).backgroundColor);if(c[3]>.9&&c.slice(0,3).every(v=>v>225)&&r.width*r.height>350)whiteSurfaces.push(el.tagName.toLowerCase()+'.'+el.className);}
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 let count=0;
 while(walker.nextNode()){
  const text=walker.currentNode.textContent.trim(),el=walker.currentNode.parentElement;if(!text||!visible(el)||el.closest('[disabled]'))continue;
  const s=getComputedStyle(el),size=parseFloat(s.fontSize),minimum=size>=24||size>=18&&Number(s.fontWeight)>=600?3:4.5;
  const contrast=ratio(blend(rgba(s.color),background(el)),background(el));count++;
  if(contrast<minimum-.03)failures.push({text:text.slice(0,70),element:el.tagName.toLowerCase()+'.'+el.className,color:s.color,contrast:+contrast.toFixed(2),minimum});
 }
 for(const el of document.querySelectorAll('input:not([type="checkbox"]),select,textarea')){if(!visible(el)||el.disabled)continue;const contrast=ratio(rgba(getComputedStyle(el).color),background(el));if(contrast<4.47)failures.push({element:el.tagName+'.'+el.id,contrast:+contrast.toFixed(2)});}
 return {failures:failures.slice(0,18),whiteSurfaces:[...new Set(whiteSurfaces)],count};
})()`;
async function inspect(label,theme='dark'){
 assert.equal(await b.evaluate("document.querySelectorAll('[data-theme-toggle]').length"),1,label+' has duplicate toggles');
 assert.equal(await b.evaluate('document.documentElement.scrollWidth>innerWidth'),false,label+' overflows');
 const edges=await b.evaluate(`(()=>{
  const failures=[];
  for(const el of document.querySelectorAll('.btn,.theme-toggle,.campus-role-card,input:not([type="checkbox"]),select,textarea,.panel,.stat-card,.room-card,.feature-card,.art-float,.contact-card,.search-field,dialog[open],.toast')){
   if(!el.getClientRects().length)continue;const s=getComputedStyle(el),name=el.tagName+'.'+el.className;
   const widths=[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth];
   if(widths.some(w=>!['0px','1px'].includes(w)))failures.push({name,reason:'border thickness',widths});
   let depth=0,layers=s.boxShadow==='none'?0:1;
   for(const char of s.boxShadow){if(char==='(')depth++;if(char===')')depth--;if(char===','&&depth===0)layers++;}
   if(layers>1||s.boxShadow.includes('inset'))failures.push({name,reason:'stacked shadow',shadow:s.boxShadow});
   if(s.outlineStyle!=='none'){
    if(!el.matches(':focus-visible,:has(input:focus-visible)')||s.outlineWidth!=='2px'||s.outlineOffset!=='2px')failures.push({name,reason:'unexpected focus layer',outline:s.outline,offset:s.outlineOffset});
   }
  }
  return failures;
 })()`);
 assert.deepEqual(edges,[],label+' noisy edges: '+JSON.stringify(edges));
 if(theme==='dark'){
  const audit=await b.evaluate(auditExpression);
  assert.deepEqual(audit.whiteSurfaces,[],label+' has white surfaces');
  assert.deepEqual(audit.failures,[],label+' contrast: '+JSON.stringify(audit.failures));
 }
}
try{
 await b.viewport(1440,1000);await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
 await page('/');await b.evaluate("localStorage.removeItem('smartstay-theme')");await page('/');
 assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'light');
 assert.equal(await b.evaluate("getComputedStyle(document.body).backgroundColor"),'rgb(255, 255, 255)');
 assert.equal(await b.evaluate("getComputedStyle(document.querySelector('.hero-buttons .primary')).backgroundColor"),'rgb(50, 98, 221)');
 log('Original light homepage remains the default even with an OS dark preference');
 await b.evaluate("document.querySelector('[data-theme-toggle]').focus()");
 await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
 await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await b.waitFor("document.documentElement.dataset.theme==='dark'&&!document.documentElement.classList.contains('theme-changing')");
 assert.equal(await b.evaluate("document.querySelector('[data-theme-toggle]').getAttribute('aria-label')"),'Switch to light mode');
 assert.equal(await b.evaluate("document.querySelector('[data-theme-toggle]').title"),'Switch to light mode');
 assert.equal(await b.evaluate("getComputedStyle(document.querySelector('[data-theme-toggle]')).outlineStyle"),'solid');
 log('Keyboard toggle has an accessible label, tooltip, visible focus and immediate saved state');
 const bootstrap=await b.send('Page.addScriptToEvaluateOnNewDocument',{source:"new MutationObserver((_,o)=>{if(document.body){window.themeAtBodyCreation=document.documentElement.dataset.theme;o.disconnect();}}).observe(document,{childList:true,subtree:true});"});
 await page('/login?role=student');assert.equal(await b.evaluate('window.themeAtBodyCreation'),'dark');
 assert.equal(await b.evaluate("[...document.head.children].findIndex(e=>e.matches('script[src=\"/js/theme.js\"]'))<[...document.head.children].findIndex(e=>e.matches('link[rel=\"stylesheet\"]'))"),true);
 await b.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:bootstrap.identifier});
 log('Saved dark theme applies before body creation and before styles load');
 for(const path of ['/','/login?role=student','/login?role=admin','/register']){
  await page(path);for(const theme of ['light','dark']){await mode(theme);await inspect(path+' '+theme,theme);}
  log(path+' supports light/dark surfaces and readable forms');
 }
 await page('/register');
 for(const role of ['student','warden','security','maintenance','laundry','admin']){
  await b.evaluate(`(()=>{const roleField=document.querySelector('#registration-form [name=role]');roleField.value='${role}';roleField.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await inspect('Registration '+role);log(role+' registration fields and dropdowns support dark mode');
 }
 await page('/login?role=student');await b.evaluate("document.querySelector('#forgot').click()");await b.waitFor("document.querySelector('#modal').open");await inspect('Login recovery dialog');await b.evaluate("document.querySelector('[data-close]').click()");
 for(const role of ['admin','warden','student','security','maintenance','laundry']){
  await login(role);assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'dark');
  const modules=await b.evaluate("[...document.querySelectorAll('.sidebar [data-nav]')].map(a=>a.dataset.nav).filter((v,i,a)=>a.indexOf(v)===i)");
  for(const module of modules){
   await page('/app/'+module);assert.ok(!(await b.evaluate("document.querySelector('#page').innerText")).includes('Could not load'));
   for(const theme of ['light','dark']){await mode(theme);await inspect(role+' '+module+' '+theme,theme);}
   results.push({label:role+' '+module+' verified in both modes',passed:true});
  }
  await page('/app/dashboard');await b.screenshot('theme-'+role+'-dark');
  if(role==='admin'){
   const darkDonut=await b.evaluate("getComputedStyle(document.querySelector('.donut')).backgroundImage");await mode('light');const lightDonut=await b.evaluate("getComputedStyle(document.querySelector('.donut')).backgroundImage");assert.notEqual(lightDonut,darkDonut);await mode('dark');
   assert.equal(await b.evaluate("getComputedStyle(document.querySelector('.donut'),'::before').backgroundColor===getComputedStyle(document.querySelector('.panel')).backgroundColor"),true);log('Attendance chart colors and donut center switch without a page reload');
   await page('/app/students');await b.evaluate("document.querySelector('[data-action=add-student]').click()");await b.waitFor("document.querySelector('#record-form')");await inspect('Student form modal');await b.evaluate("document.querySelector('[data-close]').click()");
   await page('/app/rooms');await b.evaluate("document.querySelector('.room-card').click()");await b.waitFor("document.querySelector('#modal').open");await inspect('Room details dialog');await b.evaluate("document.querySelector('[data-close]').click()");
   await page('/app/reports');const darkBar=await b.evaluate("getComputedStyle(document.querySelector('.bar-col>div')).backgroundColor");await mode('light');assert.notEqual(await b.evaluate("getComputedStyle(document.querySelector('.bar-col>div')).backgroundColor"),darkBar);await mode('dark');
   await b.evaluate("import('/js/components.js').then(c=>{c.toast('Theme check completed');c.toast('Theme error state check','error');})");await inspect('Report chart and success/error toasts');
   await b.evaluate("import('/js/components.js').then(c=>c.confirm('Review this action?','Confirmation stays readable in either mode.',()=>{}))");await b.waitFor("document.querySelector('#modal').open");await inspect('Confirmation dialog');await b.evaluate("document.querySelector('[data-close]').click()");
   await b.evaluate("document.querySelector('[data-action=notification-panel]').click()");await b.waitFor("document.querySelector('#modal').open");await inspect('Notifications panel');await b.evaluate("document.querySelector('[data-close]').click()");
   log('Tables, inputs, selects, room details, charts, confirmations, notifications and toasts verified');
  }
  await b.evaluate("document.querySelector('[data-action=logout]').click()");await b.waitFor("location.pathname==='/login'&&document.querySelector('[data-theme-toggle]')");assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'dark');log(role+' pages, sidebar, dashboard and logout preserve the theme');
 }
 await login('admin');
 const adminModules=await b.evaluate("[...document.querySelectorAll('.sidebar-nav [data-nav]')].map(a=>a.dataset.nav)");
 for(const width of [1920,1440,1024,768,430,390]){
  await b.viewport(width,1000);
  for(const path of ['/','/login?role=admin','/register','/app/dashboard','/app/students','/app/rooms','/app/gate','/app/reports','/app/settings']){
   await page(path);for(const theme of ['light','dark']){await mode(theme);await inspect(width+'px '+path+' '+theme,theme);}
  }
  if(width===768||width===390){for(const module of adminModules){await page('/app/'+module);for(const theme of ['light','dark']){await mode(theme);await inspect(width+'px '+module+' '+theme,theme);}}}
  if(width===390){await page('/app/dashboard');await b.screenshot('theme-admin-mobile-dark');await b.evaluate("document.querySelector('[data-action=sidebar]').click()");await inspect('Dark mobile drawer');await b.evaluate("document.querySelector('[data-action=drawer-close]').click()");}
  log('Public pages and application responsive in both themes at '+width+'px');
 }
 await b.viewport(1440,1000);await page('/app/dashboard');
 await b.send('Network.enable');
 try{
  await b.send('Network.emulateNetworkConditions',{offline:false,latency:700,downloadThroughput:-1,uploadThroughput:-1});
  await b.evaluate("document.querySelector('.sidebar [data-nav=students]').click()");await b.waitFor("document.querySelector('#page .skeleton')");await inspect('Loading skeleton');
  assert.ok(!(await b.evaluate("getComputedStyle(document.querySelector('#page .skeleton')).backgroundImage")).includes('249, 250, 252'));
 }finally{await b.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});}
 await b.waitFor("document.querySelector('#student-table input')");
 await b.evaluate("(()=>{const input=document.querySelector('#student-table input');input.value='theme-no-matching-student';input.dispatchEvent(new Event('input',{bubbles:true}));})()");await b.waitFor("document.querySelector('#student-table .empty-state')");await inspect('Empty student search');log('Actual navigation skeleton and empty search results stay readable in dark mode');
 await page('/app/dashboard');await b.send('Page.reload');await b.waitFor("document.querySelector('#page .page-heading')");assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'dark');log('Browser refresh restores the saved theme');
 await b.send('Emulation.setEmulatedMedia',{media:'print'});assert.equal(await b.evaluate('getComputedStyle(document.documentElement).colorScheme'),'light');assert.equal(await b.evaluate('getComputedStyle(document.body).backgroundColor'),'rgb(255, 255, 255)');await b.send('Emulation.setEmulatedMedia',{media:'screen'});log('Printing uses the original light palette');
 await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await mode('light');assert.equal(await b.evaluate("document.documentElement.classList.contains('theme-changing')"),false);await mode('dark');log('Reduced-motion preference disables theme animation');
 await b.evaluate("localStorage.setItem('smartstay-theme','light');window.dispatchEvent(new StorageEvent('storage',{key:'smartstay-theme'}))");assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'light');log('Changed preferences synchronize through the storage event');
 assert.deepEqual(b.errors,[]);assert.equal(serverErrors,'');log('No browser runtime errors or application server errors');
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/theme-browser-results.json',JSON.stringify(results,null,2));console.log(results.length+' theme checks passed.');
}finally{b.close();child.kill();}
