import {prepareTestAccounts} from './auth-fixtures.js';
await prepareTestAccounts();
await import('../server/server.js');
