export const testEmail=local=>String(local).toLowerCase()+'@gmail.com';
export const seedStudentEmail=(number=1)=>testEmail(`smartstay.resident${number}`);
export const testAccountEmail=role=>role==='student'?seedStudentEmail():testEmail(role);

// Test fixtures only. This helper refuses to touch a persistent database.
export async function prepareTestAccounts(){
  if(process.env.SMARTSTAY_DB!==':memory:')throw Error('Gmail account fixtures require an isolated in-memory database.');
  const {all,run,transaction}=await import('../server/db.js');
  transaction(()=>{
    for(const user of all('SELECT u.id,u.email,r.name role,s.id student_id FROM users u JOIN roles r ON r.id=u.role_id LEFT JOIN students s ON s.user_id=u.id')){
      const email=user.student_id?seedStudentEmail(user.student_id):user.email===`${user.role}@smartstay.edu`?testAccountEmail(user.role):testEmail(`fixture.${user.role}.${user.id}`);
      run('UPDATE users SET email=? WHERE id=?',email,user.id);
    }
  });
}
