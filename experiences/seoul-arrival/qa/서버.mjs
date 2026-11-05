// 서울행 확인용 WORLD 개발 서버(리허설 계정). 워크트리에서도 형제 저장소 SYNK-talk를 찾는다. 새 학생 길은 주소에 ?seoulAuto=1을 붙인다.
//   node experiences/seoul-arrival/qa/서버.mjs [포트]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
process.env.SYNK_TALK_ROOT||=path.join(os.homedir(),'Documents','SYNK-talk');
process.env.SYNK_WORLD_PORT=process.argv[2]||process.env.SYNK_WORLD_PORT||'4388';
process.env.SYNK_WORLD_DATA_DIR||=path.join(ROOT,'.tmp','seoul-world-db');
fs.mkdirSync(path.dirname(process.env.SYNK_WORLD_DATA_DIR),{recursive:true});
await import(new URL('../../synk-world-app/server.mjs',import.meta.url).href);
