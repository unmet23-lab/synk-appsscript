'use strict';
// 한글 단계 · 「여러 목소리로 듣고 고르기」(HVPT)용 소리 굽기(2026-10-09 저녁 유호님 「오케이 이어서 남은것도 전부 하자」 — 10-08 견적 승인).
// 근거: docs/한글단계_노래영상_근거점검_20261008.md §4-1 — 노래 속도에서 안 갈리는 구별(가·카·까, 받침 ㄱ·ㄷ·ㅂ, ㅓ/ㅗ)은
//   목소리 4~6개로 같은 음절을 들려주고 고른 뒤 바로 정답 소리를 들려준다(HVPT 메타분석 g=0.67, 목소리 수가 효과를 가름).
// 대상 154음절: 세 소리 열네 자음(ㄱㅋㄲ ㄷㅌㄸ ㅂㅍㅃ ㅈㅊㅉ ㅅㅆ) × 기본 모음 여섯 84 · 받침 ㄱ·ㄷ·ㅂ(앱 받침 틀) 60 · ㅓ/ㅗ 나머지 10.
// 목소리: 기본 글자 소리(하나)에 더해 넷 — 여자 둘(진희 아나운서 · 효은 교육)과 남자 둘(재영 교육 · 강일 라디오), 음높이 146~267Hz로 넓게.
// 설정은 기본 글자 소리와 같다(ssfm-v30 · normal · 빠르기 0.9 · seed 1003 · -17 LUFS, 앞뒤 무음 걷고 64k mp3).
//   node tools/한글단계_여러목소리.cjs              → 없는 것만 굽는다(키는 보안 폴더 파일에서 메모리로만 — 화면·파일에 남기지 않음)
//   node tools/한글단계_여러목소리.cjs --list       → 대상 음절과 글자 수만
//   node tools/한글단계_여러목소리.cjs --approve "유호님 10-1X 귀 확인"  → talkers.candidate.json을 앱이 쓰는 talkers.json으로
// 원본 wav는 저장소 밖(Documents/synk-vendor/hangul-voice/talkers/), 화면용 mp3는 experiences/hangul-stage/assets/voice/talkers/<이름>/.
// 앱은 talkers.json의 approved:true일 때만 여러 목소리를 쓴다(09-19 결정 「귀로 확인한 파일만」). 그전에는 기본 목소리 하나다.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const repo = path.resolve(__dirname, '..');
const stage = path.join(repo, 'experiences', 'hangul-stage');
const outRoot = path.join(stage, 'assets', 'voice', 'talkers');
const rawRoot = path.join(os.homedir(), 'Documents', 'synk-vendor', 'hangul-voice', 'talkers');
const CANDIDATE = path.join(stage, 'assets', 'voice', 'talkers.candidate.json'), APPROVED = path.join(stage, 'assets', 'voice', 'talkers.json');
const KEY_FILE = path.join(os.homedir(), 'SYNK_보안', '타입캐스트.txt');
const SETTINGS = { model: 'ssfm-v30', emotion: 'normal', intensity: 1.0, tempo: 0.9, seed: 1003 };
const TALKERS = [
  { slug: 'jinhee', name: '진희', id: 'tc_6731b2b2478a48710ecc9158', gender: 'female', why: '아나운서·뉴스 — 느리고 또렷하다(225Hz)' },
  { slug: 'hyoeun', name: '효은', id: 'tc_691d49ccc47926d741f15913', gender: 'female', why: '교육·라디오 — 선생님 말투(242Hz)' },
  { slug: 'jaeyoung', name: '재영', id: 'tc_65571d3fb22102b993a24350', gender: 'male', why: '교육 — 또박또박(162Hz)' },
  { slug: 'gangil', name: '강일', id: 'tc_68d4b115f0486108a7eefb37', gender: 'male', why: '라디오·아나운서 — 낮고 또렷하다(146Hz)' },
];
const safe = text => [...text].map(ch => ch.codePointAt(0).toString(36)).join('');
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };

// 대상 음절(견적과 같은 규칙 — scratchpad hvpt_estimate.mjs를 옮김). pack이 정한 음절 만들기를 그대로 쓴다.
async function targets() {
  const { createPack } = await import(pathToFileURL(path.join(stage, 'pack.mjs')).href);
  const pack = createPack(JSON.parse(fs.readFileSync(path.join(repo, 'strata', 'hangul.json'), 'utf8')));
  const J = g => pack.letters.find(l => l.glyph === g);
  const BASIC = ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ'].map(J);
  const triad = ['ㄱ', 'ㅋ', 'ㄲ', 'ㄷ', 'ㅌ', 'ㄸ', 'ㅂ', 'ㅍ', 'ㅃ', 'ㅈ', 'ㅊ', 'ㅉ', 'ㅅ', 'ㅆ'].map(J);
  const set = new Set();
  for (const c of triad) for (const v of BASIC) set.add(pack.syllable(c.id, v.id));
  const finals = pack.letters.filter(l => l.role === 'final' && ['ㄱ', 'ㄷ', 'ㅂ'].includes(l.glyph));
  for (const c of pack.FINAL_FRAME.initials) for (const v of pack.FINAL_FRAME.vowels) for (const f of finals) set.add(pack.syllable(c, v, f.id));
  for (const c of [null, ...['ㄴ', 'ㄹ', 'ㅁ', 'ㅎ'].map(g => J(g).id)]) for (const v of ['ㅓ', 'ㅗ']) set.add(pack.syllable(c, J(v).id));
  const main = new Set(pack.audioManifest().clips);
  const list = [...set];
  const missing = list.filter(t => !main.has(t));
  if (missing.length) throw Error('기본 소리 목록에 없는 음절: ' + missing.join(' '));
  return list;
}

if (process.argv.includes('--approve')) {
  const note = arg('--approve');
  const candidate = readJson(CANDIDATE, null);
  if (!candidate?.talkers?.length) throw Error('후보 목록이 없다: 먼저 굽기');
  if (!note) throw Error('누가 언제 귀로 확인했는지 적는다: --approve "유호님 10-1X 귀 확인"');
  for (const t of candidate.talkers) for (const file of Object.values(t.clips)) if (!fs.existsSync(path.join(stage, 'assets', 'voice', file))) throw Error('파일 없음: ' + file);
  fs.writeFileSync(APPROVED, JSON.stringify({ ...candidate, approved: true, approvedNote: note, approvedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(`talkers.json 승인: 목소리 ${candidate.talkers.length} · 소리 ${candidate.talkers.reduce((n, t) => n + Object.keys(t.clips).length, 0)}개 (${note})`);
  process.exit(0);
}

async function main() {
  const list = await targets();
  const chars = list.reduce((n, t) => n + [...t].length, 0);
  if (process.argv.includes('--list')) { console.log(JSON.stringify({ syllables: list.length, chars, perTalker: chars, talkers: TALKERS.length, total: chars * TALKERS.length, list: list.join(' ') })); return; }
  let key = (fs.readFileSync(KEY_FILE, 'utf8').split(/\r?\n/).map(s => s.trim()).find(Boolean) || '');
  if (key.length < 10) throw Error('키 파일이 비어 있음');
  const api = async (route, method = 'GET', body) => {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch('https://api.typecast.ai' + route, { method, headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(180000) });
      if ((response.status === 429 || response.status >= 500) && attempt < 4) { await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); continue; }
      if (!response.ok) throw Error('Typecast HTTP ' + response.status);
      return response.json();
    }
  };
  const left = sub => sub.credits.plan_credits - sub.credits.used_credits;
  const before = await api('/v1/users/me/subscription');
  if (left(before) < 5000) throw Error('월 제공 크레딧이 부족함');
  const prev = readJson(CANDIDATE, { talkers: [] });
  const out = { note: '후보다. 유호님이 귀로 확인한 뒤 tools/한글단계_여러목소리.cjs --approve로 talkers.json에 옮긴다. 기본 글자 소리(voices.json)와 함께 듣기 문항의 목소리를 돌려 쓴다.',
    settings: SETTINGS, approved: false, syllables: list.length, talkers: [] };
  let made = 0;
  try {
    for (const t of TALKERS) {
      const old = prev.talkers.find(x => x.slug === t.slug && x.id === t.id);
      const clips = { ...(old?.clips || {}) };
      const dir = path.join(outRoot, t.slug), raw = path.join(rawRoot, t.slug);
      fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(raw, { recursive: true });
      for (const text of list) {
        const rel = `talkers/${t.slug}/${safe(text)}.mp3`;
        if (clips[text] === rel && fs.existsSync(path.join(stage, 'assets', 'voice', rel))) continue;
        const data = await api('/v1/text-to-speech/with-timestamps', 'POST', { seed: SETTINGS.seed, model: SETTINGS.model, voice_id: t.id, text, language: 'kor',
          output: { audio_format: 'wav', audio_tempo: SETTINGS.tempo, target_lufs: -17 },
          prompt: { emotion_type: 'preset', emotion_preset: SETTINGS.emotion, emotion_intensity: SETTINGS.intensity } });
        const bytes = Buffer.from(data.audio || '', 'base64');
        if (bytes.length < 1000) throw Error('빈 음성: ' + t.name + ' ' + text);
        const wav = path.join(raw, safe(text) + '.wav');
        fs.writeFileSync(wav, bytes);
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af',
          'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse,apad=pad_dur=0.08',
          '-ac', '1', '-ar', '44100', '-b:a', '64k', path.join(dir, safe(text) + '.mp3')]);
        clips[text] = rel; made += 1;
        if (made % 50 === 0) console.log('…', made, t.name, text);
      }
      out.talkers.push({ ...t, clips: Object.fromEntries(Object.entries(clips).sort(([a], [b]) => a.localeCompare(b, 'ko'))) });
    }
  } finally {
    // 중간에 멈춰도 만든 만큼은 후보 목록에 남긴다(다시 켜면 이어서)
    for (const t of TALKERS) if (!out.talkers.some(x => x.slug === t.slug)) {
      const old = prev.talkers.find(x => x.slug === t.slug && x.id === t.id);
      if (old) out.talkers.push(old);
    }
    fs.writeFileSync(CANDIDATE, JSON.stringify(out, null, 2) + '\n');
  }
  const after = await api('/v1/users/me/subscription');
  key = '';
  console.log(JSON.stringify({ made, syllables: list.length, talkers: out.talkers.map(t => `${t.name} ${Object.keys(t.clips).length}`),
    note: 'Typecast 잔액은 늦게 반영되고 같은 키를 다른 작업이 함께 쓸 수 있어 글자 수로 센다', chars: made, left: left(after) }));
}
main().catch(e => { console.error('실패:', e.message); process.exit(1); });
