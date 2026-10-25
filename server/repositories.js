import { all, one, run, today, now } from './db.js';
import { HttpError } from './security.js';

export const studentSelect = `SELECT s.*,u.full_name,u.email,u.phone,h.name hostel,r.room_number,b.bed_number,
 COALESCE(a.status,'Not Recorded') attendance_status,
 ROUND(100.0*(SELECT COUNT(*) FROM attendance WHERE student_id=s.id AND status IN ('Present','On Leave','Medical Leave'))/MAX(1,(SELECT COUNT(*) FROM attendance WHERE student_id=s.id)),1) attendance_percentage
 FROM students s JOIN users u ON u.id=s.user_id LEFT JOIN hostels h ON h.id=s.hostel_id
 LEFT JOIN rooms r ON r.id=s.room_id LEFT JOIN beds b ON b.id=s.bed_id
 LEFT JOIN attendance a ON a.student_id=s.id AND a.attendance_date='${today()}'`;
export function scope(user, alias='s') {
  if(user.role==='student')return { sql:`${alias}.id=?`, args:[user.student_id] };
  if(user.role==='warden')return { sql:`${alias}.hostel_id=?`, args:[user.hostel_id] };
  return { sql:'1=1',args:[] };
}
export function students(user, includeInactive=false) {
  const sc=scope(user);return all(`${studentSelect} WHERE ${sc.sql} ${includeInactive?'':'AND s.active=1'} ORDER BY s.id`,...sc.args);
}
export function student(user,id) {
  const sc=scope(user); const row=one(`${studentSelect} WHERE s.id=? AND ${sc.sql}`,Number(id),...sc.args);
  if(!row)throw new HttpError(404,'Student not found in your residence.');return row;
}
export function room(user,id) {
  const row=one('SELECT r.*,f.floor_number,h.name hostel FROM rooms r JOIN floors f ON f.id=r.floor_id JOIN hostels h ON h.id=r.hostel_id WHERE r.id=?',Number(id));
  if(!row || (user.role==='warden'&&row.hostel_id!==user.hostel_id) || (user.role==='student'&&row.id!==one('SELECT room_id FROM students WHERE id=?',user.student_id)?.room_id))throw new HttpError(404,'Room not found in your residence.');return row;
}
export function rooms(user) {
  let condition='1=1',args=[];
  if(user.role==='warden'){condition='r.hostel_id=?';args=[user.hostel_id];}
  if(user.role==='student'){condition='r.id=(SELECT room_id FROM students WHERE id=?)';args=[user.student_id];}
  return all(`SELECT r.*,h.name hostel,f.floor_number,COUNT(b.id) total_beds,SUM(b.status='Occupied') occupied_beds,SUM(b.status='Available') available_beds FROM rooms r JOIN hostels h ON h.id=r.hostel_id JOIN floors f ON f.id=r.floor_id LEFT JOIN beds b ON b.room_id=r.id WHERE ${condition} GROUP BY r.id ORDER BY r.room_number`,...args);
}
export function hostels(user) {
  return all(`SELECT h.*,u.full_name warden,u.phone warden_phone,
  (SELECT COUNT(*) FROM rooms WHERE hostel_id=h.id) total_rooms,
  (SELECT COUNT(*) FROM beds b JOIN rooms r ON r.id=b.room_id WHERE r.hostel_id=h.id) total_beds,
  (SELECT COUNT(*) FROM beds b JOIN rooms r ON r.id=b.room_id WHERE r.hostel_id=h.id AND b.status='Occupied') occupied_beds
  FROM hostels h LEFT JOIN users u ON u.id=h.warden_user_id ${user.role==='warden'?'WHERE h.id=?':''}`,...(user.role==='warden'?[user.hostel_id]:[]));
}
export function activityRecords(user,table,extras='') {
  const sc=scope(user);return all(`SELECT t.*,s.student_code,u.full_name,s.registration_number,s.hostel_id,r.room_number,h.name hostel ${extras} FROM ${table} t JOIN students s ON s.id=t.student_id JOIN users u ON u.id=s.user_id LEFT JOIN rooms r ON r.id=s.room_id LEFT JOIN hostels h ON h.id=s.hostel_id WHERE ${sc.sql} ORDER BY t.id DESC`,...sc.args);
}
export function scopedRecord(user,table,id) {
  const row=one(`SELECT * FROM ${table} WHERE id=?`,Number(id));
  if(!row)throw new HttpError(404,'Record not found.');
  if(row.student_id)student(user,row.student_id);
  return row;
}
export function settings() {return Object.fromEntries(all('SELECT * FROM hostel_settings').map(r=>[r.setting_key,r.setting_value]));}
export function audit(user,action,entity,id=null) {run('INSERT INTO audit_logs(user_id,action,entity,entity_id,created_at) VALUES(?,?,?,?,?)',user.id,action,entity,id,now());}
export function notify(uid,title,message,priority='Normal') {run('INSERT INTO notifications(user_id,title,message,priority,created_at) VALUES(?,?,?,?,?)',uid,title,message,priority,now());}
export function notifyRoles(roles,title,message,priority='Normal',hostelId=null) {
  const marks=roles.map(()=>'?').join(',');
  all(`SELECT u.id,r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.active=1 AND r.name IN (${marks})`,...roles).forEach(u=>{
    if(hostelId&&u.name==='warden'&&!one('SELECT id FROM wardens WHERE user_id=? AND hostel_id=?',u.id,hostelId))return;
    notify(u.id,title,message,priority);
  });
}
export function code(table,column,prefix) {
  const max=one(`SELECT MAX(CAST(SUBSTR(${column},?) AS INTEGER)) n FROM ${table}`,prefix.length+1).n;
  return `${prefix}${(max||1000)+1}`;
}
