// ts-fsrs를 찾는다: 환경 변수 TS_FSRS → 이 저장소 node_modules → 옆 저장소 SYNK-talk의 node_modules(08-22부터 그곳의 의존).
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// 찾은 자리(require에 넘길 이름이나 폴더)를 돌려준다. 다른 폴더에서 돌릴 때 TS_FSRS로 넘겨 줄 수 있다.
export function findFsrs() {
  const require = createRequire(import.meta.url);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const tried = [];
  if (process.env.TS_FSRS) tried.push(process.env.TS_FSRS);
  tried.push('ts-fsrs');
  for (let dir = here, i = 0; i < 12; i += 1, dir = path.dirname(dir)) {
    tried.push(path.join(dir, 'SYNK-talk', 'node_modules', 'ts-fsrs'));
    tried.push(path.join(dir, '..', 'SYNK-talk', 'node_modules', 'ts-fsrs'));
  }
  for (const candidate of tried) {
    try { if (candidate === 'ts-fsrs' || existsSync(candidate)) { require(candidate); return candidate; } } catch { /* 다음 후보 */ }
  }
  throw new Error('ts-fsrs를 찾지 못했다. TS_FSRS=<ts-fsrs 폴더> 로 알려 주거나 SYNK-talk에서 npm install을 한다.');
}
export function loadFsrs() { return createRequire(import.meta.url)(findFsrs()); }
