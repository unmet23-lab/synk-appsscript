// 대본 전체를 한 번에 읽힌 테이크를 만든다(Gemini TTS, Vertex). 10-04 「흐름이 뚝뚝 끊기는 느낌」 → 한 줄씩 따로 만들지 않는다.
// 연출 메모와 대본은 머리글로 가른다(10-02 입장 검사: 한 문장 지시는 지시문까지 소리로 읽었다).
// 실행(폴더 안에서, 종량제라 --유료-api가 있어야 부른다):
//   node 음성/한번에_생성.cjs --유료-api --voices Achird,Algieba [--model gemini-3.8-flash-tts] [--out 음성/후보] [--n 2] [--tag r2] [--segs c1,c2]
// 결과: <out>/<모델>__<목소리>[_n].wav(16비트 PCM, 원래 표본율) + 같은 이름 .json(모델·목소리·대본·길이). 이미 있으면 건너뛴다(--다시).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repo = path.resolve(__dirname, '../../../..');
const 정책 = require(path.join(repo, 'tools', '모델정책.js'));
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'voice-plan.json'), 'utf8'));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const MODEL = arg('--model', plan.take.model);
const VOICES = String(arg('--voices', plan.take.voice || '')).split(',').filter(Boolean);
const OUT = path.resolve(path.join(__dirname, '..'), arg('--out', '음성/후보'));
const N = Number(arg('--n', 1));
const again = argv.includes('--다시');
const TAG = arg('--tag', '');
// --segs c1,c2: 그 대사들만 이어 읽힌다(끝 문단만 새로 쓸 때). 음성/테이크_잇기.py가 앞 테이크와 잇는다.
const SEGS = arg('--segs', '') ? arg('--segs').split(',') : null;
const short = MODEL.replace(/^gemini-/, '').replace(/-preview/, '').replace(/-tts$/, '');

/** 화면 단위(segments)를 이어 붙인 읽을 대본. breaks에 든 대사 앞에서 줄을 바꾼다. */
function transcript() {
  const out = [];
  plan.segments.filter((s) => !SEGS || SEGS.includes(s.id)).forEach((s, i) => {
    if (i > 0) out.push(plan.take.breaks.includes(s.id) ? '\n' : ' ');
    out.push(s.text);
  });
  return out.join('');
}
const prompt = () => ["### DIRECTOR'S NOTES (never read these notes aloud)", ...plan.take.notes, '', '### TRANSCRIPT', transcript()].join('\n');

async function tts(voice) {
  const url = `https://aiplatform.googleapis.com/v1/projects/${정책.벌텍스프로젝트()}/locations/global/publishers/google/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt() }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
  };
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(url, { method: 'POST', headers: await 정책.제미나이헤더('돈'), body: JSON.stringify(body) });
    const t = await r.text();
    if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 5000 * attempt)); continue; }
    if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 200)}`);
    const part = JSON.parse(t).candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new Error(`소리가 안 왔다: ${t.slice(0, 200)}`);
    return { mime: part.inlineData.mimeType, data: Buffer.from(part.inlineData.data, 'base64') };
  }
  throw new Error('네 번 시도해도 실패');
}

/** 받은 소리를 16비트 PCM wav로(wav면 ffmpeg로 정리만, L16이면 머리를 붙인다). */
function save(got, file) {
  const raw = file + '.raw';
  fs.writeFileSync(raw, got.data);
  const rate = Number((got.mime.match(/rate=(\d+)/) || [])[1] || 24000);
  const input = /wav/i.test(got.mime) ? ['-i', raw] : ['-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', raw];
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...input, '-c:a', 'pcm_s16le', '-ac', '1', file], { encoding: 'utf8' });
  fs.unlinkSync(raw);
  if (r.status !== 0) throw new Error('ffmpeg 실패: ' + r.stderr.slice(-300));
  const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' });
  return Number(p.stdout.trim());
}

(async () => {
  if (!VOICES.length) throw new Error('--voices 목소리1,목소리2 를 준다');
  정책.유료API요구('Gemini TTS(Vertex)');
  fs.mkdirSync(OUT, { recursive: true });
  const jobs = [];
  for (const v of VOICES) for (let k = 1; k <= N; k++) jobs.push({ voice: v, file: path.join(OUT, `${short}__${v}${TAG ? '_' + TAG : ''}${N > 1 ? '_' + k : ''}.wav`) });
  const todo = jobs.filter((j) => again || !fs.existsSync(j.file));
  console.log(`${MODEL} · ${todo.length}개 만들기 / ${jobs.length}개`);
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const j = todo[i++];
      const t0 = Date.now();
      try {
        const got = await tts(j.voice);
        const sec = save(got, j.file);
        fs.writeFileSync(j.file.replace(/\.wav$/, '.json'), JSON.stringify({ engine: 'Gemini TTS (Vertex)', model: MODEL, voice: j.voice, segs: SEGS || undefined, mime: got.mime, seconds: sec, made: new Date().toISOString(), transcript: transcript(), notes: plan.take.notes }, null, 1));
        console.log(`  ${path.basename(j.file)} ${sec.toFixed(2)}초 · ${((Date.now() - t0) / 1000).toFixed(1)}초 걸림`);
      } catch (e) { console.log(`  ${path.basename(j.file)} 실패: ${e.message}`); }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
})().catch((e) => { console.error(e.message); process.exit(1); });
