// synkbrief 「메뉴판 AI 음식 사진」 본편 나레이션을 Typecast로 굽는다(10-20, 조율 세션 지시 「목소리는 지금 쓰는 Typecast(범수)」).
//   node docs/마케팅/synkbrief_AI음식사진_20261020/소리/나레이션.mjs [--견적] [a01 b01 …]   글자 수만(키 필요 없음)
//   node docs/마케팅/synkbrief_AI음식사진_20261020/소리/나레이션.mjs [a01 b01 …]     전부(또는 고른 줄)를 remotion/public/vo/에
//   node docs/마케팅/synkbrief_AI음식사진_20261020/소리/나레이션.mjs --잔량    Typecast 남은 크레딧만(굽지 않음)
// 목소리·설정은 같은 채널 지난 두 편과 같다: 범수 · ssfm-v30 · 보통 감정 · 1.12배.
// 키: ~/SYNK_보안/타입캐스트.txt(메모리에서만 읽고 버린다). 1글자 1크레딧.
// 읽는 글은 소리 나는 대로 쓴다. 화면 자막은 장면 코드(remotion/src/full)가 따로 쥔다.
// 다음 단계: python -I 소리/vo표.py(끝 숨 자르기 · remotion/src/full/vo.ts) → node remotion/scripts/vo-place.mjs → 렌더.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'remotion', 'public', 'vo');
const KEY_FILE = path.join(os.homedir(), 'SYNK_보안', '타입캐스트.txt');
const VOICE = { name: '범수', id: 'tc_5c3c52cb5827e00008dd7f3b' };
const SETTINGS = { model: 'ssfm-v30', emotion: 'normal', intensity: 1.0, tempo: 1.12, seed: 1018 };

// [id, 읽는 글, 장면] — 콘티.md 「장면」 표와 「본편 v2」·「본편 v4」 절의 고친 줄.
// 10-20 Fable 콘티 검수 반영: 02 「현행법상」→「지금은」, 05는 화면 요청문과 같은 「빛·색·배경만」, 06 「잡동사니」 단정 대신,
// 07 「실제에 가깝게」라고만 써서 빨개진 까닭, 08 ✓ 대신 「똑같진 않아도 훨씬 가까워졌어요」(실측 36.4° → 33.8°), 09 O·X 질문.
export const LINES = [
  ['a01', '진짜 라볶이 사진을, 빛이랑 배경만 AI로 다듬었어요.', '01A 훅(인스타 · 결과)'],
  ['b01', '메뉴판에 AI로 만든 음식 사진, 써도 될까요?', '01B 훅(유튜브 쇼츠 · 질문)'],
  ['v02', 'AI 사진을 메뉴판에 걸어도, 지금은 표시 의무가 없어요.', '02 사실'],
  ['v03', '그런데 손님은 실제랑 다르면 속은 기분이 든대요.', '03 손님'],
  ['v04', '그래서 만들지 말고, 진짜 사진을 다듬어요.', '04 전환'],
  ['v05', '사진을 올리고 이렇게 쓰세요. 음식은 그대로, 빛, 색, 배경만.', '05 요청문'],
  ['v06', '얼핏 보면 배치 그대로, 가장자리만 깨끗해졌죠.', '06 결과 1'],
  ['v07', '올리기 전엔 세 가지를 봐요. 양 같고, 재료 같고, 색은, 실제에 가깝게라고만 썼더니, 빨개졌네요.', '07 확인 셋'],
  ['v08', '한 줄 더. 색을 콕 집어 적으니, 똑같진 않아도 훨씬 가까워졌어요.', '08 한 줄 더'],
  ['v09', '요청문은 글에 적어 뒀어요. AI 메뉴 사진, 표시해야 할까요?', '09 끝'],
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = process.argv.filter((a) => /^[abv]\d\d$/.test(a));
  const pick = LINES.filter(([id]) => !only.length || only.includes(id));
  const chars = pick.reduce((n, [, t]) => n + [...t].length, 0);
  const syll = pick.reduce((n, [, t]) => n + [...t].filter((c) => /[가-힣]/.test(c)).length, 0);
  if (process.argv.includes('--견적')) { console.log(JSON.stringify({ lines: pick.length, chars, syllables: syll, credits: chars })); process.exit(0); }
  if (!fs.existsSync(KEY_FILE)) { console.error(`Typecast 키 파일이 없다: ${KEY_FILE}`); process.exit(2); }
  let key = (fs.readFileSync(KEY_FILE, 'utf8').split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '');
  if (key.length < 10) throw Error('키 파일이 비어 있음');
  const api = async (route, method = 'GET', body) => {
    for (let attempt = 0; ; attempt += 1) {
      const res = await fetch('https://api.typecast.ai' + route, { method, headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(180000) });
      if ((res.status === 429 || res.status >= 500) && attempt < 4) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
      if (!res.ok) throw Error('Typecast HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
      return res.json();
    }
  };
  const left = (sub) => sub.credits.plan_credits - sub.credits.used_credits;
  const before = await api('/v1/users/me/subscription');
  // 잔량은 굽고 한참 뒤에 반영된다(현장 노트) — 나중에 --잔량으로 다시 읽는다.
  if (process.argv.includes('--잔량')) { key = ''; console.log(JSON.stringify({ left: left(before), plan: before.credits.plan_credits, used: before.credits.used_credits })); process.exit(0); }
  if (left(before) < chars + 1000) throw Error('월 제공 크레딧이 부족함');
  fs.mkdirSync(OUT, { recursive: true });
  const out = [];
  for (const [id, text] of pick) {
    const data = await api('/v1/text-to-speech/with-timestamps', 'POST', {
      seed: SETTINGS.seed, model: SETTINGS.model, voice_id: VOICE.id, text, language: 'kor',
      output: { audio_format: 'wav', audio_tempo: SETTINGS.tempo, target_lufs: -17 },
      prompt: { emotion_type: 'preset', emotion_preset: SETTINGS.emotion, emotion_intensity: SETTINGS.intensity },
    });
    const bytes = Buffer.from(data.audio || '', 'base64');
    if (bytes.length < 1000) throw Error('빈 음성: ' + id);
    const raw = path.join(OUT, id + '.raw.wav');
    const wav = path.join(OUT, id + '.wav');
    fs.writeFileSync(raw, bytes);
    // 앞 무음만 다듬는다(0.02초 남김). 끝은 Typecast 낱말 시각으로 vo표.mjs가 자른다(줄 끝 숨이 −50dB 걷기로 안 걷힌다 — 현장 노트).
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af',
      'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02',
      '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    fs.rmSync(raw);
    // vo표.py는 자르기 전 판(임시 폴더)에서 끝을 잰다 — 다시 구운 줄은 그 판도 새것으로 바꾼다(안 바꾸면 옛 소리를 잘라 쓴다).
    const keepDir = path.join(os.tmpdir(), 'synkbrief-food-vo-uncut');
    fs.mkdirSync(keepDir, { recursive: true });
    fs.copyFileSync(wav, path.join(keepDir, id + '.wav'));
    const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString().trim());
    const meta = { ...data }; delete meta.audio;
    fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(meta, null, 1) + '\n');
    const hs = [...text].filter((c) => /[가-힣]/.test(c)).length;
    out.push({ id, text, dur: +dur.toFixed(3), syllablesPerSec: +(hs / dur).toFixed(2) });
    console.log(id, dur.toFixed(2) + 's', (hs / dur).toFixed(2) + '음절/초', text);
  }
  const after = await api('/v1/users/me/subscription');
  key = '';
  const prevFile = path.join(OUT, 'vo.json');
  const prev = fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, 'utf8')) : { lines: [] };
  const merged = LINES.map(([id]) => out.find((x) => x.id === id) || prev.lines.find((x) => x.id === id)).filter(Boolean);
  fs.writeFileSync(prevFile, JSON.stringify({ voice: VOICE, settings: SETTINGS, made: new Date().toISOString(), lines: merged }, null, 1) + '\n');
  console.log(JSON.stringify({ chars: out.reduce((n, x) => n + [...x.text].length, 0), creditsBefore: left(before), creditsAfter: left(after), used: left(before) - left(after) }));
}
