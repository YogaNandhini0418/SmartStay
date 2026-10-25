import {icon} from './icons.js';
import {isValidAccountEmail} from './email.js';

// Keep the existing HTML constraints and server validation. Only their presentation
// is shared here, so every dynamically opened hostel form has the same experience.
const states=new WeakMap();
const fieldStatuses=new WeakMap();
let sequence=0;
const controls=form=>[...form.querySelectorAll('input,select,textarea')].filter(el=>el.form===form&&!el.disabled&&!el.readOnly&&!['hidden','submit','button','reset'].includes(el.type));
const nameOf=el=>el.name||el.id;
const labelOf=el=>{
  const label=el.labels?.[0];
  if(!label)return el.getAttribute('aria-label')||'this field';
  const copy=label.cloneNode(true);
  copy.querySelectorAll('input,select,textarea,small,.required,.field-error,.field-status,.password-wrap,button').forEach(node=>node.remove());
  return copy.textContent.replace(/\s+/g,' ').trim()||'this field';
};
function missingMessage(el){
  const name=nameOf(el),form=el.form;
  const messages={
    full_name:'What should we call you? Add your full name.',
    phone:'Add a phone number the hostel can use to reach you.',email:'Please enter your email address.',
    roll_number:'Add your college roll number to identify your student record.',registration_number:'Add your college roll number to identify your student record.',
    department:"Choose the department you're studying in.",year:'Select your current year of study.',gender:'Select your gender to show the appropriate hostel options.',
    employee_id:form.id==='registration-form'&&form.elements.role?.value==='admin'?'Please enter your administrator ID.':'Add your employee ID to identify your staff record.',shift:'Choose your working shift.',specialization:'Choose your maintenance specialization.',
    requested_hostel_id:form.elements.role?.value==='student'?'Choose the hostel type you prefer.':'Choose your requested hostel assignment.',
    hostel_id:'Please select the hostel you are assigned to.',student_id:'Please select a student.',room_id:'Please select a room.',bed_id:'Please select an available bed.',
    password:form.id==='login-form'?'Enter your password to access your residence.':'Create a secure password for your account.',
    current_password:'Please enter your current password.',new_password:'Create a secure new password.',confirm_password:'Enter your password once more to confirm it.',
    admin_security_code:form.id==='registration-form'?'Please enter the administrator security code.':'Please enter your admin security code.',guardian_name:'Please enter your parent or guardian’s name.',
    guardian_phone:'Please enter your guardian’s phone number.',emergency_phone:'Please enter an emergency contact number.',
    emergency_contact:'Please enter an emergency contact number.',support_phone:'Please enter the residence support number.',
    from_date:'Please select your departure date.',to_date:'Please select your return date.',from:'Please select a start date.',to:'Please select an end date.',
    departure_time:'Please select your departure time.',expected_return:'Please select your expected return time.',
    destination:'Please enter your destination.',reason:'Please tell us the reason.',
    description:location.pathname.includes('maintenance')?'Please describe the maintenance issue.':'Please describe your concern.',
    clothes_count:'Please enter the number of clothes.',pickup_date:'Please select your pickup date.',
    'scan-id':'Please enter a student ID, roll number, or email.',
    identity_verified:'Please confirm that you have verified the account holder’s identity.',
    confirmed:'Please confirm before continuing.'
  };
  if(messages[name])return messages[name];
  if(el.type==='checkbox')return 'Please confirm before continuing.';
  if(el.type==='file')return 'Please choose a file to upload.';
  return `Please ${el.tagName==='SELECT'||['date','time','datetime-local'].includes(el.type)?'select':'enter'} ${labelOf(el).toLowerCase().replace(/\s*\(optional\)/,'')}.`;
}
function messageFor(el,state){
  const stored=state.server.get(el);
  if(stored&&stored.value===el.value)return stored.message;
  state.server.delete(el);
  const value=el.value,name=nameOf(el),validity=el.validity;
  if(el.required&&(el.type==='checkbox'?!el.checked:el.type==='file'?!el.files.length:!value.trim()))return missingMessage(el);
  if(validity.badInput)return 'Please enter a valid number.';
  if(!value)return '';
  if(el.type==='email'&&!isValidAccountEmail(value))return 'Please enter a valid email address.';
  if(el.type==='tel'&&!/^\+?[\d\s()-]{10,16}$/.test(value.trim()))return 'Please enter a valid phone number, including the country code if needed.';
  if(el.form.id==='registration-form'&&['roll_number','employee_id'].includes(name)&&!/^[A-Z0-9-]{3,40}$/i.test(value.trim()))return `Please use 3–40 letters, numbers, or hyphens for your ${name==='roll_number'?'roll number':el.form.elements.role?.value==='admin'?'administrator ID':'employee ID'}.`;
  if(name==='confirm_password'){
    const password=el.form.elements.new_password||el.form.elements.password;
    if(password&&value!==password.value)return "These passwords don't match yet.";
  }
  const min=el.getAttribute('minlength'),max=el.getAttribute('maxlength');
  if(min&&(name.includes('password')?value:value.trim()).length<Number(min))return name.includes('password')?`Please use at least ${min} characters for your password.`:`Please enter at least ${min} characters.`;
  if(max&&value.length>Number(max))return `Please keep this to ${max} characters or fewer.`;
  if(validity.rangeUnderflow)return ['date','time','datetime-local'].includes(el.type)?`Please choose ${el.min} or later.`:`Please enter ${el.min} or more.`;
  if(validity.rangeOverflow)return ['date','time','datetime-local'].includes(el.type)?`Please choose ${el.max} or earlier.`:`Please enter ${el.max} or less.`;
  if(validity.stepMismatch)return el.type==='number'&&(!el.step||el.step==='1')?'Please enter a whole number.':'Please choose a value in the allowed increments.';
  if(validity.patternMismatch||validity.typeMismatch)return el.dataset.formatMessage||'Please check the format and try again.';
  if(validity.customError)return 'Please check this value and try again.';
  const start=name==='to_date'?el.form.elements.from_date:name==='to'?el.form.elements.from:name==='gate_close'?el.form.elements.gate_open:null;
  if(start?.value&&(name==='gate_close'?start.value>=value:start.value>value))return name==='gate_close'?'Please choose a closing time after the gate opens.':name==='to_date'?'Please choose a return date on or after your departure.':'Please choose an end date on or after the start date.';
  if(el.type==='file'){
    const file=el.files[0];
    if(!file)return '';
    // The 2 MB limit belongs to the shared evidence upload, not roster imports.
    if(el.form.id==='record-form'&&file.size>2097152)return 'Please choose a file smaller than 2 MB.';
    const accepted=el.accept.split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
    if(accepted.length&&!accepted.some(v=>v.startsWith('.')?file.name.toLowerCase().endsWith(v):v.endsWith('/*')?file.type.startsWith(v.slice(0,-1)):file.type===v))return el.accept.includes('.csv')?'Please choose a CSV student roster.':'Please choose a PNG, JPG, WebP, or PDF file.';
  }
  return '';
}
function fieldCaption(el){
  if(!el.id)el.id=`smartstay-field-${++sequence}`;
  const label=el.labels?.[0];
  if(label&&!el.getAttribute('aria-labelledby')&&!el.getAttribute('aria-label')){
    const caption=document.createElement('span');caption.id=`${el.id}-label`;caption.className='validation-caption';
    const textNodes=[...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
    if(textNodes.length){label.insertBefore(caption,textNodes[0]);textNodes.forEach(n=>caption.append(n));el.setAttribute('aria-labelledby',caption.id);}
  }
  return label;
}
function fieldStatus(el,value='neutral',tone='attention'){
  let status=fieldStatuses.get(el);
  if(!status){
    const label=fieldCaption(el),node=document.createElement('span');
    node.className='field-status';node.setAttribute('aria-hidden','true');
    const floating=el.tagName==='SELECT'||el.tagName==='INPUT'&&!['checkbox','radio','file','date','time','datetime-local','month','week','range','color'].includes(el.type);
    if(floating){
      let host=el.closest('.password-wrap');
      if(!host){host=document.createElement('span');host.className='field-control';el.before(host);host.append(el);}
      host.classList.add('field-status-host');if(el.tagName==='SELECT')host.classList.add('field-select-host');
      if(el.type==='number')host.classList.add('field-number-host');host.append(node);
    }else{
      node.classList.add('field-label-status');const caption=label?.querySelector('.validation-caption');
      if(caption)caption.after(node);else if(label)label.prepend(node);else el.after(node);
    }
    status={node};fieldStatuses.set(el,status);
  }
  el.dataset.fieldState=value;status.node.dataset.state=value;status.node.dataset.tone=tone;
  if(status.value!==value){status.node.innerHTML=value==='neutral'?'':icon(value==='complete'?'check':'attention',15);status.value=value;}
}
function errorNode(el){
  const label=fieldCaption(el),id=`${el.id}-error`;
  let node=document.getElementById(id);if(node)return node;
  node=document.createElement('span');node.className='field-error';node.id=id;node.setAttribute('aria-live','polite');
  if(label){if(el.type==='checkbox')label.append(node);else{const anchor=el.closest('.field-status-host')||el;anchor.after(node);}}else el.form.append(node);
  return node;
}
function showField(el,message){
  const id=el.id?`${el.id}-error`:null,existing=id?document.getElementById(id):null;
  if(!message){
    existing?.remove();
    if(el.dataset.smartstayInvalid){el.removeAttribute('aria-invalid');delete el.dataset.smartstayInvalid;}
    if(id){const refs=(el.getAttribute('aria-describedby')||'').split(/\s+/).filter(v=>v&&v!==id);refs.length?el.setAttribute('aria-describedby',refs.join(' ')):el.removeAttribute('aria-describedby');}
    el.labels?.[0]?.classList.remove('has-field-error');
    if(el.form?.id==='scan-form')el.form.classList.toggle('has-field-error',!!el.form.querySelector('.field-error'));
    return;
  }
  const node=existing||errorNode(el);
  if(node.dataset.message!==message){const text=document.createElement('span');text.textContent=message;node.replaceChildren(text);node.dataset.message=message;}
  node.dataset.tone=states.get(el.form)?.server.has(el)?'conflict':'attention';
  fieldStatus(el,'attention',node.dataset.tone);
  el.setAttribute('aria-invalid','true');el.dataset.smartstayInvalid='true';
  const refs=new Set((el.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));refs.add(node.id);el.setAttribute('aria-describedby',[...refs].join(' '));
  el.labels?.[0]?.classList.add('has-field-error');if(el.form.id==='scan-form')el.form.classList.add('has-field-error');
}
function summary(form,message='',kind='server'){
  let node=form.querySelector('.form-error');
  if(!node){node=document.createElement('p');node.className='form-error';node.setAttribute('role','alert');form.prepend(node);}
  node.classList.add('validation-summary');node.hidden=!message;
  node.dataset.kind=kind;
  if(form.id==='registration-form'){
    const feedback=ensureGuide(form).querySelector('.guide-feedback');feedback.append(node);
    if(kind==='validation')message='';node.hidden=!message;feedback.hidden=!message;
  }
  if(message){if(form.id!=='registration-form')form.prepend(node);node.innerHTML=icon(kind==='validation'?'graduation':'attention',16);const text=document.createElement('span');text.textContent=message;node.append(text);}else node.replaceChildren();
}
function refreshSummary(form,state){
  // Role changes remove their fields; their server hints must leave with them.
  if(state.errorField&&!form.contains(state.errorField)){summary(form);state.globalError=false;state.errorField=null;}
  if(!form.querySelector('[data-smartstay-invalid]')){summary(form);state.globalError=false;state.errorField=null;}
  else if(!state.globalError&&state.submitted)summary(form,'A few details need your attention. Follow the notes below.','validation');
  updateGuide(form,state);
}
const registrationGroups=[['personal','Personal'],['hostel','Hostel'],['account','Account']];
function ensureGuide(form){
  let guide=form.querySelector('.campus-guide');if(guide)return guide;
  guide=document.createElement('section');guide.className='campus-guide';guide.setAttribute('aria-label','SmartStay Campus Guide');
  guide.innerHTML=`<span class="guide-emblem">${icon('graduation',21)}</span><div class="guide-copy"><span class="guide-eyebrow">SMARTSTAY CAMPUS GUIDE</span><h3 class="guide-title">Let's finish your hostel profile</h3><p class="guide-count" aria-live="polite"></p></div><span class="guide-percent" aria-hidden="true"></span><div class="guide-progress" role="progressbar" aria-label="Profile setup" aria-valuemin="0" aria-valuemax="100"><span></span></div><div class="guide-bottom"><span class="guide-completed"></span><button type="button" class="guide-next" hidden>Next detail ${icon('arrow',13)}</button></div><div class="guide-feedback"></div>`;
  form.prepend(guide);
  guide.querySelector('.guide-next').onclick=()=>{const state=states.get(form),next=controls(form).find(el=>el.required&&messageFor(el,state));if(next){next.focus({preventScroll:true});next.scrollIntoView({block:'center',behavior:'instant'});}};
  return guide;
}
function updateGuide(form,state){
  if(form.id!=='registration-form')return;
  const guide=ensureGuide(form),fields=controls(form).filter(el=>el.required&&el.name!=='role');
  const remaining=fields.filter(el=>messageFor(el,state)),done=fields.length-remaining.length,percent=fields.length?Math.round(done/fields.length*100):0;
  const admin=form.elements.role?.value==='admin';
  const count=remaining.length?`${remaining.length} ${remaining.length===1?'detail':'details'} ${state.submitted?'still need your attention':'left to add'}`:admin?'Ready to create your administrator account.':'Ready to send for administrator approval.';
  const setText=(selector,text)=>{const node=guide.querySelector(selector);if(node.textContent!==text)node.textContent=text;};
  setText('.guide-title',remaining.length?admin?"Let's finish your administrator profile":"Let's finish your hostel profile":'Everything looks good!');setText('.guide-count',count);setText('.guide-percent',`${percent}%`);setText('.guide-completed',`${done} of ${fields.length} details ready`);
  const progress=guide.querySelector('.guide-progress');progress.setAttribute('aria-valuenow',String(percent));progress.setAttribute('aria-valuetext',`${done} of ${fields.length} required details ready`);progress.firstElementChild.style.width=`${percent}%`;
  const next=guide.querySelector('.guide-next');next.hidden=!state.submitted||!remaining.length;
  const button=form.querySelector('button[type="submit"]');if(button&&!button.disabled){const label=remaining.length?'Complete registration':admin?'Create administrator account':'Submit registration';if(button.dataset.guideLabel!==label){button.innerHTML=`${label} ${icon('arrow',17)}`;button.dataset.guideLabel=label;}}
  for(const [name]of registrationGroups){const section=form.querySelector(`[data-form-section="${name}"]`),step=form.querySelector(`[data-journey="${name}"]`);if(!section||!step)continue;const items=fields.filter(el=>section.contains(el));step.dataset.complete=String(items.length>0&&items.every(el=>!messageFor(el,state)));}
}
function updateField(el,state){
  const visible=state.submitted||state.touched.has(el)||el.dataset.smartstayInvalid;
  const message=el.disabled?'':messageFor(el,state);
  if(visible)showField(el,message);
  if(el.required||visible)fieldStatus(el,!el.disabled&&visible?(message?'attention':el.value.trim()&&(el.type!=='checkbox'||el.checked)?'complete':'neutral'):'neutral',state.server.has(el)?'conflict':'attention');
}
export function formSection(name,number,title,description,content){return `<fieldset class="form-section" data-form-section="${name}"><legend class="form-section-heading"><span class="form-section-number">${number}</span><span><b>${title}</b><small>${description}</small></span></legend><div class="form-grid">${content}</div></fieldset>`;}
export function validateForm(form,{focus=true}={}){
  const state=setupValidation(form);state.submitted=true;
  let first;
  for(const el of controls(form)){const message=messageFor(el,state);updateField(el,state);if(message&&!first)first=el;}
  updateGuide(form,state);
  if(first){summary(form,'A few details need your attention. Follow the notes below.','validation');if(focus){first.focus({preventScroll:true});first.scrollIntoView({block:'nearest',behavior:'instant'});}return false;}
  summary(form);state.globalError=false;return true;
}
export function refreshValidation(form){
  const state=setupValidation(form);
  for(const el of form.querySelectorAll('[data-smartstay-invalid]'))if(el.disabled){showField(el,'');fieldStatus(el,'neutral');}
  for(const el of controls(form))updateField(el,state);
  refreshSummary(form,state);
}
export function showFormError(form,error){
  const state=setupValidation(form),message=String(error?.message||error||'We could not save this. Please try again.');
  state.errorField=null;
  const matches=[[/administrator security code/i,'admin_security_code'],[/valid email address|enter your email address/i,'email'],[/administrator id/i,'employee_id'],[/email.*(already|registered|use)|already.*email|duplicate.*email/i,'email'],[/roll number.*(already|registered)/i,'roll_number','registration_number'],[/employee id.*(already|registered)/i,'employee_id'],[/passwords.*(match)|password.*characters/i,'confirm_password','new_password','password'],[/occupied bed|bed.*(available|occupied)/i,'bed_id']];
  const match=matches.find(([pattern])=>pattern.test(message));
  if(match){const el=match.slice(1).map(name=>form.elements[name]).find(Boolean);if(el){state.errorField=el;state.server.set(el,{value:el.value,message});showField(el,message);el.focus({preventScroll:true});}}
  state.globalError=true;summary(form,message);updateGuide(form,state);
}
export function setupValidation(form){
  if(states.has(form))return states.get(form);
  const state={submitted:false,touched:new WeakSet(),server:new WeakMap(),globalError:false};states.set(form,state);form.noValidate=true;
  if(form.id==='registration-form'){
    ensureGuide(form);
    form.querySelectorAll('[data-journey]').forEach(button=>button.onclick=()=>{const section=form.querySelector(`[data-form-section="${button.dataset.journey}"]`);section?.querySelector('input,select,textarea')?.focus({preventScroll:true});section?.scrollIntoView({block:'start',behavior:'instant'});});
    form.addEventListener('focusin',e=>{const name=e.target.closest('[data-form-section]')?.dataset.formSection||'personal';form.querySelectorAll('[data-journey]').forEach(button=>{const active=button.dataset.journey===name;button.classList.toggle('current',active);active?button.setAttribute('aria-current','step'):button.removeAttribute('aria-current');});});
  }
  form.addEventListener('submit',e=>{if(!validateForm(form)){e.preventDefault();e.stopImmediatePropagation();}},true);
  const update=e=>{
    const el=e.target;if(!el.matches('input,select,textarea')||el.form!==form)return;
    if(e.type==='focusout'||e.type==='change')state.touched.add(el);
    if(e.type==='input'||e.type==='change')state.server.delete(el);
    updateField(el,state);
    const peer={password:'confirm_password',new_password:'confirm_password',from_date:'to_date',from:'to',gate_open:'gate_close'}[nameOf(el)];
    if(peer&&form.elements[peer])updateField(form.elements[peer],state);
    refreshSummary(form,state);
  };
  for(const type of ['input','change','focusout'])form.addEventListener(type,update);
  form.addEventListener('reset',()=>queueMicrotask(()=>{state.submitted=false;state.touched=new WeakSet();state.server=new WeakMap();state.globalError=false;for(const el of controls(form)){showField(el,'');fieldStatus(el,'neutral');}summary(form);updateGuide(form,state);}));
  // Explicit reportValidity calls cannot open a browser bubble either. Submission
  // still runs the complete validator above, including all original constraints.
  form.addEventListener('invalid',e=>e.preventDefault(),true);
  return state;
}
document.querySelectorAll('form').forEach(setupValidation);
new MutationObserver(records=>{
  const forms=new Set();
  for(const record of records)for(const node of [...record.addedNodes,...record.removedNodes]){
    if(node.nodeType!==Node.ELEMENT_NODE)continue;
    if(node.matches('form')){if(node.isConnected)forms.add(node);}
    node.querySelectorAll('form').forEach(form=>{if(form.isConnected)forms.add(form);});
    if(node.matches('input,select,textarea')||node.querySelector('input,select,textarea')){const form=record.target.closest?.('form');if(form?.isConnected)forms.add(form);}
  }
  forms.forEach(refreshValidation);
}).observe(document.documentElement,{childList:true,subtree:true});
