import test from 'node:test';
import {testEmail,seedStudentEmail,prepareTestAccounts} from './auth-fixtures.js';
import assert from 'node:assert/strict';
import {mkdirSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
process.env.SMARTSTAY_DB=':memory:';process.env.SMARTSTAY_NO_LISTEN='1';process.env.ADMIN_SECURITY_CODE='Test-only-admin-code-2026';
const {server}=await import('../server/server.js');
const {all,one,run,db}=await import('../server/db.js');
await prepareTestAccounts();
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,cookies={},registered={};
async function req(key,path,method='GET',data,status=200){const r=await fetch(`${base}/api/${path}`,{method,headers:{'Content-Type':'application/json','X-SmartStay-Request':'1',...(cookies[key]?{cookie:cookies[key]}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});const result=await r.json();assert.equal(r.status,status,`${key} ${method} ${path}: ${JSON.stringify(result)}`);return result;}
async function login(key,email,password='Testing@123',admin=false,status=200,code=process.env.ADMIN_SECURITY_CODE){const r=await fetch(`${base}/api/auth/${admin?'admin-login':'login'}`,{method:'POST',headers:{'Content-Type':'application/json','X-SmartStay-Request':'1'},body:JSON.stringify({email,password,...(admin?{admin_security_code:code}:{})})});const d=await r.json();assert.equal(r.status,status,`${email}: ${JSON.stringify(d)}`);if(r.ok)cookies[key]=r.headers.get('set-cookie').split(';')[0];else assert.equal(r.headers.get('set-cookie'),null);return d;}
const registration=role=>({full_name:`New ${role} Applicant`,email:role==='student'?testEmail('23CSE1024'):`new-${role}@gmail.com`,phone:'+91 98765 43210',password:'Testing@123',confirm_password:'Testing@123',role,requested_hostel_id:1,...(role==='student'?{roll_number:'23CSE1024',department:'CSE',year:2,gender:'Male'}:{employee_id:`NEW-${role.toUpperCase()}`}),...(role==='security'?{shift:'Night'}:{}),...(role==='maintenance'?{specialization:'Electrical'}:{})});

try{
await test('Non-destructive migration keeps campus totals and establishes exactly four typed hostels',()=>{
 assert.equal(one('SELECT COUNT(*) n FROM students').n,842);assert.equal(one('SELECT COUNT(*) n FROM room_allocations').n,842);assert.equal(one('SELECT COUNT(*) n FROM attendance').n,842*14);
 assert.deepEqual(all('SELECT name FROM hostels ORDER BY id').map(h=>h.name),['Boys Hostel – AC','Boys Hostel – Non-AC','Girls Hostel – AC','Girls Hostel – Non-AC']);
 assert.equal(one("SELECT COUNT(*) n FROM students s JOIN hostels h ON h.id=s.hostel_id WHERE s.gender<>CASE h.category WHEN 'Boys' THEN 'Male' ELSE 'Female' END").n,0);assert.deepEqual(all('PRAGMA foreign_key_check'),[]);
});
await test('Admin needs dedicated login and a private server security code',async()=>{
 await login('bad','admin@gmail.com','Admin@123',false,401);await login('bad','admin@gmail.com','Admin@123',true,401,'wrong-code');await login('bad','admin@gmail.com','Admin@123',true,401,'');
 await login('admin','admin@gmail.com','Admin@123',true);await login('bad',seedStudentEmail(),'Student@123',true,403);
 const page=await(await fetch(`${base}/login?role=admin`)).text();assert.ok(!page.includes(process.env.ADMIN_SECURITY_CODE));const options=await req(null,'registration-options');assert.deepEqual(options.roles,['student','warden','security','maintenance','laundry','admin']);
 const env=await fetch(`${base}/.env.local`);assert.equal(env.status,404);const missing=process.env.ADMIN_SECURITY_CODE;delete process.env.ADMIN_SECURITY_CODE;await login('bad','admin@gmail.com','Admin@123',true,503);process.env.ADMIN_SECURITY_CODE=missing;
});
await test('Ten-character backend Admin codes authenticate and shorter configurations fail closed',async()=>{
 const previous=process.env.ADMIN_SECURITY_CODE;
 try{process.env.ADMIN_SECURITY_CODE='0987654321';await login('admin','admin@gmail.com','Admin@123',true);await login('bad','admin@gmail.com','Admin@123',true,401,'wrong-code');process.env.ADMIN_SECURITY_CODE='098765432';await login('bad','admin@gmail.com','Admin@123',true,503);}finally{process.env.ADMIN_SECURITY_CODE=previous;}
});
await test('Approved college students remain scoped to all four assigned residences',async()=>{
 for(const [index,number] of [1,212,422,633].entries()){
  await login('student-hostel',seedStudentEmail(number),'Student@123');
  const me=await req('student-hostel','me');assert.equal(me.user.hostel_id,index+1);assert.equal(me.hostels.length,1);
  const dashboard=await req('student-hostel','dashboard');assert.equal(dashboard.me.gender,index<2?'Male':'Female');
  await req('student-hostel',`dashboard?hostel_id=${index<2?3:1}`,'GET',undefined,403);
  await req('student-hostel','rooms/240','GET',undefined,404);await req('student-hostel','auth/logout','POST',{});
 }
});
await test('Demo discovery and obsolete college-domain metadata are removed from registration options',async()=>{
 const options=await req(null,'registration-options');assert.equal(options.college_email_domain,undefined);assert.equal(options.admin_email_domain,undefined);
 const html=await(await fetch(base+'/login')).text();assert.ok(!html.includes('Demo Access'));assert.ok(!html.includes('Student@123'));
 await req('admin','auth/student-demos','GET',undefined,404);
});
await test('All five registrations stay pending, hash passwords, request hostel assignment and notify Admin',async()=>{
 for(const role of ['student','warden','security','maintenance','laundry']){registered[role]=await req(null,'auth/register','POST',registration(role),201);const u=one('SELECT * FROM users WHERE id=?',registered[role].id);assert.equal(u.account_status,'PENDING');assert.equal(u.active,0);assert.equal(u.assigned_hostel_id,null);assert.equal(u.requested_hostel_id,1);assert.notEqual(u.password_hash,'Testing@123');const response=await login('pending',u.email,'Testing@123',false,403);assert.equal(response.error,'Your registration is awaiting administrator approval.');}
 const student=one('SELECT * FROM students WHERE user_id=?',registered.student.id);assert.equal(student.hostel_id,null);assert.equal(student.bed_id,null);assert.equal(student.active,0);assert.equal(one('SELECT COUNT(*) n FROM notifications WHERE user_id=1 AND title LIKE \'New % Registration\'').n,5);
 assert.equal((await req('admin','approvals')).summary.PENDING,5);await req(null,'dashboard','GET',undefined,401);
});
await test('Registration validates role, password confirmation, engineering department and unique identifiers',async()=>{
 await req(null,'auth/register','POST',{...registration('student'),role:'admin'},400);
 await req(null,'auth/register','POST',{...registration('student'),email:testEmail('23CSE1024')},409);
 await req(null,'auth/register','POST',{...registration('student'),email:'new-student@smartstay..edu',roll_number:'NEWROLL1'},400);
 await req(null,'auth/register','POST',{...registration('security'),email:'unique-security@gmail.com'},409);
 await req(null,'auth/register','POST',{...registration('laundry'),email:'new-password@gmail.com',employee_id:'NEW-PASSWORD',confirm_password:'Different@123'},400);
 await req(null,'auth/register','POST',{...registration('student'),email:testEmail('NEWROLL2'),roll_number:'NEWROLL2',department:'Unknown'},400);
 await req(null,'auth/register','POST',{...registration('student'),email:testEmail('NEWROLL3'),roll_number:'NEWROLL3',requested_hostel_id:3},400);
});
await test('Only Admin can review requests; approval confirms a valid hostel without allocating a bed',async()=>{
 await login('student',seedStudentEmail(),'Student@123');await req('student','approvals','GET',undefined,403);await req('student',`approvals/${registered.student.id}`,'PATCH',{action:'approve',hostel_id:1},403);
 await req('admin',`approvals/${registered.student.id}`,'PATCH',{action:'approve',hostel_id:3},400);
 const result=await req('admin',`approvals/${registered.student.id}`,'PATCH',{action:'approve',hostel_id:2});assert.equal(result.status,'APPROVED');
 const u=one('SELECT * FROM users WHERE id=?',registered.student.id),s=one('SELECT * FROM students WHERE user_id=?',u.id);assert.equal(u.approved_by,1);assert.ok(u.approved_at);assert.equal(u.requested_hostel_id,1);assert.equal(u.assigned_hostel_id,2);assert.equal(s.hostel_id,2);assert.equal(s.bed_id,null);
 await login('newStudent',u.email);const d=await req('newStudent','dashboard');assert.equal(d.me.hostel_id,2);assert.equal(d.me.room_id,null);assert.equal((await req('newStudent','rooms')).length,0);
});
await test('Staff approval activates every registered role and confirms scoped employee profiles',async()=>{
 for(const role of ['warden','security','maintenance','laundry']){await req('admin',`approvals/${registered[role].id}`,'PATCH',{action:'approve',hostel_id:2});await login(role,`new-${role}@gmail.com`);const me=await req(role,'me');assert.equal(me.user.role,role);assert.equal(me.user.hostel_id,2);assert.equal(me.hostels.length,1);assert.equal(me.hostels[0].id,2);await req(role,'dashboard');}
});
await test('Admin can filter all modules and all four hostels; non-global roles cannot change scope',async()=>{
 const hs=await req('admin','hostels');assert.equal(hs.length,4);for(const h of hs){const ds=await req('admin',`dashboard?hostel_id=${h.id}`);assert.equal(ds.hostels.length,1);assert.equal(ds.hostels[0].id,h.id);assert.equal((await req('admin',`hostels?hostel_id=${h.id}`)).length,1);assert.ok((await req('admin',`students?hostel_id=${h.id}`)).every(s=>s.hostel_id===h.id));}
 for(const role of ['warden','security','maintenance','laundry']){await req(role,'dashboard?hostel_id=3','GET',undefined,403);await req(role,'dashboard?hostel_id=all','GET',undefined,403);await req(role,'approvals','GET',undefined,403);}
 const me=await req('newStudent','me');await req('newStudent','gate?hostel_id=1','GET',undefined,403);assert.equal(me.hostels[0].id,2);
});
await test('Warden and security reject direct reads and actions for another hostel',async()=>{
 assert.ok((await req('warden','students')).every(s=>s.hostel_id===2));await req('warden','students/1','GET',undefined,404);await req('warden','rooms/1','GET',undefined,404);await req('warden','attendance','POST',{student_id:1,status:'Present'},404);
 const gate=await req('security','gate');assert.ok(gate.students.length>0);assert.ok(gate.students.every(s=>s.hostel_id===2));assert.ok(gate.logs.every(g=>g.hostel_id===2));await req('security','gate','POST',{student_id:1,action:'entry'},404);await req('security','keys','POST',{student_id:1,action:'submit',key_code:'CROSS'},404);await req('security','visitors','POST',{student_id:1,name:'Cross',purpose:'Visit',phone:'+91 98765 43210'},404);
});
await test('Gender and confirmed hostel restrictions protect allocation and transfer on the API',async()=>{
 const s=one('SELECT * FROM students WHERE user_id=?',registered.student.id),bedFor=hid=>one("SELECT b.id FROM beds b JOIN rooms r ON r.id=b.room_id WHERE r.hostel_id=? AND b.status='Available' LIMIT 1",hid).id;
 await req('admin','allocations','POST',{student_id:s.id,bed_id:bedFor(3)},400);await req('admin','allocations','POST',{student_id:s.id,bed_id:bedFor(1)},400);
 await req('admin','allocations','POST',{student_id:s.id,bed_id:bedFor(2)},201);await req('admin','allocations','POST',{student_id:s.id,bed_id:bedFor(4),transfer:true},400);
 await req('admin',`approvals/${registered.student.id}`,'PATCH',{action:'change_hostel',hostel_id:1},409);
 await req('admin','allocations','POST',{student_id:s.id,bed_id:bedFor(1),transfer:true},201);assert.equal(one('SELECT assigned_hostel_id FROM users WHERE id=?',registered.student.id).assigned_hostel_id,1);
 await req('warden','allocations','POST',{student_id:s.id,bed_id:bedFor(2),transfer:true},404);
});
await test('Maintenance/laundry enforce hostel ownership on reads, assignment and updates',async()=>{
 const list=await req('maintenance','maintenance');assert.ok(list.every(m=>m.hostel_id===2));const other=one('SELECT id FROM maintenance_requests WHERE room_id=1');await req('maintenance',`maintenance/${other.id}`,'PATCH',{status:'In Progress'},404);
 const mine=await req('student','maintenance','POST',{category:'Fan',description:'Hostel-scoped task',priority:'High'},201);const staff=one('SELECT id FROM staff WHERE user_id=?',registered.maintenance.id);await req('admin',`maintenance/${mine.id}`,'PATCH',{assigned_staff_id:staff.id},400);
 assert.ok((await req('laundry','laundry')).every(l=>l.hostel_id===2));const laundry=await req('student','laundry','POST',{clothes_count:4,service_type:'Wash & Fold',pickup_date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date())},201);await req('laundry',`laundry/${laundry.id}`,'PATCH',{status:'Collected'},404);
});
await test('Rejection gives the exact login message and persists the review reason',async()=>{
 const d={...registration('laundry'),full_name:'Rejected Applicant',email:'rejected@gmail.com',employee_id:'REJECT-001'};const r=await req(null,'auth/register','POST',d,201);await req('admin',`approvals/${r.id}`,'PATCH',{action:'reject',reason:'Employee ID could not be verified'});const response=await login('rejected',d.email,'Testing@123',false,403);assert.equal(response.error,'Your registration request was not approved. Please contact the hostel administration.');assert.equal((await req('admin',`approvals/${r.id}`)).rejection_reason,'Employee ID could not be verified');await req('admin',`approvals/${r.id}`,'PATCH',{action:'approve',hostel_id:1},409);
});
await test('Suspension revokes existing sessions immediately; restoration and logout work',async()=>{
 await req('admin',`approvals/${registered.security.id}`,'PATCH',{action:'suspend',reason:'Identity review'});await req('security','me','GET',undefined,401);const d=await login('suspended','new-security@gmail.com','Testing@123',false,403);assert.equal(d.error,'Your account has been suspended. Please contact the hostel administration.');await req('admin',`approvals/${registered.security.id}`,'PATCH',{action:'restore'});await login('security','new-security@gmail.com');await req('security','auth/logout','POST',{});await req('security','me','GET',undefined,401);
});
await test('Department configuration, fixed hostel entities, assignment audit and emergency routing are enforced',async()=>{
 const dep=await req('admin','departments','POST',{name:'Robotics Engineering'},201);assert.ok((await req(null,'registration-options')).departments.some(d=>d.name==='Robotics Engineering'));await req('admin',`departments/${dep.id}`,'PATCH',{name:'Robotics Engineering',active:0});assert.ok(!(await req(null,'registration-options')).departments.some(d=>d.id===dep.id));
 await req('admin','hostels','POST',{name:'Hostel E',category:'Boys'},409);await req('admin','hostels/1','PATCH',{name:'Boys Hostel A'},400);assert.equal((await req('admin','hostels')).length,4);
 const alert=await req('student','safety','POST',{confirmed:true,emergency_type:'Security Issue',details:'Test routing',contact_number:'+91 98765 43210'},201);assert.ok(alert.id);assert.equal(one("SELECT COUNT(*) n FROM notifications WHERE user_id=? AND title LIKE 'EMERGENCY%'",registered.security.id).n,0);assert.ok(one("SELECT COUNT(*) n FROM audit_logs WHERE entity='users' AND details LIKE '%target_user%' AND user_id=1").n>5);assert.deepEqual(all('PRAGMA foreign_key_check'),[]);
});
await test('Admin notification administration and explicit record URLs enforce hostel and role scope',async()=>{
 const notifications=await req('admin','notifications?audience=all');assert.ok(notifications.some(n=>n.recipient_email===seedStudentEmail()));
 const scoped=await req('admin','notifications?audience=all&hostel_id=2');assert.ok(scoped.every(n=>n.hostel==='Boys Hostel – Non-AC'));
 await req('warden','notifications?audience=all','GET',undefined,403);await req('laundry','notifications?audience=all','GET',undefined,403);await req('student','notifications?audience=all','GET',undefined,403);
 const ownLaundry=one('SELECT l.id FROM laundry_requests l JOIN students s ON s.id=l.student_id WHERE s.hostel_id=2');assert.equal((await req('laundry',`laundry/${ownLaundry.id}`)).id,ownLaundry.id);
 const otherLaundry=one('SELECT l.id FROM laundry_requests l JOIN students s ON s.id=l.student_id WHERE s.hostel_id=1');await req('laundry',`laundry/${otherLaundry.id}`,'GET',undefined,404);
 const otherMaintenance=one('SELECT m.id FROM maintenance_requests m JOIN rooms r ON r.id=m.room_id WHERE r.hostel_id=1');await req('maintenance',`maintenance/${otherMaintenance.id}`,'GET',undefined,404);
 const r=await fetch(`${base}/app/approvals`,{headers:{cookie:cookies.student}});assert.equal(r.status,403);
 await req(null,'auth/register','POST',{...registration('warden'),full_name:123,email:'bad-type@gmail.com',employee_id:'BAD-TYPE'},400);
});
await test('Disk migration and account approval remain idempotent and persist across process restarts',()=>{
 const folder=resolve('test-results','persistence-v2');mkdirSync(folder,{recursive:true});const path=resolve(folder,`test-${Date.now()}-${process.pid}.sqlite`);
 // A fresh isolated database is seeded, migrated, then changed in a separate process.
 const env={...process.env,SMARTSTAY_DB:path};const first=spawnSync(process.execPath,['--input-type=module','-e',"const {db}=await import('./server/db.js');const {register,review}=await import('./server/accounts.js');const r=register({full_name:'Persistent Employee',email:'persist@gmail.com',phone:'+91 98765 43210',password:'Persistence@123',confirm_password:'Persistence@123',role:'laundry',employee_id:'PERSIST-001',requested_hostel_id:2});review({id:1,role:'admin'},r.id,{action:'approve',hostel_id:3});db.close();"],{env,encoding:'utf8'});assert.equal(first.status,0,first.stderr);
 const second=spawnSync(process.execPath,['--input-type=module','-e',"const {one,db}=await import('./server/db.js');const {verifyPassword}=await import('./server/security.js');const u=one(\"SELECT * FROM users WHERE email='persist@gmail.com'\");console.log(JSON.stringify({students:one('SELECT COUNT(*) n FROM students').n,status:u.account_status,requested:u.requested_hostel_id,assigned:u.assigned_hostel_id,approved_by:u.approved_by,verified:verifyPassword('Persistence@123',u.password_hash),migrations:one('SELECT COUNT(*) n FROM schema_migrations').n}));db.close();"],{env,encoding:'utf8'});assert.equal(second.status,0,second.stderr);assert.deepEqual(JSON.parse(second.stdout),{students:842,status:'APPROVED',requested:2,assigned:3,approved_by:1,verified:true,migrations:1});
 const check=new DatabaseSync(path);assert.deepEqual(check.prepare('PRAGMA foreign_key_check').all(),[]);check.close();
 const backups=readdirSync(resolve(folder,'backups'));assert.ok(backups.length>0);
});
}finally{await new Promise(r=>server.close(r));db.close();}
