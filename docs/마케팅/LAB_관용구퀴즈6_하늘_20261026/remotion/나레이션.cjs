'use strict';
// 나레이션을 Typecast로 굽는다(2026-10-13 유호님 「나레이션만 자연스럽게 얹을 수 있을까? … 완전 재밌는 말투로 해줘도 좋아. 타입캐스트로, 두 버전 다」).
//   node 나레이션.cjs --list                 → 줄·글자 수만(유료 호출 없음)
//   node 나레이션.cjs [--판 natural|fun|test] → 없는 줄만 굽는다. 키는 ~/SYNK_보안/타입캐스트.txt에서 메모리로만(화면·파일에 남기지 않음)
// 목소리: 하나(tc_61659cc118732016a95fe7c6) — LAB 낱말 콘텐츠 기준(발음이 또렷함). 한 판 안에서는 한 목소리만.
// 원본 wav: 저장소 밖 Documents/synk-vendor/lab-topik-narration/raw/<요청 해시>.wav — 같은 요청은 다시 사지 않는다.
// 결과: public/vo/<판>/<줄>.wav(앞뒤 무음 걷음) + src/film/vo.generated.ts(줄마다 시작 초·길이).
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const HERE = __dirname;
const KEY_FILE = path.join(os.homedir(), 'SYNK_보안', '타입캐스트.txt');
const RAW = path.join(os.homedir(), 'Documents', 'synk-vendor', 'lab-topik-narration', 'raw');
const SCRIPT = path.join(HERE, '나레이션_대본.json');
const OUT_TS = path.join(HERE, 'src', 'film', 'vo.generated.ts');
const VOICE = { id: 'tc_61659cc118732016a95fe7c6', name: '하나' };
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };

const script = JSON.parse(fs.readFileSync(SCRIPT, 'utf8'));
const which = arg('--판');
const versions = Object.keys(script.versions).filter((v) => !which || which.split(',').includes(v));

const request = (line, v) => {
  const s = { ...script.defaults, ...(script.versions[v].defaults || {}), ...line };
  return {
    seed: s.seed,
    model: 'ssfm-v30',
    voice_id: VOICE.id,
    text: s.text,
    language: s.lang === 'ko' ? 'kor' : 'eng',
    output: { audio_format: 'wav', audio_tempo: s.tempo, target_lufs: s.lufs },
    prompt:
      s.emotion === 'smart'
        ? { emotion_type: 'smart', previous_text: s.prev || '', next_text: s.next || '' }
        : { emotion_type: 'preset', emotion_preset: s.emotion, emotion_intensity: s.intensity },
  };
};
const hash = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 32);
const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

async function main() {
  const jobs = versions.flatMap((v) => script.versions[v].lines.map((l) => ({ v, l, req: request(l, v) })));
  const chars = jobs.reduce((n, j) => n + [...j.req.text].length, 0);
  // 같은 요청(같은 글·설정)은 한 번만 산다 — 「Three!」「Nope.」처럼 되풀이되는 줄
  const seen = new Set();
  const todo = jobs.filter((j) => {
    const h = hash(j.req);
    if (seen.has(h) || fs.existsSync(path.join(RAW, h + '.wav'))) return false;
    seen.add(h);
    return true;
  });
  const todoChars = todo.reduce((n, j) => n + [...j.req.text].length, 0);
  console.log(`판 ${versions.join(',')} · 줄 ${jobs.length} · 글자 ${chars} · 새로 굽기 ${todo.length}줄 ${todoChars}자(≈${todoChars}크레딧)`);
  if (process.argv.includes('--list')) return;

  if (todo.length) {
    const key = (fs.readFileSync(KEY_FILE, 'utf8').split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '');
    if (key.length < 10) throw Error('키 파일이 비어 있음');
    const api = async (route, method = 'GET', body) => {
      for (let attempt = 0; ; attempt += 1) {
        const r = await fetch('https://api.typecast.ai' + route, { method, headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(180000) });
        if ((r.status === 429 || r.status >= 500) && attempt < 4) { await new Promise((ok) => setTimeout(ok, 2000 * (attempt + 1))); continue; }
        if (!r.ok) throw Error('Typecast HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
        return r.json();
      }
    };
    const left = (s) => s.credits.plan_credits - s.credits.used_credits;
    const before = await api('/v1/users/me/subscription');
    if (left(before) < todoChars + 2000) throw Error('월 제공 크레딧이 부족함');
    fs.mkdirSync(RAW, { recursive: true });
    for (const j of todo) {
      const data = await api('/v1/text-to-speech/with-timestamps', 'POST', j.req);
      const bytes = Buffer.from(data.audio || '', 'base64');
      if (bytes.length < 1000) throw Error('빈 음성: ' + j.l.id);
      fs.writeFileSync(path.join(RAW, hash(j.req) + '.wav'), bytes);
      process.stdout.write('.');
    }
    const after = await api('/v1/users/me/subscription');
    console.log(`\n크레딧: 이번 ${before.credits.used_credits === after.credits.used_credits ? '(반영 지연)' : after.credits.used_credits - before.credits.used_credits} · 남은 ${left(after)} / ${after.credits.plan_credits}`);
  }

  // 후처리: 앞뒤 무음 걷기 → public/vo/<판>/<줄>.wav, 길이 기록
  const manifest = {};
  for (const v of versions) {
    const dir = path.join(HERE, 'public', 'vo', v);
    fs.rmSync(dir, { recursive: true, force: true }); // 뺀 줄의 옛 파일이 남지 않게
    fs.mkdirSync(dir, { recursive: true });
    manifest[v] = [];
    for (const l of script.versions[v].lines) {
      const raw = path.join(RAW, hash(request(l, v)) + '.wav');
      const out = path.join(dir, l.id + '.wav');
      // speed: 음높이는 그대로 두고 빠르기만(atempo). 요청에 들지 않아 다시 사지 않는다.
      const tempo = l.speed && l.speed !== 1 ? `atempo=${l.speed},` : '';
      // cut: 받아쓰기로 잰 말끝 + 여유에서 자르고 0.06초 페이드(10-17 v4) — 숨·여운 꼬리가 다음 줄과 겹치지 않게
      const cut = l.cut ? `,atrim=end=${l.cut},afade=t=out:st=${Math.max(0, l.cut - 0.06).toFixed(3)}:d=0.06` : '';
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af',
        tempo + 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse' + cut,
        '-ac', '1', '-ar', '48000', out]);
      manifest[v].push({ id: l.id, at: l.at, dur: +dur(out).toFixed(3), text: l.text, src: `vo/${v}/${l.id}.wav` });
    }
  }
  // 겹침·넘침 점검: 다음 줄 시작 전에 끝나는지, 장면 끝을 넘지 않는지
  for (const [v, list] of Object.entries(manifest)) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i], b = list[i + 1];
      const end = a.at + a.dur - 0.05; // 끝 0.05초는 여운
      if (b && end > b.at - 0.03) console.log(`⚠ ${v} ${a.id} ${end.toFixed(2)}초에 끝남 → 다음 ${b.id} ${b.at}초와 겹침`);
      const limit = (script.limits || []).find((x) => a.at >= x.from && a.at < x.to);
      if (limit && end > limit.to) console.log(`⚠ ${v} ${a.id} ${end.toFixed(2)}초에 끝남 → 구간 끝 ${limit.to}초 넘음`);
    }
  }
  const prev = fs.existsSync(OUT_TS) ? fs.readFileSync(OUT_TS, 'utf8') : '';
  const old = (prev.match(/export const VO = (\{[\s\S]*\}) as const;/) || [])[1];
  const merged = { ...(old ? JSON.parse(old) : {}), ...manifest };
  fs.writeFileSync(OUT_TS, `// 나레이션.cjs가 만든다(손으로 고치지 않음). 줄마다 시작 초·길이.\nexport const VO = ${JSON.stringify(merged, null, 1)} as const;\nexport type VoVersion = keyof typeof VO;\n`);
  for (const [v, list] of Object.entries(manifest)) console.log(v, list.map((x) => `${x.id}@${x.at}+${x.dur}`).join(' '));
}
main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
