import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SMARTSTAY_DB=':memory:';process.env.SMARTSTAY_NO_LISTEN='1';
process.env.ADMIN_SECURITY_CODE='Admin-registration-test-code-2026';
const {server}=await import('../server/server.js');
const {db,one,all}=await import('../server/db.js');
const {verifyPassword}=await import('../server/security.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,cookies={};
async function request(path,data,status=200,key){
  const response=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-SmartStay-Request':'1',...(cookies[key]?{Cookie:cookies[key]}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));
  if(key&&response.headers.get('set-cookie'))cookies[key]=response.headers.get('set-cookie').split(';')[0];
  if(path==='/api/auth/register'||status>=400)assert.equal(response.headers.get('set-cookie'),null);
  return result;
}
const payload=(extra={})=>({role:'admin',full_name:'Campus Administrator',employee_id:'ADMIN-NEW',phone:'+91 98765 43210',email:`campus.admin@gmail.com`,password:'Registered@123',confirm_password:'Registered@123',...extra});
const created=()=>one('SELECT COUNT(*) n FROM users').n;
let administrator;
try{
  await test('Admin remains the sixth role without obsolete domain settings or private code exposure',async()=>{
    const options=await request('/api/registration-options');assert.deepEqual(options.roles,['student','warden','security','maintenance','laundry','admin']);
    assert.equal(options.admin_email_domain,undefined);assert.equal(options.college_email_domain,undefined);assert.ok(!JSON.stringify(options).includes(process.env.ADMIN_SECURITY_CODE));
    for(const path of ['/register','/js/register.js','/js/validation.js'])assert.ok(!(await(await fetch(base+path)).text()).includes(process.env.ADMIN_SECURITY_CODE));
  });
  await test('Missing, empty and incorrect registration codes fail before any account is created',async()=>{
    const count=created();
    for(const code of [undefined,'','   ']){
      const result=await request('/api/auth/register',payload({admin_security_code:code}),400);assert.equal(result.error,'Please enter the administrator security code.');
    }
    for(const code of ['wrong-code','1234560000']){
      const result=await request('/api/auth/register',payload({admin_security_code:code}),403);assert.equal(result.error,'Invalid administrator security code. Please check the code and try again.');assert.ok(!JSON.stringify(result).includes(process.env.ADMIN_SECURITY_CODE));
    }
    await request('/api/auth/register',payload({admin_security_code:{value:process.env.ADMIN_SECURITY_CODE}}),400);
    assert.equal(created(),count);
  });
  await test('Direct uppercase ADMIN and client-supplied privilege fields cannot bypass authorization',async()=>{
    const count=created();await request('/api/auth/register',payload({role:'ADMIN',role_id:1,active:1,account_status:'APPROVED'}),400);assert.equal(created(),count);
    const ordinary=await request('/api/auth/register',payload({role:'warden',employee_id:'FORGED-STAFF',email:'forged.staff@gmail.com',requested_hostel_id:1,role_id:1,active:1,account_status:'APPROVED',assigned_hostel_id:1}),201);
    const user=one('SELECT u.*,r.name role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?',ordinary.id);
    assert.equal(user.role,'warden');assert.equal(user.active,0);assert.equal(user.account_status,'PENDING');assert.equal(user.assigned_hostel_id,null);
  });
  await test('Admin rejects malformed emails without a domain restriction',async()=>{
    const count=created();
    for(const email of ['not-an-email','campus.admin@','campus admin@college.edu']){
      const result=await request('/api/auth/register',payload({email,admin_security_code:process.env.ADMIN_SECURITY_CODE}),400);assert.match(result.error,/valid email address/);
    }
    assert.equal(created(),count);
  });
  await test('A verified Admin becomes active with hashed credentials, no self-approval and no hostel assignment',async()=>{
    administrator=await request('/api/auth/register',payload({email:payload().email.toUpperCase(),admin_security_code:process.env.ADMIN_SECURITY_CODE,requested_hostel_id:1,assigned_hostel_id:1,approved_by:1}),201);
    assert.equal(administrator.status,'APPROVED');
    const user=one('SELECT u.*,r.name role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?',administrator.id);
    assert.equal(user.role,'admin');assert.equal(user.active,1);assert.equal(user.account_status,'APPROVED');assert.ok(user.approved_at);
    assert.equal(user.requested_hostel_id,null);assert.equal(user.assigned_hostel_id,null);assert.equal(user.approved_by,null);assert.equal(user.email,payload().email);
    assert.ok(verifyPassword('Registered@123',user.password_hash));assert.notEqual(user.password_hash,'Registered@123');
    for(const table of ['students','wardens','staff'])assert.equal(one(`SELECT COUNT(*) n FROM ${table} WHERE user_id=?`,administrator.id).n,0);
  });
  await test('A registered Admin still needs the dedicated login, correct password and private code',async()=>{
    await request('/api/auth/login',{email:payload().email,password:'Registered@123',role:'admin'},401);
    await request('/api/auth/admin-login',{email:payload().email,password:'Wrong@123',role:'admin',admin_security_code:process.env.ADMIN_SECURITY_CODE},401);
    await request('/api/auth/admin-login',{email:payload().email,password:'Registered@123',role:'admin',admin_security_code:'wrong-code'},401);
    const result=await request('/api/auth/admin-login',{email:payload().email.toUpperCase(),password:'Registered@123',role:'admin',admin_security_code:process.env.ADMIN_SECURITY_CODE},200,'admin');
    assert.equal(result.role,'admin');assert.equal(result.redirect,'/app/dashboard');
  });
  await test('Admins register and securely sign in across Gmail, Yahoo, Outlook, college and business domains',async()=>{
    const emails=['admin@gmail.com','admin@yahoo.com','admin@outlook.com','admin@college.edu','hosteladmin@mits.ac.in','manager@company.in'];
    for(const [index,email]of emails.entries()){
      const account=await request('/api/auth/register',payload({email:email.toUpperCase(),employee_id:`ADMIN-DOMAIN-${index}`,admin_security_code:process.env.ADMIN_SECURITY_CODE}),201);
      const saved=one('SELECT u.*,r.name role FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?',account.id);
      assert.equal(saved.role,'admin');assert.equal(saved.email,email);assert.equal(saved.active,1);assert.equal(saved.account_status,'APPROVED');assert.equal(saved.assigned_hostel_id,null);assert.equal(saved.requested_hostel_id,null);
      await request('/api/auth/admin-login',{email,password:'Registered@123',role:'admin'},401);
      await request('/api/auth/admin-login',{email,password:'Wrong@123',role:'admin',admin_security_code:process.env.ADMIN_SECURITY_CODE},401);
      await request('/api/auth/admin-login',{email,password:'Registered@123',role:'student',admin_security_code:process.env.ADMIN_SECURITY_CODE},403);
      await request('/api/auth/admin-login',{email:email.toUpperCase(),password:'Registered@123',role:'admin',admin_security_code:process.env.ADMIN_SECURITY_CODE},200,'domain-admin');
      const me=await request('/api/me',undefined,200,'domain-admin');assert.equal(me.user.id,account.id);assert.equal(me.user.role,'admin');assert.equal(me.hostels.length,4);assert.equal(me.user.hostel_id,null);
      for(const hostel of me.hostels){const data=await request(`/api/dashboard?hostel_id=${hostel.id}`,undefined,200,'domain-admin');assert.equal(data.hostels[0].id,hostel.id);}
      await request('/api/auth/forgot',{email});assert.ok(one('SELECT id FROM password_reset_requests WHERE email=?',email));
      if(index===1){const duplicate=await request('/api/auth/register',payload({email:email.toUpperCase(),employee_id:'ADMIN-DOMAIN-DUP',admin_security_code:process.env.ADMIN_SECURITY_CODE}),409);assert.equal(duplicate.error,'An account with this email already exists.');}
      await request('/api/auth/logout',{},200,'domain-admin');await request('/api/me',undefined,401,'domain-admin');
    }
  });
  await test('The new Admin can access all four hostels, every authorized module and protected Admin URLs',async()=>{
    const me=await request('/api/me',undefined,200,'admin');assert.equal(me.user.id,administrator.id);assert.equal(me.user.hostel_id,null);assert.equal(me.hostels.length,4);
    assert.equal((await request('/api/hostels',undefined,200,'admin')).length,4);
    for(const hostel of me.hostels){const dashboard=await request(`/api/dashboard?hostel_id=${hostel.id}`,undefined,200,'admin');assert.equal(dashboard.hostels.length,1);assert.equal(dashboard.hostels[0].id,hostel.id);}
    for(const module of me.permissions)await request('/api/'+module,undefined,200,'admin');
    assert.equal((await fetch(base+'/app/approvals',{headers:{Cookie:cookies.admin}})).status,200);
    assert.ok(!(await request('/api/approvals',undefined,200,'admin')).rows.some(row=>row.id===administrator.id));
    const review=await fetch(base+'/api/approvals/'+administrator.id,{method:'PATCH',headers:{'Content-Type':'application/json','X-SmartStay-Request':'1',Cookie:cookies.admin},body:JSON.stringify({action:'approve',hostel_id:1})});assert.equal(review.status,404);
  });
  await test('Admin email and employee IDs remain unique and required',async()=>{
    const count=created(),code=process.env.ADMIN_SECURITY_CODE;
    await request('/api/auth/register',payload({admin_security_code:code}),409);
    await request('/api/auth/register',payload({email:`different.admin@gmail.com`,employee_id:'admin-new',admin_security_code:code}),409);
    const missing=await request('/api/auth/register',payload({email:`missing.id@gmail.com`,employee_id:'',admin_security_code:code}),400);assert.equal(missing.error,'Please enter your administrator ID.');
    assert.equal(created(),count);
  });
  await test('Private code misconfiguration fails closed; the existing ten-character code policy is supported',async()=>{
    const previous=process.env.ADMIN_SECURITY_CODE,count=created();
    try{
      delete process.env.ADMIN_SECURITY_CODE;await request('/api/auth/register',payload({admin_security_code:previous}),503);
      process.env.ADMIN_SECURITY_CODE='short';await request('/api/auth/register',payload({admin_security_code:'short'}),503);assert.equal(created(),count);
      process.env.ADMIN_SECURITY_CODE='0987654321';const result=await request('/api/auth/register',payload({email:`ten.code@gmail.com`,employee_id:'ADMIN-TEN',admin_security_code:process.env.ADMIN_SECURITY_CODE}),201);assert.equal(result.status,'APPROVED');
    }finally{process.env.ADMIN_SECURITY_CODE=previous;}
  });
  await test('Account creation is audited and notifies existing Admins without retaining the security code',()=>{
    const audit=one('SELECT * FROM audit_logs WHERE entity_id=? AND action=?',administrator.id,'Admin account created with verified security code');assert.ok(audit);assert.equal(JSON.parse(audit.details).access,'all_hostels');
    assert.ok(one("SELECT id FROM notifications WHERE user_id=1 AND title='New Administrator Account'"));
    for(const table of ['users','audit_logs','notifications'])assert.ok(!JSON.stringify(all('SELECT * FROM '+table)).includes(process.env.ADMIN_SECURITY_CODE));
    assert.deepEqual(all('PRAGMA foreign_key_check'),[]);
  });
}finally{await new Promise(resolve=>server.close(resolve));db.close();}
