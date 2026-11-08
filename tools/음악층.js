#!/usr/bin/env node
'use strict';
/**
 * 음악층 — 편의 Remotion 사본에서 전체 소리와 음악만(음악 파일 말고 모든 소리를 같은 길이 · 같은 꼴 무음으로 바꿔)을 각각
 * 소리만 렌더해, 음악이 꺼지거나 얇아지는 자리와 음악 바닥을 잰다 → 올리기 전 검사 ⑲(판정 tools/lib/음악층관문.js).
 * 11-08 유호님 「백그라운드 뮤직 … 중간중간 좀 빠져있는데 의도한거야?」 — 섞인 소리 음량 · 무음 검사로는 안 잡혔다.
 * 원본 프로젝트는 건드리지 않는다(사본은 %TEMP%\synk-음악층\<편>, 끝나면 지운다 — --남김이면 둔다).
 *
 *   node tools/음악층.js --편 <편 폴더> [--comp <컴포지션 id>] [--남김] [--json]
 *
 * comp를 안 주면 src/Root.tsx의 첫 컴포지션(이름에 scene이 든 것은 뺀다). 결과는 <편>/게시/음악층.json
 * {만든때, comp, 음악, 길이, 음악가운데, 전체가운데, 꺼짐[{시작, 끝, 깊이}], 낮음[{시작, 끝}], 바닥차}. 종료 코드: 꺼짐 있음 1 · 없음 0 · 오류 2.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const 관문 = require('./lib/음악층관문.js');

const 소리 = /\.(wav|mp3|m4a|aac|ogg)$/i;
const 화질줄 = /setX264Preset|setVideoBitrate|setPixelFormat|setColorSpace|setVideoImageFormat|setCrf|setCodec|setJpegQuality/;

function 인자(argv) {
  const o = { 편: null, comp: null, 남김: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--편') o.편 = argv[++i];
    else if (a === '--comp') o.comp = argv[++i];
    else if (a === '--남김') o.남김 = true;
    else if (a === '--json') o.json = true;
    else throw new Error(`모르는 인자: ${a}`);
  }
  if (!o.편) throw new Error('사용: node tools/음악층.js --편 <편 폴더> [--comp <id>] [--남김] [--json]');
  return o;
}

function 첫컴포지션(rootTsx) {
  const ids = [...fs.readFileSync(rootTsx, 'utf8').matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]);
  return ids.find((id) => !/scene/i.test(id)) || ids[0] || null;
}

function 복사(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (['node_modules', 'out', '.git'].includes(e.name)) continue;
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) 복사(a, b); else fs.copyFileSync(a, b);
  }
}

function 소리파일(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...소리파일(p)); else if (소리.test(e.name)) out.push(p);
  }
  return out;
}

// 같은 길이 · 표본율 · 채널의 무음으로 바꾼다 — 길이가 바뀌면 소리 길이로 박자를 잡는 편의 시간표가 어긋난다
function 무음으로(f) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels:format=duration', '-of', 'json', f], { encoding: 'utf8' }));
  const st = (j.streams || [])[0] || {};
  const 길이 = Number(j.format?.duration) || 0.1, sr = Number(st.sample_rate) || 48000, ch = Number(st.channels) || 2;
  const 임시 = `${f}.무음${path.extname(f)}`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `anullsrc=r=${sr}:cl=${ch === 1 ? 'mono' : 'stereo'}`, '-t', String(길이),
    ...(/\.wav$/i.test(f) ? ['-c:a', 'pcm_s16le'] : []), 임시]);
  fs.renameSync(임시, f);
}

// 0.25초 칸마다 RMS dB(16kHz 모노)
function 칸재기(file) {
  const x = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const s = new Int16Array(x.buffer, x.byteOffset, Math.floor(x.length / 2));
  const n = Math.round(16000 * 관문.칸), out = [];
  for (let i = 0; i + n <= s.length; i += n) {
    let a = 0;
    for (let k = i; k < i + n; k++) a += (s[k] / 32768) ** 2;
    out.push(20 * Math.log10(Math.sqrt(a / n) + 1e-9));
  }
  return out;
}

function 렌더(dir, comp, out) {
  const 입구 = ['src/index.ts', 'src/index.tsx'].find((p) => fs.existsSync(path.join(dir, p)));
  if (!입구) throw new Error('src/index.ts가 없다');
  const r = spawnSync(`npx remotion render ${입구} ${comp} "${out}" --codec=wav --log=error`, { cwd: dir, shell: true, encoding: 'utf8', timeout: 20 * 60 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`소리 렌더 실패(${r.status}): ${String(r.stderr || r.stdout).replace(/\u001b\[\d+m/g, '').trim().split('\n').filter((l) => !/^\s*at /.test(l)).slice(-3).join(' / ')}`);
}

function main(argv) {
  const o = 인자(argv);
  const 편 = path.resolve(o.편);
  const 원본 = path.join(편, 'remotion');
  const 음악 = 관문.음악파일(편);
  if (!음악) throw new Error(`음악 파일(remotion/public 아래 bgm.*)이 하나가 아니다 — 음악층 대상이 아니다: ${편}`);
  const comp = o.comp || 첫컴포지션(path.join(원본, 'src', 'Root.tsx'));
  if (!comp) throw new Error('컴포지션 id를 못 찾았다 — --comp로 준다');
  const 사본 = path.join(os.tmpdir(), 'synk-음악층', path.basename(편));
  fs.rmSync(사본, { recursive: true, force: true });
  try {
    복사(원본, 사본);
    fs.symlinkSync(fs.realpathSync(path.join(원본, 'node_modules')), path.join(사본, 'node_modules'), 'junction');
    const 설정 = path.join(사본, 'remotion.config.ts'); // 영상 화질 줄(x264 등)은 소리만 렌더(wav)와 부딪힌다
    if (fs.existsSync(설정)) fs.writeFileSync(설정, fs.readFileSync(설정, 'utf8').split(/\r?\n/).filter((l) => !화질줄.test(l)).join('\n'));
    const 전체wav = path.join(사본, '전체.wav'), 음악wav = path.join(사본, '음악.wav');
    렌더(사본, comp, 전체wav);
    const 음악상대 = path.relative(path.join(원본, 'public'), 음악);
    for (const f of 소리파일(path.join(사본, 'public'))) if (path.relative(path.join(사본, 'public'), f) !== 음악상대) 무음으로(f);
    렌더(사본, comp, 음악wav);
    const 잰것 = 관문.재기(칸재기(음악wav), 칸재기(전체wav));
    const 결과 = { 만든때: new Date().toISOString(), comp, 음악: path.relative(편, 음악).split(path.sep).join('/'), ...잰것 };
    fs.mkdirSync(path.join(편, '게시'), { recursive: true });
    fs.writeFileSync(path.join(편, '게시', '음악층.json'), JSON.stringify(결과, null, 1));
    if (o.json) console.log(JSON.stringify(결과, null, 1));
    else {
      const 초 = (z) => `${z.시작.toFixed(2)}~${z.끝.toFixed(2)}초`;
      console.log(`음악층 ${path.basename(편)} · ${comp}: 음악 가운데 ${결과.음악가운데}dB · 전체 ${결과.전체가운데}dB(바닥차 ${결과.바닥차}dB)`);
      console.log(`  꺼짐 ${결과.꺼짐.length}${결과.꺼짐.map((z) => ` | ${초(z)} ${z.깊이}dB`).join('')}`);
      console.log(`  얇아짐 ${결과.낮음.length}${결과.낮음.map((z) => ` | ${초(z)}`).join('')}`);
    }
    return 결과.꺼짐.length ? 1 : 0;
  } finally {
    if (!o.남김) fs.rmSync(사본, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 2; }
}

module.exports = { 인자, 첫컴포지션, 칸재기, main };
