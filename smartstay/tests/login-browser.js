import assert from 'node:assert/strict';
import {testEmail,seedStudentEmail,testAccountEmail} from './auth-fixtures.js';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {connect} from './cdp.js';

// Isolated database and private test code; never use or modify development accounts.
const adminCode='Login-browser-test-code-2026';
const child=spawn(process.execPath,['tests/browser-server.js'],{
  cwd:process.cwd(),env:{...process.env,PORT:'5010',SMARTSTAY_DB:':memory:',ADMIN_SECURITY_CODE:adminCode},
  stdio:['ignore','pipe','pipe']
});
let serverErrors='';child.stderr.on('data',data=>serverErrors+=data);
let browser;
const results=[];
const roles=['student','warden','security','maintenance','laundry','admin'];
const label=role=>role[0].toUpperCase()+role.slice(1);
const log=name=>{results.push({name,passed:true});console.log('PASS '+name);};

try{
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Login test server did not start')),15000);
    child.stdout.on('data',data=>{if(String(data).includes('running')){clearTimeout(timer);resolve();}});
    child.on('error',reject);child.on('exit',code=>{if(code){clearTimeout(timer);reject(Error('Test server exited: '+code));}});
  });
  browser=await connect(9223,'http://127.0.0.1:5010');
  const b=browser;
  const click=selector=>b.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  async function loginPage(role='student',extra=''){
    await b.send('Network.clearBrowserCookies');await b.navigate(`/login?role=${role}${extra}`);
    await b.waitFor(`location.pathname==='/login' && document.querySelector('#login-roles [aria-selected="true"]')?.dataset.role===${JSON.stringify(role)}`);
    await b.waitFor(`document.querySelector('#login-form').dataset.role`);
  }
  async function fill(values,selector='#login-form'){
    await b.evaluate(`(()=>{const f=document.querySelector(${JSON.stringify(selector)});for(const [key,value] of Object.entries(${JSON.stringify(values)})){const el=f.elements[key];if(el.type==='checkbox')el.checked=value;else el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
  }
  async function theme(value){
    await b.evaluate(`if(document.documentElement.dataset.theme!==${JSON.stringify(value)})document.querySelector('[data-theme-toggle]').click()`);
    await b.waitFor(`!document.documentElement.classList.contains('theme-changing')`);
  }
  async function submit(success=true){
    await click('#login-form [type="submit"]');
    await b.waitFor(success?`location.pathname==='/app/dashboard'&&document.querySelector('#page .page-heading')`:`document.querySelector('#login-error')?.textContent && !document.querySelector('#login-form [type="submit"]').disabled`);
  }
  async function status(path){return b.evaluate(`fetch('/api/${path}').then(r=>r.status)`);}
  async function audit(){
    const ratios=await b.evaluate(`(()=>{
      const rgb=s=>s.match(/[\\d.]+/g).slice(0,3).map(Number);
      const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
      return [...document.querySelectorAll('.campus-role-card b,.campus-role-card small,.campus-access>p,.login-email-help,.login-register,.login-security')].filter(el=>el.getClientRects().length).map(el=>{
        let p=el,bg;while(p){const color=getComputedStyle(p).backgroundColor;if(color!=='rgba(0, 0, 0, 0)'){bg=rgb(color);break;}p=p.parentElement;}
        const a=lum(rgb(getComputedStyle(el).color)),z=lum(bg||[255,255,255]);return (Math.max(a,z)+.05)/(Math.min(a,z)+.05);
      });
    })()`);
    assert.ok(ratios.length&&ratios.every(ratio=>ratio>=4.5),'Login text contrast: '+ratios);
    assert.equal(await b.evaluate('document.documentElement.scrollWidth>innerWidth'),false);
  }

  await b.viewport(1440,1000);await loginPage();await theme('light');
  assert.equal(await b.evaluate(`document.querySelector('.auth-mode')`),null);
  assert.equal(await b.evaluate(`document.querySelectorAll('#login-roles [role="tab"]').length`),6);
  assert.equal(await b.evaluate(`document.querySelector('#demo-access,#use-demo,#student-demo-hostel')`),null);
  assert.equal(await b.evaluate(`document.querySelector('#email').value+document.querySelector('#password').value`),'');
  assert.ok(!(await b.evaluate(`document.body.innerText`)).includes('Demo Access'));
  await click('#login-form [type="submit"]');
  assert.equal(await b.evaluate(`document.querySelector('#login-form').noValidate`),true);
  assert.equal(await b.evaluate(`document.querySelectorAll('#login-form [aria-invalid="true"]').length`),2);
  assert.equal(await b.evaluate(`document.activeElement.id`),'email');
  assert.equal(await b.evaluate(`document.querySelector('#email').getAttribute('aria-labelledby')`),'email-caption');
  log('Student default, six cards, empty personal login, no demo UI and accessible custom validation');

  for(const role of roles){
    await loginPage(role);
    assert.equal(await b.evaluate(`document.querySelectorAll('#login-roles [aria-selected="true"]').length`),1);
    assert.equal(await b.evaluate(`document.querySelector('#login-heading').textContent`),role==='admin'?'Administrator Sign In':'Sign in as '+label(role));
    assert.equal(await b.evaluate(`document.querySelector('#login-submit-label').textContent`),'Sign in as '+(role==='admin'?'Administrator':label(role)));
    assert.equal(await b.evaluate(`document.querySelector('#admin-code-label').hidden`),role!=='admin');
    assert.equal(await b.evaluate(`document.querySelector('#admin-security-code').required`),role==='admin');
    assert.equal(await b.evaluate(`document.querySelector('#admin-security-code').disabled`),role!=='admin');
    assert.equal(await b.evaluate(`document.querySelector('#login-details').getAttribute('aria-labelledby')`),'role-'+role);
    assert.equal(await b.evaluate(`document.querySelector('#email-caption').textContent`),'Email Address');
    assert.equal(await b.evaluate(`document.querySelector('#login-email-help').hidden`),false);
    await fill({email:testAccountEmail(role),password:label(role)+'@123'});
    assert.equal(await b.evaluate(`document.querySelector('#admin-security-code').value`),'');
    await click('#show-password');assert.equal(await b.evaluate(`document.querySelector('#password').type`),'text');
    assert.equal(await b.evaluate(`document.querySelector('#show-password').getAttribute('aria-pressed')`),'true');
    await click('#show-password');assert.equal(await b.evaluate(`document.querySelector('#password').type`),'password');
    await fill({remember:role==='student',...(role==='admin'?{admin_security_code:adminCode}:{})});
    if(role==='admin')assert.equal(await b.evaluate(`document.body.innerText.includes(${JSON.stringify(adminCode)})`),false);
    await submit();
    const me=await b.evaluate(`fetch('/api/me').then(r=>r.json())`);assert.equal(me.user.role,role);
    const cookie=(await b.send('Network.getCookies')).cookies.find(c=>c.name==='smartstay_session');
    assert.ok(cookie.httpOnly);assert.equal(cookie.sameSite,'Strict');
    const lifetime=cookie.expires-Date.now()/1000;
    assert.ok(lifetime>(role==='student'?29*86400:7*3600)&&lifetime<(role==='student'?31*86400:9*3600));
    log(`${label(role)} card, titles, fields, manual credentials, password visibility, login and session lifetime`);
  }

  // Check every portal/account combination. The server's role remains authoritative.
  for(const portal of roles)for(const account of roles.filter(role=>role!==portal)){
    await loginPage(portal);
    await fill({email:testAccountEmail(account),password:label(account)+'@123',...(portal==='admin'?{admin_security_code:adminCode}:{})});
    await submit(false);
    assert.equal(await b.evaluate('location.pathname'),'/login');
    assert.equal(await status('me'),401);
    const message=await b.evaluate(`document.querySelector('#login-error').textContent`);
    assert.ok(portal==='admin'?message.includes('Admin access'):account==='admin'?message.includes('dedicated Admin login'):message.includes('correct role'),message);
  }
  log('All 30 wrong-role combinations rejected; no session created for mismatches');

  await loginPage('admin');
  await fill({email:testAccountEmail('admin'),password:'Admin@123'});await click('#login-form [type="submit"]');
  assert.equal(await b.evaluate(`document.querySelector('#admin-security-code').getAttribute('aria-invalid')`),'true');
  await fill({admin_security_code:'incorrect-test-code'});await submit(false);
  assert.match(await b.evaluate(`document.querySelector('#login-error').textContent`),/security code are incorrect/);assert.equal(await status('me'),401);
  log('Admin code stays private; missing and incorrect codes rejected');

  await loginPage('student');
  await fill({email:'resident@gmail.com',password:'Personal@123'});await click('[data-role="warden"]');
  assert.equal(await b.evaluate(`document.querySelector('#email').value`),'resident@gmail.com');
  assert.equal(await b.evaluate(`document.querySelector('#password').value`),'Personal@123');
  await b.evaluate(`document.querySelector('[data-role="warden"]').focus()`);
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
  assert.equal(await b.evaluate(`document.activeElement.dataset.role`),'security');
  assert.equal(await b.evaluate(`document.querySelector('#login-heading').textContent`),'Sign in as Security');
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End'});
  assert.equal(await b.evaluate(`document.activeElement.dataset.role`),'admin');
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home'});
  assert.equal(await b.evaluate(`document.activeElement.dataset.role`),'student');
  assert.equal(await b.evaluate(`document.querySelectorAll('#login-roles [tabindex="0"]').length`),1);
  assert.equal(await b.evaluate(`getComputedStyle(document.activeElement).outlineStyle`),'solid');
  log('Keyboard selection, visible focus and personal credentials preserved during role changes');

  for(const [id,number] of [[1,1],[2,212],[3,422],[4,633]]){
    await loginPage('student');await fill({email:seedStudentEmail(number),password:'Student@123'});await submit();
    assert.equal(await b.evaluate(`fetch('/api/me').then(r=>r.json()).then(d=>d.user.hostel_id)`),id);
    log(`Gmail student for hostel ${id} keeps the assigned residence scope`);
  }

  // A personal email belongs to a real pending applicant, not a seeded shortcut.
  const applicantEmail='najma.resident+campus@yahoo.com';
  await b.navigate('/register');await b.waitFor(`document.querySelector('#registration-form')?.elements.role`);
  await fill({full_name:'Najma Campus Resident',phone:'+91 98765 43210',roll_number:'23691A31G6',department:'CSE',year:2,gender:'Female',email:'invalid-email',password:'College@123',confirm_password:'College@123'},'#registration-form');
  assert.equal(await b.evaluate(`document.querySelector('#registration-email-caption').textContent`),'Email Address');
  assert.equal(await b.evaluate(`document.querySelector('#r-email-error').textContent`),'Please enter a valid email address.');
  for(const email of ['resident_02@outlook.com','campus.student@yahoo.com','resident@college.ac.in']){
    await fill({email},'#registration-form');
    assert.equal(await b.evaluate(`document.querySelector('#r-email-error')`),null);
  }
  for(const email of [applicantEmail,'sreesanth1873@gmail.com',testEmail('23691A31E6')]){
    await fill({email},'#registration-form');
    assert.equal(await b.evaluate(`document.querySelector('#r-email-error')`),null);
  }
  await fill({roll_number:'23691A31E6'},'#registration-form');assert.equal(await b.evaluate(`document.querySelector('#r-email-error')`),null);
  await fill({roll_number:'23691A31G6',email:applicantEmail.toUpperCase(),requested_hostel_id:3},'#registration-form');
  await click('#registration-form [type="submit"]');await b.waitFor(`document.querySelector('.registration-success')`);
  log('Email providers validate independently of roll number; malformed addresses remain inline');
  await loginPage();await fill({email:applicantEmail,password:'College@123'});await submit(false);
  assert.match(await b.evaluate(`document.querySelector('#login-error').textContent`),/awaiting administrator approval/);
  for(const [email,password] of [[applicantEmail,'WrongPassword@123'],[testEmail('23691A3199'),'College@123']]){
    await loginPage();await fill({email,password});await submit(false);assert.match(await b.evaluate(`document.querySelector('#login-error').textContent`),/Email or password is incorrect/);
  }
  await loginPage('admin');await fill({email:testAccountEmail('admin'),password:'Admin@123',admin_security_code:adminCode});await submit();
  const account=await b.evaluate(`fetch('/api/approvals').then(r=>r.json()).then(d=>d.rows.find(u=>u.email===${JSON.stringify(applicantEmail)}))`);
  const review=async(action,extra={})=>{
    assert.equal(await b.evaluate(`fetch('/api/approvals/${account.id}',{method:'PATCH',headers:{'Content-Type':'application/json','X-SmartStay-Request':'1'},body:${JSON.stringify(JSON.stringify({action,...extra}))}}).then(r=>r.status)`),200);
  };
  await review('approve',{hostel_id:3});
  await loginPage();await fill({email:applicantEmail,password:'College@123'});await submit();
  assert.equal(await b.evaluate(`fetch('/api/me').then(r=>r.json()).then(d=>d.user.hostel_id)`),3);
  log('Personal email registers pending, rejects incorrect/unregistered credentials, then logs in after Admin approval');
  await loginPage('admin');await fill({email:testAccountEmail('admin'),password:'Admin@123',admin_security_code:adminCode});await submit();await review('suspend',{reason:'Browser identity check'});
  await loginPage();await fill({email:applicantEmail,password:'College@123'});await submit(false);
  assert.match(await b.evaluate(`document.querySelector('#login-error').textContent`),/account has been suspended/);
  log('Suspended personal-email student is blocked with the existing friendly status message');

  await loginPage();await fill({email:'resident@gmail.com'});await click('#forgot');
  await b.waitFor(`document.querySelector('#modal').open&&document.querySelector('#record-form')`);
  assert.equal(await b.evaluate(`document.querySelector('#record-form').elements.email.value`),'resident@gmail.com');
  await click('#record-form [type="submit"]');await b.waitFor(`!document.querySelector('#modal').open`);
  assert.ok((await b.evaluate(`document.querySelector('#toasts').innerText`)).includes('recovery request is recorded'));
  log('Forgot Password submits the existing recovery request');
  await click('.login-register a');await b.waitFor(`location.pathname==='/register'&&document.querySelector('#registration-form')`);
  log('Register opens the existing campus registration page');

  for(const mode of ['light','dark'])for(const width of [1920,1440,1024,768,430,390,320]){
    await b.viewport(width,1000);await loginPage();await theme(mode);await audit();
    const columns=await b.evaluate(`getComputedStyle(document.querySelector('#login-roles')).gridTemplateColumns.split(' ').length`);
    assert.equal(columns,width<768?2:3);
    await click('[data-role="admin"]');await audit();
    if(width===1440||width===390)await b.screenshot(`role-login-admin-${mode}-${width}`);
    await click('[data-role="student"]');await audit();
    if(width===1440||width===390)await b.screenshot(`role-login-student-${mode}-${width}`);
    if(width===1440||width===390)await b.screenshot(`email-login-${mode}-${width}`);
    log(`${mode} login: ${width}px cards, selected states, forms, email helper, contrast and no overflow`);
  }
  await b.viewport(390,1000);await theme('dark');await b.send('Page.reload');
  await b.waitFor(`document.querySelector('#login-roles [aria-selected="true"]')&&document.documentElement.dataset.theme==='dark'`);
  assert.equal(await b.evaluate(`localStorage.getItem('smartstay-theme')`),'dark');
  await fill({email:seedStudentEmail(),password:'Student@123'});await submit();
  assert.equal(await b.evaluate(`document.documentElement.dataset.theme`),'dark');
  await click('[data-action="logout"]');await b.waitFor(`location.pathname==='/login'&&document.querySelector('#login-roles [aria-selected="true"]')`);
  assert.equal(await status('me'),401);assert.equal(await b.evaluate(`document.documentElement.dataset.theme`),'dark');
  log('Theme survives refresh, login and logout; logout revokes access');
  assert.deepEqual(b.errors,[]);assert.equal(serverErrors,'');
  log('No browser runtime exceptions or application server errors');
  mkdirSync('test-results',{recursive:true});writeFileSync('test-results/login-browser-results.json',JSON.stringify(results,null,2));
  console.log(`${results.length} role-first login browser checks passed.`);
}finally{browser?.close();child.kill();}
