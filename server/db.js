import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hashPassword } from './security.js';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'data'), { recursive: true });
export const db = new DatabaseSync(process.env.SMARTSTAY_DB || join(root, 'data', 'smartstay.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(readFileSync(join(root, 'server', 'schema.sql'), 'utf8'));
export const all = (sql, ...args) => db.prepare(sql).all(...args);
export const one = (sql, ...args) => db.prepare(sql).get(...args);
export const get = one;
export const run = (sql, ...args) => db.prepare(sql).run(...args);
let transactionDepth = 0;
export function transaction(fn) {
  if(transactionDepth) return fn();
  db.exec('BEGIN IMMEDIATE');
  transactionDepth++;
  try { const result = fn(); db.exec('COMMIT'); return result; } catch(e) { db.exec('ROLLBACK'); throw e; } finally { transactionDepth--; }
}
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
export const dayOffset = n => { const d = new Date(`${today()}T12:00:00+05:30`); d.setUTCDate(d.getUTCDate()+n); return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d); };
export const now = () => new Date().toISOString();
export const stamp = (day, time='12:00') => new Date(`${day}T${time}:00+05:30`).toISOString();

function seed() {
  if (one('SELECT COUNT(*) n FROM users').n) return;
  transaction(() => {
    ['admin','warden','student','security','maintenance','laundry'].forEach((r,i)=>run('INSERT INTO roles(id,name) VALUES(?,?)',i+1,r));
    const createUser=(role,email,name,password,phone='+91 98765 43210')=>Number(run('INSERT INTO users(role_id,email,full_name,password_hash,phone) VALUES(?,?,?,?,?)',role,email,name,password,phone).lastInsertRowid);
    createUser(1,'admin@smartstay.edu','Vikram Rao',hashPassword('Admin@123'));
    const wid=createUser(2,'warden@smartstay.edu','Dr. Meera Iyer',hashPassword('Warden@123'));
    const sh=hashPassword('Student@123');
    createUser(3,'student@smartstay.edu','Arjun Reddy',sh);
    const sec=createUser(4,'security@smartstay.edu','Suresh Naik',hashPassword('Security@123'));
    const maint=createUser(5,'maintenance@smartstay.edu','Ramesh Patel',hashPassword('Maintenance@123'));
    const laundry=createUser(6,'laundry@smartstay.edu','Lakshmi Devi',hashPassword('Laundry@123'));
    const wh=hashPassword('Warden@123');
    const wardens=[wid,createUser(2,'warden.b@smartstay.edu','Prof. Anand Menon',wh),createUser(2,'warden.c@smartstay.edu','Dr. Kavitha Rao',wh),createUser(2,'warden.d@smartstay.edu','Dr. Neha Sharma',wh)];
    ['Boys Hostel A','Boys Hostel B','Girls Hostel A','Girls Hostel B'].forEach((name,h)=>{
      run('INSERT INTO hostels(id,name,category,address,warden_user_id,facilities) VALUES(?,?,?,?,?,?)',h+1,name,h<2?'Boys':'Girls',`North Campus · Residence ${String.fromCharCode(65+h)}`,wardens[h],'Wi-Fi,Study lounge,Mess,Recreation room,Laundry,24/7 security');
      run('INSERT INTO wardens(user_id,warden_code,hostel_id,shift) VALUES(?,?,?,?)',wardens[h],`WRD00${h+1}`,h+1,h%2?'Evening':'Day');
      for(let f=1;f<=4;f++) {
        const fid=Number(run('INSERT INTO floors(hostel_id,floor_number) VALUES(?,?)',h+1,f).lastInsertRowid);
        for(let r=1;r<=15;r++) {
          const roomid=Number(run('INSERT INTO rooms(hostel_id,floor_id,room_number,room_type,cleaning_status,lights_status,door_status) VALUES(?,?,?,?,?,?,?)',h+1,fid,`${String.fromCharCode(65+h)}-${f}${String(r).padStart(2,'0')}`,r<=3?'Premium':'Standard',r%5===0?'Scheduled':'Clean',r%3===0?'On':'Off',r%4===0?'Open':'Locked').lastInsertRowid);
          for(let b=1;b<=4;b++)run('INSERT INTO beds(room_id,bed_number) VALUES(?,?)',roomid,b);
        }
      }
    });
    const staff=[['Ramesh Patel','Maintenance',maint],['Lakshmi Devi','Laundry',laundry],['Suresh Naik','Security',sec],['Anil Verma','Electrician',null],['Ravi Kumar','Plumber',null],['Sunita Devi','Cleaning',null],['Geetha Rao','Cleaning',null],['Mohan Das','Security',null],['Padma Reddy','Laundry',null],['Rajesh Singh','Maintenance',null],['Fatima Begum','Cleaning',null],['Sanjay Joshi','Security',null]];
    staff.forEach((s,i)=>run('INSERT INTO staff(user_id,staff_code,name,role,phone,hostel_id,shift) VALUES(?,?,?,?,?,?,?)',s[2],`STF${String(i+1).padStart(3,'0')}`,s[0],s[1],`+91 98${String(76543210+i)}`,i%4+1,i%2?'Evening':'Day'));
    const male=['Arjun Reddy','Rahul Kumar','Kiran Kumar','Aditya Verma','Rohit Sharma','Vishal Patel','Sai Krishna','Nikhil Rao','Varun Menon','Siddharth Joshi','Akash Singh','Pranav Iyer','Harsh Gupta','Dev Mehta','Rishi Nair','Anirudh Das'];
    const female=['Priya Sharma','Sneha Reddy','Ananya Rao','Divya Iyer','Pooja Verma','Kavya Nair','Aisha Khan','Ishita Patel','Megha Menon','Neha Gupta','Shruti Desai','Riya Singh','Nandini Joshi','Swathi Krishna','Tanvi Mehta','Sanjana Das'];
    const deps=['CSE','CSE-AI','CSE-DS','ECE','EEE','Mechanical','Civil'];
    for(let i=0;i<842;i++) {
      const h=i<211?1:i<421?2:i<632?3:4; const local=i-[0,0,211,421,632][h];
      const name=i===0?'Arjun Reddy':(h<3?male:female)[local%16];
      const uid=i===0?3:createUser(3,`st${1001+i}@smartstay.edu`,name,sh,`+91 9${String(876500000+i)}`);
      const bid=(h-1)*240+local+1;const room=one('SELECT room_id FROM beds WHERE id=?',bid).room_id;
      const status=i>=806?'On Leave':i>=782?'Outside Hostel':'Inside Hostel';
      run('INSERT INTO students(id,user_id,student_code,registration_number,department,year,guardian_name,guardian_phone,emergency_phone,hostel_id,room_id,bed_id,joining_date,current_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',i+1,uid,`STU${1001+i}`,`${2023+(i%3)}1A${String(i+1).padStart(5,'0')}`,deps[i%7],i%4+1,`${name.split(' ')[1]} (Guardian)`,`+91 9${String(765400000+i)}`,`+91 9${String(765400000+i)}`,h,room,bid,'2026-07-15',status);
      run('INSERT INTO room_allocations(student_id,bed_id,allocated_by,allocated_at) VALUES(?,?,?,?)',i+1,bid,1,'2026-07-15T04:30:00.000Z');
      run("UPDATE beds SET status='Occupied' WHERE id=?",bid);
      for(let d=-13;d<=0;d++)run('INSERT INTO attendance(student_id,attendance_date,status,source,recorded_by) VALUES(?,?,?,?,?)',i+1,dayOffset(d),d===0?(status==='On Leave'?'On Leave':status==='Outside Hostel'?'Outside Hostel':i%31===0?'Absent':'Present'):((i+d)%23===0?'Absent':'Present'),'Manual',wid);
    }
    for(let i=0;i<36;i++)run('INSERT INTO leave_requests(request_code,student_id,leave_type,from_date,to_date,departure_time,expected_return,destination,reason,emergency_contact,status,approved_by,reviewed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',`LV${1024+i}`,807+i,i%5===0?'Medical Leave':'Normal Leave',dayOffset(-1),dayOffset(2),'09:00','20:00',i%2?'Hyderabad':'Vijayawada',i%5===0?'Medical appointment and recovery':'Family visit during the semester break','+91 98765 43210','Active',wardens[3],now());
    for(let i=0;i<9;i++)run('INSERT INTO leave_requests(request_code,student_id,leave_type,from_date,to_date,departure_time,expected_return,destination,reason,emergency_contact) VALUES(?,?,?,?,?,?,?,?,?,?)',`LV${1060+i}`,i+1,i===0?'Emergency Leave':'Normal Leave',dayOffset(1),dayOffset(3),'09:00','20:00','Hyderabad',i===0?'Urgent family matter':'Family occasion and travel','+91 98765 43210');
    for(let i=0;i<24;i++)run('INSERT INTO gate_logs(student_id,exit_time,expected_return,reason,status,recorded_by) VALUES(?,?,?,?,?,?)',783+i,stamp(today(),`${String(8+i%10).padStart(2,'0')}:30`),stamp(today(),'21:30'),'Library / campus activity',i%8===0?'Late':'Outside Hostel',sec);
    for(let i=0;i<18;i++)run('INSERT INTO gate_logs(student_id,exit_time,entry_time,expected_return,reason,status,recorded_by) VALUES(?,?,?,?,?,?,?)',i+1,stamp(dayOffset(-1),'16:00'),stamp(dayOffset(-1),i%6===0?'22:25':'20:42'),stamp(dayOffset(-1),'21:00'),'Personal errands',i%6===0?'Late':'Inside Hostel',sec);
    const categories=['Electrical','Plumbing','Internet','Fan','Furniture','Water'];
    const descriptions=['Study desk light needs replacement','Washroom tap leaking continuously','Wi-Fi disconnects during evening study hours','Ceiling fan making unusual noise','Wardrobe hinge needs repair','Low water pressure on second floor'];
    for(let i=0;i<16;i++) {
      const s=one('SELECT * FROM students WHERE id=?',i*51+1);const status=['Reported','Assigned','In Progress','Resolved','Verified'][i%5];
      run('INSERT INTO maintenance_requests(ticket_code,student_id,room_id,category,description,priority,status,assigned_staff_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)',`MT${2041+i}`,s.id,s.room_id,categories[i%6],descriptions[i%6],i%4===0?'High':'Medium',status,status==='Reported'?null:1,stamp(dayOffset(-i%4),'10:15'));
      if(status!=='Reported')run('INSERT INTO maintenance_assignments(request_id,staff_id,assigned_by) VALUES(?,?,?)',i+1,1,wid);
    }
    for(let i=0;i<12;i++)run('INSERT INTO complaints(complaint_code,student_id,category,description,priority,confidential,status,assigned_to,created_at) VALUES(?,?,?,?,?,?,?,?,?)',`CMP${3021+i}`,i*61+1,['Food','Cleanliness','Hostel facilities','Security','Staff behavior'][i%5],['Please add more vegetarian options to the evening menu.','The third-floor study lounge needs regular cleaning.','Please extend library access during exam week.','A corridor access light is not working.','Request a private discussion about staff communication.'][i%5],i%4===0?'High':'Normal',i%5===4?1:0,['Submitted','Under Review','Assigned','Resolved'][i%4],wid,stamp(dayOffset(-i%6),'11:30'));
    for(let i=0;i<14;i++)run('INSERT INTO laundry_requests(request_code,student_id,clothes_count,service_type,pickup_date,status) VALUES(?,?,?,?,?,?)',`LDR${4011+i}`,i*42+1,6+i%7,i%2?'Wash & Iron':'Wash & Fold',today(),['Requested','Collected','Washing','Ready','Delivered'][i%5]);
    for(let i=0;i<20;i++)run('INSERT INTO cleaning_tasks(room_id,staff_id,scheduled_date,status) VALUES(?,?,?,?)',i*9+1,6,today(),['Scheduled','In Progress','Completed'][i%3]);
    for(let h=1;h<=4;h++)run('INSERT INTO room_inspections(hostel_id,user_id,inspection_date,rooms_checked,issues_found,action_taken) VALUES(?,?,?,?,?,?)',h,wardens[h-1],dayOffset(-2),15,'Two corridor lights need replacement','Maintenance tickets assigned; follow-up scheduled');
    for(let i=0;i<24;i++)run('INSERT INTO iot_devices(device_code,room_id,device_type,label,demo_value) VALUES(?,?,?,?,?)',`IOT${100+i}`,i<18?i*7+1:null,['Light','Door lock','Temperature','Water tank','Smoke detector','Electricity'][i%6],i<18?`Residence sensor ${i+1}`:`Campus sensor ${i+1}`,['Off','Locked','26.4 °C','78%','Normal','12.8 kWh'][i%6]);
    for(let i=0;i<30;i++)run('INSERT INTO feedback(student_id,service,rating,comment) VALUES(?,?,?,?)',i+1,['Cleanliness','Warden support','Maintenance response','Security','Laundry service'][i%5],3+i%3,'Thank you for keeping our residence comfortable.');
    const settings={gate_open:'05:30',gate_close:'22:00',visitor_start:'09:00',visitor_end:'18:00',laundry_start:'08:00',laundry_end:'18:00',breakfast:'07:30 – 09:00',lunch:'12:30 – 14:00',dinner:'19:00 – 21:00',college_name:'Vidyavan Institute of Technology',academic_year:'2026–27',support_phone:'+91 98765 40000',emergency_phone:'+91 98765 40100'};
    Object.entries(settings).forEach(([k,v])=>run('INSERT INTO hostel_settings VALUES(?,?,?)',k,v,now()));
    [1,wid,3,sec,maint,laundry].forEach(uid=>{
      run('INSERT INTO notifications(user_id,title,message,priority) VALUES(?,?,?,?)',uid,'Welcome to SmartStay','Your campus residence, connected. Explore your dashboard to get started.','Normal');
      run('INSERT INTO notifications(user_id,title,message,priority) VALUES(?,?,?,?)',uid,'Residence community meeting','Join your warden in the study lounge this Friday at 6 PM.','Normal');
    });
    run('INSERT INTO notifications(user_id,title,message,priority) VALUES(?,?,?,?)',wid,'Urgent leave request','Arjun Reddy has submitted an emergency leave request.','High');
    ['Attendance updated for today','Semester room allocations completed','Weekly hostel inspections recorded','Maintenance team assigned morning tasks'].forEach((action,i)=>run('INSERT INTO audit_logs(user_id,action,entity,created_at) VALUES(?,?,?,?)',1,action,'Campus',stamp(today(),`${String(8+i).padStart(2,'0')}:15`)));
  });
}
seed();
