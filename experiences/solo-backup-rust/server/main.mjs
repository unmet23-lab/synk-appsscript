// Entry point: `node main.mjs api|keys|files`. One image, three compose services,
// each with its own user, secrets and network (STAGE1_DESIGN.md 「개통 서버 구현 설계」).
import fs from 'node:fs';
import { apiFromEnv } from './boot.mjs';
import { startKeysWorker } from './keys-worker.mjs';
import { startFilesWorker } from './files-worker.mjs';

const role = process.argv[2];
if (role === 'api') {
  const { api, jobs } = apiFromEnv();
  api.server().listen(Number(process.env.WB_PORT || 4191), '0.0.0.0');
  jobs.start();
} else if (role === 'keys') startKeysWorker();
else if (role === 'files') startFilesWorker();
else if (role === 'check') { fs.accessSync(process.env.WB_DB || '/data', fs.constants.W_OK); console.log('ok'); }
else if (role !== undefined) { console.error('usage: node main.mjs api|keys|files'); process.exit(2); }
