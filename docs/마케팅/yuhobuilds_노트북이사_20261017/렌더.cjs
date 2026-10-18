// 두 훅 판을 렌더한다. A(인스타) = 지금 index.html 그대로, C(유튜브) = 목소리를 take_C.wav로 바꿔 끼우고 --variables hook=C.
// 소리는 렌더가 적힌 src를 읽으므로(variables-and-media: 미디어 src는 변수로 바꾸면 소리에 안 들어간다) C는 파일을 잠깐 바꿨다가 되돌린다.
// 실행(이 폴더에서): node 렌더.cjs [A|C|AC] [--quality draft|standard|delivery]
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const VER = '0.8.167';
const which = (process.argv[2] || 'AC').toUpperCase();
const qi = process.argv.indexOf('--quality');
const quality = qi > 0 ? process.argv[qi + 1] : 'delivery';
const here = __dirname;
const html = path.join(here, 'index.html');
const OUT = {
  A: `renders/yuhobuilds_노트북이사_A_인스타${quality === 'delivery' ? '' : '_' + quality}.mp4`,
  C: `renders/yuhobuilds_노트북이사_C_유튜브${quality === 'delivery' ? '' : '_' + quality}.mp4`,
};
fs.mkdirSync(path.join(here, 'renders'), { recursive: true });

function render(out, vars) {
  const args = ['--yes', `hyperframes@${VER}`, 'render', '--quality', quality, '--output', out];
  // Windows에서 npx는 셸을 거쳐 JSON 따옴표가 빠진다(10-17 C 렌더 실패) → 변수는 파일로 넘긴다
  if (vars) {
    const vf = path.join(here, '.hyperframes', 'render-variables.json');
    fs.mkdirSync(path.dirname(vf), { recursive: true });
    fs.writeFileSync(vf, JSON.stringify(vars));
    args.push('--variables-file', vf, '--strict-variables');
  }
  const r = spawnSync('npx', args, { cwd: here, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error('렌더 실패: ' + out);
}

if (which.includes('A')) render(OUT.A);
if (which.includes('C')) {
  const orig = fs.readFileSync(html);
  // 훅 C: 크레용 링이 없으니 키 소리(fx-ring)는 「통째로」(h1c 낱말 6)로 옮긴다 — 그 자리에서 형광펜·펀치가 같이 일어난다
  const vo = JSON.parse(fs.readFileSync(path.join(here, '음성', 'timing.js'), 'utf8').replace(/^[\s\S]*?window\.VO = /, '').replace(/;\s*$/, ''));
  const ringAt = vo.variants.h1c.tokens[6];
  let swapped = orig.toString('utf8').replace('src="음성/take/take.wav"', 'src="음성/take/take_C.wav"');
  swapped = swapped.replace(/(<audio id="fx-ring"[^>]*\sdata-start=")[0-9.]+(")/, `$1${ringAt}$2`);
  if (!swapped.includes('take_C.wav') || !swapped.includes(`data-start="${ringAt}"`)) throw new Error('목소리 src나 fx-ring을 못 찾음');
  try {
    fs.writeFileSync(html, swapped);
    render(OUT.C, { hook: 'C' });
  } finally {
    fs.writeFileSync(html, orig);   // 바이트 그대로 되돌린다
  }
}
console.log('끝:', which.split('').filter((k) => OUT[k]).map((k) => OUT[k]).join(', '));
