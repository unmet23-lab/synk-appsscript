// synkbrief 「카타나 써 봤습니다」 v4 나레이션을 Typecast로 굽는다: node docs/마케팅/synkbrief_카타나실험_20261013/나레이션_v4.mjs
// 유호님 10-13 「영상 템포가 너무 느리고 오디오도 없네. tts는 타입캐스트로 넣어주고 배경음도 깔아줘」.
// 목소리: 범수(tc_5c3c52cb5827e00008dd7f3b, 다큐) — 새 나레이션 기본(결정 표 10-10). 한 콘텐츠 한 목소리, 줄마다 보통(정보 전달).
// 키: ~/SYNK_보안/타입캐스트.txt(유호님이 넣은 파일, 메모리에서만 읽고 버린다). 1글자 1크레딧.
// 결과: kit-v4/assets/media/vo/vNN.wav(앞뒤 무음 다듬음) + vo.json(줄마다 길이·글자 시각). 화면 글은 index.html이 따로 쥔다(읽는 글과 다를 수 있음).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'kit-v4', 'assets', 'media', 'vo');
const KEY_FILE = path.join(os.homedir(), 'SYNK_보안', '타입캐스트.txt');
const VOICE = { name: '범수', id: 'tc_5c3c52cb5827e00008dd7f3b' };
const SETTINGS = { model: 'ssfm-v30', emotion: 'normal', intensity: 1.0, tempo: 1.08, seed: 1013 };

// 읽는 글(숫자·기호는 소리 나는 대로). 화면 자막은 index.html의 글을 쓴다.
export const LINES = [
  ['v01', '몽글 사진 다섯 장으로, 영상 두 편을 만들었어요.'],
  ['v02', '클로드에 힉스필드를 연결하고, 슬래시 카타나 뒤에 요청문만 붙였어요.'],
  ['v03', '제품 광고처럼 만들어 달라고 했더니,'],
  ['v04', '이런 광고가 나왔어요. 사십이 크레딧, 삼십팔 분 걸렸어요.'],
  ['v05', '다만 표정이 바뀌는 이 부분은, 새로 만든 게 아니라 사진 합성이에요.'],
  ['v06', '이번엔 아우라 에딧으로 부탁했더니,'],
  ['v07', '팔십사 크레딧짜리 아우라 에딧이 나왔어요.'],
  ['v08', '써 보니 꼭 알아 둘 게 있어요. 카타나는 비용을 묻지 않아요.'],
  ['v09', '그러니 요청문에 크레딧 상한을 꼭 적으세요. 화질도 사팔공 피라고 적으면, 비용이 절반 이하로 줄어요.'],
  ['v10', '내 영상에 맞춘 요청문은, 프로필 링크에서 만들어 보세요.'],
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const chars = LINES.reduce((n, [, t]) => n + [...t].length, 0);
  if (process.argv.includes('--견적')) { console.log(JSON.stringify({ lines: LINES.length, chars })); process.exit(0); }
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
  if (left(before) < chars + 1000) throw Error('월 제공 크레딧이 부족함');
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv.find((a) => /^v\d\d$/.test(a));
  const out = [];
  for (const [id, text] of LINES) {
    if (only && id !== only) continue;
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
    // 앞뒤 무음만 다듬는다(말 사이 쉼은 그대로)
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af',
      'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse',
      '-ar', '48000', '-ac', '1', wav]);
    const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString().trim());
    const meta = { ...data }; delete meta.audio;
    fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(meta, null, 1));
    out.push({ id, text, dur: +dur.toFixed(3) });
    console.log(id, dur.toFixed(2) + 's', text);
  }
  const after = await api('/v1/users/me/subscription');
  key = '';
  const prev = fs.existsSync(path.join(OUT, 'vo.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'vo.json'), 'utf8')) : { lines: [] };
  const merged = LINES.map(([id]) => out.find((x) => x.id === id) || prev.lines.find((x) => x.id === id)).filter(Boolean);
  fs.writeFileSync(path.join(OUT, 'vo.json'), JSON.stringify({ voice: VOICE, settings: SETTINGS, lines: merged }, null, 1) + '\n');
  console.log(JSON.stringify({ chars: out.reduce((n, x) => n + [...x.text].length, 0), creditsBefore: left(before), creditsAfter: left(after) }));
}
