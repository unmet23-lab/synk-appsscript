// 운영 Auth에 보안 알림 메일 틀을 싣는다(2026-11-23, 유호님 「Alerts + re-auth」).
// node 적용.mjs <SYNK-talk 경로>            보낼 키와 지금 값의 차이만 보인다(읽기)
// node 적용.mjs <SYNK-talk 경로> --운영 --백업 <저장소 밖 JSON>   바꿀 키의 지금 값을 먼저 그 파일에 쓰고, 운영에 PATCH한 뒤 다시 읽어 맞는지 본다
// 되돌리기: node 적용.mjs <SYNK-talk 경로> --되돌리기 <바꾸기 전 JSON> --운영 --백업 <새 JSON>   그 JSON에 적힌 키만 되돌린다
// 토큰은 화면에 내지 않는다.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 설정 } from './틀.mjs';

const [talk, ...인자] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const 자격증명 = require(`${talk}/lib/자격증명.js`);
const 쓰기 = 인자.includes('--운영');
const 되돌림 = 인자.includes('--되돌리기') ? JSON.parse(readFileSync(인자[인자.indexOf('--되돌리기') + 1], 'utf8')) : null;
// 되돌릴 때는 백업에 적힌 키만 보낸다(처음 적용 때 이미 같아 백업에 없는 키는 건드리지 않는다).
const 보낼 = 되돌림 ? Object.fromEntries(Object.keys(되돌림).filter((k) => k in 설정).map((k) => [k, 되돌림[k]])) : 설정;
const env = 자격증명.읽기('auth메일틀', 쓰기 ? { args: 인자 } : { 읽기: true, args: 인자 });
const 주소 = `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/config/auth`;
const 머리 = { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };

const 읽기 = async () => { const r = await fetch(주소, { headers: 머리 }); if (!r.ok) throw new Error(`읽기 ${r.status}`); return r.json(); };
const 다른키 = (지금) => Object.keys(보낼).filter((k) => 지금[k] !== 보낼[k]);

const 지금 = await 읽기();
const 차이 = 다른키(지금);
console.log('과녁 끝', String(env.SUPABASE_PROJECT_REF).slice(-4), '· 바뀔 키', 차이.length, '/', Object.keys(보낼).length);
for (const k of 차이) console.log(' ', k, typeof 보낼[k] === 'string' ? `(${보낼[k].length}자)` : `${지금[k]} → ${보낼[k]}`);
if (!쓰기) process.exit(0);
if (!차이.length) { console.log('이미 같다'); process.exit(0); }
// 되돌릴 수 있게 바꿀 키의 지금 값을 먼저 남긴다. 저장소(공개) 안이나 이미 있는 파일에는 쓰지 않는다.
const 백업 = 인자.includes('--백업') ? resolve(인자[인자.indexOf('--백업') + 1] || '') : null;
const 저장소 = fileURLToPath(new URL('../../../..', import.meta.url));
const 안 = 백업 && !relative(저장소, 백업).startsWith('..') && !/^\.tmp[\\/]/.test(relative(저장소, 백업));
if (!백업 || 안 || existsSync(백업)) { console.error('--백업 <저장소 밖이나 .tmp 아래의 새 JSON 경로>가 필요하다'); process.exit(2); }
writeFileSync(백업, JSON.stringify(Object.fromEntries(차이.map((k) => [k, 지금[k]])), null, 2));
console.log('바꾸기 전 값', 차이.length, '개를 남김');
const r = await fetch(주소, { method: 'PATCH', headers: 머리, body: JSON.stringify(Object.fromEntries(차이.map((k) => [k, 보낼[k]]))) });
const 답 = await r.text();
console.log('PATCH', r.status, r.ok ? '' : 답.slice(0, 400));
if (!r.ok) process.exit(1);
const 뒤 = await 읽기();
const 남은 = 다른키(뒤);
console.log('다시 읽기 · 안 맞는 키', 남은.length, 남은.join(' '));
process.exit(남은.length ? 1 : 0);
