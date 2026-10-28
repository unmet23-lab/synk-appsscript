#!/usr/bin/env node
'use strict';
/* 낯선 사람 이해 시험 재료 (2026-10-23, 10-28 넓힘). 영상은 읽기만 하고 재료는 .tmp에 만든다.
 *
 * 10-23 유호님 「synkbrief랑 yuhobuilds가 뭘 말하려는건지 도저히 이해가 안가」 — 두 편 모두 사실 검수는 통과했었다.
 * 같은 날 「synk lab은 훌륭해」라고 하신 관용구 퀴즈 #5와 견주어 본 차이는 알아듣기였다. 영상 장면을 초와 함께 찍고 들리는 말을
 * 초와 함께 적은 뒤, 이 대화 맥락이 없는 새 하위 에이전트에게 줄 질문(그 계정의 시청자 한 사람 역할)을 만든다. 판정은 답을 받은
 * 세션이 한 장 기획의 「한 문장」과 견줘서 한다(docs/마케팅/기획장부/제작절차.md 「시험」).
 *
 * 10-28(유호님 「반영해」): 이해만 보던 질문에 재미 · 3초 · 저장/공유 · 지난 두 편과 같아 보이나를 더했다. 장면은 휴대폰 크기다 —
 * 옛 묶음은 칸을 300px로 줄여 40px 글자가 11px로 보였고(실제 폰에선 14px 남짓), 0~3초도 2초 간격이라 첫 장면을 거의 못 봤다.
 *
 *   node tools/낯선이시험.js <영상.mp4> --말 <말.txt|.srt> --브랜드 <lab-en|lab-mn|lab-cn|lab-mm|synkbrief|yuhobuilds|pulse>
 *       [--밖 <폴더>] [--컷 <초,초,…>] [--지난 자동|없음|<편 폴더 또는 영상>,<…>]
 *
 * 만드는 것: <밖>/정지컷_01.jpg …(한 장에 휴대폰 크기 칸 넷) · <밖>/지난1_<편>.jpg · 지난2_<편>.jpg(같은 계정의 지난 두 편, 작게) ·
 * <밖>/말.txt · <밖>/질문.md(시험관 둘에게 그대로 줄 글).
 * 장면은 0~3초를 0.5초마다, 그 뒤는 2초마다, 그리고 끝 장면 하나. 2초보다 짧은 컷이 많은 영상은 --컷에 컷이 시작하는 초를 주면
 * 컷마다 한 장(그 컷 가운데 장면)으로 찍는다. --지난 자동(기본)은 그 브랜드의 본 계정 판이 있는 편 가운데 이 편 말고 슬롯이 가장
 * 늦은 두 편을 고른다(공용 작업본의 docs/마케팅/*\/게시/준비.json). 말.txt는 줄마다 「12.3s  들리는 말」 꼴이 좋다. .srt를 주면 그 꼴로 바꾼다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 공용작업본 } = require('./lib/공용작업본.js');

const ROOT = path.resolve(__dirname, '..');

const 시청자 = {
  'lab-en': { 곳: '유튜브 쇼츠', 사람: '한국어를 이제 막 배우기 시작한 영어 사용자', 계정: 'lab-youtube' },
  'lab-mn': { 곳: '인스타 릴스', 사람: '한국어를 이제 막 배우기 시작한 몽골 사람(몽골어로 생각한다)', 계정: 'lab-instagram' },
  // 10-25 두 채널 판(기획장부/LAB.md 머리말) — 원본 편이 통과한 뒤 옮긴 판의 최종본을 그 나라 사람이 본다.
  'lab-cn': { 곳: '샤오훙수 영상 노트', 사람: '한국어를 이제 막 배우기 시작한 중국 사람(간체 중국어로 생각한다)', 계정: 'lab-cn-xiaohongshu' },
  'lab-mm': { 곳: '틱톡', 사람: '한국어를 이제 막 배우기 시작한 미얀마 사람(버마어로 생각한다)', 계정: 'lab-mm-tiktok' },
  synkbrief: { 곳: '인스타 릴스', 사람: 'AI 도구를 가끔 쓰는 30대 한국인 직장인', 계정: 'synkbrief-instagram' },
  yuhobuilds: { 곳: '인스타 릴스', 사람: 'AI 도구를 일에 자주 쓰지만 개발자는 아닌 30대 한국인 직장인·1인 사업가', 계정: 'yuhobuilds-instagram' },
  // 10-26 PULSE 포트폴리오 광고(이야기 한 장의 애니매틱 · 완성본) — 광고를 건너뛰지 않고 처음 본 사람.
  pulse: { 곳: '유튜브', 사람: '광고를 건너뛰지 않고 끝까지 볼지 고민하는 20~30대 한국인 직장인', 계정: null },
};

// 휴대폰 크기 칸. 세로 영상은 폰 화면 폭(390pt)에 꽉 차니 1080 폭의 40px 글자가 14px 남짓으로 보인다 — 칸을 그 크기로 둔다.
// 그림을 읽는 쪽은 긴 변 1568px · 약 115만 화소를 넘는 그림을 줄여 읽으므로, 한 장에 세로 칸 넷(2×2, 약 110만 화소)까지만 묶는다.
// 가로 영상(PULSE 16:9 광고)은 찌그러지지 않게 480×270 칸을 2×4로 묶는다(10-26).
const 세로칸 = { w: 390, h: 694, 열: 2, 행: 2 };
const 가로칸 = { w: 480, h: 270, 열: 2, 행: 4 };
const 지난칸 = { w: 180, h: 320, 열: 6 }; // 지난 편은 틀이 같아 보이는지만 보니 작게, 한 편 한 장
const FONT = "C\\:/Windows/Fonts/arial.ttf";

// .srt를 「12.3s  말」 줄로 바꾼다. 번호·시각 줄만 있는 블록은 건너뛴다.
function srtToLines(text) {
  return String(text).replace(/\r\n/g, '\n').trim().split(/\n\s*\n+/).map((block) => {
    const lines = block.split('\n');
    const timeAt = lines.findIndex((line) => line.includes('-->'));
    if (timeAt < 0) return null;
    const m = lines[timeAt].match(/(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!m) return null;
    const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`);
    const words = lines.slice(timeAt + 1).join(' ').trim();
    return words ? `${sec.toFixed(1)}s  ${words}` : null;
  }).filter(Boolean);
}

function readSpeech(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.srt$/i.test(file)) return srtToLines(text).join('\n') + '\n';
  return text.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

// 질문. 1~5는 10-23부터의 이해 질문 그대로, 6~9는 10-28에 더했다 — 이해 시험은 무의미한 슬롭은 막았지만(LAB 10-26~28 버림 12건)
// 재미 · 첫 3초 · 저장/공유 · 같은 틀 찍어 내기를 거르는 단계가 없어 유호님이 먼저 듣고 지적했다.
function buildPrompt({ brand, sheets, sheet, speech, cuts = false, previous = [] }) {
  const who = 시청자[brand];
  if (!who) throw new Error(`브랜드는 ${Object.keys(시청자).join(' · ')} 가운데 하나다: ${brand}`);
  const list = [].concat(sheets || sheet || []);
  const every = cuts
    ? '컷이 바뀔 때마다 한 장(그 컷의 가운데 장면), 각 칸 왼쪽 위 숫자는 그 컷이 화면에 나오는 초(시작-끝)다 — 짧은 컷은 그만큼 잠깐 지나간다.'
    : '0~3초는 0.5초마다, 그 뒤는 2초마다, 마지막 칸은 끝 장면이다. 각 칸 왼쪽 위 숫자가 영상의 초다.';
  const prev = previous.length
    ? ['', `- 비교용(9번에만): 같은 계정이 이 영상 전에 올린 ${previous.length}편의 장면 묶음 — ${previous.map((p) => p.file).join(' · ')}. 1~8번은 이 영상만 보고 답한 뒤, 9번을 답할 때만 연다.`]
    : [];
  return [
    `너는 ${who.곳}를 넘기다가 이 영상을 처음 본 사람이다. ${who.사람}이고, 이 계정도 만든 사람도 이 영상의 배경도 모른다. 아래 파일만 Read 도구로 열어 보고 답해라. 다른 파일·폴더·인터넷은 보지 마라.`,
    '',
    `- 장면 묶음(그림 ${list.length}장, 이 순서로 다 연다): ${list.join(' · ')} — 휴대폰에서 보는 크기 그대로다. ${every} 한 장 안은 왼쪽에서 오른쪽, 위에서 아래 순서.`,
    `- 들리는 말: ${speech} — 줄 앞 숫자는 그 말이 시작하는 초. 배경음악은 따로 깔려 있다.`,
    ...prev,
    '',
    '한국어로, 아래 양식 그대로 답해라(전체 700자 안팎). 겉치레 칭찬은 하지 말고, 모르는 것은 모른다고 써라. 휴대폰에서 작아 못 읽은 글자는 못 읽었다고 써라.',
    '1. 이 영상이 말하려는 것 — 친구에게 전하듯 한 문장.',
    '2. 보고 나서 내가 바로 할 수 있게 된 것 — 없으면 「없음」.',
    '3. 무슨 말인지 모르겠던 낱말·장면 — 초와 함께 전부. 없으면 「없음」.',
    '4. 넘겼을 것 같은 초와 까닭 — 끝까지 봤을 것 같으면 「끝까지」와 까닭.',
    '5. 이해 점수 1~5(5 = 한 번 보고 다 알겠다)와 한 줄 까닭.',
    '6. 재미 점수 1~5(5 = 친구에게 보여 주고 싶을 만큼 재밌다, 1 = 지루하다)와 한 줄 까닭 — 이해와 따로 매긴다.',
    '7. 처음 3초(0~3초 장면)만 보고 넘기겠나 — 「넘김」 또는 「계속 봄」과 까닭.',
    '8. 저장하거나 누구에게 보내겠나 — 「저장」 · 「공유」 · 「둘 다」 · 「안 함」 가운데 하나와 까닭.',
    previous.length
      ? '9. 비교용 묶음과 견주어 같은 틀을 또 찍어 낸 것처럼 보이나 — 「같아 보임」 또는 「달라 보임」과, 같아 보이면 어디가 같은지(무대·머리 글·말 뼈대·끝 카드·그림).'
      : '9. (비교용 묶음 없음 — 「비교 못 함」이라고만 쓴다)',
    '',
  ].join('\n');
}

function probe(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', video],
    { encoding: 'utf8', windowsHide: true });
  let info = null;
  try { info = JSON.parse(String(r.stdout)); } catch { /* 아래에서 멈춘다 */ }
  const sec = Number(info?.format?.duration);
  const s = info?.streams?.[0] || {};
  if (r.status !== 0 || !(sec > 0)) throw new Error('ffprobe로 길이를 못 읽었다: ' + String(r.stderr || '').trim());
  return { duration: sec, landscape: Number(s.width) > Number(s.height) };
}

// 찍을 장면: 0~3초는 0.5초마다(첫 장면에서 넘길지가 갈린다), 그 뒤는 2초마다, 그리고 끝에서 0.3초 앞 장면(끝 카드).
function shotTimes(duration) {
  const out = [];
  for (let t = 0; t <= 3 + 1e-9 && t < duration; t += 0.5) out.push(Math.round(t * 10) / 10);
  for (let t = 4; t < duration - 1; t += 2) out.push(t);
  const end = Math.max(0, Math.round((duration - 0.3) * 10) / 10);
  if (end - out[out.length - 1] >= 0.5) out.push(end);
  return out.map((t) => ({ at: t, label: `${Number.isInteger(t) ? t : t.toFixed(1)}s` }));
}

// --컷 「0,3.56,4.52,…」(컷이 시작하는 초). 2초보다 짧은 컷이 많은 영상은 2초 정지컷이 컷을 통째로 빠뜨린다 — 원본 1:1
// 리메이크 「옆집의 크리스마스」 36컷/60초는 10컷이 묶음에 없었다(10-26). 그래서 컷마다 그 컷 가운데 장면 한 장을 찍는다.
// 칸이 모두 같은 크기라 0.5초 컷도 3초 컷만큼 무게를 얻으니, 표시는 그 컷이 나오는 「시작-끝」 초로 한다.
function parseCuts(text, end) {
  const starts = String(text).split(',').map((x) => Number(x.trim()));
  if (!starts.length || starts.some((s, i) => !(s >= 0) || s >= end || (i > 0 && s <= starts[i - 1]))) {
    throw new Error(`--컷은 0 이상 ${end.toFixed(2)}초 미만에서 커지는 초를 쉼표로 잇는다: ${text}`);
  }
  return starts;
}

function cutShots(starts, end) {
  return starts.map((s, i) => {
    const e = i + 1 < starts.length ? starts[i + 1] : end;
    return { at: (s + e) / 2, label: `${s.toFixed(1)}-${e.toFixed(1)}s` };
  });
}

function ffmpeg(args, what) {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`ffmpeg 실패(${what}): ` + String(r.stderr || '').trim().split('\n').slice(-2).join(' '));
}

// 장면마다 한 장씩 찍어(초를 찍어 넣고) cell.열×cell.행 칸으로 묶는다 → 만든 그림 경로들. -ss를 -i 앞에 두면 그 시각의 프레임을 바로 찾는다.
function makeSheets(video, shots, cell, outFor) {
  const dir = fs.mkdtempSync(path.join(path.dirname(outFor(1)), '.장면-'));
  try {
    shots.forEach((shot, i) => {
      const vf = `scale=${cell.w}:${cell.h},drawtext=fontfile='${FONT}':text='${shot.label}':x=8:y=8:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=6`;
      ffmpeg(['-ss', shot.at.toFixed(3), '-i', video, '-vf', vf, '-frames:v', '1', path.join(dir, `${String(i).padStart(3, '0')}.png`)], `${shot.label} 장면`);
    });
    const per = cell.열 * (cell.행 || Math.ceil(shots.length / cell.열));
    const files = [];
    for (let k = 0; k * per < shots.length; k += 1) {
      const n = Math.min(per, shots.length - k * per);
      const rows = cell.행 ? Math.min(cell.행, Math.ceil(n / cell.열)) : Math.ceil(n / cell.열);
      const out = outFor(k + 1);
      ffmpeg(['-start_number', String(k * per), '-i', path.join(dir, '%03d.png'), '-frames:v', '1', '-vf', `tile=${cell.열}x${rows}:nb_frames=${n}:padding=6:color=white`, '-q:v', '3', out], '묶기');
      files.push(out);
    }
    return files;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 영상이 든 편 폴더(docs/마케팅/<편>) — 그 편은 지난 편에서 뺀다.
function episodeOf(file) {
  const parts = path.resolve(file).split(path.sep);
  const i = parts.lastIndexOf('마케팅');
  return i >= 0 && parts[i + 1] ? parts[i + 1] : null;
}

// 같은 계정의 지난 편 — 판에 그 계정이 있고 영상이 있는 편 가운데 이 편 말고 「시각」이 가장 늦은 n편.
// 영상은 git 밖이라 공용 작업본에만 있다(워크트리에서 돌려도 공용 작업본의 편을 본다).
function pickPrevious(account, { exclude = null, roots = [공용작업본(ROOT)], n = 2 } = {}) {
  if (!account) return [];
  const 묶음 = require('./lib/게시묶음.js');
  const found = new Map();
  for (const root of [...new Set(roots.map((r) => path.resolve(r)))]) {
    const base = path.join(root, 'docs', '마케팅');
    let names = [];
    try { names = fs.readdirSync(base); } catch { continue; }
    for (const name of names) {
      if (name === exclude || found.has(name) || !fs.existsSync(path.join(base, name, '게시', '준비.json'))) continue;
      let bundle;
      try { bundle = 묶음.load(path.join(base, name)); } catch { continue; }
      const plate = 묶음.plates(bundle).find((p) => p.account === account && p.video?.exists && Date.parse(p.time || ''));
      if (plate) found.set(name, { name, video: plate.video.path, time: Date.parse(plate.time) });
    }
  }
  return [...found.values()].sort((a, b) => b.time - a.time || a.name.localeCompare(b.name)).slice(0, n);
}

function previousVideo(arg) {
  const p = path.resolve(arg);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return { name: episodeOf(p) || path.basename(p, path.extname(p)), video: p };
  const 묶음 = require('./lib/게시묶음.js');
  const bundle = 묶음.load(p);
  const plate = 묶음.plates(bundle).find((x) => x.video?.exists);
  if (!plate) throw new Error(`--지난 ${arg}: 판에 영상이 없다`);
  return { name: path.basename(p), video: plate.video.path };
}

function main(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1], i += 1;
    else args._.push(argv[i]);
  }
  const video = args._[0];
  if (!video || !args['말'] || !args['브랜드']) {
    console.error('쓰는 법: node tools/낯선이시험.js <영상.mp4> --말 <말.txt|.srt> --브랜드 <lab-en|lab-mn|lab-cn|lab-mm|synkbrief|yuhobuilds|pulse> [--밖 <폴더>] [--컷 <초,초,…>] [--지난 자동|없음|<편 폴더|영상>,…]');
    return 2;
  }
  const who = 시청자[args['브랜드']];
  if (!who) throw new Error(`브랜드는 ${Object.keys(시청자).join(' · ')} 가운데 하나다: ${args['브랜드']}`);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  const out = path.resolve(args['밖'] || path.join(ROOT, '.tmp', '낯선이시험', `${path.basename(video, path.extname(video))}-${stamp}`));
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (/^(정지컷_|지난\d)/.test(f) && /\.jpg$/.test(f)) fs.rmSync(path.join(out, f)); // 같은 폴더로 다시 돌릴 때 옛 장면을 섞지 않는다
  const src = path.resolve(video);
  const info = probe(src);
  const cuts = args['컷'] !== undefined;
  const shots = cuts ? cutShots(parseCuts(args['컷'], info.duration), info.duration) : shotTimes(info.duration);
  const sheets = makeSheets(src, shots, info.landscape ? 가로칸 : 세로칸, (k) => path.join(out, `정지컷_${String(k).padStart(2, '0')}.jpg`));

  const want = args['지난'] === undefined ? '자동' : String(args['지난']);
  const prevList = want === '없음' ? [] : want === '자동'
    ? pickPrevious(who.계정, { exclude: episodeOf(src) })
    : want.split(',').map((x) => x.trim()).filter(Boolean).map(previousVideo);
  const previous = prevList.map((p, i) => {
    const d = probe(p.video).duration;
    const times = [];
    for (let t = 0; t < d - 0.05; t += 2) times.push({ at: t, label: `${t}s` });
    const file = path.join(out, `지난${i + 1}_${p.name.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40)}.jpg`);
    makeSheets(p.video, times, { ...지난칸, 행: 0 }, () => file);
    return { ...p, file };
  });

  const speech = path.join(out, '말.txt');
  fs.writeFileSync(speech, readSpeech(path.resolve(args['말'])));
  fs.writeFileSync(path.join(out, '질문.md'), buildPrompt({ brand: args['브랜드'], sheets, speech, cuts, previous }));
  console.log(`재료: ${out} · 장면 ${shots.length}칸 / 그림 ${sheets.length}장 · 지난 편 ${previous.length ? previous.map((p) => p.name).join(' · ') : '없음'}`);
  if (want === '자동' && who.계정 && previous.length < 2) console.log(`  지난 편을 ${previous.length}편만 찾았다(${who.계정} 판에 영상이 있는 편) — 9번은 그만큼만 본다`);
  console.log('다음: 질문.md를 이 대화 맥락이 없는 새 시험관 둘(Agent model sonnet · model haiku, 서로 따로)에게 그대로 주고, 둘의 답을 한 장 기획의 「한 문장」과 견준다(제작절차 「시험」).');
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { srtToLines, readSpeech, buildPrompt, parseCuts, cutShots, shotTimes, pickPrevious, episodeOf, 시청자 };
