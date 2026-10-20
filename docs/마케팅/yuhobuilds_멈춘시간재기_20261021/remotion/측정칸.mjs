// 화면 띠에 칠할 0.5초 칸 값을 tools/정지구간.js와 같은 셈으로 뽑아 src/p2/bins.generated.ts로 쓴다: node 측정칸.mjs  (remotion 폴더에서)
// 칸 값 = 그 0.5초 안 프레임끼리 밝기 차이(tblend difference → signalstats YAVG, 270px 폭) 평균. 0.15 아래면 「거의 멈춤」.
// 도구는 1.5초 넘는 구간만 내보내서, 띠에 쓸 칸마다의 값은 여기서 같은 필터로 다시 잰다.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..', '..');
const FOOD = 'docs/마케팅/synkbrief_AI음식사진_20261020';
const FILES = {
  before: `${FOOD}/remotion/out/food-a-v3-phone.mp4`, // 고치기 전(v3 휴대폰판)
  after: `${FOOD}/게시/food-a_upload.mp4`, // 고친 뒤(v4 공개 올림판)
};

const bins = (file) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '측정칸-'));
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path.join(REPO, file), '-vf', 'scale=270:-1,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=diff.txt', '-an', '-f', 'null', '-'], { cwd: dir, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error('ffmpeg 실패 ' + file);
  const m = new Map();
  let t = null;
  for (const line of fs.readFileSync(path.join(dir, 'diff.txt'), 'utf8').split('\n')) {
    const a = line.match(/pts_time:([\d.]+)/);
    if (a) t = Number(a[1]);
    const v = line.match(/YAVG=([\d.]+)/);
    if (v && t != null) {
      const b = Math.floor(t * 2) / 2;
      if (!m.has(b)) m.set(b, []);
      m.get(b).push(Number(v[1]));
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return [...m.keys()].sort((a, b) => a - b).map((k) => +(m.get(k).reduce((x, y) => x + y, 0) / m.get(k).length).toFixed(3));
};

const out = {};
for (const [k, f] of Object.entries(FILES)) {
  const v = bins(f);
  const still = v.filter((x) => x < 0.15).length * 0.5;
  out[k] = { file: f, values: v, still, length: v.length * 0.5 };
  console.log(`${k}: 칸 ${v.length}개 · 거의 멈춤 ${still}초 / ${v.length * 0.5}초`);
}

// 판 안 터미널에 찍을 실제 출력: 도구를 그대로 돌린다. 파일 이름은 보는 사람용으로 중립 이름 사본을 만들어 돌린다(내부 판 번호가 화면에 안 나오게).
const NAMES = { before: '음식사진편_고치기전.mp4', after: '음식사진편_고친뒤.mp4' };
const term = {};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '정지출력-'));
for (const [k, f] of Object.entries(FILES)) {
  const copy = path.join(tmp, NAMES[k]);
  fs.copyFileSync(path.join(REPO, f), copy);
  const r = spawnSync('node', [path.join(REPO, 'tools', '정지구간.js'), copy], { encoding: 'utf8', windowsHide: true });
  term[k] = { cmd: `node tools/정지구간.js ${NAMES[k]}`, lines: r.stdout.trimEnd().split('\n') };
  console.log(term[k].lines.join('\n'));
}
fs.rmSync(tmp, { recursive: true, force: true });

// b3 목소리 줄의 크기(30fps, 프레임마다 RMS dB): 화면이 멈춘 동안 목소리만 흐르는 띠에 쓴다.
const env = (() => {
  const wav = path.join(HERE, '..', '음성', '범수', 'b3.wav');
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'asetnsamples=1600,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-', '-f', 'null', '-'], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  return [...r.stdout.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === '-inf' ? -90 : Math.round(Number(m[1]) * 10) / 10));
})();
console.log(`b3 목소리 크기 ${env.length}프레임`);

fs.writeFileSync(path.join(HERE, 'src', 'p2', 'bins.generated.ts'), `// node 측정칸.mjs가 만든 파일. 고치지 말고 다시 만든다.\nexport const BINS = ${JSON.stringify(out)} as const;\nexport const TERM = ${JSON.stringify(term)} as const;\nexport const VOICE_ENV: readonly number[] = ${JSON.stringify(env)};\n`);
