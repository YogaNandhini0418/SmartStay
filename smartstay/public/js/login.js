import {api,icon,formModal,field,toast,showFormError,refreshValidation} from './components.js';

const roles=[
  {id:'student',label:'Student',hint:'Resident access',icon:'graduation'},
  {id:'warden',label:'Warden',hint:'Hostel management',icon:'building'},
  {id:'security',label:'Security',hint:'Gate access',icon:'shield'},
  {id:'maintenance',label:'Maintenance',hint:'Service tasks',icon:'wrench'},
  {id:'laundry',label:'Laundry',hint:'Laundry services',icon:'laundry'},
  {id:'admin',label:'Admin',hint:'Full control',icon:'settings'}
];
const form=document.querySelector('#login-form');
const roleGrid=document.querySelector('#login-roles');
const code=document.querySelector('#admin-security-code');
const submitButton=form.querySelector('[type="submit"]');
let selectedRole='student',busy=false;

function updateSubmit(){
  document.querySelector('#login-submit-label').textContent=busy?'Signing in…':'Sign in as '+(selectedRole==='admin'?'Administrator':roles.find(r=>r.id===selectedRole).label);
  submitButton.disabled=busy;
  submitButton.setAttribute('aria-busy',String(busy));
  form.setAttribute('aria-busy',String(busy));
  roleGrid.querySelectorAll('[data-role]').forEach(button=>button.disabled=busy);
}

function selectRole(role){
  if(busy||!roles.some(r=>r.id===role))return;
  if(selectedRole!==role)code.value='';
  selectedRole=role;
  form.dataset.role=role;
  const admin=role==='admin',label=roles.find(r=>r.id===role).label;
  document.querySelector('#admin-code-label').hidden=!admin;
  code.disabled=!admin;code.required=admin;
  document.querySelector('#email-caption').textContent='Email Address';
  document.querySelector('#login-email-help').hidden=false;
  const email=document.querySelector('#email');
  email.placeholder=admin?'admin@example.com':'yourname@example.com';
  document.querySelector('#login-email-help').textContent='Use the email address linked to your SmartStay account.';
  email.setAttribute('aria-describedby',[...new Set(['login-email-help',...(email.getAttribute('aria-describedby')||'').split(' ').filter(Boolean)])].join(' '));
  document.querySelector('#login-heading').textContent=admin?'Administrator Sign In':'Sign in as '+label;
  document.querySelector('#login-details').setAttribute('aria-labelledby','role-'+role);
  roleGrid.querySelectorAll('[data-role]').forEach(button=>{
    const selected=button.dataset.role===role;
    button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  });
  document.querySelector('#login-error').textContent='';
  updateSubmit();refreshValidation(form);
}

roleGrid.innerHTML=roles.map(role=>`<button type="button" id="role-${role.id}" class="campus-role-card" role="tab" data-role="${role.id}" aria-selected="false" aria-controls="login-details" aria-label="${role.label}: ${role.hint}" tabindex="-1"><span class="role-check">${icon('check',11)}</span><span class="campus-role-icon">${icon(role.icon,20)}</span><b>${role.label}</b><small>${role.hint}</small></button>`).join('');
roleGrid.onclick=e=>{const button=e.target.closest('[data-role]');if(button)selectRole(button.dataset.role);};
roleGrid.onkeydown=e=>{
  const current=e.target.closest('[data-role]');
  if(!current||busy)return;
  const keys=['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'];
  if(!keys.includes(e.key))return;
  e.preventDefault();
  const columns=getComputedStyle(roleGrid).gridTemplateColumns.split(' ').length;
  const index=roles.findIndex(role=>role.id===current.dataset.role);
  const delta={ArrowRight:1,ArrowLeft:-1,ArrowDown:columns,ArrowUp:-columns};
  const next=e.key==='Home'?0:e.key==='End'?roles.length-1:(index+delta[e.key]+roles.length)%roles.length;
  selectRole(roles[next].id);document.querySelector('#role-'+roles[next].id).focus();
};
document.querySelector('#show-password').innerHTML=icon('eye',19);
document.querySelector('#show-password').onclick=e=>{
  const password=document.querySelector('#password'),visible=password.type==='password';
  password.type=visible?'text':'password';
  e.currentTarget.setAttribute('aria-label',visible?'Hide password':'Show password');
  e.currentTarget.setAttribute('aria-pressed',String(visible));
};
const requestedRole=new URLSearchParams(location.search).get('role');
selectRole(roles.some(r=>r.id===requestedRole)?requestedRole:'student');
form.onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const portal=selectedRole;
  busy=true;updateSubmit();document.querySelector('#login-error').textContent='';
  try{
    // Preserve the existing endpoints, credential payload, approval checks and cookies.
    const result=await api(portal==='admin'?'auth/admin-login':'auth/login','POST',{
      email:document.querySelector('#email').value,password:document.querySelector('#password').value,role:portal,
      remember:form.elements.remember.checked,
      ...(portal==='admin'?{admin_security_code:code.value}:{})
    });
    // The server supplies the authenticated role. A portal choice grants no permissions.
    // End a mismatched session rather than opening a different role's dashboard.
    if(result.role!==portal){
      await api('auth/logout','POST',{});
      const actual=roles.find(role=>role.id===result.role)?.label||'correct';
      throw new Error(`This account uses the ${actual} portal. Choose ${actual} to sign in.`);
    }
    location.href=result.redirect;
  }catch(error){
    showFormError(form,error);busy=false;updateSubmit();
  }
};
document.querySelector('#forgot').onclick=()=>{
  const role=selectedRole,admin=role==='admin';
  const dialog=formModal('Recover your account',[field('email','Email Address','email',[],{placeholder:admin?'admin@example.com':'yourname@example.com',hint:'Use the email address linked to your SmartStay account.'})],{email:document.querySelector('#email').value},async d=>{
    const result=await api('auth/forgot','POST',d);toast(result.message);
  },{subtitle:'The residence office will verify your identity before resetting access.',submit:'Request account recovery',wide:false});
  dialog.querySelector('form').dataset.role=role;refreshValidation(dialog.querySelector('form'));
};
