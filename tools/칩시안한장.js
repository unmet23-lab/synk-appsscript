#!/usr/bin/env node
'use strict';
/**
 * 분류 칩 — 시안 전량 한 장 (2026-09-03)
 *
 * ══ 왜 한 장인가 ═════════════════════════════════════════════════════════
 *   유호 지시: 「다 나오면 한 장으로 보여줘」. 갈래가 두 종류로 갈려 있어 따로 보면 못 고른다 —
 *   ⓐ **새로 구운 띠**(실땀 위치·맨 펠트)와 ⓑ **이미 구운 것을 다르게 쓰는 안**(밑선·표식·바탕 없음).
 *   같은 글·같은 크기로 한 자리에 놓아야 «어느 쪽이 더 읽히나»가 성립한다.
 *
 * ══ 09-03 에 여기까지 왔다 ═══════════════════════════════════════════════
 *   ① 반복하면 조각이 알약처럼 끊겼다 → 원인은 위아래 모서리 라운드가 창 안에 들어온 것.
 *      몸폭 0.92 → 1.6 으로 넓혀 코너를 프레임 밖으로 보내니 매끈하게 이어졌다.
 *   ② 유호 지적 「공간이 작아서 가시성이 떨어지고 보기 불편하다」 → 실측: 24px 칩에서 띠는 18.5px,
 *      위아래 실땀이 각 ~2px 를 먹어 글자 자리가 14px(글자 12.5px). 여백이 1.5px 뿐이었다.
 *      ⇒ 두 손잡이를 열었다: 실땀을 가장자리로 미는 「땀안쪽=」, 실땀을 아예 빼는 「띠땀=없음」.
 *   ③ 유호 지시 「바탕을 빼고 글씨만 넣는게 나을수도 · 다른 버전으로도 만들어봐줘」
 *      ⇒ 굽지 않고 되는 갈래도 함께 낸다(밑선만·앞 표식·하이라이터·반전).
 *
 * ══ 자 ══════════════════════════════════════════════════════════════════
 *   실제로 앉는 크기(28px)와 3배 확대를 «둘 다» 낸다. 이 판정은 작은 크기에서 갈리는데,
 *   확대 없이는 «왜» 갈리는지 안 보인다(글자가 실땀에 눌리는 것은 확대에서만 드러난다).
 *
 * 통로: node tools/칩시안한장.js [나갈파일.png]
 */

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 띠방 = path.join(루트, 'docs', '캐릭터', '요소공방_0822', '띠_0903');
const 형태방 = path.join(루트, 'docs', '캐릭터', '요소공방_0822', '부품형태');
const 자산길 = path.join(루트, 'docs', 'Loom_자산', '구운재질.json');

const 높이 = 28;      // 유호 09-03 지적 뒤 24 → 28 (글자 여백 확보)
const 글크 = 12.5;

function 크롬() {
  const 후보 = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].filter(fs.existsSync);
  if (!후보.length) throw new Error('크롬을 못 찾았다 — 찍을 자가 없다');
  return 후보[0];
}

/** png → webp data URI. 없으면 null(호출부가 그 안을 빼고 분모에 적는다). */
function uri(파일, 폭 = 300) {
  if (!fs.existsSync(파일)) return null;
  const 임시 = path.join(os.tmpdir(), `칩-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    execFileSync('ffmpeg', ['-y', '-i', 파일, '-vf', `scale=${폭}:-1`, '-quality', '95', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } catch { return null; } finally { try { fs.unlinkSync(임시); } catch { /* */ } }
}

function main() {
  const 나갈곳 = process.argv[2] || path.join(os.tmpdir(), '칩시안.png');
  const 자산 = JSON.parse(fs.readFileSync(자산길, 'utf8'))['부품'];
  const 매듭 = (자산['매듭점'] || {})['몸'] || null;

  const 띠 = {
    옛: uri(path.join(형태방, 'D2_태그중.png')),
    넓힘: uri(path.join(띠방, 'T16_태그중_몸폭1.6.png')),
    땀83: uri(path.join(띠방, 'S08_띠_땀83.png')),
    땀91: uri(path.join(띠방, 'S04_띠_땀91.png')),
    맨: uri(path.join(띠방, 'B0_띠_맨펠트.png')),
  };

  const 안들 = [
    ['A ① 옛 판  ·  몸폭 0.92', '조각이 알약처럼 끊긴다. 여기서 시작했다.',
      띠.옛 && `color:#2B2320;background:url(${띠.옛}) left center/auto 100% repeat-x`],
    ['A ② 넓힘  ·  몸폭 1.6', '이음매가 사라졌다. 다만 실땀이 글자를 조인다(유호 지적).',
      띠.넓힘 && `color:#2B2320;background:url(${띠.넓힘}) left center/auto 100% repeat-x`],
    ['A ③ 실땀을 가장자리로  ·  83%', '땀을 밀어 가운데를 넓혔다.',
      띠.땀83 && `color:#2B2320;background:url(${띠.땀83}) left center/auto 100% repeat-x`],
    ['A ④ 실땀을 더 가장자리로  ·  91%', '더 밀었다. 땀이 경계에 걸리는지 본다.',
      띠.땀91 && `color:#2B2320;background:url(${띠.땀91}) left center/auto 100% repeat-x`],
    ['A ⑤ 맨 펠트 띠  ·  실땀 없음', '바탕은 두고 실땀만 뺐다. 글자가 방해 없이 앉는다.',
      띠.맨 && `color:#2B2320;background:url(${띠.맨}) left center/auto 100% repeat-x`],

    ['B ⑥ 밑선만  ·  띠의 아래 실땀 줄', '띠를 키워 아래 한 줄만 남긴다. 밑줄이 자수가 된다.',
      띠.땀83 && `color:#E4E4E7;background:url(${띠.땀83}) left bottom/auto 340% repeat-x`],
    ['B ⑦ 앞에 자수 표식만', '배경 없이 표식으로 «분류»를 알린다.',
      매듭 && `color:#E4E4E7;padding-left:22px;background:url(${매듭}) left center/13px 13px no-repeat`],
    ['B ⑧ 바탕 없이 글씨만', '가장 읽기 쉽다. 다만 «분류»라는 표시가 사라진다.',
      'color:#E4E4E7;background:none'],
  ].filter((a) => a[2]);

  const 글 = ['펠트', '한국어 학원', '아주 긴 분류 이름도 여기 들어간다'];
  const 칩 = (st, t) => `<span style="display:inline-flex;align-items:center;height:${높이}px;`
    + `padding:0 13px;font-size:${글크}px;font-weight:700;letter-spacing:-.02em;${st}">${t}</span>`;
  const 줄 = (st) => 글.map((t) => 칩(st, t)).join('');

  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0E0F13;color:#E4E4E7;font:15px/1.6 "Malgun Gothic",sans-serif;padding:26px 32px}
h1{font-size:19px;margin:0 0 4px}
p.top{margin:0 0 6px;font-size:12.5px;color:#9CA3AF;max-width:78ch}
p.top b{color:#E4E4E7}
h2{font-size:13.5px;margin:0 0 2px}
p.k{margin:0 0 7px;font-size:11.5px;color:#9CA3AF}
.row{display:flex;gap:13px;align-items:center;flex-wrap:wrap;margin:0 0 5px}
.sec{border-top:1px solid #23252C;margin-top:15px;padding-top:14px}
.gap{border-top:2px solid #3A3D46;margin-top:22px;padding-top:18px}
.zoom{transform:scale(3);transform-origin:left top;height:${높이 * 3 + 10}px;width:34%}
.zl{font-size:11px;color:#6B7280;margin:8px 0 2px}
</style>
<h1>분류 칩 — 시안 여덟</h1>
<p class="top"><b>A 갈래</b>는 새로 구운 띠다(실땀 위치·맨 펠트). <b>B 갈래</b>는 이미 구운 것을 다르게 쓴다.
같은 글·같은 크기(${높이}px)로 한 자리에 놓았다. 아래 확대 줄은 «왜» 갈리는지 보는 창이다 —
글자가 실땀에 눌리는 것은 확대에서만 드러난다.</p>
${안들.map((a, i) => {
    const 새갈래 = a[0].startsWith('B') && !안들[i - 1]?.[0].startsWith('B');
    return `<div class="${새갈래 ? 'gap' : (i ? 'sec' : '')}"><h2>${a[0]}</h2><p class="k">${a[1]}</p>
  <div class="row">${줄(a[2])}</div>
  <div class="zl">3배 확대</div><div class="zoom">${줄(a[2])}</div></div>`;
  }).join('')}`;

  const 임시 = path.join(os.tmpdir(), `칩시안-${process.pid}.html`);
  fs.writeFileSync(임시, html, 'utf8');
  /* 🔴 2026-09-04 — 옛 산출을 먼저 지운다(codex `a4918bf57d0d` · 칩띠대조와 같은 무늬).
   *   `existsSync` 하나로 판정하면 어제 그림이 오늘의 실패를 덮는다. 「없앤 뒤에 생겼나」로 묻는다. */
  try { fs.unlinkSync(나갈곳); } catch { /* 없으면 그만 */ }
  const 창높 = 200 + 안들.length * 250;
  let r;
  try {
    r = spawnSync(크롬(), ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--force-device-scale-factor=2', `--window-size=1400,${창높}`,
      `--screenshot=${나갈곳}`, 'file:///' + 임시.split(path.sep).join('/')], { encoding: 'utf8' });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }
  if (!fs.existsSync(나갈곳)) { console.error('🔴 못 찍었다:', ((r && r.stderr) || '').slice(0, 300)); process.exit(1); }
  console.log(`■ 칩 시안 한 장  ${나갈곳}  (${Math.round(fs.statSync(나갈곳).size / 1024)}KB · 안 ${안들.length}/8)`);
}

module.exports = { uri, 크롬 };
if (require.main === module) main();
