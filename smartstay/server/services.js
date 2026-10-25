import { all, one, run, transaction, today, now } from './db.js';
import { student, room, validHostel, notify, notifyRoles, audit, settings } from './repositories.js';
import { HttpError, required, choice, integer } from './security.js';

export function allocate(user,data) {
  required(data,['student_id','bed_id']);
  const s=student(user,integer(data.student_id));
  if(!s.active)throw new HttpError(400,'Reactivate the student before allocating a bed.');
  const bed=one('SELECT * FROM beds WHERE id=?',integer(data.bed_id));
  if(!bed)throw new HttpError(404,'Bed not found.');
  const r=room(user,bed.room_id);
  validHostel(r.hostel_id,s.gender);
  if(!data.transfer&&s.hostel_id!==r.hostel_id)throw new HttpError(400,'Allocate a bed in the confirmed hostel. Admin can change the hostel assignment in User Approvals.');
  if(data.transfer&&s.hostel_id!==r.hostel_id&&user.role!=='admin')throw new HttpError(403,'Only Admin can transfer a resident between hostels.');
  if(r.maintenance_status!=='Clear')throw new HttpError(409,'This room is unavailable during maintenance.');
  return transaction(()=>{
    if(bed.status!=='Available')throw new HttpError(409,'This bed is already occupied or unavailable.');
    const active=one('SELECT * FROM room_allocations WHERE student_id=? AND vacated_at IS NULL',s.id);
    if(active&&!data.transfer)throw new HttpError(409,'This student already has an active allocation. Use Transfer.');
    if(active){run('UPDATE room_allocations SET vacated_at=? WHERE id=?',now(),active.id);run("UPDATE beds SET status='Available' WHERE id=?",active.bed_id);}
    const id=Number(run('INSERT INTO room_allocations(student_id,bed_id,allocated_by,note,allocated_at) VALUES(?,?,?,?,?)',s.id,bed.id,user.id,data.note||'',now()).lastInsertRowid);
    run("UPDATE beds SET status='Occupied' WHERE id=?",bed.id);
    run("UPDATE students SET hostel_id=?,room_id=?,bed_id=?,current_status=CASE WHEN current_status='Awaiting allocation' THEN 'Inside Hostel' ELSE current_status END WHERE id=?",r.hostel_id,r.id,bed.id,s.id);
    notify(s.user_id,active?'Room transfer complete':'Your room is ready',`You are allocated to ${r.room_number}, bed ${bed.bed_number}.`);
    audit(user,active?'Room transferred':'Room allocated','room_allocations',id,{target_user:s.user_id,from_hostel:s.hostel_id,to_hostel:r.hostel_id});return {id};
  });
}
export function vacate(user,id) {
  const s=student(user,id);
  return transaction(()=>{
    const active=one('SELECT * FROM room_allocations WHERE student_id=? AND vacated_at IS NULL',s.id);
    if(!active)throw new HttpError(409,'This student has no active bed allocation.');
    run('UPDATE room_allocations SET vacated_at=? WHERE id=?',now(),active.id);run("UPDATE beds SET status='Available' WHERE id=?",active.bed_id);
    run('UPDATE students SET room_id=NULL,bed_id=NULL WHERE id=?',s.id);
    audit(user,'Room vacated','students',s.id);return {id:s.id};
  });
}
export function attendance(user,data) {
  required(data,['student_id','status']);student(user,integer(data.student_id));
  choice(data.status,['Present','Absent','On Leave','Outside Hostel','Medical Leave']);
  const date=data.attendance_date||today();
  run(`INSERT INTO attendance(student_id,attendance_date,status,source,recorded_by,recorded_at) VALUES(?,?,?,?,?,?) ON CONFLICT(student_id,attendance_date) DO UPDATE SET status=excluded.status,source=excluded.source,recorded_by=excluded.recorded_by,recorded_at=excluded.recorded_at`,Number(data.student_id),date,data.status,data.source||'Manual',user.id,now());
  audit(user,'Attendance recorded','students',Number(data.student_id));return {success:true};
}
export function gate(user,data) {
  required(data,['student_id','action']);choice(data.action,['entry','exit']);
  const s=student(user,integer(data.student_id));
  if(!s.active||!s.room_id)throw new HttpError(400,'Only active residents with a room can use the hostel gate.');
  return transaction(()=>{
    const open=one('SELECT * FROM gate_logs WHERE student_id=? AND entry_time IS NULL ORDER BY id DESC LIMIT 1',s.id);
    let id,status;
    if(data.action==='exit') {
      if(open)throw new HttpError(409,'This student is already recorded outside.');
      required(data,['expected_return','reason']);
      if(Number.isNaN(Date.parse(data.expected_return)) || new Date(data.expected_return)<=new Date())throw new HttpError(400,'Expected return must be in the future.');
      const leave=one("SELECT * FROM leave_requests WHERE student_id=? AND status IN ('Approved','Active') AND from_date<=? AND to_date>=?",s.id,today(),today());
      status=leave?'On Leave':'Outside Hostel';
      id=Number(run('INSERT INTO gate_logs(student_id,exit_time,expected_return,reason,status,recorded_by,source) VALUES(?,?,?,?,?,?,?)',s.id,now(),new Date(data.expected_return).toISOString(),data.reason,status,user.id,data.source||'Gate').lastInsertRowid);
      run('UPDATE students SET current_status=? WHERE id=?',status,s.id);
      if(leave)run("UPDATE leave_requests SET status='Active' WHERE id=?",leave.id);
      attendance(user,{student_id:s.id,status:leave?'On Leave':'Outside Hostel',source:'Gate'});
    } else {
      if(!open&&s.current_status==='Inside Hostel')throw new HttpError(409,'This student is already recorded inside.');
      const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
      const config=settings(); const late=clock>config.gate_close||clock<config.gate_open || (open&&new Date(open.expected_return)<new Date());
      status=late?'Late':'Inside Hostel';
      if(open){id=open.id;run('UPDATE gate_logs SET entry_time=?,status=?,recorded_by=? WHERE id=?',now(),status,user.id,id);}
      else id=Number(run('INSERT INTO gate_logs(student_id,entry_time,status,recorded_by,source) VALUES(?,?,?,?,?)',s.id,now(),status,user.id,data.source||'Gate').lastInsertRowid);
      run("UPDATE students SET current_status='Inside Hostel' WHERE id=?",s.id);
      run("UPDATE leave_requests SET status='Completed' WHERE student_id=? AND status='Active'",s.id);
      attendance(user,{student_id:s.id,status:'Present',source:data.source||'Gate'});
      if(late)notifyRoles(['warden','security','admin'],'Late return recorded',`${s.full_name} (${s.student_code}) returned after the permitted time.`,'High',s.hostel_id);
    }
    audit(user,`Gate ${data.action} recorded`,'gate_logs',id);return {id,status};
  });
}
export function attachment(user,entity,id,file) {
  if(!file)return;
  required(file,['name','type','data']);
  if(!['image/png','image/jpeg','image/webp','application/pdf'].includes(file.type))throw new HttpError(400,'Attachments must be PNG, JPG, WebP or PDF.');
  const bytes=Buffer.from(file.data,'base64');
  if(bytes.length>2*1024*1024 || bytes.length<4)throw new HttpError(400,'Attachment must be smaller than 2 MB.');
  const valid=file.type==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':file.type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  if(!valid)throw new HttpError(400,'The attachment does not match its file type.');
  run('INSERT INTO attachments(user_id,entity,entity_id,filename,mime_type,content) VALUES(?,?,?,?,?,?)',user.id,entity,id,String(file.name).replace(/[^a-zA-Z0-9_. -]/g,'').slice(0,100),file.type,bytes);
}
export function transition(current,next,flow) {
  if(!flow[current]?.includes(next))throw new HttpError(409,`Cannot change ${current} to ${next}. Follow the next step in the workflow.`);
}
export function checkLateReturns() {
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
  const cfg=settings(),curfew=clock>=cfg.gate_close||clock<cfg.gate_open;
  const candidates=all("SELECT g.*,s.hostel_id,s.current_status,u.full_name,s.student_code FROM gate_logs g JOIN students s ON s.id=g.student_id JOIN users u ON u.id=s.user_id WHERE g.entry_time IS NULL AND g.late_alerted_at IS NULL AND s.active=1 AND s.current_status='Outside Hostel'");
  let flagged=0;
  transaction(()=>candidates.forEach(g=>{
    if(!curfew&&(!g.expected_return||new Date(g.expected_return)>new Date()))return;
    run("UPDATE gate_logs SET status='Late',late_alerted_at=? WHERE id=?",now(),g.id);
    notifyRoles(['admin','warden','security'],'Student not returned',`${g.full_name} (${g.student_code}) is still outside after ${curfew?'gate closing':'their expected return'}. Please follow up.`,'High',g.hostel_id);
    audit({id:null},'Late return follow-up alert generated','gate_logs',g.id);flagged++;
  }));return {flagged};
}
