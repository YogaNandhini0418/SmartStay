import { all, one, run, today, now } from './db.js';
import { HttpError, integer, choice } from './security.js';

export const studentSelect = `SELECT s.*,u.full_name,u.email,u.phone,u.account_status,h.name hostel,h.accommodation_type,r.room_number,b.bed_number,
 COALESCE(a.status,'Not Recorded') attendance_status,
 ROUND(100.0*(SELECT COUNT(*) FROM attendance WHERE student_id=s.id AND status IN ('Present','On Leave','Medical Leave'))/MAX(1,(SELECT COUNT(*) FROM attendance WHERE student_id=s.id)),1) attendance_percentage
 FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN hostels h ON h.id=s.hostel_id
 LEFT JOIN rooms r ON r.id=s.room_id LEFT JOIN beds b ON b.id=s.bed_id
 LEFT JOIN attendance a ON a.student_id=s.id AND a.attendance_date='${today()}'`;
export function hostelScope(user, alias='r') {
  const hid=user.role==='admin'?user.hostel_filter:user.hostel_id;
  return hid?{sql:`${alias}.hostel_id=?`,args:[hid]}:user.role==='admin'?{sql:'1=1',args:[]}:{sql:'1=0',args:[]};
}
export function scope(user, alias='s') {
  if(user.role==='student')return {sql:`${alias}.id=?`,args:[user.student_id]};
  return hostelScope(user,alias);
}
export function filteredUser(user, value) {
  if(value===null||value===undefined||value==='')return user;
  if(value==='all'){if(user.role!=='admin')throw new HttpError(403,'Only Admin can access all hostels.');return {...user,hostel_filter:null};}
  const hid=integer(value);if(!one('SELECT id FROM hostels WHERE id=?',hid))throw new HttpError(404,'Hostel not found.');
  if(user.role!=='admin'&&hid!==user.hostel_id)throw new HttpError(403,'This hostel is outside your assignment.');
  return user.role==='admin'?{...user,hostel_filter:hid}:user;
}
export function validHostel(id, gender=null, active=true) {
  const h=one('SELECT * FROM hostels WHERE id=?',integer(id));
  if(!h||active&&!h.active)throw new HttpError(400,'Choose an active hostel.');
  if(gender){choice(gender,['Male','Female'],'Gender');if(h.category!==(gender==='Male'?'Boys':'Girls'))throw new HttpError(400,'Student gender does not match the selected hostel.');}
  return h;
}
export function departments(includeInactive=false){return all(`SELECT * FROM departments ${includeInactive?'':'WHERE active=1'} ORDER BY id`);}
export function students(user, includeInactive=false) {
  const sc=scope(user);return all(`${studentSelect} WHERE ${sc.sql} AND u.account_status IN ('APPROVED','SUSPENDED') ${includeInactive?'':"AND s.active=1 AND u.active=1 AND u.account_status='APPROVED'"} ORDER BY s.id`,...sc.args);
}
export function student(user,id) {
  const sc=scope(user);const row=one(`${studentSelect} WHERE s.id=? AND ${sc.sql} AND u.account_status IN ('APPROVED','SUSPENDED')`,Number(id),...sc.args);
  if(!row)throw new HttpError(404,'Student not found in your residence.');return row;
}
export function room(user,id) {
  const sc=hostelScope(user);const row=one(`SELECT r.*,f.floor_number,h.name hostel,h.category,h.accommodation_type FROM rooms r JOIN floors f ON f.id=r.floor_id JOIN hostels h ON h.id=r.hostel_id WHERE r.id=? AND ${sc.sql}`,Number(id),...sc.args);
  if(!row||(user.role==='student'&&row.id!==one('SELECT room_id FROM students WHERE id=?',user.student_id)?.room_id))throw new HttpError(404,'Room not found in your residence.');return row;
}
export function rooms(user) {
  const sc=user.role==='student'?{sql:'r.id=(SELECT room_id FROM students WHERE id=?)',args:[user.student_id]}:hostelScope(user);
  return all(`SELECT r.*,h.name hostel,h.category,h.accommodation_type,h.active hostel_active,f.floor_number,COUNT(b.id) total_beds,SUM(b.status='Occupied') occupied_beds,SUM(b.status='Available') available_beds FROM rooms r JOIN hostels h ON h.id=r.hostel_id JOIN floors f ON f.id=r.floor_id LEFT JOIN beds b ON b.room_id=r.id WHERE ${sc.sql} GROUP BY r.id ORDER BY r.room_number`,...sc.args);
}
export function hostels(user) {
  const sc=hostelScope(user,'x');
  return all(`SELECT h.*,u.full_name warden,u.phone warden_phone,
   (SELECT COUNT(*) FROM floors WHERE hostel_id=h.id) number_of_floors,
   (SELECT COUNT(*) FROM rooms WHERE hostel_id=h.id) total_rooms,
   (SELECT COUNT(*) FROM beds b JOIN rooms r ON r.id=b.room_id WHERE r.hostel_id=h.id) total_beds,
   (SELECT COUNT(*) FROM beds b JOIN rooms r ON r.id=b.room_id WHERE r.hostel_id=h.id AND b.status='Occupied') occupied_beds,
   (SELECT COUNT(*) FROM beds b JOIN rooms r ON r.id=b.room_id WHERE r.hostel_id=h.id AND b.status='Available') available_beds
   FROM hostels h LEFT JOIN users u ON u.id=h.warden_user_id JOIN (SELECT id hostel_id FROM hostels) x ON x.hostel_id=h.id WHERE ${sc.sql} ORDER BY h.id`,...sc.args).map(h=>({...h,assigned_staff:all('SELECT st.id,st.name,st.role,st.shift,st.user_id FROM staff st WHERE st.hostel_id=? ORDER BY st.role,st.name',h.id)}));
}
export function activityRecords(user,table,extras='') {
  const sc=scope(user);return all(`SELECT t.*,s.student_code,u.full_name,s.registration_number,s.hostel_id,r.room_number,h.name hostel ${extras} FROM ${table} t JOIN students s ON s.id=t.student_id JOIN users u ON u.id=s.user_id LEFT JOIN rooms r ON r.id=s.room_id LEFT JOIN hostels h ON h.id=s.hostel_id WHERE ${sc.sql} ORDER BY t.id DESC`,...sc.args);
}
export function scopedRecord(user,table,id) {
  const row=one(`SELECT * FROM ${table} WHERE id=?`,Number(id));if(!row)throw new HttpError(404,'Record not found.');
  if(table==='maintenance_requests'&&user.role!=='student'){if(!row.room_id)throw new HttpError(404,'Maintenance room not found.');room(user,row.room_id);return row;}
  if(row.student_id)student(user,row.student_id);
  return row;
}
export function settings(){return Object.fromEntries(all('SELECT * FROM hostel_settings').map(r=>[r.setting_key,r.setting_value]));}
export function audit(user,action,entity,id=null,details={}){run('INSERT INTO audit_logs(user_id,action,entity,entity_id,details,created_at) VALUES(?,?,?,?,?,?)',user.id,action,entity,id,JSON.stringify(details),now());}
export function notify(uid,title,message,priority='Normal',hostelId=null){run('INSERT INTO notifications(user_id,title,message,priority,hostel_id,created_at) VALUES(?,?,?,?,?,?)',uid,title,message,priority,hostelId,now());}
export function notifyRoles(roles,title,message,priority='Normal',hostelId=null){
  const marks=roles.map(()=>'?').join(',');
  all(`SELECT u.id,u.assigned_hostel_id,r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.active=1 AND u.account_status='APPROVED' AND r.name IN (${marks})`,...roles).forEach(u=>{
    if(hostelId&&u.name!=='admin'&&u.assigned_hostel_id!==hostelId)return;
    notify(u.id,title,message,priority,hostelId);
  });
}
export function code(table,column,prefix){const max=one(`SELECT MAX(CAST(SUBSTR(${column},?) AS INTEGER)) n FROM ${table}`,prefix.length+1).n;return `${prefix}${(max||1000)+1}`;}
