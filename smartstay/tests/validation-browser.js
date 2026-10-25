import assert from 'node:assert/strict';
import {testEmail,seedStudentEmail,testAccountEmail} from './auth-fixtures.js';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp.js';

const adminCode='Validation-browser-admin-code-2026';
const child=spawn(process.execPath,['tests/browser-server.js'],{cwd:process.cwd(),env:{...process.env,PORT:'5008',SMARTSTAY_DB:':memory:',ADMIN_SECURITY_CODE:adminCode},stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',data=>stderr+=data);
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Validation test server did not start')),15000);child.stdout.on('data',data=>{if(String(data).includes('running')){clearTimeout(timer);resolve();}});child.on('error',reject);});
const b=await connect(9223,'http://127.0.0.1:5008'),results=[];
const log=label=>{results.push({label,passed:true});console.log('PASS '+label);};
const click=selector=>b.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
async function fill(values,selector='#record-form',event='input'){
  await b.evaluate(`(()=>{const f=document.querySelector(${JSON.stringify(selector)});for(const [name,value] of Object.entries(${JSON.stringify(values)})){const el=f.elements[name]||f.querySelector('#'+name);if(!el)throw Error('Missing '+name);if(el.type==='checkbox')el.checked=value;else el.value=String(value);el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));}})()`);
}
async function api(path,method='GET',data,status=200){return b.evaluate(`fetch('/api/${path}',{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json','X-SmartStay-Request':'1'},${data===undefined?'':`body:${JSON.stringify(JSON.stringify(data))},`}}).then(async r=>{const d=await r.json();if(r.status!==${status})throw Error(r.status+': '+JSON.stringify(d));return d;})`);}
async function page(path){await b.navigate(path);await b.waitFor(`location.pathname===${JSON.stringify(path.split('?')[0])}&&document.readyState==='complete'`);await b.waitFor(path==='/register'?`document.querySelector('#registration-form')`:path.startsWith('/login')?`document.querySelector('#login-roles [aria-selected="true"]') && document.querySelector('#login-form').dataset.role`:`document.querySelector('#page .page-heading')`);}
async function theme(value){await b.evaluate(`if(document.documentElement.dataset.theme!==${JSON.stringify(value)})document.querySelector('[data-theme-toggle]').click()`);await b.waitFor(`!document.documentElement.classList.contains('theme-changing')`);}
async function monitor(){await b.evaluate(`(()=>{window.validationPosts=0;const original=window.fetch;window.fetch=(url,opts)=>{if(opts?.method&&opts.method!=='GET')window.validationPosts++;return original(url,opts);};})()`);}
async function error(name,selector='#record-form'){return b.evaluate(`(()=>{const f=document.querySelector(${JSON.stringify(selector)}),el=f.elements[${JSON.stringify(name)}]||f.querySelector('#'+${JSON.stringify(name)});return el?.id?document.getElementById(el.id+'-error')?.textContent||'':'';})()`);}
async function emptySubmit(selector){await b.evaluate(`(()=>{const f=document.querySelector(${JSON.stringify(selector)}),button=f.querySelector('button[type="submit"],button:not([type])');if(button)button.click();else f.requestSubmit();})()`);assert.equal(await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).noValidate`),true);assert.equal(await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).querySelector('.validation-summary').textContent`),selector==='#registration-form'?'':'A few details need your attention. Follow the notes below.');}
async function accessible(selector){assert.equal(await b.evaluate(`(()=>{const f=document.querySelector(${JSON.stringify(selector)});return [...f.querySelectorAll('[aria-invalid="true"]')].every(el=>{const id=el.id+'-error',e=document.getElementById(id);return e&&el.getAttribute('aria-describedby').split(' ').includes(id)&&e.querySelector('span').textContent&&el.dataset.fieldState==='attention'&&(el.closest('label')||el.closest('.field-status-host'))?.querySelector('.field-status svg[aria-hidden="true"]');});})()`),true);}
async function layout(selector){assert.equal(await b.evaluate(`document.documentElement.scrollWidth>innerWidth`),false);assert.equal(await b.evaluate(`(()=>{const f=document.querySelector(${JSON.stringify(selector)}),r=f.getBoundingClientRect();return [...f.querySelectorAll('.field-error')].every(e=>{const x=e.getBoundingClientRect();return x.left>=r.left-1&&x.right<=r.right+1&&x.height>0;});})()`),true);}
async function contrast(selector){
  const ratios=await b.evaluate(`(()=>{const rgb=s=>s.match(/[\\d.]+/g)?.slice(0,3).map(Number),lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);return [...document.querySelectorAll(${JSON.stringify(selector)})].filter(el=>el.getClientRects().length&&el.textContent.trim()).map(el=>{let p=el,bg;while(p){const c=getComputedStyle(p).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'){bg=rgb(c);break;}p=p.parentElement;}const a=lum(rgb(getComputedStyle(el).color)),z=lum(bg||[255,255,255]);return (Math.max(a,z)+.05)/(Math.min(a,z)+.05);});})()`);
  assert.ok(ratios.length);assert.ok(ratios.every(v=>v>=4.5),`Validation text contrast: ${ratios}`);
}
async function guideSnapshot(){return b.evaluate(`(()=>{const f=document.querySelector('#registration-form'),p=f.querySelector('.guide-progress');return {percent:Number(p.getAttribute('aria-valuenow')),count:f.querySelector('.guide-count').textContent,completed:f.querySelector('.guide-completed').textContent,button:f.querySelector('[type="submit"]').textContent.trim(),fields:[...f.querySelectorAll('[required]')].filter(e=>e.name!=='role').length};})()`);}
async function statusLayout(){assert.equal(await b.evaluate(`(()=>{return [...document.querySelectorAll('.field-status-host>.field-status')].filter(s=>s.dataset.state!=='neutral').every(s=>{const e=s.parentElement.querySelector('input,select'),r=e.getBoundingClientRect(),x=s.getBoundingClientRect(),padding=parseFloat(getComputedStyle(e).paddingRight);return x.left>=r.left&&x.right<=r.right&&x.top>=r.top&&x.bottom<=r.bottom&&padding>=r.right-x.left+3&&(e.tagName!=='SELECT'||r.right-x.right>=26);});})()`),true,'Field icons must leave text and native controls clear');}
async function login(role,email=testAccountEmail(role),password=role[0].toUpperCase()+role.slice(1)+'@123'){
  // Stop the previous portal's polling before removing its session cookie.
  await b.send('Page.navigate',{url:'about:blank'});await b.waitFor(`location.href==='about:blank'&&document.readyState==='complete'`);
  await b.send('Network.clearBrowserCookies');await page(`/login?role=${role}`);
  await fill({email,password,...(role==='admin'?{admin_security_code:adminCode}:{})},'#login-form');
  await b.evaluate(`document.querySelector('#login-form').requestSubmit()`);await b.waitFor(`location.pathname==='/app/dashboard'&&document.querySelector('#page .page-heading')`);
}
async function open(module,action){await page(`/app/${module}`);await click(`[data-action="${action}"]`);await b.waitFor(`document.querySelector('#modal').open&&document.querySelector('#record-form')`);}
async function submitModal(){await b.evaluate(`document.querySelector('#record-form').requestSubmit()`);await b.waitFor(`!document.querySelector('#modal').open||document.querySelector('#record-form .form-error')?.textContent`);assert.equal(await b.evaluate(`document.querySelector('#modal').open?document.querySelector('#record-form .form-error')?.textContent:''`),'');}

try{
  await b.viewport(1440,1000);await page('/register');
  assert.equal(await b.evaluate(`document.querySelectorAll('.field-error,[aria-invalid="true"]').length`),0);
  await b.evaluate(`document.querySelector('#r-full_name').focus();document.querySelector('#r-phone').focus()`);
  assert.equal(await error('full_name','#registration-form'),"What should we call you? Add your full name.");
  assert.equal(await b.evaluate(`document.querySelector('.validation-summary')?.textContent||''`),'');
  await fill({full_name:'Campus Resident'},'#registration-form');assert.equal(await error('full_name','#registration-form'),'');
  assert.equal(await b.evaluate(`document.querySelector('#r-full_name').dataset.fieldState`),'complete');
  assert.equal(await b.evaluate(`document.querySelector('#r-full_name').closest('.field-status-host').querySelector('.field-status').dataset.state`),'complete');
  const initialGuide=await guideSnapshot();assert.equal(initialGuide.percent,50);assert.equal(initialGuide.fields,10);
  log('Untouched registration is quiet; touched fields validate and clear immediately');

  for(const mode of ['light','dark'])for(const width of [1440,390]){
    await b.viewport(width,1000);await page('/register');await theme(mode);await monitor();
    await emptySubmit('#registration-form');assert.equal(await b.evaluate(`window.validationPosts`),0);
    assert.equal(await b.evaluate(`document.activeElement.id`),'r-full_name');
    assert.equal(await b.evaluate(`document.querySelectorAll('.field-error').length`),6);await accessible('#registration-form');await layout('#registration-form');await contrast('.field-error,.validation-summary,.guide-count,.guide-completed,.guide-title');
    assert.equal((await guideSnapshot()).percent,40);assert.match((await guideSnapshot()).count,/6 details still need your attention/);assert.match((await guideSnapshot()).button,/Complete registration/);
    assert.equal(await b.evaluate(`document.querySelector('#registration-error').getClientRects().length`),0);assert.equal(await b.evaluate(`document.querySelector('.field-error svg')`),null);
    await statusLayout();await click('[data-journey="account"]');assert.equal(await b.evaluate(`document.activeElement.name`),'email');assert.equal(await b.evaluate(`document.querySelector('[aria-current="step"]').dataset.journey`),'account');
    await fill({full_name:'Campus Resident'},'#registration-form');assert.equal((await guideSnapshot()).percent,50);await click('.guide-next');assert.equal(await b.evaluate(`document.activeElement.name`),'phone');
    await b.evaluate(`document.querySelector('#r-full_name').focus()`);
    await b.screenshot(`validation-registration-${mode}-${width}`);
    await fill({full_name:'Campus Resident',phone:'+91 98765 43210',roll_number:'23VAL101',email:'invalid-email',password:'short',confirm_password:'Different@123'},'#registration-form');
    assert.equal(await error('email','#registration-form'),'Please enter a valid email address.');
    assert.equal(await error('password','#registration-form'),'Please use at least 8 characters for your password.');
    assert.equal(await error('confirm_password','#registration-form'),"These passwords don't match yet.");
    await fill({email:testEmail('23VAL101'),password:'Different@123'},'#registration-form');
    assert.equal(await b.evaluate(`document.querySelectorAll('[aria-invalid="true"]').length`),0);
    assert.equal(await b.evaluate(`document.querySelector('.validation-summary').hidden`),true);
    assert.equal((await guideSnapshot()).percent,100);assert.match((await guideSnapshot()).button,/Submit registration/);assert.equal(await b.evaluate(`document.querySelector('.guide-title').textContent`),'Everything looks good!');await statusLayout();
    await fill({phone:'wrong'},'#registration-form');assert.match(await error('phone','#registration-form'),/valid phone/);
    await fill({phone:'+91 98765 43210',roll_number:'??'},'#registration-form');assert.match(await error('roll_number','#registration-form'),/letters, numbers/);
    await fill({roll_number:'23VAL101',department:'',year:'',gender:'',requested_hostel_id:''},'#registration-form');
    await emptySubmit('#registration-form');
    assert.equal(await error('department','#registration-form'),"Choose the department you're studying in.");
    assert.equal(await error('year','#registration-form'),"Select your current year of study.");
    assert.equal(await error('gender','#registration-form'),"Select your gender to show the appropriate hostel options.");
    assert.equal(await error('requested_hostel_id','#registration-form'),"Choose the hostel type you prefer.");
    log(`${mode} registration at ${width}px: inline errors, correction, email, phone, passwords, selects, ARIA and contrast`);
  }

  for(const mode of ['light','dark'])for(const width of [1024,768,430]){
    await b.viewport(width,1000);await page('/register');await theme(mode);await emptySubmit('#registration-form');await layout('#registration-form');await statusLayout();await contrast('.field-error,.guide-count,.guide-completed,.guide-title');
    if(width===430)assert.equal(await b.evaluate(`getComputedStyle(document.querySelector('#role-fields>.form-grid')).gridTemplateColumns.split(' ').length`),1);
    await fill({role:'security'},'#registration-form','change');assert.equal(await b.evaluate(`document.querySelector('[name="roll_number"]')`),null);assert.ok(await error('employee_id','#registration-form'));assert.equal((await guideSnapshot()).fields,8);assert.equal(await b.evaluate(`document.querySelector('[data-form-section="hostel"] legend b').textContent`),'HOSTEL ASSIGNMENT');await statusLayout();
    await fill({role:'student',gender:'Female'},'#registration-form','change');assert.deepEqual(await b.evaluate(`[...document.querySelector('#r-hostel').options].map(e=>e.value)`),['3','4']);assert.equal(await b.evaluate(`document.querySelector('[name="employee_id"]')`),null);assert.equal((await guideSnapshot()).fields,10);await layout('#registration-form');
    log(`${mode} Campus Guide, role changes, gender choices, icons and section hierarchy at ${width}px`);
  }
  await b.viewport(1440,1000);
  for(const role of ['student','warden','security','maintenance','laundry']){
    await page('/register');await fill({role},'#registration-form','change');await emptySubmit('#registration-form');await accessible('#registration-form');
    assert.equal(await error(role==='student'?'roll_number':'employee_id','#registration-form'),role==='student'?"Add your college roll number to identify your student record.":"Add your employee ID to identify your staff record.");
    if(role==='security'){await fill({shift:''},'#registration-form');assert.equal(await error('shift','#registration-form'),"Choose your working shift.");}
    if(role==='maintenance'){await fill({specialization:''},'#registration-form');assert.equal(await error('specialization','#registration-form'),"Choose your maintenance specialization.");}
    const values={full_name:`Validation ${role} Resident`,phone:'+91 98765 43210',email:role==='student'?testEmail('23VALIDATION'):`validation-${role}@gmail.com`,password:'Validation@123',confirm_password:'Validation@123',...(role==='student'?{roll_number:'23VALIDATION',gender:'Female',department:'ECE',year:2}:{employee_id:`VAL-${role}`}),...(role==='security'?{shift:'Night'}:{}),...(role==='maintenance'?{specialization:'Electrical'}:{})};
    await fill(values,'#registration-form','change');await fill({requested_hostel_id:role==='student'?3:1},'#registration-form');
    assert.equal(await b.evaluate(`document.querySelectorAll('.field-error').length`),0);
    assert.equal((await guideSnapshot()).percent,100);assert.match((await guideSnapshot()).button,/Submit registration/);
    await b.evaluate(`(()=>{const original=window.fetch;window.fetch=async(...args)=>{if(args[0]==='/api/auth/register')await new Promise(r=>setTimeout(r,300));return original(...args);};document.querySelector('#registration-form').requestSubmit();})()`);
    assert.equal(await b.evaluate(`document.querySelector('#registration-form [type="submit"]').getAttribute('aria-busy')`),'true');assert.match(await b.evaluate(`document.querySelector('#registration-form [type="submit"]').textContent`),/Sending for approval/);await b.waitFor(`document.querySelector('.registration-success')`);
    assert.ok((await b.evaluate(`document.querySelector('.registration-success').textContent`)).includes("Registration sent for approval"));
    assert.ok((await b.evaluate(`document.querySelector('.success-details').textContent`)).includes('Awaiting approval'));assert.ok(await b.evaluate(`document.querySelector('.success-details b').textContent.startsWith(${JSON.stringify(role==='student'?'Girls Hostel':'Boys Hostel')})`));
    await page(`/login?role=${role}`);await fill({email:values.email,password:values.password},'#login-form');await b.evaluate(`document.querySelector('#login-form').requestSubmit()`);
    await b.waitFor(`document.querySelector('#login-error')?.textContent`);assert.equal(await b.evaluate(`document.querySelector('#login-error').textContent`),'Your registration is awaiting administrator approval.');
    log(`${role}: empty form validates, corrections clear errors, real registration succeeds and pending login stays blocked`);
  }

  // Backend uniqueness remains enforced and its errors attach to the affected field.
  await page('/register');await fill({full_name:'Duplicate Resident',phone:'+91 98765 43210',email:testEmail('23VALIDATION'),password:'Validation@123',confirm_password:'Validation@123',roll_number:'23VALIDATION'},'#registration-form');
  await b.evaluate(`document.querySelector('#registration-form').requestSubmit()`);await b.waitFor(`document.querySelector('#r-email-error')`);assert.match(await error('email','#registration-form'),/already/);
  await login('admin');const duplicateSeed=await api('students/2');await api('students/2','PATCH',{...duplicateSeed,email:'legacy-roll-test@gmail.com'});
  await page('/register');await fill({full_name:'Duplicate Legacy Resident',phone:'+91 98765 43210',email:seedStudentEmail(2),password:'Validation@123',confirm_password:'Validation@123',roll_number:duplicateSeed.registration_number},'#registration-form');assert.equal(await error('email','#registration-form'),'');
  await b.evaluate(`document.querySelector('#registration-form').requestSubmit()`);await b.waitFor(`document.querySelector('#r-roll_number-error')`);assert.match(await error('roll_number','#registration-form'),/already registered/);
  await fill({roll_number:'23UNIQUENEW',email:testEmail('23UNIQUENEW')},'#registration-form');assert.equal(await error('roll_number','#registration-form'),'');log('Server duplicate email and legacy roll number errors appear inline and clear on correction');

  // Approval and activation are still the existing backend workflow.
  await login('admin');await api('students/2','PATCH',{...duplicateSeed,email:seedStudentEmail(2)});await page('/app/approvals');const pending=(await api('approvals')).rows.filter(r=>(r.email.startsWith('validation-')||r.email===testEmail('23VALIDATION'))&&r.account_status==='PENDING');assert.equal(pending.length,5);
  for(const account of pending){await click(`[data-action="approval-approve"][data-id="${account.id}"]`);await b.waitFor(`document.querySelector('#modal').open&&document.querySelector('#record-form')`);await emptySubmit('#record-form');assert.equal(await error('confirmed'),'Please confirm before continuing.');await fill({confirmed:true});await submitModal();}
  for(const account of pending){await login(account.role,account.email,'Validation@123');assert.equal((await api('me')).user.role,account.role);}
  log('All five corrected registrations complete admin approval, activation and role login');

  for(const mode of ['light','dark'])for(const width of [1440,390]){
    await b.viewport(width,1000);await page('/login?role=admin');await theme(mode);await monitor();await fill({email:'',password:'',admin_security_code:''},'#login-form');await emptySubmit('#login-form');
    assert.equal(await error('email','#login-form'),"Please enter your email address.");assert.equal(await error('password','#login-form'),"Enter your password to access your residence.");assert.equal(await error('admin_security_code','#login-form'),'Please enter your admin security code.');await accessible('#login-form');await layout('#login-form');await contrast('.field-error,.validation-summary');assert.equal(await b.evaluate(`window.validationPosts`),0);
    await click('[data-role="student"]');assert.equal(await error('admin_security_code','#login-form'),'');await b.waitFor(`document.querySelector('#login-form').dataset.role`);
    await fill({email:'invalid'},'#login-form');assert.equal(await error('email','#login-form'),'Please enter a valid email address.');
    await b.screenshot(`validation-login-${mode}-${width}`);await click('#forgot');await b.waitFor(`document.querySelector('#record-form')`);await fill({email:''});await emptySubmit('#record-form');assert.equal(await error('email'),"Please enter your email address.");await accessible('#record-form');await layout('#record-form');await click('[data-close]');
    log(`${mode} login and recovery at ${width}px: inline errors, role switching, accessibility and contrast`);
  }

  await b.viewport(1440,1000);await login('student');
  for(const mode of ['light','dark']){
    await theme(mode);
    for(const [module,values] of [['leaves',{destination:'',emergency_contact:'',reason:'',from_date:'',to_date:'',departure_time:'',expected_return:''}],['maintenance',{description:''}],['complaints',{description:''}],['laundry',{clothes_count:'',pickup_date:''}]]){
      await open(module,'new-request');await monitor();await fill(values);await emptySubmit('#record-form');await accessible('#record-form');await layout('#record-form');await contrast('.field-error,.validation-summary');assert.equal(await b.evaluate(`window.validationPosts`),0);
      if(module==='leaves'){await fill({from_date:'2030-12-20',to_date:'2030-12-19'});assert.match(await error('to_date'),/on or after your departure/);await fill({from_date:'2030-12-18'});assert.equal(await error('to_date'),'');}
      if(module==='laundry'){await fill({clothes_count:101});assert.equal(await error('clothes_count'),'Please enter 100 or less.');await fill({clothes_count:2.5});assert.match(await error('clothes_count'),/whole number/);await fill({clothes_count:8});assert.equal(await error('clothes_count'),'');}
      if(module==='maintenance'){
        await b.evaluate(`(()=>{const f=document.querySelector('#f-attachment'),dt=new DataTransfer();dt.items.add(new File(['x'],'invalid.txt',{type:'text/plain'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));})()`);assert.match(await error('attachment'),/PNG, JPG, WebP, or PDF/);
        await b.evaluate(`(()=>{const f=document.querySelector('#f-attachment'),dt=new DataTransfer();dt.items.add(new File([new Uint8Array(2097153)],'large.pdf',{type:'application/pdf'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));})()`);assert.match(await error('attachment'),/smaller than 2 MB/);
        await b.evaluate(`document.querySelector('#f-attachment').value='';document.querySelector('#f-attachment').dispatchEvent(new Event('change',{bubbles:true}))`);assert.equal(await error('attachment'),'');
      }
      await b.viewport(390,1000);await layout('#record-form');await b.screenshot(`validation-${module}-${mode}-mobile`);await b.viewport(1440,1000);await click('[data-close]');
      log(`${mode} ${module} validation: required fields, workflow constraints, desktop and mobile modal`);
    }
    await open('settings','change-password');await fill({current_password:'Student@123',new_password:'New@12345',confirm_password:'Other@1234'});await emptySubmit('#record-form');assert.match(await error('confirm_password'),/don't match/);await fill({new_password:'Other@1234'});assert.equal(await error('confirm_password'),'');await click('[data-close]');
    await open('safety','raise-emergency');await fill({details:'Validation safety example'});await monitor();await emptySubmit('#record-form');assert.equal(await error('confirmed'),'Please confirm before continuing.');assert.equal(await b.evaluate(`window.validationPosts`),0);await accessible('#record-form');await click('[data-close]');
    log(`${mode} password confirmation and SOS required checkbox retain their safeguards`);
  }
  // Real shared-modal submissions after correcting visible errors.
  for(const [module,values] of [['leaves',{destination:'Hyderabad',reason:'Validation leave workflow',emergency_contact:'+91 98765 43210',from_date:'2030-12-20',to_date:'2030-12-21'}],['maintenance',{description:'Validation maintenance workflow'}],['complaints',{description:'Validation complaint workflow',confidential:true}],['laundry',{clothes_count:7}]]){
    await open(module,'new-request');await fill(Object.fromEntries(Object.keys(values).filter(k=>!['from_date','to_date','confidential'].includes(k)).map(k=>[k,''])));await emptySubmit('#record-form');await fill(values);await submitModal();assert.ok((await api(module)).length);log(`${module} saves normally after correcting inline errors`);
  }

  await login('admin');
  for(const mode of ['light','dark']){
    await theme(mode);
    for(const [module,action,values] of [['students','add-student',{full_name:'',email:'',registration_number:'',phone:'',guardian_name:'',guardian_phone:'',emergency_phone:''}],['students','edit-student',{full_name:'',phone:''}],['wardens','add-person',{full_name:'',email:'',phone:''}],['staff','add-person',{name:'',phone:''}]]){
      await open(module,action);await monitor();await fill(values);await emptySubmit('#record-form');await accessible('#record-form');await contrast('.field-error,.validation-summary');assert.equal(await b.evaluate(`window.validationPosts`),0);await b.viewport(390,1000);await layout('#record-form');await b.viewport(1440,1000);await click('[data-close]');log(`${mode} ${module}/${action} uses shared validation in desktop and mobile`);
    }
    await open('allocations','allocate');await b.waitFor(`document.querySelector('#f-bed_id')?.value`);await fill({bed_id:''});await emptySubmit('#record-form');assert.equal(await error('bed_id'),'Please select an available bed.');await accessible('#record-form');await click('[data-close]');
    await page('/app/settings');await monitor();await fill({gate_open:'',gate_close:'',support_phone:''},'#settings-form');await emptySubmit('#settings-form');await accessible('#settings-form');assert.equal(await b.evaluate(`window.validationPosts`),0);await fill({gate_open:'22:00',gate_close:'05:30',support_phone:'+91 98765 40000'},'#settings-form');assert.match(await error('gate_close','#settings-form'),/after the gate opens/);await fill({gate_open:'05:00'},'#settings-form');assert.equal(await error('gate_close','#settings-form'),'');await b.viewport(390,1000);await layout('#settings-form');await b.viewport(1440,1000);
    for(const [module,selector] of [['attendance','#attendance-dates'],['reports','#report-filter']]){await page(`/app/${module}`);await fill({from:'2030-12-20',to:'2030-12-19'},selector);await emptySubmit(selector);assert.match(await error('to',selector),/on or after/);await b.viewport(390,1000);await layout(selector);await b.viewport(1440,1000);}
    log(`${mode} room allocation, settings, attendance and report filters preserve validation and responsive layout`);
  }
  await page('/app/students');await click('[data-action="import-students"]');await b.waitFor(`document.querySelector('#modal').open&&document.querySelector('#import-form')`);await monitor();await emptySubmit('#import-form');await accessible('#import-form');assert.equal(await b.evaluate(`window.validationPosts`),0);await b.evaluate(`(()=>{const f=document.querySelector('#import-form input'),dt=new DataTransfer();dt.items.add(new File(['full_name'],'roster.csv',{type:'text/csv'}));f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));})()`);assert.equal(await b.evaluate(`document.querySelector('#import-form [aria-invalid="true"]')===null`),true);await click('[data-close]');log('Student CSV upload uses shared validation and accepts the existing CSV format');
  await login('security');const gateStudent=(await api('gate')).students[0];await monitor();await emptySubmit('#scan-form');assert.equal(await error('scan-id','#scan-form'),'Please enter a student ID, roll number, or email.');await accessible('#scan-form');await b.viewport(390,1000);await layout('#scan-form');await fill({'scan-id':gateStudent.student_code},'#scan-form');assert.equal(await error('scan-id','#scan-form'),'');await b.evaluate(`document.querySelector('#scan-form').requestSubmit()`);await b.waitFor(`document.querySelector('#scan-result').textContent.includes(${JSON.stringify(gateStudent.full_name)})`);log('Gate scanner validates inline, clears on input, and still finds an assigned-hostel student');
  assert.deepEqual(b.errors,[]);assert.equal(stderr,'');log('No browser exceptions or server errors');
  mkdirSync('test-results',{recursive:true});writeFileSync('test-results/validation-browser-results.json',JSON.stringify(results,null,2));console.log(`${results.length} validation browser checks passed.`);
}finally{b.close();child.kill();}
