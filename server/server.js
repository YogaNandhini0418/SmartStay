import { createServer } from 'node:http';
import { readFileSync,existsSync,statSync } from 'node:fs';
import { resolve,join,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db,one,all,run,now } from './db.js';
import { read,write } from './controllers.js';
import { HttpError,hashPassword,verifyPassword,digest,token,permissions,required,validEmail,requireRole } from './security.js';
import { settings,notifyRoles,audit,students,rooms,student } from './repositories.js';
const publicDir=resolve(fileURLToPath(new URL('../public',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const attempts=new Map();
const send=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));};
function session(req) {
  const raw=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('smartstay_session='))?.slice(18);
  if(!raw)throw new HttpError(401,'Sign in to continue.');
  const user=one(`SELECT u.id,u.email,u.full_name,u.phone,r.name role,s.id student_id,w.hostel_id,ss.expires_at FROM sessions ss JOIN users u ON u.id=ss.user_id JOIN roles r ON r.id=u.role_id LEFT JOIN students s ON s.user_id=u.id LEFT JOIN wardens w ON w.user_id=u.id WHERE ss.token_hash=? AND u.active=1`,digest(raw));
  if(!user||user.expires_at<Date.now())throw new HttpError(401,'Your session expired. Please sign in again.');
  delete user.expires_at;return user;
}
async function body(req) {
  let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>3*1024*1024)throw new HttpError(413,'Request is too large. Attach files below 2 MB.');chunks.push(c);}
  try{const parsed=JSON.parse(Buffer.concat(chunks).toString()||'{}');if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();validateStrings(parsed);return parsed;}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Invalid JSON request.');}
}
function validateStrings(obj){for(const [key,v]of Object.entries(obj)){if(typeof v==='string'&&key!=='data'&&v.length>2500)throw new HttpError(400,'Text fields must be below 2,500 characters.');if(v&&typeof v==='object')validateStrings(v);}}
function checkModule(user,module){const aliases={keys:'gate',visitors:'gate',inspections:'hostels',cleaning:'rooms',feedback:'reports'};if(module==='feedback'&&user.role==='student')return;if(!permissions[user.role]?.includes(aliases[module]||module))throw new HttpError(403,'Your role does not have access to this module.');}
export const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    const url=new URL(req.url,'http://localhost'),path=url.pathname;
    if(path.startsWith('/api/')) {
      const mutation=['POST','PATCH','PUT','DELETE'].includes(req.method);
      if(mutation){if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw new HttpError(403,'Cross-origin writes are not permitted.');if(req.headers['x-smartstay-request']!=='1')throw new HttpError(403,'Missing request verification header.');if(!String(req.headers['content-type']).startsWith('application/json'))throw new HttpError(415,'Use application/json.');}
      const d=mutation?await body(req):{};
      if(path==='/api/public'&&req.method==='GET')return send(res,200,{college:settings().college_name,hostels:one('SELECT COUNT(*) n FROM hostels').n,beds:one('SELECT COUNT(*) n FROM beds').n,students:one('SELECT COUNT(*) n FROM students WHERE active=1').n,support:settings().support_phone,emergency:settings().emergency_phone});
      if(path==='/api/auth/login'&&req.method==='POST') {
        required(d,['email','password']);validEmail(d.email);const key=`${req.socket.remoteAddress}:${d.email.toLowerCase()}`;const attempt=attempts.get(key)||{count:0,until:Date.now()+900000};if(attempt.until<Date.now()){attempt.count=0;attempt.until=Date.now()+900000;}if(attempt.count>=15)throw new HttpError(429,'Too many login attempts. Please try again in 15 minutes.');
        const u=one('SELECT u.*,r.name role FROM users u JOIN roles r ON r.id=u.role_id WHERE lower(u.email)=? AND u.active=1',d.email.toLowerCase());
        if(!u||!verifyPassword(d.password,u.password_hash)){attempt.count++;attempts.set(key,attempt);throw new HttpError(401,'Email or password is incorrect.');}
        attempts.delete(key);run('DELETE FROM sessions WHERE expires_at<?',Date.now());const t=token(),ttl=d.remember?30*86400000:8*3600000;run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',digest(t),u.id,Date.now()+ttl);audit(u,'Signed in','users',u.id);
        return send(res,200,{role:u.role,redirect:'/app/dashboard'},{'Set-Cookie':`smartstay_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ttl/1000}${process.env.COOKIE_SECURE==='true'?'; Secure':''}`});
      }
      if(path==='/api/auth/forgot'&&req.method==='POST'){required(d,['email']);validEmail(d.email);run('INSERT INTO password_reset_requests(email) VALUES(?)',d.email.toLowerCase());notifyRoles(['admin'],'Account recovery requested',`Verify the identity of ${d.email.toLowerCase()} at the residence office before issuing a new password.`,'High');return send(res,200,{message:'Your recovery request is recorded. Contact the residence office to verify your identity and receive a new password.'});}
      const user=session(req);
      if(path==='/api/me')return send(res,200,{user,permissions:permissions[user.role]});
      if(path==='/api/auth/logout'&&req.method==='POST'){const raw=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('smartstay_session='))?.slice(18);run('DELETE FROM sessions WHERE token_hash=?',digest(raw||''));return send(res,200,{success:true},{'Set-Cookie':'smartstay_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});}
      if(path==='/api/auth/password'&&req.method==='POST'){required(d,['current_password','new_password']);const u=one('SELECT password_hash FROM users WHERE id=?',user.id);if(!verifyPassword(d.current_password,u.password_hash))throw new HttpError(400,'Current password is incorrect.');if(d.new_password.length<8)throw new HttpError(400,'Use at least 8 characters.');run('UPDATE users SET password_hash=?,updated_at=? WHERE id=?',hashPassword(d.new_password),now(),user.id);run('DELETE FROM sessions WHERE user_id=?',user.id);audit(user,'Password changed','users',user.id);return send(res,200,{message:'Password updated. Sign in with your new password.'},{'Set-Cookie':'smartstay_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});}
      if(path==='/api/auth/recover'&&req.method==='POST'){requireRole(user,['admin']);required(d,['request_id','new_password']);if(d.new_password.length<8)throw new HttpError(400,'Use at least 8 characters.');const r=one("SELECT * FROM password_reset_requests WHERE id=? AND status='Pending'",Number(d.request_id));if(!r)throw new HttpError(404,'Recovery request not found.');const u=one('SELECT id FROM users WHERE lower(email)=?',r.email);if(!u)throw new HttpError(404,'No account matches this request.');run('UPDATE users SET password_hash=? WHERE id=?',hashPassword(d.new_password),u.id);run('DELETE FROM sessions WHERE user_id=?',u.id);run("UPDATE password_reset_requests SET status='Resolved' WHERE id=?",r.id);audit(user,'Account recovery completed','users',u.id);return send(res,200,{success:true});}
      if(path==='/api/search'){const term=url.searchParams.get('q')?.toLowerCase()||'';if(term.length<2)return send(res,200,[]);const results=[];if(permissions[user.role].includes('students'))students(user).filter(s=>[s.full_name,s.student_code,s.registration_number].join(' ').toLowerCase().includes(term)).slice(0,6).forEach(s=>results.push({title:s.full_name,subtitle:`${s.student_code} · ${s.room_number||'Unallocated'}`,module:user.role==='security'?'gate':'students',id:s.id}));if(permissions[user.role].includes('rooms'))rooms(user).filter(r=>r.room_number.toLowerCase().includes(term)).slice(0,4).forEach(r=>results.push({title:`Room ${r.room_number}`,subtitle:r.hostel,module:'rooms',id:r.id}));for(const m of ['maintenance','complaints'])if(permissions[user.role].includes(m))read(user,m).filter(r=>[r.ticket_code,r.complaint_code,r.description].join(' ').toLowerCase().includes(term)).slice(0,4).forEach(r=>results.push({title:r.ticket_code||r.complaint_code,subtitle:r.category,module:m,id:r.id}));return send(res,200,results);}
      const match=path.match(/^\/api\/([a-z]+)(?:\/(\d+))?$/);if(!match)throw new HttpError(404,'API route not found.');const [,module,id]=match;
      if(module==='attachments') {const a=one('SELECT * FROM attachments WHERE id=?',Number(id));if(!a)throw new HttpError(404,'Attachment not found.');checkModule(user,a.entity);const table={leaves:'leave_requests',maintenance:'maintenance_requests',complaints:'complaints'}[a.entity];if(!table)throw new HttpError(404,'Attachment unavailable.');const record=one(`SELECT student_id FROM ${table} WHERE id=?`,a.entity_id);student(user,record.student_id);res.writeHead(200,{'Content-Type':a.mime_type,'Content-Disposition':`attachment; filename="${a.filename}"`,'Cache-Control':'private,no-store'});return res.end(Buffer.from(a.content));}
      checkModule(user,module);
      if(req.method==='GET')return send(res,200,read(user,module,id,url.searchParams));
      if(['POST','PATCH','PUT'].includes(req.method))return send(res,req.method==='POST'?201:200,write(user,module,id,d));
      throw new HttpError(405,'Method not permitted.');
    }
    if(!['GET','HEAD'].includes(req.method))throw new HttpError(405,'Method not permitted.');
    let file;
    if(path.startsWith('/app')){try{const u=session(req);checkModule(u,path.split('/')[2]||'dashboard');}catch(e){if(e.status===401){res.writeHead(302,{Location:'/login'});return res.end();}if(e.status===403){res.writeHead(403,{'Content-Type':'text/html'});return res.end('<!doctype html><title>Access restricted · SmartStay</title><p>Your role cannot access this page.</p><a href="/app/dashboard">Return to your dashboard</a>');}throw e;}file=join(publicDir,'app.html');}
    else file=path==='/'?join(publicDir,'index.html'):path==='/login'?join(publicDir,'login.html'):resolve(publicDir,decodeURIComponent(path).replace(/^\/+/,''));
    if(!file.startsWith(publicDir+sep)||!existsSync(file)||!statSync(file).isFile())throw new HttpError(404,'Page not found.');res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:readFileSync(file));
  }catch(e){const status=e.status||((String(e.code).includes('SQLITE')&&String(e.message).includes('UNIQUE'))?409:500);if(status===500)console.error(e);if(!res.headersSent)send(res,status,{error:status===500?'An unexpected error occurred. Please try again.':status===409&&!e.status?'That ID or email already exists.':e.message});else res.end();}
});
if(process.env.SMARTSTAY_NO_LISTEN!=='1')server.listen(Number(process.env.PORT||5000),'0.0.0.0',()=>console.log(`SmartStay running at http://localhost:${process.env.PORT||5000}`));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>{db.close();process.exit(0);}));
