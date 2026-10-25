import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
let count=0;function check(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())check(path);else if(path.endsWith('.js')){const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(result.status){process.stderr.write(result.stderr);process.exit(1);}count++;}}}check('server');check('public/js');console.log(`${count} JavaScript files passed syntax checks.`);
