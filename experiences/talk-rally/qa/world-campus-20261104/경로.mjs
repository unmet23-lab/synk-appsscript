// 말 랠리 캠퍼스 판 qa 도구들이 같이 쓰는 자리. 그림 원본 · 목소리 묶음 · 시안 영상처럼 git에 넣지 않는 것은 공용 작업본 .tmp에 둔다.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const 여기 = path.dirname(fileURLToPath(import.meta.url));
export const 게임 = path.resolve(여기, '..', '..');
export const 뿌리 = path.resolve(게임, '..', '..');
const { 공용작업본 } = createRequire(import.meta.url)('../../../../tools/lib/공용작업본.js');
export const 공용 = 공용작업본(뿌리);
export const 밖 = path.join(공용, '.tmp', 'talk-rally-world-20261104');
