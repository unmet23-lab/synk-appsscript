// synkbrief 「AI 구독 계정판」 본편 v2 나레이션을 Typecast로 굽는다(10-18 유호님 「내레이션 녹음 승인할게」).
//   node docs/마케팅/synkbrief_AI구독계정판_20261017/소리/나레이션.mjs --견적     글자 수만(키 필요 없음)
//   node docs/마케팅/synkbrief_AI구독계정판_20261017/소리/나레이션.mjs [v04]     전부(또는 한 줄)를 remotion/public/vo/에
//   node docs/마케팅/synkbrief_AI구독계정판_20261017/소리/나레이션.mjs --잔량    Typecast 남은 크레딧만(굽지 않음)
// 목소리·설정은 같은 채널 「GPTs·젬」 편(synkbrief_GPTs젬_스킬전환_20261017/소리/나레이션.mjs)과 같다: 범수 · ssfm-v30 · 보통 감정 · 1.12배.
// 키: ~/SYNK_보안/타입캐스트.txt(메모리에서만 읽고 버린다). 1글자 1크레딧.
// 읽는 글은 소리 나는 대로(SYNK → 싱크, PC → 피씨, 16 → 열여섯). 화면 자막은 장면 코드(remotion/src/full)가 따로 쥔다.
// 다음 단계: python 소리/받아쓰기.py(받아쓰기 확인) → node 소리/vo표.mjs(remotion/src/full/vo.ts) → 렌더.
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

// [id, 읽는 글, 장면] — 콘티.md 「장면」 표와 「본편 v2」 절의 고친 줄.
export const LINES = [
  ['a01', '클릭 한 번에 AI 계정 열여섯 개, 남은 한도가 다 보여요.', '01A 훅(인스타)'],
  ['b01', 'AI 구독 세 개 넘게 쓰면, 이번 주 얼마 남았는지 바로 아세요?', '01B 훅(유튜브 쇼츠)'],
  ['v02', '보통은 계정마다 로그아웃, 로그인, 사용량 확인이죠.', '02 전'],
  ['v03', '싱크 회원 혜택, AI 구독 계정판이에요.', '03 혜택 카드'],
  ['v04', '지금 확인 한 번이면 계정 열여섯 개를 다 읽어요.', '04 지금 확인'],
  ['v05', '다 쓴 계정, 모자란 크레딧까지 줄마다 보여요.', '05 다 쓴 것·모자란 것'],
  ['v06', '지금 쓸 여유 있는 계정까지 알려 주고,', '06 여유 있는 계정'],
  ['v07', '다 쓴 계정도 언제 풀리는지 바로 보여요.', '07 풀리는 때'],
  ['v08', '풀리는 때와 주간 초기화를 날짜순으로 모아요.', '08 앞으로 7일'],
  ['v09', '토큰을 복사할 필요 없이, 각 서비스 공식 프로그램이 알려 준 숫자만 모아요.', '09 공식 프로그램'],
  ['v10', '같은 앱이어도 내 피씨에선 내 계정 숫자가 나와요.', '10 내 계정 숫자'],
  ['v11', '싱크 회원이면 무료. AI 구독, 몇 개 쓰세요?', '11 끝'],
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = process.argv.find((a) => /^[abv]\d\d$/.test(a));
  const pick = LINES.filter(([id]) => !only || id === only);
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
