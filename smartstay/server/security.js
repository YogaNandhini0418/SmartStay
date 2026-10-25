import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { isValidAccountEmail } from '../public/js/email.js';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
export const digest = value => createHash('sha256').update(value).digest('hex');
export function verifyAdminCode(provided) {
  const configured=process.env.ADMIN_SECURITY_CODE;
  if(!configured||configured.length<10)throw new HttpError(503,'Admin access needs backend ADMIN_SECURITY_CODE configuration. Contact the system administrator.');
  return typeof provided==='string'&&timingSafeEqual(Buffer.from(digest(provided),'hex'),Buffer.from(digest(configured),'hex'));
}
export const token = () => randomBytes(32).toString('hex');
export const hashToken = digest;
export const newToken = token;
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function requireRole(user, roles) {
  if (!roles.includes(user.role)) throw new HttpError(403, 'Your role does not have permission for this action.');
}
export function required(data, fields) {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || String(data[field]).trim() === '') throw new HttpError(400, `${field.replaceAll('_', ' ')} is required.`);
    if(!['string','number','boolean'].includes(typeof data[field]))throw new HttpError(400,`Invalid ${field.replaceAll('_',' ')}.`);
  }
}
export function choice(value, choices, label='Status') {
  if (!choices.includes(value)) throw new HttpError(400, `${label} must be one of: ${choices.join(', ')}.`);
}
export function integer(value, min=1, max=100000) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new HttpError(400, `Enter a whole number between ${min} and ${max}.`);
  return n;
}
export function validEmail(email) {
  if (typeof email !== 'string' || !email.trim()) throw new HttpError(400, 'Please enter your email address.');
  if (!isValidAccountEmail(email)) throw new HttpError(400, 'Please enter a valid email address.');
}
export function validPhone(phone) {
  if (!/^\+?[\d\s()-]{10,16}$/.test(phone)) throw new HttpError(400, 'Enter a valid contact number.');
}
export function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new HttpError(400, 'Enter a valid date.');
}
export const permissions = {
  admin: ['dashboard','approvals','departments','students','hostels','rooms','allocations','wardens','staff','attendance','gate','leaves','maintenance','complaints','laundry','notifications','safety','iot','cleaning','inspections','feedback','reports','settings'],
  warden: ['dashboard','students','hostels','rooms','allocations','staff','attendance','gate','leaves','maintenance','complaints','laundry','notifications','safety','iot','cleaning','inspections','feedback','reports','settings'],
  student: ['dashboard','rooms','attendance','gate','leaves','maintenance','complaints','laundry','notifications','safety','cleaning','feedback','settings'],
  security: ['dashboard','gate','leaves','notifications','safety','settings'],
  maintenance: ['dashboard','rooms','maintenance','cleaning','notifications','settings'],
  laundry: ['dashboard','laundry','notifications','settings']
};
