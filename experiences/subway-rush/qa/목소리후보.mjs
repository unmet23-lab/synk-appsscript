#!/usr/bin/env node
/**
 * 환승 러시 목소리 후보(2026-11-04): 역마다 같은 두 줄을 일레븐 v4(힉스필드 founder CLI)로 구워 지금 판(Typecast)과 나란히 들려 드린다(설계 13절).
 * 가장 가까운 만족 사례는 장부 S39(일레븐 v4 선배 목소리)다. 접수마다 최소 0.23크레딧 · 후보 스무 판 약 5크레딧. 이미 받은 판은 다시 굽지 않는다.
 * 크기는 게임 줄과 같은 −17 LUFS로 맞춘다(견주기 공정하게). 파일은 git 밖 공용 작업본 `.tmp/subway-rush-20261104/목소리후보/`.
 *
 *   node experiences/subway-rush/qa/목소리후보.mjs [역…]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..');
const { 공용작업본 } = createRequire(import.meta.url)(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const OUT = path.join(공용작업본(뿌리), '.tmp', 'subway-rush-20261104', '목소리후보');
fs.mkdirSync(OUT, { recursive: true });

const V = { Luna: '375a3398-e3b4-4f91-845d-42181e352899', Hana: 'c25f78a0-714e-42af-8da3-a399cef94968', Sienna: '41023a48-71ab-478a-bea7-c7b5a78f6b36', Kevin: 'f1373f24-3b96-433f-9a68-e595810ef608', Cillian: 'd8ba9f14-8a24-44db-932b-99e16c45bd32', Andre: 'f1e8226e-2248-4d5f-b43c-0a79e9949dbf', Mark: '27c04473-84a9-4b60-a41f-c8e8458bd4f1', Harrison: '573e5163-59b3-4926-aab1-951ef2985f81', Chloe: 'e9cfbbf0-4476-46be-b396-596eb774b165', Maya: 'b0f766b7-8703-4bd1-b973-f857c36837b6', Gia: '530df032-c311-483b-a750-cb3c9e1bcdfd', Skye: '1fb253b8-928b-4d29-a349-f242a71eaddf', Mabel: 'fa64fba4-ad02-405e-99d0-1f085d87c706', Vesper: 'c3204739-4084-41a3-9dc5-c805b307ec18', Gideon: '1ad38ba4-9cc4-4f2f-9fde-b0fefdf67ae5', Sterling: 'dc382508-c8bd-443c-8cb2-46e57b8d2e6f', Orion: 'ed69c516-92d2-4b30-a967-617737a342e5', Xavier: '43173c95-3ec8-446a-a162-6504332c578b' };
// 드라마 교수(Elena) · 선배(Julian) · 앱 하온(Hana · Zoe 후보)과 겹치는 목소리는 사람 역에서 피한다 — 역마다 하나.
export const CAST = {
  announcer: { 이름: '안내방송', 줄: '[calm] 이번 역은 시청, 시청역입니다. 내리실 문은 오른쪽입니다. 일호선으로 갈아타실 분은 이번 역에서 내리시기 바랍니다.', 후보: ['Luna', 'Sienna'], 지금: ['stop-cityhall-right'] },
  guide: { 이름: '휴대폰 길 안내', 줄: '[friendly] 시청역에서 일호선으로 갈아타세요. 일호선, 청량리 방면이에요. 종로오가에서 내리세요.', 후보: ['Kevin', 'Andre'], 지금: ['guide-start-cityhall-1', 'guide-fork-1-jongno5'] },
  worker: { 이름: '깜빡 잠든 직장인', 줄: '[sleepy] 어… 다음이 어디예요? [relieved] 아이고, 감사합니다!', 후보: ['Mark', 'Harrison'], 지금: ['p-worker-ask', 'p-worker-thanks'] },
  traveler: { 이름: '길 묻는 여행객', 줄: '[curious] 저기요, 이 열차 명동에 가요? [cheerful] 고마워요!', 후보: ['Chloe', 'Maya'], 지금: ['p-traveler-ask-myeongdong', 'p-traveler-thanks'] },
  fan: { 이름: '콘서트 가는 또래', 줄: '[excited] 혹시 오늘 콘서트 가요? [playful] 아쉽다! 다음엔 같이 가요!', 후보: ['Gia', 'Skye'], 지금: ['p-fan-ask', 'p-fan-school'] },
  grandma: { 이름: '귤 주시는 할머니', 줄: '[tired] 아이고, 다리가 아프네. [warmly] 고마워, 학생. 밥은 먹고 다니지?', 후보: ['Mabel', 'Vesper'], 지금: ['p-grandma-ask', 'p-grandma-sit'] },
  hiker: { 이름: '문 앞의 등산객', 줄: '[friendly] 학생, 내려요? [laughs] 어이쿠, 미안해요!', 후보: ['Gideon', 'Sterling'], 지금: ['p-hiker-ask', 'p-hiker-yes'] },
  freshman: { 이름: '뛰는 신입생', 줄: '[excited] 혹시 오티 가요? 저도요! [cheerful] 좋아요! 뛰어요!', 후보: ['Orion', 'Xavier'], 지금: ['p-freshman-ask', 'p-freshman-together'] },
};

const 집 = path.join(os.homedir(), '.ai-accounts', 'higgsfield-founder');
const hf = (인자) => {
  const r = spawnSync(path.join(process.env.APPDATA, 'npm', 'higgsfield'), [...인자, '--json'], { encoding: 'utf8', shell: process.platform === 'win32' && false, env: { ...process.env, HOME: 집, USERPROFILE: 집 }, timeout: 15 * 60 * 1000 });
  try { return JSON.parse((r.stdout || '').trim()); } catch { throw Error(`힉스필드 답을 못 읽었다: ${(r.stdout || r.stderr || '').slice(0, 300)}`); }
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const 번호찾기 = (o) => { if (!o || typeof o !== 'object') return null; for (const k of ['id', 'job_id']) if (typeof o[k] === 'string' && UUID.test(o[k])) return o[k]; for (const v of Object.values(o)) { const x = 번호찾기(v); if (x) return x; } return null; };
const 주소찾기 = (o) => { if (!o || typeof o !== 'object') return null; if (typeof o.result_url === 'string') return o.result_url; for (const v of Object.values(o)) { const x = 주소찾기(v); if (x) return x; } return null; };
const 맞추기 = (들어옴, 나감) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', 들어옴, '-af', 'loudnorm=I=-17:TP=-1.5:LRA=11', '-ar', '44100', '-b:a', '128k', 나감]); if (r.status !== 0) throw Error(`ffmpeg 실패: ${r.stderr}`); };

const 고른역 = process.argv.slice(2);
for (const [역, c] of Object.entries(CAST)) {
  if (고른역.length && !고른역.includes(역)) continue;
  // 지금 판: 게임 줄을 0.45초 쉼으로 잇는다
  const 지금 = path.join(OUT, `${역}-지금.mp3`);
  if (!fs.existsSync(지금)) {
    const inputs = c.지금.flatMap((n) => ['-i', path.join(여기, '..', 'assets', 'voice', `${n}.mp3`)]);
    const filter = c.지금.map((_, i) => `[${i}:a]aresample=44100,apad=pad_dur=0.45[a${i}]`).join(';') + ';' + c.지금.map((_, i) => `[a${i}]`).join('') + `concat=n=${c.지금.length}:v=0:a=1[out]`;
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-b:a', '128k', 지금]);
    if (r.status !== 0) throw Error(`지금 판 못 이음(${역}): ${r.stderr}`);
  }
  for (const 이름 of c.후보) {
    const 끝 = path.join(OUT, `${역}-${이름}.mp3`);
    if (fs.existsSync(끝)) { console.log('있음', 역, 이름); continue; }
    const 대화 = JSON.stringify([{ text: c.줄, voice_id: V[이름], voice_type: 'preset' }]);
    const 이전 = Date.now();
    let 작업 = 번호찾기(hf(['generate', 'create', 'elevenlabs_v4', '--dialogue', 대화, '--stability', '0.5']));
    if (!작업) { const 목록 = hf(['generate', 'list', '--size', '3']); const a = Array.isArray(목록) ? 목록 : 목록.jobs || 목록.items || 목록.data || []; 작업 = a.find((x) => x.job_type === 'elevenlabs_v4' && Date.parse(x.created_at) >= 이전 - 5000)?.id; }
    if (!작업) throw Error('접수 번호를 못 찾았다');
    const 주소 = 주소찾기(hf(['generate', 'wait', 작업]));
    if (!주소) throw Error(`결과 주소가 없다: ${작업}`);
    const 받음 = path.join(OUT, `_받음_${역}-${이름}.mp3`);
    fs.writeFileSync(받음, Buffer.from(await (await fetch(주소)).arrayBuffer()));
    맞추기(받음, 끝); fs.rmSync(받음);
    console.log('구움', 역, 이름, 작업);
  }
}
console.log('끝');
