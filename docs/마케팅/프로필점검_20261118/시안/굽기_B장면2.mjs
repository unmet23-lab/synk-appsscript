// synkbrief · yuhobuilds 유튜브 배너 B 둘째 판 굽기 (2026-11-19)
// 첫 판(굽기_B장면.mjs)은 세로 컷을 오려 검은 바탕에 페더로 얹어 카본 맹검 여섯 장 모두 기각(1~3점)이었다 —
// 「16:9 한 컷의 공간 조명으로 설계하지 않은 초보 합성」, 「4줄 설명 글 · 겹친 태그 · 좁은 자간의 썸네일 고딕」.
// 그래서 둘째 판은 ① 편과 같은 인물 · 같은 세계로 처음부터 넓게 구운 한 장을 판 전체에 깔고(오리기 · 마스크 없음)
// ② 글은 지금 건 판 A의 제목 두 줄과 작은 이름 한 줄만 쓴다. 장면은 tools/그림굽기.js(구독)로 구웠고 원본은 저장소 밖에 둔다.
// 유튜브 2560×1440, 모든 기기에서 보이는 가운데 1546×423(x507~2053, y508~931)에 얼굴과 글을 함께 넣는다.
//   node docs/마케팅/프로필점검_20261118/시안/굽기_B장면2.mjs <판 정의 json>
//   판 정의: [{ "이름": "...", "글": "brief|builds", "그림": "<절대 경로>", "배": 1.0, "x": 0, "y": -120, "얼굴": [왼, 위, 오른, 아래] }]
//   로고(경로) · 로고px: 이름 줄 대신 브랜드 킷 배치용 로고를 얹는다(PULSE 배너 C와 같은 길).
//   줄굵기([첫 줄, 둘째 줄]): 제목 두 줄의 굵기를 나눈다(예: [500, 800]). 없으면 두 줄 다 800.
//   줄px([첫 줄, 둘째 줄]): 제목 두 줄의 크기를 나눈다(첫 줄을 작은 머리말로). 없으면 두 줄 다 제목px.
//   글색 · 그림자 · 로고그림자: 밝은 장면에서 짙은 글을 쓸 때 바꾼다(로고그림자 'none').
//   첫줄색: 제목 첫 줄(머리말)만 이 색으로 친다(브랜드 색을 한 곳에만).
//   명조(굵기): 둘째 줄(큰 제목)만 Noto Serif KR로 친다(글꼴 정본 §10-2 감성 편의 명조 + 가는 고딕 짝). 글꼴은 Windows의 NotoSerifKR-VF.ttf.
//   위흐림(px): 장면 위끝이 판 위끝보다 아래에 올 때(얼굴이 그림 위쪽에 있어 띠 안에 넣으려면) 그 경계를 이만큼 흐리게 이어 바탕(같은 그림을 흐린 것)과 섞는다 — TV에서만 보이는 자리다.
//   배 · x · y는 그림을 판에 얹는 크기와 자리(그림 1px → 판 배 px, 그림 왼쪽 위가 판의 x, y). 얼굴은 판 좌표의 얼굴 상자(머리끝~턱).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const W = 2560, H = 1440, 띠 = { 위: 508, 아래: 931, 왼: 507, 오른: 2053 };
const 글 = {
  brief: { 이름: 'SYNK 브리핑', 제목: ['AI 때문에', '실제로 벌어진 일'] },
  builds: { 이름: 'SYNK 대표 유호', 제목: ['개발을 몰랐던 사람이', 'AI로 회사를 만드는 중'] },
};

function 문서(p) {
  const g = 글[p.글];
  const 그림 = fs.readFileSync(p.그림).toString('base64');
  const 종류 = p.그림.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="../../../디자인/SNS키트/kit.css"><style>
html,body{margin:0;background:#0b0c10}
.판{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#0b0c10;font-family:var(--k-sans)}
.바탕{position:absolute;inset:-80px;background:url(data:image/${종류};base64,${그림}) center/cover no-repeat;filter:blur(60px)}
.장면{position:absolute;left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;background:url(data:image/${종류};base64,${그림}) 0 0/100% 100% no-repeat${p.위흐림 ? `;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 ${p.위흐림}px)` : ''}}
.글{position:absolute;left:${p.글왼 ?? 640}px;top:${띠.위}px;height:${띠.아래 - 띠.위}px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;color:${p.글색 ?? '#fff'};text-shadow:${p.그림자 ?? '0 2px 24px rgba(0,0,0,.35)'}}
.이름{margin:0;font:600 34px/1.2 var(--k-sans);letter-spacing:.01em;opacity:.78}
h1{margin:18px 0 0;font:800 ${p.제목px ?? 88}px/1.14 var(--k-sans);letter-spacing:-.022em;white-space:nowrap}
h1 span{display:block}
${p.명조 ? `@font-face{font-family:'B Serif';src:url('file:///C:/Windows/Fonts/NotoSerifKR-VF.ttf');font-weight:200 900}
h1 span:last-child{font-family:'B Serif',serif;font-weight:${p.명조} !important;letter-spacing:-.012em}` : ''}
</style></head><body><div class="판"><div class="바탕"></div><div class="장면"></div>
<div class="글">${p.로고 ? `<img class="이름" style="height:${p.로고px ?? 58}px;width:auto;opacity:1;filter:${p.로고그림자 ?? 'drop-shadow(0 2px 14px rgba(0,0,0,.35))'}" src="data:image/png;base64,${fs.readFileSync(p.로고).toString('base64')}" alt="${g.이름}">` : `<p class="이름">${g.이름}</p>`}<h1>${g.제목.map((s, i) => `<span style="${p.줄굵기 ? `font-weight:${p.줄굵기[i]};` : ''}${p.줄px ? `font-size:${p.줄px[i]}px;${i ? '' : 'margin-bottom:10px;letter-spacing:-.01em;'}` : ''}${p.첫줄색 && !i ? `color:${p.첫줄색};` : ''}">${s}</span>`).join('')}</h1></div></div></body></html>`;
}

const 정의 = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const 브라우저 = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch({ channel: 'msedge' }));
const 검사 = {};
try {
  for (const p of 정의) {
    const 임시 = path.join(여기, `._굽는중_${process.pid}.html`);
    fs.writeFileSync(임시, 문서(p), 'utf8');
    const 쪽 = await 브라우저.newPage({ viewport: { width: W, height: H } });
    await 쪽.goto('file:///' + 임시.replace(/\\/g, '/'));
    await 쪽.evaluate(() => document.fonts.ready);
    await 쪽.waitForTimeout(300);
    const 잼 = await 쪽.evaluate(() => { const a = [...document.querySelectorAll('.이름, h1')].map((e) => e.getBoundingClientRect()); return { 왼: Math.round(Math.min(...a.map((x) => x.left))), 오른: Math.round(Math.max(...a.map((x) => x.right))), 위: Math.round(a[0].top), 아래: Math.round(a[1].bottom) }; });
    const [fl, ft, fr, fb] = p.얼굴;
    const 얼굴 = { 왼: fl, 위: ft, 오른: fr, 아래: fb };
    const 안 = (b) => b.왼 >= 띠.왼 && b.오른 <= 띠.오른 && b.위 >= 띠.위 && b.아래 <= 띠.아래;
    const 겹침 = !(잼.오른 < 얼굴.왼 || 얼굴.오른 < 잼.왼);
    검사[p.이름] = { 글: 잼, 얼굴, 글안: 안(잼), 얼굴안: 안(얼굴), 글얼굴겹침: 겹침, 장면: path.basename(p.그림) };
    if (!안(잼) || !안(얼굴) || 겹침) throw new Error(`${p.이름}: 자리 검사 걸림 ${JSON.stringify(검사[p.이름])}`);
    const 낼 = path.join(여기, 'out', `B2-${p.이름}.png`);
    await 쪽.screenshot({ path: 낼, clip: { x: 0, y: 0, width: W, height: H } });
    await 쪽.close();
    fs.rmSync(임시, { force: true });
    console.log('구움', path.relative(여기, 낼), JSON.stringify(검사[p.이름]));
  }
} finally { await 브라우저.close(); }
const 검사파일 = path.join(여기, 'out', 'B2-검사.json');
const 앞 = fs.existsSync(검사파일) ? JSON.parse(fs.readFileSync(검사파일, 'utf8')) : {};
fs.writeFileSync(검사파일, JSON.stringify({ ...앞, ...검사 }, null, 2) + '\n');
