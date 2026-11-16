// Entry point: `node main.mjs api|keys|files`. One image, three compose services,
// each with its own user, secrets and network (STAGE1_DESIGN.md 「개통 서버 구현 설계」).
import fs from 'node:fs';
import path from 'node:path';
import { apiFromEnv } from './boot.mjs';
import { withSettings } from './config.mjs';
import { startKeysWorker } from './keys-worker.mjs';
import { startFilesWorker } from './files-worker.mjs';

const role = process.argv[2];
const env = role ? withSettings(process.env) : process.env;
if (role === 'api') {
  const { api, jobs } = apiFromEnv(env);
  api.server().listen(Number(env.WB_PORT || 4191), '0.0.0.0');
  jobs.start();
} else if (role === 'keys') startKeysWorker({ env });
else if (role === 'files') startFilesWorker({ env });
else if (role === 'check') { fs.accessSync(path.dirname(env.WB_DB || '/data/wb.sqlite'), fs.constants.W_OK); console.log('ok'); }
else if (role !== undefined) { console.error('usage: node main.mjs api|keys|files'); process.exit(2); }
