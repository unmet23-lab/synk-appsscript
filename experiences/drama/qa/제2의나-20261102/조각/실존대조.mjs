#!/usr/bin/env node
/**
 * 「제2의 나」 얼굴 조각 실존 인물 대조 (2026-11-03) — 설계 5절 「얼굴 조각은 지어낸 사람이다」의 절차.
 *
 * 공개 전에 조각마다 세 겹으로 본다.
 *   ① 역검색: 얼굴만 잘라 구글 렌즈(ego 브라우저)에 올리고, 「전체」 탭의 시각 일치 카드(배우 프로필 · 기사 · SNS) 썸네일을 받아
 *      조각 얼굴과 SFace로 견준다. 판정은 공인 출처 카드로만 — 하나가 0.55 이상이거나 같은 공인이 0.40 이상으로 둘 넘게 모이면 걸림,
 *      하나가 0.40 이상이면 살핌(`실존대조_얼굴.py` 머리말에 까닭).
 *   ② 판별 모델 둘: 같은 얼굴을 Gemini 4 Argon(웹 구독, `tools/아르곤웹.js`)과 GPT(구독, `tools/codex계정.js exec -i`)에 따로 묻는다 —
 *      이름 · 실존 인물 비교 없이 「유명인 본뜨기로 오해받을 만큼 특정한 인상인가」(흔함 · 중간 · 높음과 그렇게 본 생김새). 공인 대조를 직접 시키면 거절한다.
 *   ③ 조각마다 한 줄: 하나라도 걸림(렌즈 0.47 이상 · 모델 하나라도 높음 · 두 모델 모두 중간)이면 「다시 굽기」 —
 *      얼굴 특징 둘 이상(얼굴형 · 눈 · 눈썹 · 코 · 입 · 머리)을 바꿔 다시 굽고 처음부터 다시 돌린다. 살핌은 나란히 놓고 눈으로 정해 적는다.
 * 현금은 0이다(구글 렌즈 무료 · Gemini 웹 구독 · ChatGPT 구독). 실존 인물의 이름 · 사진은 git 밖(.tmp)에만 두고, 저장소 기록에는 숫자 · 판정만 쓴다.
 *
 *   node experiences/drama/qa/제2의나-20261102/조각/실존대조.mjs 렌즈 <id=그림>…
 *   node experiences/drama/qa/제2의나-20261102/조각/실존대조.mjs 모델 <묶음 이름> <id=그림>…   (한 묶음 10장까지 — 아르곤 첨부 한도)
 *   node experiences/drama/qa/제2의나-20261102/조각/실존대조.mjs 다시재기 <id=그림>…   (렌즈 결과는 두고 닮음 · 판정만 다시)
 *   node experiences/drama/qa/제2의나-20261102/조각/실존대조.mjs 나란히 <id=그림>…   (살핌: 조각 + 렌즈 공인 카드 위 다섯 → <id>/나란히.jpg, 본 판정은 piece-check/눈.json에)
 *   node experiences/drama/qa/제2의나-20261102/조각/실존대조.mjs 표 <id>… [--md]
 *
 * 나오는 곳(공용 작업본, git 밖): `.tmp/me2-20261102/piece-check/<id>/`(얼굴.jpg · 렌즈/ · 렌즈.json), `piece-check/_모델/<묶음>/`(순서.json · 답_gemini.md · 답_gpt.md)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 밖 = process.env.ME2_CHECK_OUT || path.join(공용작업본(뿌리), '.tmp', 'me2-20261102', 'piece-check');
const EGO = path.join(os.homedir(), '.local', 'share', 'ego', 'active_version_dir', 'ego-browser.exe');
const 슬래시 = (p) => String(p).replace(/\\/g, '/');
const 파이썬 = (...a) => {
  const r = spawnSync('python', ['-I', '-X', 'utf8', path.join(여기, '실존대조_얼굴.py'), ...a], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`실존대조_얼굴.py ${a[0]} 실패: ${r.stderr.split('\n').filter((l) => !/WARN/.test(l)).join(' ').slice(0, 300)}`);
  return JSON.parse(r.stdout.trim().split('\n').pop());
};

// 「공인과 대조해 이름을 대라」는 GPT가 넷 모두 「실존 공인과 얼굴 대조는 도와드릴 수 없음」으로 거절했다(11-03 T-C). 누구인지는 역검색이 맡고,
// 판별 모델에는 이름 · 비교 없이 「유명인 본뜨기로 오해받을 만큼 특정한 인상인가」만 묻는다 — 같은 날 GPT가 이 꼴로 답했고 uz-m을 「미간까지 짙은
// 눈썹 · 도드라진 곧은 콧대」(중간)로 짚었다(역검색 · Fable 「특정 해외 배우 인상」과 같은 자리).
export const 질문 = (n) => `붙인 얼굴 사진 ${n}장은 모두 AI로 새로 지어낸 가상 인물이다(한국어 학습 게임의 플레이어 얼굴 후보, 붙인 순서대로 1번부터). 누구인지 알아보거나 이름을 대지 말고, 실존 인물과 비교하지도 말라. 디자인 검토로서 각 얼굴을 다음 하나로만 분류해 달라.
- 흔함: 그 지역 젊은이에게 흔한 생김새의 조합이라, 특정 유명인을 본뜬 얼굴로 오해받을 걱정이 적다
- 중간: 생김새 몇 가지가 아주 뚜렷하게 한데 모여 있어(예: 특이한 눈썹 · 코 모양의 조합), 보는 사람에 따라 특정 유명인을 떠올릴 수도 있다
- 높음: 화보 · 배우 프로필처럼 매우 특정한 인상이라 유명인 본뜨기로 오해받을 위험이 크다
답은 아래 꼴의 줄만, 사진 수만큼 마지막 메시지로(머리말 · 맺음말 · 표 머리 없이):
번호 | 흔함/중간/높음 | 그렇게 본 생김새 두셋`;

function 자른얼굴(id, 그림) {
  const 폴더 = path.join(밖, id);
  fs.mkdirSync(폴더, { recursive: true });
  const 얼굴 = path.join(폴더, '얼굴.jpg');
  파이썬('자르기', 그림, 얼굴);
  fs.writeFileSync(path.join(폴더, '원본.txt'), `${그림}\n`);
  return 얼굴;
}

const 쌍들 = (xs) => xs.map((x) => { const i = x.indexOf('='); if (i < 1) throw new Error(`id=그림 꼴이 아님: ${x}`); return [x.slice(0, i), path.resolve(x.slice(i + 1))]; });

function 렌즈(xs) {
  const 쌍 = 쌍들(xs);
  const items = 쌍.map(([id, 그림]) => ({ id, img: 슬래시(자른얼굴(id, 그림)), out: 슬래시(path.join(밖, id, '렌즈')) }));
  const 스크립트 = `globalThis.LENS = ${JSON.stringify({ space: 'me2-piece-lens-20261103', items })};\nawait import(${JSON.stringify(`file:///${슬래시(path.join(여기, '렌즈.mjs'))}`)});\n`;
  const r = spawnSync(EGO, ['nodejs'], { input: 스크립트, encoding: 'utf8', timeout: 30 * 60_000 });
  const 글 = `${r.stdout || ''}${r.stderr || ''}`;
  console.log(글.split('\n').filter((l) => l.startsWith('{')).join('\n'));
  if (/로봇 확인/.test(글)) throw new Error('구글 로봇 확인(sorry) — 누르지 않고 멈춤. 유호님께 맡긴다');
  for (const [id, 그림] of 쌍) {
    if (!fs.existsSync(path.join(밖, id, '렌즈', '결과.json'))) { console.log(JSON.stringify({ id, 렌즈: '결과 없음' })); continue; }
    console.log(JSON.stringify({ id, ...파이썬('렌즈닮음', 그림, path.join(밖, id, '렌즈')) }));
  }
}

function 나란히(xs) {
  for (const [id, 그림] of 쌍들(xs)) console.log(JSON.stringify({ id, ...파이썬('나란히', 그림, path.join(밖, id, '렌즈'), path.join(밖, id, '나란히.jpg')) }));
}

function 다시재기(xs) {
  for (const [id, 그림] of 쌍들(xs)) console.log(JSON.stringify({ id, ...파이썬('렌즈닮음', 그림, path.join(밖, id, '렌즈')) }));
}

function 모델(묶음, xs) {
  const 쌍 = 쌍들(xs);
  if (쌍.length > 10) throw new Error('한 묶음 10장까지(아르곤 첨부 한도)');
  const 폴더 = path.join(밖, '_모델', 묶음);
  fs.mkdirSync(폴더, { recursive: true });
  // 첨부 이름에 조각 id가 드러나지 않게 번호만 — 「몽골」 같은 이름이 판정을 이끌지 않게
  const 얼굴들 = 쌍.map(([id, 그림], i) => { const f = path.join(폴더, `${String(i + 1).padStart(2, '0')}.jpg`); fs.copyFileSync(자른얼굴(id, 그림), f); return f; });
  fs.writeFileSync(path.join(폴더, '순서.json'), JSON.stringify(쌍.map(([id, 그림], i) => ({ 번호: i + 1, id, 그림 })), null, 1));
  const 질문파일 = path.join(폴더, '질문.md');
  fs.writeFileSync(질문파일, `${질문(쌍.length)}\n`);
  const gpt답 = path.join(폴더, '답_gpt.md');
  if (!fs.existsSync(gpt답)) {
    const 인자 = ['tools/codex계정.js', 'exec', '--skip-git-repo-check', '-C', 폴더, '-s', 'read-only', '-o', gpt답, ...얼굴들.flatMap((f) => ['-i', f]), '-'];
    const r = spawnSync(process.execPath, 인자, { cwd: 뿌리, input: fs.readFileSync(질문파일, 'utf8'), encoding: 'utf8', timeout: 20 * 60_000 });
    console.log(`[GPT] 종료 ${r.status} — ${fs.existsSync(gpt답) ? '답 있음' : (r.stderr || '').slice(-300)}`);
  }
  const gem답 = path.join(폴더, '답_gemini.md');
  if (!fs.existsSync(gem답)) {
    const r = spawnSync(process.execPath, ['tools/아르곤웹.js', '보내기', '--파일', ...얼굴들, '--지시문', 질문파일, '--답', gem답, '--이름', `me2-pc-${묶음}`], { cwd: 뿌리, encoding: 'utf8', timeout: 60 * 60_000, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(`[Gemini] 종료 ${r.status} — ${fs.existsSync(gem답) ? '답 있음' : `${r.stdout || ''}${r.stderr || ''}`.slice(-400)}`);
  }
}

// 답 줄 「번호 | 흔함·중간·높음 | 생김새」를 읽는다(흔함은 낮음으로) — 표 꼴(앞뒤 |)이나 굵은 글씨가 섞여도 받는다.
export function 답읽기(파일) {
  if (!fs.existsSync(파일)) return null;
  const 줄 = {};
  for (const l of fs.readFileSync(파일, 'utf8').split('\n')) {
    const 칸 = l.replace(/\*\*/g, '').split('|').map((s) => s.trim()).filter((s, i, a) => !(s === '' && (i === 0 || i === a.length - 1)));
    const 번호 = Number.parseInt(칸[0], 10);
    const 위험 = (칸[1] || '').match(/높음|중간|낮음|흔함/)?.[0]?.replace('흔함', '낮음');
    if (Number.isFinite(번호) && 위험) 줄[번호] = { 위험, 특징: 칸.slice(2).join(' | ') };
  }
  return 줄;
}

function 모델답(id) {
  const 묶음들 = fs.existsSync(path.join(밖, '_모델')) ? fs.readdirSync(path.join(밖, '_모델')).sort() : [];
  let 찾음 = null;
  for (const b of 묶음들) {
    const 순서파일 = path.join(밖, '_모델', b, '순서.json');
    if (!fs.existsSync(순서파일)) continue;
    const 칸 = JSON.parse(fs.readFileSync(순서파일, 'utf8')).find((x) => x.id === id);
    if (!칸) continue;
    const g = 답읽기(path.join(밖, '_모델', b, '답_gemini.md'));
    const p = 답읽기(path.join(밖, '_모델', b, '답_gpt.md'));
    찾음 = { 묶음: b, gemini: g ? g[칸.번호] || { 위험: '답 없음' } : null, gpt: p ? p[칸.번호] || { 위험: '답 없음' } : null };
  }
  return 찾음;
}

export function 판정(렌즈판정, gem, gpt) {
  const 위험 = [gem?.위험, gpt?.위험];
  if (렌즈판정 === '걸림' || 위험.includes('높음') || 위험.every((x) => x === '중간')) return '다시 굽기';
  if (!렌즈판정 || 렌즈판정 === '결과 없음' || 위험.some((x) => !x || x === '답 없음')) return '덜 봄';
  if (렌즈판정 === '살핌' || 위험.includes('중간')) return '살핌(눈으로)';
  return '통과';
}

// 살핌을 눈으로 정한 기록 — piece-check/눈.json {id: {판정: '통과' | '다시 굽기', 까닭}} (나란히 한 장을 보고 적는다).
const 눈 = () => (fs.existsSync(path.join(밖, '눈.json')) ? JSON.parse(fs.readFileSync(path.join(밖, '눈.json'), 'utf8')) : {});

function 표(ids, md) {
  const 줄 = [], 눈판 = 눈();
  for (const id of ids) {
    const 렌즈파일 = path.join(밖, id, '렌즈', '렌즈.json');
    const 렌 = fs.existsSync(렌즈파일) ? JSON.parse(fs.readFileSync(렌즈파일, 'utf8')) : null;
    const m = 모델답(id);
    줄.push({ id, 렌즈: 렌 ? { 카드: 렌.카드, 최고: 렌.최고, 공인카드: 렌.공인카드, 공인최고: 렌.공인최고, 공인무리: 렌.공인무리, 판정: 렌.판정 } : null, gemini: m?.gemini?.위험 || null, gpt: m?.gpt?.위험 || null, 판정: 판정(렌?.판정 || null, m?.gemini, m?.gpt) });
    const 끝 = 줄.at(-1);
    if (끝.판정.startsWith('살핌') && 눈판[id]) Object.assign(끝, { 판정: `${눈판[id].판정}(눈)`, 까닭: 눈판[id].까닭 });
  }
  fs.writeFileSync(path.join(밖, '대조.json'), JSON.stringify(줄, null, 1));
  if (!md) { for (const r of 줄) console.log(JSON.stringify(r)); return; }
  console.log('| 조각 | 역검색(카드 · 공인 카드 · 공인 최고 · 같은 공인 무리 · 전체 최고 → 판정) | Gemini | GPT | 판정 |\n|---|---|---|---|---|');
  for (const r of 줄) console.log(`| ${r.id} | ${r.렌즈 ? `${r.렌즈.카드} · ${r.렌즈.공인카드} · ${r.렌즈.공인최고 ?? '-'} · ${r.렌즈.공인무리} · ${r.렌즈.최고 ?? '-'} → ${r.렌즈.판정}` : '안 돌림'} | ${r.gemini || '-'} | ${r.gpt || '-'} | ${r.판정}${r.까닭 ? ` — ${r.까닭}` : ''} |`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [할일, ...나머지] = process.argv.slice(2);
  if (할일 === '렌즈') 렌즈(나머지);
  else if (할일 === '다시재기') 다시재기(나머지);
  else if (할일 === '나란히') 나란히(나머지);
  else if (할일 === '모델') 모델(나머지[0], 나머지.slice(1));
  else if (할일 === '표') 표(나머지.filter((x) => x !== '--md'), 나머지.includes('--md'));
  else { console.error('사용: 실존대조.mjs 렌즈 <id=그림>… | 모델 <묶음> <id=그림>… | 표 <id>… [--md]'); process.exit(2); }
}
