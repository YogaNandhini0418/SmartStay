import { all, one, run, transaction, today, now } from './db.js';
import { HttpError, required, choice, integer, validEmail, validPhone, hashPassword, requireRole, verifyAdminCode } from './security.js';
import { validHostel, departments, notifyRoles, notify, audit, code } from './repositories.js';
import {normalizeEmail} from '../public/js/email.js';

const roles=['student','warden','security','maintenance','laundry','admin'];
export function registrationOptions(){return {roles,departments:departments(),hostels:all('SELECT id,name,category,accommodation_type FROM hostels WHERE active=1 ORDER BY id'),specializations:['Electrical','Plumbing','Carpentry','General Maintenance'],shifts:['Day','Evening','Night']};}
export function register(d){
  required(d,['full_name','phone','password','confirm_password','role']);
  for(const key of ['full_name','email','phone','password','confirm_password','role','roll_number','department','gender','employee_id','specialization','shift','admin_security_code'])if(d[key]!==undefined&&typeof d[key]!=='string')throw new HttpError(400,`${key.replaceAll('_',' ')} must be text.`);
  choice(d.role,roles,'Registration role');
  const admin=d.role==='admin';
  // A public role choice cannot grant administrative access. Verify the existing
  // server secret before checking account details or creating any records.
  if(admin){
    if(!d.admin_security_code?.trim())throw new HttpError(400,'Please enter the administrator security code.');
    if(!verifyAdminCode(d.admin_security_code))throw new HttpError(403,'Invalid administrator security code. Please check the code and try again.');
  }else required(d,['requested_hostel_id']);
  validEmail(d.email,d.role);validPhone(d.phone);
  if(typeof d.password!=='string'||d.password.length<8||d.password.length>128)throw new HttpError(400,'Use a password between 8 and 128 characters.');
  if(d.password!==d.confirm_password)throw new HttpError(400,'Passwords do not match.');
  const email=normalizeEmail(d.email),name=d.full_name.trim();if(name.length<2||name.length>120)throw new HttpError(400,'Enter your full name (2–120 characters).');
  if(one('SELECT id FROM users WHERE lower(email)=?',email))throw new HttpError(409,admin?'An account with this email already exists.':'An account already uses this email address.');
  let roll=null,employee=null,gender=null;
  if(d.role==='student'){
    required(d,['roll_number','department','year','gender']);gender=d.gender;choice(gender,['Male','Female'],'Gender');
    roll=d.roll_number.trim().toUpperCase();if(!/^[A-Z0-9-]{3,40}$/.test(roll))throw new HttpError(400,'Roll number must contain 3–40 letters, digits or hyphens.');
    if(one('SELECT id FROM students WHERE upper(registration_number)=?',roll))throw new HttpError(409,'This roll number is already registered.');
    choice(d.department,departments().map(x=>x.name),'Department');integer(d.year,1,6);
  }else{
    if(admin&&!d.employee_id?.trim())throw new HttpError(400,'Please enter your administrator ID.');
    required(d,['employee_id']);employee=d.employee_id.trim().toUpperCase();if(!/^[A-Z0-9-]{3,40}$/.test(employee))throw new HttpError(400,admin?'Administrator ID must contain 3–40 letters, digits or hyphens.':'Employee ID must contain 3–40 letters, digits or hyphens.');
    if(one('SELECT id FROM users WHERE employee_id=?',employee)||one('SELECT id FROM staff WHERE staff_code=?',employee)||one('SELECT id FROM wardens WHERE warden_code=?',employee))throw new HttpError(409,'This employee ID is already registered.');
    if(d.role==='security'){required(d,['shift']);choice(d.shift,['Day','Evening','Night'],'Shift');}
    if(d.role==='maintenance'){required(d,['specialization']);choice(d.specialization,registrationOptions().specializations,'Specialization');}
  }
  if(admin)return transaction(()=>{
    const role=one("SELECT id FROM roles WHERE name='admin'"),created=now();
    // Server-verified activation uses no self-approval and no hostel assignment.
    // The security code is never included in the user record or audit details.
    const uid=Number(run("INSERT INTO users(role_id,email,password_hash,full_name,phone,employee_id,active,account_status,approved_at,created_at,updated_at) VALUES(?,?,?,?,?,?,1,'APPROVED',?,?,?)",role.id,email,hashPassword(d.password),name,d.phone,employee,created,created,created).lastInsertRowid);
    audit({id:uid},'Admin account created with verified security code','users',uid,{role:'admin',employee_id:employee,activation:'server_security_code',access:'all_hostels'});
    notifyRoles(['admin'],'New Administrator Account',`${name} (${employee}) created an administrator account with verified access to all four hostels.`,'High');
    return {id:uid,status:'APPROVED',message:'Administrator account created successfully. Sign in with your email, password, and administrator security code.'};
  });
  const hostel=validHostel(d.requested_hostel_id,gender);
  return transaction(()=>{
    const role=one('SELECT id FROM roles WHERE name=?',d.role);
    const uid=Number(run("INSERT INTO users(role_id,email,password_hash,full_name,phone,active,account_status,requested_hostel_id,employee_id,specialization,shift,created_at,updated_at) VALUES(?,?,?,?,?,0,'PENDING',?,?,?,?,?,?)",role.id,email,hashPassword(d.password),name,d.phone,hostel.id,employee,d.role==='maintenance'?d.specialization:null,d.role==='security'?d.shift:'Day',now(),now()).lastInsertRowid);
    if(d.role==='student')run("INSERT INTO students(user_id,student_code,registration_number,department,year,gender,joining_date,active,current_status) VALUES(?,?,?,?,?,?,?,0,'Awaiting allocation')",uid,code('students','student_code','STU'),roll,d.department,Number(d.year),gender,today());
    const label=d.role[0].toUpperCase()+d.role.slice(1);
    notifyRoles(['admin'],`New ${label} Registration`,`${name} (${roll||employee}) requested ${hostel.name} and is waiting for account approval.`,'High',hostel.id);
    audit({id:uid},'Registration submitted','users',uid,{role:d.role,requested_hostel_id:hostel.id});
    return {id:uid,status:'PENDING',message:'Registration submitted successfully. Your account is awaiting Admin approval.'};
  });
}
const approvalSelect=`SELECT u.id,u.email,u.full_name,u.phone,u.employee_id,u.specialization,u.shift,u.account_status,u.requested_hostel_id,u.assigned_hostel_id,u.approved_at,u.approved_by,u.rejection_reason,u.created_at,r.name role,s.id student_id,s.student_code,s.registration_number roll_number,s.department,s.year,s.gender,s.room_id,s.bed_id,h.name requested_hostel,ah.name assigned_hostel,au.full_name approved_by_name FROM users u JOIN roles r ON r.id=u.role_id LEFT JOIN students s ON s.user_id=u.id LEFT JOIN hostels h ON h.id=u.requested_hostel_id LEFT JOIN hostels ah ON ah.id=u.assigned_hostel_id LEFT JOIN users au ON au.id=u.approved_by WHERE r.name<>'admin'`;
export function approvals(user,id){
  requireRole(user,['admin']);
  if(id){const row=one(`${approvalSelect} AND u.id=?`,integer(id));if(!row)throw new HttpError(404,'Account request not found.');return row;}
  const rows=all(`${approvalSelect} ${user.hostel_filter?'AND COALESCE(u.assigned_hostel_id,u.requested_hostel_id)=?':''} ORDER BY u.created_at DESC,u.id DESC`,...(user.hostel_filter?[user.hostel_filter]:[]));
  return {rows,summary:Object.fromEntries(['PENDING','APPROVED','REJECTED','SUSPENDED'].map(s=>[s,rows.filter(r=>r.account_status===s).length]))};
}
export function review(user,id,d){
  requireRole(user,['admin']);required(d,['action']);choice(d.action,['approve','reject','suspend','restore','change_hostel'],'Action');
  const target=approvals(user,id),previous=target.account_status;
  return transaction(()=>{
    let status=previous,hid=target.assigned_hostel_id;
    if(d.action==='approve'||d.action==='change_hostel'){
      if(d.action==='approve'&&previous!=='PENDING')throw new HttpError(409,'Only pending requests can be approved.');
      if(d.action==='change_hostel'&&!['APPROVED','SUSPENDED'].includes(previous))throw new HttpError(409,'Approve the request before changing its assignment.');
      required(d,['hostel_id']);hid=validHostel(d.hostel_id,target.role==='student'?target.gender:null).id;
      if(target.bed_id&&hid!==target.assigned_hostel_id)throw new HttpError(409,'Vacate or transfer the existing bed through Room Allocation before changing hostel.');
      if(target.role==='student')run('UPDATE students SET hostel_id=?,active=? WHERE user_id=?',hid,d.action==='approve'?1:previous==='APPROVED'?1:0,target.id);
      else if(target.role==='warden'){
        if(!one('SELECT id FROM wardens WHERE user_id=?',target.id))run('INSERT INTO wardens(user_id,warden_code,hostel_id,shift) VALUES(?,?,?,?)',target.id,target.employee_id,hid,target.shift);
        else run('UPDATE wardens SET hostel_id=? WHERE user_id=?',hid,target.id);
        run('UPDATE hostels SET warden_user_id=NULL WHERE warden_user_id=?',target.id);
        run('UPDATE hostels SET warden_user_id=? WHERE id=?',target.id,hid);
      }else{
        const role=target.role[0].toUpperCase()+target.role.slice(1);
        if(!one('SELECT id FROM staff WHERE user_id=?',target.id))run('INSERT INTO staff(user_id,staff_code,name,role,phone,hostel_id,shift) VALUES(?,?,?,?,?,?,?)',target.id,target.employee_id,target.full_name,role,target.phone,hid,target.shift);
        else run('UPDATE staff SET hostel_id=? WHERE user_id=?',hid,target.id);
      }
      if(d.action==='approve')status='APPROVED';
    }
    if(d.action==='reject'){if(previous!=='PENDING')throw new HttpError(409,'Only pending requests can be rejected.');required(d,['reason']);status='REJECTED';}
    if(d.action==='suspend'){if(previous!=='APPROVED')throw new HttpError(409,'Only approved users can be suspended.');required(d,['reason']);status='SUSPENDED';}
    if(d.reason!==undefined&&(typeof d.reason!=='string'||d.reason.trim().length<3))throw new HttpError(400,'Enter a review reason of at least 3 characters.');
    if(d.action==='restore'){if(previous!=='SUSPENDED')throw new HttpError(409,'Only suspended accounts can be restored.');if(!hid)throw new HttpError(409,'Confirm a hostel assignment first.');validHostel(hid,target.role==='student'?target.gender:null);status='APPROVED';}
    const active=status==='APPROVED'?1:0;
    run("UPDATE users SET account_status=?,active=?,assigned_hostel_id=?,approved_at=CASE WHEN ?='approve' THEN ? ELSE approved_at END,approved_by=CASE WHEN ?='approve' THEN ? ELSE approved_by END,rejection_reason=?,updated_at=? WHERE id=?",status,active,hid,d.action,now(),d.action,user.id,['reject','suspend'].includes(d.action)?d.reason:null,now(),target.id);
    if(target.role==='student')run('UPDATE students SET active=? WHERE user_id=?',active,target.id);
    if(target.role==='warden')run('UPDATE wardens SET status=? WHERE user_id=?',active?'Active':'Inactive',target.id);
    if(['security','maintenance','laundry'].includes(target.role))run('UPDATE staff SET availability=? WHERE user_id=?',active?'Available':'Unavailable',target.id);
    run('DELETE FROM sessions WHERE user_id=?',target.id);
    const details={target_user:target.id,identifier:target.roll_number||target.employee_id,from_status:previous,to_status:status,from_hostel:target.assigned_hostel_id,to_hostel:hid,reason:d.reason||null};
    const past={approve:'approved',reject:'rejected',suspend:'suspended',restore:'restored',change_hostel:'changed hostel assignment'}[d.action];
    audit(user,`Admin ${past}${d.action==='change_hostel'?'':' account'}`,'users',target.id,details);
    const message=d.action==='change_hostel'?`Your assigned hostel is now ${validHostel(hid,null,false).name}.`:status==='APPROVED'?`Your account is approved. Assigned hostel: ${validHostel(hid,null,false).name}. Room allocation is managed separately.`:status==='REJECTED'?`Your registration request was not approved. ${d.reason}`:`Your account has been suspended. ${d.reason}`;
    notify(target.id,'Account status updated',message,'High',hid);
    return {id:target.id,status,hostel_id:hid,message:d.action==='change_hostel'?'Hostel assignment updated successfully.':`${target.role[0].toUpperCase()+target.role.slice(1)} account ${past} successfully.`};
  });
}
