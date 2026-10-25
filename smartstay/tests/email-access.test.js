import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidAccountEmail,normalizeEmail} from '../public/js/email.js';
process.env.SMARTSTAY_DB=':memory:';
process.env.SMARTSTAY_NO_LISTEN='1';
process.env.ADMIN_SECURITY_CODE='Email-access-test-code-2026';
const {server}=await import('../server/server.js');
const {db,one,all}=await import('../server/db.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,cookies={},accounts={};
async function request(path,data,status=200,key,method=data===undefined?'GET':'POST'){
  const response=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json','X-SmartStay-Request':'1',...(cookies[key]?{Cookie:cookies[key]}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));
  const cookie=response.headers.get('set-cookie');if(key&&cookie)cookies[key]=cookie.split(';')[0];
  if(status>=400||path==='auth/register')assert.equal(cookie,null);return result;
}
const password='Resident@123';
const roles=['admin','student','warden','security','maintenance','laundry'];
const addresses={admin:'admin.smartstay@gmail.com',student:'campus.resident@yahoo.com',warden:'warden.smartstay@outlook.com',security:'security01@college.ac.in',maintenance:'maintenance01@company.in',laundry:'laundry01@smartstay.edu'};
const registration=(role,extra={})=>({role,full_name:'Campus '+role+' Applicant',email:addresses[role],phone:'+91 98765 43210',password,confirm_password:password,...(role==='student'?{roll_number:'23691A31G6',department:'CSE',year:2,gender:'Female',requested_hostel_id:3}:{employee_id:'GMAIL-'+role.toUpperCase(),...(role==='admin'?{admin_security_code:process.env.ADMIN_SECURITY_CODE}:{requested_hostel_id:2})}),...(role==='security'?{shift:'Night'}:{}),...(role==='maintenance'?{specialization:'Electrical'}:{}),...extra});
const login=(role,extra={},status=200,key=role)=>request(role==='admin'?'auth/admin-login':'auth/login',{role,email:addresses[role],password,...(role==='admin'?{admin_security_code:process.env.ADMIN_SECURITY_CODE}:{}),...extra},status,key);
const review=(id,action,extra={})=>request('approvals/'+id,{action,...extra},200,'admin','PATCH');
try{
  await test('Every role shares domain-independent email syntax validation and case-insensitive normalization',()=>{
    for(const role of roles)for(const email of ['student123@gmail.com','Sreesanth1873@GMAIL.COM','user@yahoo.com','user@outlook.com','user@college.ac.in','user@company.in','user@sub.domain.example','campus.resident+hostel@gmail.com',' security01@smartstay.edu '])assert.equal(isValidAccountEmail(email,role),true,role+' '+email);
    for(const email of ['',null,123,{},'student','student@gmail','@gmail.com','user@@gmail.com','user @gmail.com','.user@gmail.com','user..test@gmail.com','user.@gmail.com','user@-college.edu','user@college-.edu','user@college..edu','user@college_name.edu','a'.repeat(65)+'@gmail.com'])assert.equal(isValidAccountEmail(email),false,String(email));
    assert.equal(normalizeEmail(' Sreesanth1873@GMAIL.COM '),'sreesanth1873@gmail.com');
  });
  await test('Legacy accounts and data remain intact, with no demo UI or college-domain registration options',async()=>{
    assert.equal(one('SELECT email FROM users WHERE id=1').email,'admin@smartstay.edu');assert.equal(one('SELECT email FROM users WHERE id=3').email,'student@smartstay.edu');
    assert.equal(one('SELECT COUNT(*) n FROM students').n,842);
    const html=await(await fetch(base+'/login')).text(),js=await(await fetch(base+'/js/login.js')).text();
    for(const value of ['Demo Access','Use Demo Credentials','Student@123','Admin@123'])assert.ok(!html.includes(value)&&!js.includes(value),value);
    const options=await request('registration-options');assert.equal(options.college_email_domain,undefined);assert.equal(options.admin_email_domain,undefined);assert.equal(options.hostels.length,4);
    await request('auth/login',{email:'student@smartstay.edu',password:'Student@123',role:'student'},200,'legacy-student');
    await request('auth/logout',{},200,'legacy-student');
  });
  await test('Invalid and empty emails fail on the backend without accounts or sessions',async()=>{
    const before=one('SELECT COUNT(*) n FROM users').n;
    for(const email of ['not-an-email','resident@gmail','@gmail.com','resident@outlook','resident@college..edu']){
      assert.equal((await request('auth/register',registration('student',{email}),400)).error,'Please enter a valid email address.');
      assert.equal((await request('auth/login',{email,password,role:'student'},400)).error,'Please enter a valid email address.');
    }
    assert.equal((await request('auth/login',{email:'',password,role:'student'},400)).error,'Please enter your email address.');
    assert.equal(one('SELECT COUNT(*) n FROM users').n,before);
  });
  await test('Every retained development account can log in with its existing registered domain',async()=>{
    for(const role of roles){
      const key='legacy-'+role;
      await request(role==='admin'?'auth/admin-login':'auth/login',{email:role+'@smartstay.edu',password:role[0].toUpperCase()+role.slice(1)+'@123',role,...(role==='admin'?{admin_security_code:process.env.ADMIN_SECURITY_CODE}:{})},200,key);
      assert.equal((await request('me',undefined,200,key)).user.role,role);
      await request('auth/logout',{},200,key);
    }
  });
  await test('All six roles register across Gmail, Yahoo, Outlook, college and business domains with unchanged approval rules',async()=>{
    for(const role of roles){
      const account=await request('auth/register',registration(role,{email:' '+addresses[role].toUpperCase()+' '}),201);accounts[role]=account;
      assert.equal(account.status,role==='admin'?'APPROVED':'PENDING');
      const saved=one('SELECT * FROM users WHERE id=?',account.id);assert.equal(saved.email,addresses[role]);assert.equal(saved.assigned_hostel_id,null);assert.notEqual(saved.password_hash,password);
      if(role==='admin')await login(role);else assert.equal((await login(role,{},403)).error,'Your registration is awaiting administrator approval.');
    }
    const student=one('SELECT * FROM students WHERE user_id=?',accounts.student.id);assert.equal(student.registration_number,'23691A31G6');assert.equal(student.bed_id,null);assert.notEqual(student.registration_number.toLowerCase(),addresses.student.split('@')[0]);
  });
  await test('Email uniqueness across every role and independent roll-number uniqueness remain enforced',async()=>{
    const before=one('SELECT COUNT(*) n FROM users').n;
    for(const role of roles)await request('auth/register',registration(role,{email:addresses.student.toUpperCase(),employee_id:'DUP-'+role.toUpperCase(),roll_number:'UNIQUE-ROLL'}),409);
    assert.match((await request('auth/register',registration('student',{email:'another.student@gmail.com',roll_number:'23691a31g6'}),409)).error,/roll number is already registered/);
    await request('auth/register',registration('student',{email:'missing.roll@gmail.com',roll_number:''}),400);
    assert.equal(one('SELECT COUNT(*) n FROM users').n,before);
  });
  await test('Admin approval enables every email domain with the correct account and hostel scope',async()=>{
    for(const role of roles){
      if(role!=='admin')await review(accounts[role].id,'approve',{hostel_id:role==='student'?3:2});
      await login(role,{email:addresses[role].toUpperCase()});const me=await request('me',undefined,200,role);assert.equal(me.user.id,accounts[role].id);assert.equal(me.user.role,role);
      assert.equal(me.hostels.length,role==='admin'?4:1);assert.equal(me.user.hostel_id,role==='admin'?null:role==='student'?3:2);
      await request('dashboard',undefined,200,role);
    }
    assert.equal(one('SELECT bed_id FROM students WHERE user_id=?',accounts.student.id).bed_id,null);
  });
  await test('Account recovery accepts registered addresses across all providers without issuing sessions',async()=>{
    const sessions=one('SELECT COUNT(*) n FROM sessions').n;
    for(const role of roles){
      await request('auth/forgot',{email:' '+addresses[role].toUpperCase()+' '});
      assert.ok(one('SELECT id FROM password_reset_requests WHERE email=?',addresses[role]));
    }
    const count=one('SELECT COUNT(*) n FROM password_reset_requests').n;
    await request('auth/forgot',{email:'not-an-email'},400);
    assert.equal(one('SELECT COUNT(*) n FROM password_reset_requests').n,count);
    assert.equal(one('SELECT COUNT(*) n FROM sessions').n,sessions);
  });
  await test('Wrong passwords, unregistered emails and all wrong-role combinations cannot create sessions',async()=>{
    const before=one('SELECT COUNT(*) n FROM sessions').n;
    for(const role of roles){
      await login(role,{password:'Incorrect@123'},401);
      for(const portal of roles.filter(other=>other!==role))await request(portal==='admin'?'auth/admin-login':'auth/login',{email:addresses[role],password,role:portal,admin_security_code:process.env.ADMIN_SECURITY_CODE},role==='admin'&&portal!=='admin'?401:403);
    }
    for(const domain of ['gmail.com','yahoo.com','outlook.com','college.edu'])await request('auth/login',{email:'unregistered@'+domain,password,role:'student'},401);
    assert.equal(one('SELECT COUNT(*) n FROM sessions').n,before);
  });
  await test('Admin registration and login still require the private server security code',async()=>{
    const before=one('SELECT COUNT(*) n FROM users').n;
    for(const code of [undefined,'', 'incorrect-private-code'])await request('auth/register',registration('admin',{email:'unverified.admin@gmail.com',employee_id:'GMAIL-NO-CODE',admin_security_code:code}),code==='incorrect-private-code'?403:400);
    for(const code of [undefined,'incorrect-private-code'])await login('admin',{admin_security_code:code},401);
    assert.equal(one('SELECT COUNT(*) n FROM users').n,before);
  });
  await test('Suspended and rejected accounts remain blocked for every domain; logout revokes sessions',async()=>{
    await review(accounts.student.id,'suspend',{reason:'Identity review'});await request('me',undefined,401,'student');assert.match((await login('student',{},403)).error,/account has been suspended/);
    await review(accounts.student.id,'restore');await login('student');await request('auth/logout',{},200,'student');await request('me',undefined,401,'student');
    const rejected=await request('auth/register',registration('laundry',{email:'rejected.laundry@gmail.com',employee_id:'GMAIL-REJECT'}),201);await review(rejected.id,'reject',{reason:'Employee verification failed'});
    assert.match((await login('laundry',{email:'rejected.laundry@gmail.com'},403)).error,/registration request was not approved/);
    assert.deepEqual(all('PRAGMA foreign_key_check'),[]);
  });
}finally{await new Promise(resolve=>server.close(resolve));db.close();}
