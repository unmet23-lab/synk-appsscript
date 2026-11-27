'use strict';
// ㉔ 바탕 잡음(2026-11-27 유호님 「화이트노이즈 소리랑 … 마지막에 이해가 잘 안가」 → 「응, 고쳐」 · 「이 실수들이 다음 lab 작업들에 다 잘 적용되서 알아서 만들어주는거지?」)
// LAB E64 「서비스」는 v5부터 분식집 바탕으로 sfx/bunsik.wav를 깔았는데, 실제 식당 녹음이 아니라 고르게 쉬익거리는 합성 잡음이었다.
// 음량 · 무음 · 음악층 검사는 다 통과했고, 말이 없는 끝 5초에 화이트노이즈만 남아 들렸다. 같은 꼴의 바탕(room · street · cafe · air · sizzle)이
// 다른 편에도 있었다. 섞인 최종본의 소리를 1초 칸으로 재어(tools/바탕잡음.py) 잡음처럼 평탄한 칸이 많으면 막는다.
// 문턱(11-27 실측): 잡음 바탕을 깐 최종본 잡음초비율 0.21~0.59 · 가운데 평탄도 0.20~0.32, 음악 · 말만 있거나 바탕이 아주 작은 LAB 최종본 18편 0.12 이하 · 0.18 이하.
// 등급: LAB 편 가운데 편 폴더 날짜가 FIX_FROM부터인 편은 고칠 것, 그 앞 LAB 편과 synkbrief · yuhobuilds는 확인할 것.
//   일부러 둔 잡음(빗소리 장면 같은)은 준비.json 「바탕소리판단」: "까닭" — 고칠 것이 확인할 것으로 내려간다. 못 재면 확인할 것 한 줄.
// 고치는 법: 편 코드(remotion/src)에서 그 바탕 소리를 빼거나 실제 녹음으로 바꾼다. 같은 판정의 긴 바탕 파일(8초 넘게 · 평탄도 0.28 넘게 · 흔들림 3dB 아래)을 이름으로 짚어 준다.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { FIX, LOOK } = require('./게시글규칙.js');

const FIX_FROM = '20261127';
const BRANDS = new Set(['LAB', 'synkbrief', 'yuhobuilds']);
const 문턱 = Object.freeze({ 잡음초비율: 0.2, 가운데: 0.2, 바탕길이: 8, 바탕평탄도: 0.28, 바탕흔들림: 3 });
const SCRIPT = path.join(__dirname, '..', '바탕잡음.py');

const 편날짜 = (name) => (String(name).match(/_(\d{8})$/) || [])[1] || null;
const 브랜드 = (bundle) => (bundle.prep && bundle.prep.브랜드) || (String(bundle.name).match(/^(LAB|synkbrief|yuhobuilds)_/) || [])[1] || null;

function runTool(files) {
  const py = process.env.SYNK_PYTHON || 'python';
  const r = spawnSync(py, ['-X', 'utf8', SCRIPT, ...files], { encoding: 'utf8', windowsHide: true, timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(String(r.stderr || r.error || `종료 ${r.status}`).trim().split('\n').pop().slice(0, 200));
  return JSON.parse(r.stdout);
}

// 편 폴더의 바탕 후보 — remotion/public 아래 소리 파일(목소리 vo · 음악 bgm은 뺌)
function 바탕후보(dir) {
  const root = path.join(dir, 'remotion', 'public');
  const out = [];
  const walk = (d) => {
    let names = [];
    try { names = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!/^(vo|node_modules)$/i.test(e.name)) walk(p); continue; }
      if (/\.(wav|mp3|m4a|ogg|flac)$/i.test(e.name) && !/^bgm/i.test(e.name)) out.push(p);
    }
  };
  walk(root);
  return out;
}

const 잡음섞임 = (m) => m && !m.못잼 && (m.잡음초비율 >= 문턱.잡음초비율 || m.평탄도 >= 문턱.가운데);
const 잡음바탕 = (m) => m && !m.못잼 && m.길이 >= 문턱.바탕길이 && m.평탄도 >= 문턱.바탕평탄도 && m.흔들림dB < 문턱.바탕흔들림;

function bedNoiseFindings(bundle, videoFiles, { run = runTool } = {}) {
  const findings = [];
  const brand = 브랜드(bundle);
  if (!BRANDS.has(brand)) return findings;
  const videos = [...new Set(videoFiles)].filter((f) => fs.existsSync(f));
  if (!videos.length) return findings;
  const prep = bundle.prep || {};
  const why = typeof prep.바탕소리판단 === 'string' && prep.바탕소리판단.trim() ? prep.바탕소리판단.trim() : '';
  const hard = brand === 'LAB' && (편날짜(bundle.name) || '') >= FIX_FROM && !why;
  const beds = 바탕후보(bundle.dir);
  let 잰 = [];
  try { 잰 = run([...videos, ...beds]); } catch (error) {
    return [{ level: LOOK, code: 'bed-noise-failed', where: '바탕 소리', message: `바탕 잡음을 못 쟀다(${String(error && error.message).slice(0, 200)}) — python -X utf8 tools/바탕잡음.py <영상>으로 직접 재거나 말 없는 자리를 귀로 듣는다` }];
  }
  const byFile = new Map(잰.map((m) => [path.resolve(m.파일), m]));
  const 바탕들 = beds.map((f) => byFile.get(path.resolve(f))).filter(잡음바탕).map((m) => path.relative(bundle.dir, m.파일).split(path.sep).join('/'));
  for (const file of videos) {
    const m = byFile.get(path.resolve(file));
    const where = `바탕 소리 ${path.basename(path.dirname(file))}/${path.basename(file)}`;
    if (!m || m.못잼) { findings.push({ level: LOOK, code: 'bed-noise-failed', where, message: `바탕 잡음을 못 쟀다(${(m && m.못잼) || '결과 없음'}) — 말 없는 자리를 귀로 듣는다` }); continue; }
    if (!잡음섞임(m)) continue;
    const 짚음 = 바탕들.length ? ` 잡음 같은 긴 바탕 파일: ${바탕들.join(' · ')}.` : '';
    const 꼬리 = why ? ` · 「바탕소리판단」: ${why}` : (hard ? ' — 일부러 둔 소리면 준비.json 「바탕소리판단」에 까닭' : '');
    findings.push({
      level: hard ? FIX : LOOK, code: 'bed-noise', where,
      message: `섞인 소리 ${m.초수}초 가운데 ${Math.round(m.잡음초비율 * 100)}%가 고르게 쉬익거리는 잡음 같다(가운데 평탄도 ${m.평탄도}) — 말 없는 자리에서 화이트노이즈로 들린다(11-27 유호님 E64).${짚음} 편 코드에서 그 바탕을 빼거나 실제 녹음으로 바꾼다${꼬리}`,
    });
  }
  return findings;
}

module.exports = { bedNoiseFindings, 바탕후보, 잡음섞임, 잡음바탕, FIX_FROM, 문턱 };
