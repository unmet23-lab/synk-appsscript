// synkbrief 「GPTs·젬, 올해 둘 다 사라집니다」 v2 나레이션을 Typecast로 굽는다.
//   node docs/마케팅/synkbrief_GPTs젬_스킬전환_20261017/소리/나레이션.mjs --견적     글자 수만
//   node docs/마케팅/synkbrief_GPTs젬_스킬전환_20261017/소리/나레이션.mjs --시험     「GPTs」 읽기 비교 두 줄만(소리/시험/)
//   node docs/마케팅/synkbrief_GPTs젬_스킬전환_20261017/소리/나레이션.mjs [v03]     전부(또는 한 줄)를 소리/vo/에
// 목소리: 범수(tc_5c3c52cb5827e00008dd7f3b, 다큐) — 새 나레이션 기본(결정 표 10-10), 카타나 v4와 같은 채널 목소리.
// 속도: 1.12배. 유호님 10-13 「템포가 너~무 느리고」, Fable 검수 10-17 목표 6.5~7음절/초(36초판).
// 키: ~/SYNK_보안/타입캐스트.txt(메모리에서만 읽고 버린다). 1글자 1크레딧.
// 읽는 글은 소리 나는 대로(GPTs → 아래 READ, 날짜는 한글 숫자). 화면 자막은 콘티·컴포지션이 따로 쥔다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(os.homedir(), 'SYNK_보안', '타입캐스트.txt');
const VOICE = { name: '범수', id: 'tc_5c3c52cb5827e00008dd7f3b' };
const SETTINGS = { model: 'ssfm-v30', emotion: 'normal', intensity: 1.0, tempo: 1.12, seed: 1017 };
// 「GPTs」 읽기: 시험 굽기로 유호님이 귀로 고른 뒤 하나로 통일한다(Fable 10-17). 10-17 시험 두 줄을 들려 드린 뒤 「지피티에스」로 정함(받아쓰기도 지피티에스 쪽이 또렷).
const READ = process.env.GPTS_READ || '지피티에스';

// [id, 읽는 글, 장면, 감정] — 장면 초는 기획.md v2 표와 같다. 감정은 Typecast smart를 쓰지 않고 보통(정보 전달)으로 둔다.
export const LINES = [
  ['a01', `${READ}랑 젬, 만들어 두셨죠? 올해 둘 다 사라집니다.`, '01A 훅(인스타)'],
  ['c01', `알아서 옮겨 주겠지 싶죠? ${READ}는 아닙니다.`, '01C 훅(유튜브)'],
  ['a02', '그럼 만들어 둔 건, 알아서 옮겨질까요?', '02A 맞혀 보기(인스타)'],
  ['c02', '그럼, 제미나이 젬은요?', '02C 맞혀 보기(유튜브)'],
  ['v03', '젬은, 네. 십일월 십칠일부터, 알아서 옮겨지기 시작해요.', '03 젬은 자동'],
  ['v04', `${READ}는 아니에요. 십이월 십일일 전에, 직접 옮겨야 해요.`, '04 GPTs는 직접'],
  ['v05', '안 옮기면, 그날부터 못 열어요.', '05 잠김'],
  ['v06', '남이 만든 지피티는, 만든 사람이 옮겨서 다시 알려 줘야 해요.', '06 남이 만든 GPT'],
  ['v07', '대화 기록은 남아요. 하지만 게시 안 한 수정, 외부 연결, 공유 설정은 안 따라와요.', '07 안 따라오는 것'],
  ['v08', '옮기기 전, 자주 쓰던 질문 세 개를 적어 두고, 옮긴 뒤 비교하세요.', '08 질문 세 개'],
  ['v09', '내 날짜와 할 일은, 프로필 링크에서 일 분이면 나와요.', '09 내 날짜'],
  ['v10', '몇 개나 만들어 두셨어요?', '10 끝'],
];
// 「GPTs」 읽기 비교(같은 첫 줄을 두 가지로)
const TEST = [
  ['t1', '지피티즈랑 젬, 만들어 두셨죠? 올해 둘 다 사라집니다.'],
  ['t2', '지피티에스랑 젬, 만들어 두셨죠? 올해 둘 다 사라집니다.'],
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const test = process.argv.includes('--시험');
  const list = test ? TEST : LINES;
  const only = process.argv.find((a) => /^[act]\d\d$|^v\d\d$/.test(a));
  const pick = list.filter(([id]) => !only || id === only);
  const chars = pick.reduce((n, [, t]) => n + [...t].length, 0);
  const syll = pick.reduce((n, [, t]) => n + [...t].filter((c) => /[가-힣]/.test(c)).length, 0);
  if (process.argv.includes('--견적')) { console.log(JSON.stringify({ lines: pick.length, chars, syllables: syll, credits: chars })); process.exit(0); }
  const OUT = path.join(HERE, test ? '시험' : 'vo');
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
    // 앞뒤 무음만 다듬는다(말 사이 쉼은 그대로)
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af',
      'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse',
      '-ar', '48000', '-ac', '1', wav]);
    fs.rmSync(raw);
    const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).toString().trim());
    const meta = { ...data }; delete meta.audio;
    fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(meta, null, 1));
    const hs = [...text].filter((c) => /[가-힣]/.test(c)).length;
    out.push({ id, text, dur: +dur.toFixed(3), syllablesPerSec: +(hs / dur).toFixed(2) });
    console.log(id, dur.toFixed(2) + 's', (hs / dur).toFixed(2) + '음절/초', text);
  }
  const after = await api('/v1/users/me/subscription');
  key = '';
  const prev = fs.existsSync(path.join(OUT, 'vo.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'vo.json'), 'utf8')) : { lines: [] };
  const merged = list.map(([id]) => out.find((x) => x.id === id) || prev.lines.find((x) => x.id === id)).filter(Boolean);
  fs.writeFileSync(path.join(OUT, 'vo.json'), JSON.stringify({ voice: VOICE, settings: SETTINGS, read: READ, lines: merged }, null, 1) + '\n');
  console.log(JSON.stringify({ chars: out.reduce((n, x) => n + [...x.text].length, 0), creditsBefore: left(before), creditsAfter: left(after) }));
}
