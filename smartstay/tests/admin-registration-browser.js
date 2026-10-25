import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp.js';

const adminCode='Admin-registration-browser-code-2026';
const child=spawn(process.execPath,['tests/browser-server.js'],{cwd:process.cwd(),env:{...process.env,PORT:'5012',SMARTSTAY_DB:':memory:',ADMIN_SECURITY_CODE:adminCode},stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',d=>stderr+=d);
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Admin registration browser server did not start')),15000);child.stdout.on('data',d=>{if(String(d).includes('running')){clearTimeout(timer);resolve();}});child.on('error',reject);});
const b=await connect(9223,'http://127.0.0.1:5012'),results=[];
const log=label=>{results.push({label,passed:true});console.log('PASS '+label);};
async function page(path){await b.navigate(path);await b.waitFor(`location.pathname===${JSON.stringify(path.split('?')[0])}`);}
async function fill(values,selector='#registration-form'){await b.evaluate(`(()=>{const form=document.querySelector(${JSON.stringify(selector)});for(const [name,value]of Object.entries(${JSON.stringify(values)})){const el=form.elements[name];if(!el)throw Error('Missing field '+name);el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}})()`);}
async function adminForm(){await page('/register');await b.waitFor(`document.querySelector('#registration-form')`);await fill({role:'admin'});await b.waitFor(`document.querySelector('#r-admin_security_code')`);}
async function api(path){return b.evaluate(`fetch('/api/${path}').then(async r=>{const data=await r.json();if(!r.ok)throw Error(r.status+': '+JSON.stringify(data));return data;})`);}
async function submit(){await b.evaluate(`document.querySelector('#registration-form').requestSubmit()`);}
async function theme(value){await b.evaluate(`localStorage.setItem('smartstay-theme',${JSON.stringify(value)})`);await adminForm();assert.equal(await b.evaluate(`document.documentElement.dataset.theme`),value);}
function contrast(fg,bg){const rgb=color=>color.match(/[\d.]+/g).slice(0,3).map(Number),lum=color=>rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0),a=lum(fg),c=lum(bg);return(Math.max(a,c)+.05)/(Math.min(a,c)+.05);}
try{
 await b.send('Network.clearBrowserCookies');await b.viewport(1440,1100);await adminForm();
 const cfg=await api('registration-options'),domain='outlook.com';assert.equal(cfg.admin_email_domain,undefined);
 assert.deepEqual(await b.evaluate(`[...document.querySelector('#r-role').options].map(o=>o.textContent)`),['Student','Warden','Security','Maintenance Staff','Laundry Staff','Admin']);
 log('Admin is the sixth role in the existing registration dropdown');
 const fields=await b.evaluate(`[...document.querySelector('#registration-form').elements].filter(e=>e.name&&e.required&&!e.disabled).map(e=>e.name)`);
 assert.deepEqual(fields.sort(),['role','full_name','employee_id','phone','email','password','confirm_password','admin_security_code'].sort());
 assert.equal(await b.evaluate(`document.querySelector('#r-employee_id').labels[0].innerText.includes('Admin / Employee ID')`),true);
 assert.equal(await b.evaluate(`document.querySelector('#registration-email-caption').textContent`),'Email Address');
 for(const name of ['roll_number','department','year','gender'])assert.equal(await b.evaluate(`!!document.querySelector('#registration-form').elements[${JSON.stringify(name)}]`),false);
 assert.equal(await b.evaluate(`document.querySelector('[data-form-section="hostel"]').getClientRects().length`),0);
 assert.equal(await b.evaluate(`new FormData(document.querySelector('#registration-form')).has('requested_hostel_id')`),false);
 assert.equal(await b.evaluate(`document.querySelector('[data-journey="hostel"]').getClientRects().length`),0);
 assert.equal(await b.evaluate(`document.querySelector('[data-journey="account"] .journey-number').textContent`),'2');
 log('Admin has exactly seven required details and no student fields or hostel assignment');
 assert.equal(await b.evaluate(`document.querySelector('#registration-form').noValidate`),true);
 assert.equal(await b.evaluate(`document.querySelectorAll('#registration-form [aria-invalid="true"]').length`),0);
 await submit();await b.waitFor(`document.querySelectorAll('#registration-form [aria-invalid="true"]').length===7`);
 assert.equal(await b.evaluate(`document.querySelector('#r-employee_id-error').textContent`),'Please enter your administrator ID.');
 assert.equal(await b.evaluate(`document.querySelector('#r-email-error').textContent`),'Please enter your email address.');
 assert.equal(await b.evaluate(`document.querySelector('#r-admin_security_code-error').textContent`),'Please enter the administrator security code.');
 assert.equal(await b.evaluate(`document.querySelector('.guide-completed').textContent`),'0 of 7 details ready');
 assert.equal(await b.evaluate(`document.querySelector('#registration-error').textContent`),'');
 log('Empty Admin submission uses seven calm Campus Guide hints with no browser validation bubbles');
 for(const [name,value]of Object.entries({full_name:'New Campus Administrator',employee_id:'UI-ADMIN-NEW',phone:'+91 98765 43210',email:`campus.team@${domain}`,password:'Browser@123',confirm_password:'Browser@123',admin_security_code:'incorrect-admin-code'})){
  await fill({[name]:value});assert.equal(await b.evaluate(`document.querySelector('#registration-form').elements[${JSON.stringify(name)}].dataset.fieldState`),'complete');
 }
 assert.equal(await b.evaluate(`document.querySelector('.guide-percent').textContent`),'100%');
 assert.ok((await b.evaluate(`document.querySelector('.registration-submit').textContent`)).includes('Create administrator account'));
 log('Completing each Admin detail clears its hint and updates the existing progress and field checks');
 await fill({email:'not-an-email'});assert.equal(await b.evaluate(`document.querySelector('#r-email-error').textContent`),'Please enter a valid email address.');
 for(const email of ['admin@gmail.com','admin@yahoo.com','admin@outlook.com','admin@college.edu','hosteladmin@mits.ac.in','manager@company.in']){await fill({email});assert.equal(await b.evaluate(`document.querySelector('#r-email').hasAttribute('aria-invalid')`),false);}
 assert.equal(await b.evaluate(`document.querySelector('#r-email').placeholder`),'admin@example.com');
 assert.equal(await b.evaluate(`document.querySelector('#registration-email-help').textContent`),'You can use any valid email address.');
 assert.equal(await b.evaluate(`document.querySelector('#r-admin_security_code-help').textContent`),'Enter the administrator security code provided by the system owner.');
 await fill({email:`campus.team@${domain.toUpperCase()}`});assert.equal(await b.evaluate(`document.querySelector('#r-email').hasAttribute('aria-invalid')`),false);
 log('Admin accepts Gmail, Yahoo, Outlook, college and business emails with clear security-code guidance');
 await fill({phone:'123'});assert.ok((await b.evaluate(`document.querySelector('#r-phone-error').textContent`)).includes('valid phone number'));await fill({phone:'+91 98765 43210'});
 await fill({confirm_password:'Different@123'});assert.equal(await b.evaluate(`document.querySelector('#r-confirm_password-error').textContent`),"These passwords don't match yet.");await fill({confirm_password:'Browser@123'});
 log('Phone and password-match validation still works and clears during correction');
 await b.evaluate(`document.querySelector('#show-registration-password').click()`);
 assert.equal(await b.evaluate(`document.querySelector('#r-password').type`),'text');assert.equal(await b.evaluate(`document.querySelector('#r-admin_security_code').type`),'password');
 await b.evaluate(`document.querySelector('#show-registration-password').click()`);
 assert.equal(await b.evaluate(`document.querySelector('#r-admin_security_code').autocomplete`),'off');
 log('The security code stays masked when account passwords are shown');
 await submit();await b.waitFor(`document.querySelector('#r-admin_security_code-error')?.textContent==='Invalid administrator security code. Please check the code and try again.'`);
 assert.equal(await b.evaluate(`document.querySelector('#r-admin_security_code').getAttribute('aria-invalid')`),'true');
 assert.ok((await b.evaluate(`document.querySelector('#r-admin_security_code').getAttribute('aria-describedby')`)).includes('r-admin_security_code-error'));
 assert.equal(await b.evaluate(`document.querySelector('.registration-submit').disabled`),false);
 log('An incorrect code is rejected by the server and appears at its accessible field');
 await fill({role:'warden'});assert.equal(await b.evaluate(`document.querySelector('#r-admin_security_code')`),null);
 assert.equal(await b.evaluate(`document.querySelector('#registration-error').textContent`),'');
 await fill({role:'admin',employee_id:'UI-ADMIN-NEW',admin_security_code:'incorrect-admin-code'});
 await submit();await b.waitFor(`document.querySelector('#r-admin_security_code-error')?.textContent==='Invalid administrator security code. Please check the code and try again.'`);
 log('Changing roles after a rejected code removes the Admin-only server hint');
 await fill({admin_security_code:adminCode});assert.equal(await b.evaluate(`document.querySelector('#r-admin_security_code').hasAttribute('aria-invalid')`),false);
 assert.equal(await b.evaluate(`document.querySelector('#registration-error').textContent`),'');
 log('Correcting the rejected code clears the server hint and allows retry');
 for(const role of ['student','warden','security','maintenance','laundry']){
  await fill({role});assert.equal(await b.evaluate(`document.querySelector('#r-admin_security_code')`),null);
  assert.equal(await b.evaluate(`document.querySelector('#r-hostel').disabled`),false);
  assert.equal(await b.evaluate(`document.querySelector('#r-hostel').required`),true);
  assert.equal(await b.evaluate(`document.querySelector('[data-form-section="hostel"]').hidden`),false);
  assert.equal(await b.evaluate(`document.querySelector('#registration-email-caption').textContent`),'Email Address');
  assert.equal(await b.evaluate(`document.querySelector('[data-journey="account"] .journey-number').textContent`),'3');
  if(role==='student'){
   assert.ok(await b.evaluate(`!!document.querySelector('#r-roll_number')`));
   await fill({gender:'Female'});assert.deepEqual(await b.evaluate(`[...document.querySelector('#r-hostel').options].map(o=>o.value)`),['3','4']);
   await fill({gender:'Male'});assert.deepEqual(await b.evaluate(`[...document.querySelector('#r-hostel').options].map(o=>o.value)`),['1','2']);
  }
  if(role==='security')assert.ok(await b.evaluate(`!!document.querySelector('#r-shift')`));
  if(role==='maintenance')assert.ok(await b.evaluate(`!!document.querySelector('#r-specialization')`));
  await fill({role:'admin'});assert.equal(await b.evaluate(`document.querySelector('#r-admin_security_code').value`),'');
  log(`${role} fields, hostel rules and labels restore correctly when switching away from Admin`);
 }
 // Theme and responsive checks include the form in its empty, attention and complete states.
 for(const mode of ['light','dark'])for(const width of [1440,768,430,390]){
  await b.viewport(width,1100);await theme(mode);
  assert.equal(await b.evaluate(`document.documentElement.scrollWidth>innerWidth`),false);
  await submit();await b.waitFor(`document.querySelector('#r-admin_security_code-error')`);
  await fill({full_name:'New Campus Administrator',employee_id:'UI-ADMIN-NEW',phone:'+91 98765 43210',email:`campus.team@${domain}`,password:'Browser@123',confirm_password:'Browser@123'});
  const colors=await b.evaluate(`(()=>{const input=getComputedStyle(document.querySelector('#r-admin_security_code')),hint=getComputedStyle(document.querySelector('#r-admin_security_code-error'));let parent=document.querySelector('#r-admin_security_code-error').parentElement,bg;while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)')break;parent=parent.parentElement;}return{inputText:input.color,inputBg:input.backgroundColor,hintText:hint.color,hintBg:bg};})()`);
  assert.ok(contrast(colors.inputText,colors.inputBg)>=4.5,JSON.stringify(colors));assert.ok(contrast(colors.hintText,colors.hintBg)>=4.5,JSON.stringify(colors));
  const geometry=await b.evaluate(`(()=>{const el=document.querySelector('#r-admin_security_code'),icon=el.closest('.field-status-host').querySelector('.field-status'),a=el.getBoundingClientRect(),i=icon.getBoundingClientRect();return{left:a.left,right:a.right,iconLeft:i.left,iconRight:i.right};})()`);
  assert.ok(geometry.iconLeft>geometry.left&&geometry.iconRight<geometry.right);
  await fill({admin_security_code:adminCode});assert.equal(await b.evaluate(`document.querySelector('.guide-percent').textContent`),'100%');
  assert.equal(await b.evaluate(`document.documentElement.scrollWidth>innerWidth`),false);
  await b.evaluate(`scrollTo(0,0)`);await b.screenshot(`admin-registration-${mode}-${width}`);
  log(`Admin registration ${mode} mode at ${width}px: readable hints, aligned icons and no overflow`);
 }
 await b.viewport(1440,1100);await submit();await b.waitFor(`document.querySelector('.registration-success')`);
 assert.ok((await b.evaluate(`document.querySelector('.registration-success').innerText`)).includes('Administrator account created'));
 assert.ok((await b.evaluate(`document.querySelector('.success-details').innerText`)).includes('All four hostels'));
 assert.equal(await b.evaluate(`document.querySelector('.success-details .badge').textContent.trim()`),'Active');
 assert.equal(await b.evaluate(`document.querySelector('#r-admin_security_code')`),null);
 assert.equal(await b.evaluate(`JSON.stringify(localStorage).includes(${JSON.stringify(adminCode)})`),false);
 const source=await b.evaluate(`Promise.all(['/register','/js/register.js','/js/validation.js','/api/registration-options'].map(url=>fetch(url).then(r=>r.text()))).then(values=>values.join(''))`);assert.ok(!source.includes(adminCode));
 await b.screenshot('admin-registration-success');
 log('Valid code creates an active global Admin and shows the existing success panel without retaining the code');
 await b.evaluate(`document.querySelector('.registration-success a').click()`);await b.waitFor(`location.pathname==='/login'&&document.querySelector('#login-form')?.dataset.role==='admin'`);
 assert.ok(await b.evaluate(`document.querySelector('#admin-security-code')?.required`));
 await fill({email:`campus.team@${domain}`,password:'Browser@123',admin_security_code:adminCode},'#login-form');
 await b.evaluate(`document.querySelector('#login-form').requestSubmit()`);await b.waitFor(`location.pathname==='/app/dashboard'&&document.querySelector('#hostel-scope')`);
 const me=await api('me');assert.equal(me.user.role,'admin');assert.equal(me.user.hostel_id,null);assert.equal(me.hostels.length,4);
 assert.equal(await b.evaluate(`document.querySelector('#hostel-scope').disabled`),false);
 assert.equal(await b.evaluate(`document.querySelectorAll('#hostel-scope option').length`),5);
 for(const hostel of me.hostels){const dashboard=await api(`dashboard?hostel_id=${hostel.id}`);assert.equal(dashboard.hostels.length,1);assert.equal(dashboard.hostels[0].id,hostel.id);}
 log('The new Admin signs in with the existing secure login and can access all four hostels');
 assert.ok(!(await api('approvals')).rows.some(r=>r.id===me.user.id));
 await b.evaluate(`document.querySelector('[data-action="logout"]').click()`);await b.waitFor(`location.pathname==='/login'`);
 assert.equal(await b.evaluate(`fetch('/api/me').then(r=>r.status)`),401);
 assert.equal(await b.evaluate(`document.documentElement.dataset.theme`),'dark');
 log('Admin never enters self-approval; logout revokes access and retains the selected theme');
 assert.deepEqual(b.errors,[]);assert.equal(stderr,'');log('No browser runtime or application server errors');
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/admin-registration-browser-results.json',JSON.stringify(results,null,2));console.log(`${results.length} Admin registration browser checks passed.`);
}finally{b.close();child.kill();}
