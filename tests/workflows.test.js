import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const testDir=mkdtempSync(join(tmpdir(),'smartstay-workflow-'));
const dbPath=join(testDir,'workflow.sqlite');
process.env.SMARTSTAY_DB=dbPath;
process.env.SMARTSTAY_NO_LISTEN='1';
const {server}=await import('../server/server.js');
const {db,today}=await import('../server/db.js');

await new Promise((resolveListen,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',resolveListen);
});
const address=server.address();
const origin=`http://127.0.0.1:${address.port}`;
const passwords={admin:'Admin@123',warden:'Warden@123',student:'Student@123',security:'Security@123',maintenance:'Maintenance@123',laundry:'Laundry@123'};
const sessions=new Map();

async function request(role,path,{method='GET',body,headers={}}={}){
  const requestHeaders={...headers};
  if(role&&sessions.has(role))requestHeaders.cookie=sessions.get(role);
  if(['POST','PATCH','PUT','DELETE'].includes(method)){requestHeaders['x-smartstay-request']='1';requestHeaders['content-type']='application/json';}
  const response=await fetch(`${origin}${path.startsWith('/api/')||path.startsWith('/app/')?path:`/api/${path}`}`,{method,headers:requestHeaders,...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const contentType=response.headers.get('content-type')||'';
  const value=contentType.includes('application/json')?await response.json():await response.text();
  return {status:response.status,value,response};
}
async function login(role){
  const result=await request(null,'auth/login',{method:'POST',body:{email:`${role}@smartstay.edu`,password:passwords[role]}});
  assert.equal(result.status,200,`${role} demo login failed: ${JSON.stringify(result.value)}`);
  sessions.set(role,result.response.headers.get('set-cookie').split(';')[0]);
  return result.value;
}
async function ok(role,path,opts={}){const r=await request(role,path,opts);assert.ok(r.status>=200&&r.status<300,`${role} ${opts.method||'GET'} ${path}: ${r.status} ${JSON.stringify(r.value).slice(0,500)}`);return r.value;}
const later=()=>new Date(Date.now()+3*60*60*1000).toISOString();

test('SmartStay demo roles, authorization and core residence workflows',async t=>{
  t.after(async()=>{
    await new Promise(done=>server.close(done));db.close();
    const resolved=resolve(testDir),allowed=resolve(tmpdir());
    if(!resolved.startsWith(allowed))throw new Error('Refusing to clean a test directory outside the system temp folder.');
    rmSync(resolved,{recursive:true,force:true});
  });

  const publicInfo=await request(null,'public');
  assert.equal(publicInfo.status,200);assert.equal(publicInfo.value.hostels,4);assert.equal(publicInfo.value.beds,960);assert.equal(publicInfo.value.students,842);

  for(const role of Object.keys(passwords)){
    const auth=await login(role);assert.equal(auth.role,role);
    const me=await ok(role,'me');assert.equal(me.user.role,role);
    await ok(role,'dashboard');
  }

  const modules={
    admin:['students','hostels','rooms','allocations','wardens','staff','attendance','gate','leaves','maintenance','complaints','laundry','notifications','safety','iot','cleaning','inspections','feedback','reports','settings'],
    warden:['students','hostels','rooms','allocations','staff','attendance','gate','leaves','maintenance','complaints','laundry','notifications','safety','iot','cleaning','inspections','feedback','reports','settings'],
    student:['rooms','gate','leaves','maintenance','complaints','laundry','notifications','safety','iot','cleaning','feedback'],
    security:['students','hostels','gate','leaves','notifications','safety'],
    maintenance:['rooms','maintenance','cleaning','notifications'],
    laundry:['laundry','notifications'],
  };
  for(const [role,list] of Object.entries(modules))for(const page of list){
    const result=await request(role,page);assert.equal(result.status,200,`${role} could not open ${page}: ${JSON.stringify(result.value).slice(0,300)}`);
  }

  assert.equal((await request('student','students')).status,403);
  assert.equal((await request('student','reports')).status,403);
  const protectedPage=await request('student','/app/students');assert.equal(protectedPage.status,403);
  const ownRooms=await ok('student','rooms');assert.equal(ownRooms.length,1,'students should only see their assigned room');

  const studentList=await ok('admin','students');assert.equal(studentList.length,842);
  const own=studentList.find(s=>s.student_code==='STU1001');assert.ok(own);
  const home=await ok('admin','dashboard');assert.equal(home.beds,960);assert.equal(home.occupied,842);

  const newStudent=await ok('admin','students',{method:'POST',body:{full_name:'Demo Transfer Student',email:'transfer.demo@smartstay.edu',password:'Student@123',phone:'+91 98888 11111',registration_number:'20261A90001',department:'CSE',year:2,guardian_name:'Demo Guardian',guardian_phone:'+91 98888 11112',emergency_phone:'+91 98888 11113',hostel_id:1}});
  assert.ok(newStudent.id);
  const beforeAllocation=await ok('admin','allocations');assert.ok(beforeAllocation.availableBeds.length>0);
  const bed=beforeAllocation.availableBeds[0];
  await ok('admin','allocations',{method:'POST',body:{student_id:newStudent.id,bed_id:bed.bed_id}});
  const assigned=await ok('admin',`students/${newStudent.id}`);assert.equal(assigned.bed_id,bed.bed_id);
  assert.equal((await request('admin','allocations',{method:'POST',body:{student_id:newStudent.id,bed_id:bed.bed_id}})).status,409,'occupied bed must not be double allocated');

  const leaveBody={leave_type:'Normal Leave',from_date:today(),to_date:today(),departure_time:'18:00',expected_return:'21:00',destination:'Hyderabad',reason:'Family visit for the weekend',emergency_contact:'+91 98765 43210'};
  const leave=await ok('student','leaves',{method:'POST',body:leaveBody});assert.ok(leave.id);
  const pending=(await ok('warden','leaves')).find(x=>x.id===leave.id);assert.equal(pending.status,'Pending');
  await ok('warden',`leaves/${leave.id}`,{method:'PATCH',body:{status:'Approved',review_note:'Approved by the residence warden.'}});
  assert.equal((await ok('student','leaves')).find(x=>x.id===leave.id).status,'Approved');

  await ok('security','gate',{method:'POST',body:{student_id:1,action:'exit',reason:'Approved family visit',expected_return:later()}});
  assert.equal((await ok('student','gate')).logs[0].status,'On Leave');
  await ok('security','gate',{method:'POST',body:{student_id:1,action:'entry'}});
  assert.equal((await ok('student','gate')).logs[0].entry_time?true:false,true);
  await ok('security','keys',{method:'POST',body:{student_id:1,action:'submit',key_code:'KEY-DEMO-1'}});
  assert.ok((await ok('security','gate')).keys.some(key=>key.student_id===1&&!key.returned_at));
  await ok('security','keys',{method:'POST',body:{student_id:1,action:'return'}});
  assert.ok((await ok('security','gate')).keys.some(key=>key.student_id===1&&key.returned_at));

  await ok('admin','attendance',{method:'POST',body:{student_id:1,status:'Present',attendance_date:today()}});
  await ok('admin','attendance',{method:'POST',body:{student_id:1,biometric:true,method:'RFID',attendance_date:today()}});
  const att=await ok('admin',`attendance?from=${today()}&to=${today()}`);assert.ok(att.biometrics.length>0);

  const repair=await ok('student','maintenance',{method:'POST',body:{category:'Electrical',description:'Desk light needs a replacement in the study corner.',priority:'High'}});assert.ok(repair.id);
  const staff=await ok('admin','staff');const maintenanceUser=(await ok('maintenance','me')).user;const assignedStaff=staff.find(s=>s.user_id===maintenanceUser.id);assert.ok(assignedStaff,'maintenance login must map to a staff record');
  await ok('warden',`maintenance/${repair.id}`,{method:'PATCH',body:{assigned_staff_id:assignedStaff.id}});
  await ok('maintenance',`maintenance/${repair.id}`,{method:'PATCH',body:{status:'In Progress'}});
  await ok('maintenance',`maintenance/${repair.id}`,{method:'PATCH',body:{status:'Resolved',resolution:'Replaced the LED and tested the switch.'}});
  await ok('student',`maintenance/${repair.id}`,{method:'PATCH',body:{status:'Verified'}});

  const complaint=await ok('student','complaints',{method:'POST',body:{category:'Security',description:'Please review the east entrance lighting after evening study hours.',priority:'High',confidential:true}});assert.ok(complaint.id);
  const privateList=await ok('warden','complaints');assert.ok(privateList.find(x=>x.id===complaint.id)?.full_name);
  await ok('warden',`complaints/${complaint.id}`,{method:'PATCH',body:{status:'Under Review',note:'The warden has opened a private review.'}});

  const laundry=await ok('student','laundry',{method:'POST',body:{clothes_count:7,service_type:'Wash & Fold',pickup_date:today()}});assert.ok(laundry.id);
  for(const status of ['Collected','Washing','Ready','Delivered'])await ok('laundry',`laundry/${laundry.id}`,{method:'PATCH',body:{status}});
  assert.equal((await ok('student','laundry')).find(x=>x.id===laundry.id).status,'Delivered');

  const alert=await ok('student','safety',{method:'POST',body:{emergency_type:'Medical Emergency',details:'Requesting assistance at the residence common room.',contact_number:'+91 98765 43210',confirmed:true}});assert.ok(alert.id);
  await ok('security',`safety/${alert.id}`,{method:'PATCH',body:{status:'Acknowledged'}});
  await ok('security',`safety/${alert.id}`,{method:'PATCH',body:{status:'Resolved'}});

  await ok('student','feedback',{method:'POST',body:{service:'Laundry service',rating:5,comment:'Pickup was on time and the handover was clear.'}});
  assert.ok((await ok('student','feedback')).some(x=>x.comment?.includes('on time')));
  await ok('admin','iot',{method:'POST',body:{}});
  const rooms=await ok('admin','rooms');const cleaner=(await ok('admin','staff')).find(x=>x.role==='Cleaning');assert.ok(cleaner);
  const task=await ok('admin','cleaning',{method:'POST',body:{room_id:rooms[0].id,staff_id:cleaner.id,scheduled_date:today()}});assert.ok(task.id);
  await ok('maintenance',`cleaning/${task.id}`,{method:'PATCH',body:{status:'In Progress'}});
  await ok('maintenance',`cleaning/${task.id}`,{method:'PATCH',body:{status:'Completed'}});
  await ok('admin','inspections',{method:'POST',body:{hostel_id:1,inspection_date:today(),rooms_checked:12,issues_found:'Study lounge light requires replacement.',action_taken:'Maintenance team assigned for the next shift.'}});
  await ok('admin','settings',{method:'PATCH',body:{gate_open:'05:30',gate_close:'22:00',visitor_start:'09:00',visitor_end:'18:00'}});
  await ok('admin','reports?type=Occupancy');
  await ok('student','notifications',{method:'POST',body:{}});

  const current=await ok('admin','allocations');
  const active=current.allocations.find(x=>x.student_id===newStudent.id);assert.ok(active);
  await ok('admin','allocations',{method:'POST',body:{action:'vacate',student_id:newStudent.id}});
  const vacated=await ok('admin',`students/${newStudent.id}`);assert.equal(vacated.bed_id,null);
});
