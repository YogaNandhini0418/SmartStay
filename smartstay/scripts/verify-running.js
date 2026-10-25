import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const base=`http://127.0.0.1:${process.env.PORT||5001}`;
const publicData=await(await fetch(`${base}/api/public`)).json();assert.equal(publicData.hostels,4);
const current=new DatabaseSync('data/smartstay.sqlite');
const backupName=readdirSync('data/backups').filter(n=>n.startsWith('before-approval-v2-')).sort().at(-1);assert.ok(backupName);
const backup=new DatabaseSync(join('data/backups',backupName));
const tables=['students','rooms','beds','hostels','floors','room_allocations','attendance','gate_logs','leave_requests','key_handovers','maintenance_requests','maintenance_assignments','complaints','complaint_updates','laundry_requests','emergency_alerts','room_inspections','cleaning_tasks','iot_devices','iot_readings','feedback','staff','wardens','visitors','attachments'];
for(const table of tables)assert.equal(current.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,backup.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,`${table} records changed during migration`);
assert.deepEqual(current.prepare('PRAGMA foreign_key_check').all(),[]);
assert.equal(current.prepare('SELECT version FROM schema_migrations WHERE version=2').get().version,2);
function checkPublic(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())checkPublic(p);else assert.ok(!readFileSync(p).includes(Buffer.from(process.env.ADMIN_SECURITY_CODE)),`Backend code leaked into ${p}`);}}
assert.ok(process.env.ADMIN_SECURITY_CODE?.length>=10);checkPublic('public');
const headers={'Content-Type':'application/json','X-SmartStay-Request':'1'};
const login=await fetch(`${base}/api/auth/admin-login`,{method:'POST',headers,body:JSON.stringify({email:process.env.VERIFY_ADMIN_EMAIL||'admin@smartstay.edu',password:process.env.VERIFY_ADMIN_PASSWORD||'Admin@123',admin_security_code:process.env.ADMIN_SECURITY_CODE})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
const me=await(await fetch(`${base}/api/me`,{headers:{cookie}})).json();assert.equal(me.user.role,'admin');assert.equal(me.hostels.length,4);assert.ok(me.permissions.includes('approvals'));
for(const h of me.hostels){const d=await(await fetch(`${base}/api/dashboard?hostel_id=${h.id}`,{headers:{cookie}})).json();assert.equal(d.hostels.length,1);assert.equal(d.hostels[0].id,h.id);}
await fetch(`${base}/api/auth/logout`,{method:'POST',headers:{...headers,cookie},body:'{}'});
console.log(JSON.stringify({running:base,students:publicData.students,beds:publicData.beds,hostels:me.hostels.map(h=>h.name),preservedTables:tables.length,foreignKeys:'valid',backendAdminCode:'configured and absent from public files',backup:`data/backups/${backupName}`},null,2));
current.close();backup.close();
