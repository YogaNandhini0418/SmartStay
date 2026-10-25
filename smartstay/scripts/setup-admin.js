import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const path=fileURLToPath(new URL('../.env.local',import.meta.url));
if(existsSync(path)){console.log('Existing .env.local preserved. Configure ADMIN_SECURITY_CODE there.');}
else {writeFileSync(path,`# Backend only. Never place this file in public/ or commit it.\nADMIN_SECURITY_CODE=${randomBytes(24).toString('base64url')}\n`,{mode:0o600});console.log('Created private .env.local with a random admin security code. Read that file locally to sign in as Admin.');}
