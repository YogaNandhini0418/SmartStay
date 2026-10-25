const icons = {
  campus:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7M3 10h18"/>',
  dashboard:'<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
  students:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  building:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M9 21v-3h6v3"/>',
  rooms:'<path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h6M9 11h6M9 15h2"/><path d="M15 19h.01"/>',
  allocation:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h4v3H7zM13 8h4M13 12h4M7 15h10"/>',
  warden:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  staff:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
  attendance:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h2M14 14h2M8 17h2"/>',
  gate:'<path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M8 21V7h8v14M12 13h.01"/><path d="M2 21h20"/>',
  leave:'<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z"/><path d="m9 16 2 2 4-4"/>',
  maintenance:'<path d="m14.7 6.3 3 3M4 20l4.5-1 9.9-9.9a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z"/><path d="m13 5 4 4"/>',
  complaints:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/><path d="M12 8v4M12 16h.01"/>',
  laundry:'<path d="M3 6h18l-1 14H4L3 6Z"/><path d="M3 6 5 3h14l2 3M8 10h8M9 14a3 3 0 0 0 6 0"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  safety:'<path d="m12 22 1.5-1.1C19 17 21 13.5 21 9V5l-9-3-9 3v4c0 4.5 2 8 7.5 11.9L12 22Z"/><path d="M12 8v4M12 16h.01"/>',
  iot:'<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/><circle cx="12" cy="12" r="2"/>',
  chart:'<path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  close:'<path d="m18 6-12 12M6 6l12 12"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  key:'<circle cx="8" cy="15" r="5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3M18.5 4.5l3 3"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  water:'<path d="M12 3s7 7.3 7 12a7 7 0 0 1-14 0c0-4.7 7-12 7-12Z"/><path d="M9 16a3 3 0 0 0 3 3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.7L7.7 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 1.7-.6l3 .5a2 2 0 0 1 1.7 2Z"/>',
  logout:'<path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
  wrench:'<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4l-3 3-3-3 3-3Z"/>',
  laundryBag:'<path d="M5 8h14l1 13H4L5 8Z"/><path d="M8 8a4 4 0 0 1 8 0M8 12h8M9 16h6"/>',
  feedback:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  clean:'<path d="m4 20 3-8 6 2-3 7H4ZM14 3l1.5 4.5L20 9l-4.5 1.5L14 15l-1.5-4.5L8 9l4.5-1.5L14 3ZM5 3v3M3.5 4.5h3"/>',
  clipboard:'<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8 10h8M8 14h8M8 18h4"/>',
  shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  emergency:'<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v4M12 17h.01"/>',
};

export function icon(name, cls='') { return `<span class="icon ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[name] || icons.dashboard}</svg></span>`; }
export function toast(message, kind='success') {
  const region=document.getElementById('toast-region');if(!region)return;
  const node=document.createElement('div');node.className=`toast ${kind==='error'?'error':kind==='warning'?'warning':''}`;
  node.innerHTML=`${icon(kind==='error'?'emergency':kind==='warning'?'clock':'check')}<span>${escapeHtml(message)}</span>`;
  region.append(node);setTimeout(()=>node.remove(),4200);
}
export function escapeHtml(value='') { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export const initials=(name='')=>String(name).trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()||'SS';
export function dateLabel(value, {time=false}={}) { if(!value)return '—';const d=new Date(value);if(Number.isNaN(+d))return value;return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',...(time?{hour:'numeric',minute:'2-digit'}:{})}).format(d); }
export function badge(value='—') { const key=String(value).toLowerCase();let cls='';if(/present|inside|completed|resolved|delivered|returned|clean|verified/.test(key))cls='success';else if(/pending|submitted|reported|washing|scheduled|outside|active|in progress|review|requested/.test(key))cls='warning';else if(/late|emergency|high|rejected|absent|fire|urgent/.test(key))cls='danger';else if(/approved|assigned|collected|ready|locked/.test(key))cls='info';else if(/leave|medical/.test(key))cls='violet';return `<span class="status-badge ${cls}">${escapeHtml(value)}</span>`; }
export function modal({title,subtitle='',body='',actions='',wide=false}) {
  document.querySelector('.modal-backdrop')?.remove();const node=document.createElement('div');node.className='modal-backdrop';node.innerHTML=`<section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><div><h2 id="modal-title">${escapeHtml(title)}</h2>${subtitle?`<p>${escapeHtml(subtitle)}</p>`:''}</div><button type="button" class="modal-close" data-action="close-modal" aria-label="Close">${icon('close')}</button></header><div class="modal-body">${body}</div>${actions?`<footer class="modal-foot">${actions}</footer>`:''}</section>`;document.body.append(node);node.addEventListener('click',e=>{if(e.target===node)node.remove();});node.querySelector('.modal-close')?.focus();return node;
}
export function confirmDialog({title,message,confirm='Confirm',danger=false,onConfirm}) {
  const view=modal({title,body:`<div class="confirm-copy"><div class="confirm-icon">${icon(danger?'emergency':'shield')}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div>`,actions:`<button class="btn btn-outline" data-action="close-modal">Cancel</button><button class="btn ${danger?'btn-danger':'btn-primary'}" data-action="confirm-modal">${escapeHtml(confirm)}</button>`});
  view.querySelector('[data-action="confirm-modal"]').addEventListener('click',()=>{view.remove();onConfirm?.();});return view;
}
