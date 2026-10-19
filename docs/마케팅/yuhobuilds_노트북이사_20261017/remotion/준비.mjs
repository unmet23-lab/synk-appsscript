// Remotion 판의 재료를 public/과 src/data.json으로 모은다. 원본은 이 편 폴더(../)에 있고, public/ 사본은 git 밖이다.
// 실행(remotion 폴더에서): node 준비.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ep = path.join(here, '..');
const repo = path.join(ep, '..', '..', '..');
const kit = path.join(repo, 'docs', '디자인', 'SNS키트', 'assets');
const sib = path.join(repo, 'docs', '마케팅', 'synkbrief_AI구독계정판_20261017', 'remotion', 'public');

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};
const pub = (p) => path.join(here, 'public', p);

// 서체: 같은 날 synkbrief 판과 같은 파일(SUIT·Inter Tight·DM Mono)
for (const f of ['SUIT-Variable.woff2', 'InterTight-Medium.ttf', 'InterTight-SemiBold.ttf', 'InterTight-Bold.ttf', 'DMMono-Medium.ttf']) copy(path.join(sib, 'fonts', f), pub('fonts/' + f));
// 키트: 펠트 결·버터 실땀·흰 펠트 로고
for (const f of ['field-grain.webp', 'thread-butter-soft.webp', 'thread-butter.webp', 'logo-synk-paper.webp']) copy(path.join(kit, f), pub('kit/' + f));
// 효과음: synkbrief 판의 짧은 키트 소리 + 지난 편 소리
for (const f of fs.readdirSync(path.join(sib, 'sfx'))) copy(path.join(sib, 'sfx', f), pub('sfx/' + f));
for (const f of fs.readdirSync(path.join(ep, 'assets', 'media', 'sound'))) if (!f.endsWith('.md')) copy(path.join(ep, 'assets', 'media', 'sound', f), pub('sfx/' + f));
// 그림·캡처·얼굴
copy(path.join(ep, 'assets', 'media', 'gen', 'laptops.webp'), pub('media/laptops.webp'));
copy(path.join(ep, 'assets', 'media', 'face', 'yuho_model_cut.webp'), pub('media/yuho_model_cut.webp'));
for (const f of fs.readdirSync(path.join(ep, 'assets', 'media', 'tool'))) if (f.endsWith('.webp')) copy(path.join(ep, 'assets', 'media', 'tool', f), pub('media/' + f));
// 목소리(훅 A·C)
copy(path.join(ep, '음성', 'take', 'take.wav'), pub('voice/take.wav'));
copy(path.join(ep, '음성', 'take', 'take_C.wav'), pub('voice/take_C.wav'));

// 시각·로그·결과
const read = (p, name) => {
  const src = fs.readFileSync(p, 'utf8');
  const body = src.slice(src.indexOf(name) + name.length).replace(/^\s*=\s*/, '').replace(/;\s*$/, '');
  return JSON.parse(body);
};
const VO = read(path.join(ep, '음성', 'timing.js'), 'window.VO');
const LOG = read(path.join(ep, 'assets', 'media', 'log', 'log-lines.js'), 'window.LOG_LINES');
const RES = read(path.join(ep, 'assets', 'media', 'tool', 'tool-results.js'), 'window.TOOL_RESULTS');
// 목소리 파일은 0.25초에 놓였다(음성/넣기.cjs FIRST 0.3 − 테이크 첫 말소리 0.05)
const VOICE_AT = Number((fs.readFileSync(path.join(ep, 'index.html'), 'utf8').match(/id="vo-take" src="[^"]+" data-start="([0-9.]+)"/) || [])[1]);
if (!Number.isFinite(VOICE_AT)) throw new Error('index.html에서 목소리 시작 시각을 못 찾음');
fs.writeFileSync(path.join(here, 'src', 'data.json'), JSON.stringify({ VO, LOG, RES, VOICE_AT }, null, 1));
console.log(`data.json: 대사 ${Object.keys(VO.segs).length} · 전체 ${VO.total}초 · 목소리 ${VOICE_AT}초 · 로그 ${LOG.length}줄 · 결과 ${RES.people.length}명`);
