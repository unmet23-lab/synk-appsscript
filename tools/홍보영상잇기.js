#!/usr/bin/env node
/* 구운 컷들을 한 편으로 잇는다 — «조각» 단위로 짧게 끊고, 강조만 길게 둔다.
 *
 * ■ 왜 컷을 통째로 안 쓰나 (유호 09-05 「너무 길다 · 컷마다 강조할 부분 말고는 3초 이내에 전환」)
 *   한 컷이 8초짜리라 통째로 이으면 한 장면에 오래 머물러 늘어진다. 그래서 컷 하나에서
 *   «좋은 구간»만 2~3초씩 떼어 쓴다. 같은 컷의 앞과 뒤는 카메라가 움직인 만큼 다른 그림이라,
 *   **컷을 더 굽지 않고도**(한 컷 ₩4,646) 조각 수를 두 배로 늘릴 수 있다.
 *
 * ■ 조각을 고른 근거 (09-05 프레임 실측)
 *   · 컷1(아침)  = 카메라가 앞으로 간다. **뒤쪽**이 좋다(노트·펜이 가까워진다).
 *   · 컷3(손길)  = 도중에 손이 들어온다. **앞쪽**이 깔끔하고, 뒤쪽은 「손으로 만든다」가 보인다.
 *   · 컷2(마스코트) = 강조. 혼자 5초를 갖고, 끝에 짧게 한 번 더 나온다(수미상관).
 *   · 컷4(여백)  = 마무리라 마지막 조각만 길게 둔다.
 *
 * ■ 쓰기
 *   node tools/홍보영상잇기.js                 — 결1(피아노)로 잇는다
 *   node tools/홍보영상잇기.js --음악 2         — 결2(현악)로
 *   node tools/홍보영상잇기.js --음악 없음      — 음악 없이 그림만
 *   node tools/홍보영상잇기.js --표             — 0원. 조각표와 길이만 보여준다
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 방 = path.join(뿌리, '영상', 'out', '홍보_4K');
const 음악방 = path.join(방, '음악');

const 컷파일 = { 1: '컷1_아침.mp4', 2: '컷2_마스코트.mp4', 3: '컷3_손길.mp4', 4: '컷4_여백.mp4' };

/* ══════════ 조각표 ══════════
 * 강조(마스코트)만 3초를 넘고 나머지는 전부 3초 이내다.
 * 🔑 컷2 는 «앞 1.2초»부터 쓴다 — 정사각 정본 그림을 16:9 첫 프레임으로 넣은 검은 띠를 피한다. */
const 조각들 = [
  { 컷: 1, 시작: 0.4, 길이: 2.2, 왜: '빛과 여백으로 연다' },
  { 컷: 3, 시작: 0.2, 길이: 2.4, 왜: '펠트 재료 — 손이 들어오기 전' },
  { 컷: 1, 시작: 4.6, 길이: 2.8, 왜: '노트가 가까워진다' },
  { 컷: 2, 시작: 1.4, 길이: 5.0, 왜: '★강조 — 마스코트', 강조: true },
  { 컷: 3, 시작: 4.4, 길이: 2.4, 왜: '손길이 닿는다' },
  { 컷: 4, 시작: 3.4, 길이: 2.4, 왜: '공간이 열린다 — 앞쪽은 어두운 벽이 가려서 버린다' },
  { 컷: 2, 시작: 6.2, 길이: 1.8, 왜: '마스코트 한 번 더' },
  { 컷: 4, 시작: 5.4, 길이: 2.6, 왜: '창과 여백으로 닫는다(로고 자리)' },
];
const 디졸브 = 0.35;   // 짧게 — 전환이 빨라야 늘어지지 않는다

const 음악들 = { 1: '결1_피아노.wav', 2: '결2_현악.wav', 3: '결3_피아노와공기.wav' };

(async () => {
  const 인자 = process.argv.slice(2);
  const 음악픽 = 인자.includes('--음악') ? 인자[인자.indexOf('--음악') + 1] : '1';
  const 음악파일 = 음악픽 === '없음' ? null : path.join(음악방, 음악들[음악픽] || 음악들['1']);

  /* 없는 컷의 조각은 조용히 빼면 「짧아진 까닭」이 사라진다 — 무엇을 뺐는지 말한다. */
  const 쓸것 = [];
  const 뺀것 = [];
  for (const 조 of 조각들) {
    if (fs.existsSync(path.join(방, 컷파일[조.컷]))) 쓸것.push(조); else 뺀것.push(조);
  }
  if (뺀것.length) {
    console.log(`🟠 아직 안 구워진 컷의 조각 ${뺀것.length}개를 뺀다: ${[...new Set(뺀것.map((r) => `컷${r.컷}`))].join(' · ')}`);
  }
  if (쓸것.length < 2) { console.log('🔴 이을 조각이 둘도 안 된다.'); process.exit(1); }

  const 총길이 = 쓸것.reduce((a, r) => a + r.길이, 0) - 디졸브 * (쓸것.length - 1);
  console.log(`■ 조각 ${쓸것.length}개 · 디졸브 ${디졸브}초 · 완성 ${총길이.toFixed(1)}초`);
  쓸것.forEach((조, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. 컷${조.컷} ${조.시작}s부터 ${조.길이}s${조.강조 ? ' ★' : ''}  ${조.왜}`);
  });
  if (인자.includes('--표')) return;

  /* 같은 컷을 여러 조각이 쓰므로 파일은 «한 번만» 입력하고 조각마다 trim 한다. */
  const 쓰는컷 = [...new Set(쓸것.map((r) => r.컷))];
  const 칸 = new Map(쓰는컷.map((c, i) => [c, i]));
  const 입력 = [];
  for (const c of 쓰는컷) 입력.push('-i', path.join(방, 컷파일[c]));

  const 조각필터 = 쓸것.map((조, i) => `[${칸.get(조.컷)}:v]trim=start=${조.시작}:duration=${조.길이},`
    + `setpts=PTS-STARTPTS,format=yuv420p[p${i}]`);

  /* xfade 의 offset 은 «이어 붙인 결과» 위의 시각이다 — 겹친 만큼 누적에서 뺀다. */
  const 전환 = [];
  let 누적 = 쓸것[0].길이;
  let 앞 = '[p0]';
  for (let i = 1; i < 쓸것.length; i++) {
    const 나감 = (i === 쓸것.length - 1) ? '[vout]' : `[x${i}]`;
    전환.push(`${앞}[p${i}]xfade=transition=fade:duration=${디졸브}:offset=${(누적 - 디졸브).toFixed(3)}${나감}`);
    누적 += 쓸것[i].길이 - 디졸브;
    앞 = `[x${i}]`;
  }

  const 필터 = [...조각필터, ...전환];
  const 낼것 = path.join(방, 'SYNK_홍보_4K.mp4');
  const 명령 = ['-y', '-loglevel', 'error', '-stats', ...입력];

  if (음악파일 && fs.existsSync(음악파일)) {
    명령.push('-i', 음악파일);
    필터.push(`[${쓰는컷.length}:a]atrim=0:${총길이.toFixed(3)},asetpts=PTS-STARTPTS,`
      + `afade=t=in:st=0:d=1.5,afade=t=out:st=${Math.max(0, 총길이 - 3).toFixed(3)}:d=3[aout]`);
    명령.push('-filter_complex', 필터.join(';'), '-map', '[vout]', '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
    console.log(`  음악 = ${path.basename(음악파일)}`);
  } else {
    명령.push('-filter_complex', 필터.join(';'), '-map', '[vout]');
    console.log('  음악 없음');
  }
  명령.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', 낼것);

  console.log('  잇는 중… (4K 라 몇 분 걸린다)');
  execFileSync('ffmpeg', 명령, { stdio: ['ignore', 'inherit', 'inherit'] });
  const mb = (fs.statSync(낼것).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ ${낼것}  (${mb} MB · ${총길이.toFixed(1)}초 · 3840×2160)`);
})();
