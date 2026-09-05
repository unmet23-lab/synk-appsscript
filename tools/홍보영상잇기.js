#!/usr/bin/env node
/* 구운 컷들을 한 편으로 잇는다 — 디졸브 전환 + 음악 한 벌 + 4K 유지.
 *
 * ■ 왜 이 모양인가
 *   · 컷 사이를 «툭» 끊으면 그 자리가 그대로 싸구려 신호다. 느린 디졸브로 넘긴다.
 *   · 컷2(마스코트)는 앞 1초에 검은 띠가 있다 — 정사각 정본 그림을 16:9 에 첫 프레임으로
 *     넣어서 생긴 것이라, 그 구간을 잘라낸다(다시 굽는 값 ₩4,646 을 안 낸다).
 *   · 음악은 처음 2초 동안 서서히 들어오고 끝 3초 동안 서서히 빠진다.
 *
 * ■ 쓰기
 *   node tools/홍보영상잇기.js                 — 결1(피아노)로 잇는다
 *   node tools/홍보영상잇기.js --음악 2         — 결2(현악)로
 *   node tools/홍보영상잇기.js --음악 없음      — 음악 없이 그림만
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 뿌리 = path.join(__dirname, '..');
const 방 = path.join(뿌리, '영상', 'out', '홍보_4K');
const 음악방 = path.join(방, '음악');

/* 컷 순서와 «앞을 얼마나 자를지». 자르는 까닭은 컷마다 다르니 그 자리에 적어 둔다. */
const 차례 = [
  { 파일: '컷1_아침.mp4', 앞자름: 0 },
  { 파일: '컷2_마스코트.mp4', 앞자름: 1.0 },   // 첫 1초에 검은 띠 — 정사각 정본을 16:9 에 넣은 자국
  { 파일: '컷3_손길.mp4', 앞자름: 0 },
  { 파일: '컷4_여백.mp4', 앞자름: 0 },
];
const 디졸브 = 0.8;   // 초. 느릴수록 차분하다

const 음악들 = { 1: '결1_피아노.wav', 2: '결2_현악.wav', 3: '결3_피아노와공기.wav' };

function 길이(파일) {
  const s = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', 파일]).toString().trim();
  return Number(s);
}

(async () => {
  const 인자 = process.argv.slice(2);
  const 음악픽 = 인자.includes('--음악') ? 인자[인자.indexOf('--음악') + 1] : '1';
  const 음악파일 = 음악픽 === '없음' ? null : path.join(음악방, 음악들[음악픽] || 음악들['1']);

  const 있는것 = 차례.filter((c) => fs.existsSync(path.join(방, c.파일)));
  if (있는것.length < 2) { console.log(`🔴 이을 컷이 ${있는것.length}개뿐이다 — 더 굽고 다시 부른다.`); process.exit(1); }
  if (있는것.length < 차례.length) {
    console.log(`🟠 ${차례.length}컷 중 ${있는것.length}컷만 있다 — 있는 것으로 잇는다: ${있는것.map((c) => c.파일).join(' · ')}`);
  }

  /* ffmpeg 필터를 짓는다.
   * 각 컷: 앞을 잘라내고(trim) 시간을 0 으로 되돌린다(setpts). 그 뒤 xfade 로 차례차례 겹친다. */
  const 입력 = [];
  const 조각 = [];
  let 누적 = 0;               // xfade 의 offset 은 «이어 붙인 결과» 위의 시각이다
  const 전환들 = [];

  있는것.forEach((c, i) => {
    입력.push('-i', path.join(방, c.파일));
    const 원 = 길이(path.join(방, c.파일));
    const 쓸길이 = 원 - c.앞자름;
    조각.push(`[${i}:v]trim=start=${c.앞자름},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`);
    if (i === 0) { 누적 = 쓸길이; }
    else { 전환들.push({ i, offset: 누적 - 디졸브 }); 누적 += 쓸길이 - 디졸브; }
  });

  let 앞 = '[v0]';
  전환들.forEach((t, n) => {
    const 나감 = (n === 전환들.length - 1) ? '[vout]' : `[x${n}]`;
    조각.push(`${앞}[v${t.i}]xfade=transition=fade:duration=${디졸브}:offset=${t.offset.toFixed(3)}${나감}`);
    앞 = `[x${n}]`;
  });

  const 총길이 = 누적;
  console.log(`■ ${있는것.length}컷 · 디졸브 ${디졸브}초 · 완성 길이 ${총길이.toFixed(1)}초`);

  const 낼것 = path.join(방, 'SYNK_홍보_4K.mp4');
  const 명령 = ['-y', '-loglevel', 'error', '-stats', ...입력];

  if (음악파일 && fs.existsSync(음악파일)) {
    입력.push();
    명령.push('-i', 음악파일);
    const 음악칸 = 있는것.length;
    // 음악: 2초 동안 들어오고 끝 3초 동안 빠진다. 영상보다 길면 잘라낸다.
    조각.push(`[${음악칸}:a]atrim=0:${총길이.toFixed(3)},asetpts=PTS-STARTPTS,`
      + `afade=t=in:st=0:d=2,afade=t=out:st=${(총길이 - 3).toFixed(3)}:d=3[aout]`);
    명령.push('-filter_complex', 조각.join(';'), '-map', '[vout]', '-map', '[aout]',
      '-c:a', 'aac', '-b:a', '192k');
    console.log(`  음악 = ${path.basename(음악파일)}`);
  } else {
    명령.push('-filter_complex', 조각.join(';'), '-map', '[vout]');
    console.log('  음악 없음');
  }

  명령.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', 낼것);

  console.log('  굽는 중… (4K 라 몇 분 걸린다)');
  execFileSync('ffmpeg', 명령, { stdio: ['ignore', 'inherit', 'inherit'] });
  const mb = (fs.statSync(낼것).size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ ${낼것}  (${mb} MB · ${총길이.toFixed(1)}초 · 3840×2160)`);
})();
