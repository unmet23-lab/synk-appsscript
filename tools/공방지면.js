#!/usr/bin/env node
/* 공방지면 — 브랜드 자산을 «눈으로 고르는 판»으로 굽는다.
 *
 * 유호 지시 09-05: 「우리 이런 디자인 요소 브랜드 자산에 만들어서 html 파일로 어느정도 분리해서
 *   저장하자」 + 「제미나이 버전 / 블렌더 버전 / 만들어진 모든 요소 폴더(npc 포함) 세분화해서
 *   각각의 html 파일 만들어줘」.
 *
 * 🔑 목록을 «손으로» 적지 않는다 — 폴더를 훑어 짓는다.
 *   손 목록은 자산이 늘어도 스스로 안 낡는다(트랙 §0 의 「안 굽는 것 203장」이 그 병이었다).
 *   자산이 늘면 이 도구를 다시 돌리면 된다.
 *
 * 🔴 그림은 **상대 경로로 참조**한다(base64 로 심지 않는다).
 *   727장을 심으면 지면이 수백 MB 가 되어 브라우저가 열기를 거부한다.
 *   그래서 이 지면들은 «저장소 안에서 열어야» 그림이 보인다 — 남에게 보낼 판이 아니라
 *   우리가 고르는 판이다.
 *
 * 굽는 것:
 *   docs/공방/색인.html            — 모든 갈래로 가는 문
 *   docs/공방/구운것_<갈래>.html    — 이미 있는 자산(갈래별)
 *   docs/공방/구울것_제미나이.html   — 앞으로 제미나이로 구울 것
 *   docs/공방/구울것_블렌더.html     — 앞으로 블렌더로 구울 것
 *   계획 둘의 «내용»은 docs/공방/계획.json 이 쥔다 — 목록이 늘어도 이 파일은 안 고친다.
 *
 * 쓰기:  node tools/공방지면.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
/* 🔑 그림과 «서체»는 갈래가 다르다. 그림은 727장이라 심으면 수백 MB 가 되지만(위 주석),
 *   서체는 한 벌 813KB 뿐이고 그것이 없으면 판 전체가 시스템 고딕으로 떨어져 브랜드가 안 보인다.
 *   유호 확정 09-05 「나도 잘 확인해야하니」 — 고르는 판이니 서체는 실제로 떠야 한다. */
const 브랜드폰트 = require(path.join(__dirname, 'lib', '브랜드폰트.js'));

const ROOT = path.resolve(__dirname, '..');
const 나갈방 = path.join(ROOT, 'docs', '공방');
const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));
const 색 = Object.fromEntries(토큰['색']['킷'].map((c) => [c['이름'], c['hex']]));

/* ── 갈래 — 폴더를 뜻으로 묶는다. 이름표가 아니라 «무엇에 쓰나»로 가른다 ────────── */
const 갈래들 = [
  { 키: '부품', 이름: '부품 · 요소', 설명: '지면과 앱 화면에 앉는 작은 것들. 단추·매듭·체크·도장 같은 것.',
    뿌리: ['docs/캐릭터/요소공방_0822', 'docs/캐릭터/요소부품_0828', 'docs/캐릭터/퍼프로브_0819', 'docs/Loom_자산/구움', 'docs/Loom_자산/아이콘'] },
  { 키: '오브', 이름: '오브 · 색', 설명: '브랜드 색 스물여섯 벌을 같은 형태로 구운 판. 색을 고를 때 연다.',
    뿌리: ['docs/캐릭터/오브공방_0821'] },
  { 키: '마스코트', 이름: '마스코트', 설명: '몽글 · 까몽 · 마린. 학생이 앱에서 만나는 얼굴.',
    /* 🔑 09-05 — 정본이 «정본_4K» 한 폴더로 합쳐졌다(몽글 6 · 까몽 10 · 마린 11).
       ✅ 같은 날 저녁 옛 셋(`펠트코랄_0815` · `친구공방_0825`)을 **지웠으므로 여기서도 걷었다**
       (유호 지시 09-05 「옛날것들은 과감히 지워줘 지금 확정된 최신버전만 유지」).
       옛 그림은 git 이력이 보존한다 — 사본을 남기지 않는다. */
    /* ⚠ 같이 걷은 것 둘 — `까몽공방_0901` 과 `몽글` 은 **한 번도 있은 적이 없는 이름**이었다
       (실측 09-05: 디스크에도 git 에도 0건). 목록에만 살아 있는 이름은 「여기도 훑는다」는
       거짓말을 하고, 다음 사람이 그 폴더를 찾아 헤맨다. */
    뿌리: ['docs/캐릭터/정본_4K'] },
  { 키: '사람', 이름: '사람 · NPC', 설명: '학원에서 만나는 사람들. 강사·가이드·마린·NPC.',
    /* 🔴 09-05 밤 — 마린 옛 판 셋을 걷었다: `마린_후보`(124장 1.4GB) · `마린공방_0826`(3장) ·
       `마린공방_0827`(42장 블렌더 렌더). 마린 생김새가 그날 확정되고 제미나이 4K 정본 16컷이
       섰으므로(`docs/캐릭터/정본_4K/마린_*.png`) 셋 다 «대체된 옛 판»이다.
       유호 확정 09-05 「대체된 최신화된것들이 있으면 예전꺼 다 버려야지」.
       ⚠ 도구는 남긴다 — `마린굽기.js` 는 다시 고를 때 폴더를 새로 만들고,
         `마린각도굽기.js`·`마린시안.js` 에는 「지금 안 돈다」를 코드에 달아 뒀다. */
    뿌리: ['docs/캐릭터/NPC공방_0824', 'docs/캐릭터/강사공방_0823', 'docs/캐릭터/가이드_아바타'] },
  { 키: '글자', 이름: '글자 · 숫자', 설명: '자수로 놓은 글자와 숫자. 절번호·한글 자모.',
    뿌리: ['docs/캐릭터/글자공방_0820'] },
  { 키: '천', 이름: '천 · 재질', 설명: '바탕에 까는 천. 펠트 결과 패치.',
    뿌리: ['docs/캐릭터/펠트패치_0815'] },
];

/* 🔴 **AVIF 를 빠뜨리면 새 자산이 «이름만» 뜬다**(09-05 실물).
 *   09-05 에 담는 꼴이 WebP 에서 AVIF 로 갔는데(같은 품질에 36% 작다) 이 목록이 안 따라와,
 *   그날 구운 32장이 지면에서 그림 없는 이름표로만 보였다. 지면은 «눈으로 고르는 판»이라
 *   그림이 없으면 지면이 아니다. */
const 그림확장 = /\.(avif|png|webp|jpe?g)$/i;

/* 같은 물건이 여러 꼴로 있을 때 무엇을 싣나 — «담은 것»이 정본이고 png 는 원본이다.
 *   원본 PNG 는 일부러 안 지우므로(다른 임계로 다시 걷을 수 있어야 한다) 둘 다 잡힌다.
 *   그대로 두면 한 물건이 두 칸을 먹으므로 여기서 하나로 줄인다. */
const 꼴순위 = { avif: 3, webp: 2, png: 1, jpg: 0, jpeg: 0 };

function 훑기(뿌리) {
  const 방 = path.join(ROOT, 뿌리);
  if (!fs.existsSync(방)) return [];
  const 나온것 = [];
  (function 돌기(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) 돌기(p);
      else if (그림확장.test(e.name)) {
        const rel = path.relative(나갈방, p).replace(/\\/g, '/');
        나온것.push({ 이름: e.name.replace(그림확장, ''), 경로: rel,
          방: path.relative(ROOT, path.dirname(p)).replace(/\\/g, '/'),
          꼴: (e.name.split('.').pop() || '').toLowerCase(),
          바이트: fs.statSync(p).size });
      }
    }
  })(방);

  const 고른것 = new Map();          // Map 은 넣은 차례를 지키므로 정렬이 안 흔들린다
  for (const x of 나온것) {
    const 열쇠 = `${x.방}/${x.이름}`;
    const 먼저 = 고른것.get(열쇠);
    if (!먼저 || (꼴순위[x.꼴] || 0) > (꼴순위[먼저.꼴] || 0)) 고른것.set(열쇠, x);
  }
  return [...고른것.values()];
}

/* ── 지면 껍데기 — 어두운 무대. 펠트는 어두운 바닥에서 결이 산다 ──────────────── */
const 껍데기 = (제목, 앞머리, 속) => `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${제목}</title>
${브랜드폰트.블록()}
<style>
:root{ --paper:${색['Paper']}; --ink:${색['Ink']}; --coral:${색['Coral']};
  --무대:#14161B; --칸:#1D2027; --테:rgba(228,228,231,.13); --글:#E4E4E7; --흐림:#9AA0AB; }
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--무대);color:var(--글);
  font-family:'Inter Tight','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  font-size:15px;line-height:1.6}
.wrap{max-width:1280px;margin:0 auto;padding:40px 28px 90px}
a{color:inherit}
h1{font-size:30px;font-weight:800;letter-spacing:-.02em}
.eye{font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--coral);font-weight:700}
.sub{color:var(--흐림);margin-top:10px;max-width:70ch}
.bar{display:flex;gap:8px;flex-wrap:wrap;margin:26px 0 34px}
.bar a{font-size:13px;padding:7px 13px;border:1px solid var(--테);border-radius:2px;
  text-decoration:none;color:var(--흐림)}
.bar a.on{background:var(--coral);border-color:var(--coral);color:#2B2320;font-weight:700}
h2{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--흐림);
  margin:36px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--테);
  display:flex;justify-content:space-between;align-items:baseline}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:14px}
.it{background:var(--칸);border:1px solid var(--테);border-radius:3px;overflow:hidden}
.it .p{aspect-ratio:1;display:flex;align-items:center;justify-content:center;padding:9px;
  background:repeating-conic-gradient(#22252C 0% 25%,#1A1D23 0% 50%) 0 0/16px 16px}
.it img{max-width:100%;max-height:100%;display:block;object-fit:contain}
.it .n{font-size:11px;padding:7px 9px 9px;color:var(--흐림);word-break:break-all;line-height:1.35}
.plan{display:flex;flex-direction:column;gap:9px}
.p1{display:flex;gap:12px;align-items:flex-start;background:var(--칸);
  border:1px solid var(--테);border-radius:3px;padding:12px 15px}
.p1 .s{font-size:11px;padding:3px 8px;border-radius:2px;flex:none;font-weight:700;letter-spacing:.03em}
.s.yes{background:#2C3A24;color:#A9CE8C}
.s.no{background:#2A2D34;color:var(--흐림)}
.p1 .t{flex:1 1 auto;min-width:0}
.p1 .m{font-size:12.5px;color:var(--흐림);margin-top:3px}
.note{background:var(--칸);border-left:2px solid var(--coral);padding:13px 16px;
  border-radius:2px;font-size:13.5px;color:var(--흐림);margin-bottom:20px}
.note b{color:var(--글)}
.foot{margin-top:60px;padding-top:18px;border-top:1px solid var(--테);
  font-size:12px;color:#6B7280;line-height:1.8}
</style></head><body><div class="wrap">
${앞머리}
${속}
<div class="foot">굽는 자 = <b>node tools/공방지면.js</b> · 계획 목록 = docs/공방/계획.json<br>
그림은 상대 경로로 참조한다 — 저장소 안에서 열어야 보인다(수백 MB 를 심지 않으려는 것).<br>
컨셉 정본 = 기억 felt-is-the-brand-concept · 부품 규율 = loom-baked-assets-only-for-ui</div>
</div></body></html>`;

const 띠 = (지금) => {
  const 칸 = [['색인', '색인.html'], ['제미나이로 구울 것', '구울것_제미나이.html'], ['블렌더로 구울 것', '구울것_블렌더.html']]
    .concat(갈래들.map((g) => [g.이름, `구운것_${g.키}.html`]));
  return `<div class="bar">${칸.map(([n, h]) =>
    `<a href="${h}" class="${h === 지금 ? 'on' : ''}">${n}</a>`).join('')}</div>`;
};

const 머리 = (눈썹, 제목, 부제, 지금) =>
  `<div class="eye">${눈썹}</div><h1>${제목}</h1><p class="sub">${부제}</p>${띠(지금)}`;

/* ── 굽기 ─────────────────────────────────────────────────────────────────── */
fs.mkdirSync(나갈방, { recursive: true });
const 계획 = JSON.parse(fs.readFileSync(path.join(나갈방, '계획.json'), 'utf8'));
const 셈 = [];

/* ① 이미 있는 것 — 갈래마다 한 장 */
for (const g of 갈래들) {
  const 방별 = new Map();
  for (const 뿌리 of g.뿌리) for (const it of 훑기(뿌리)) {
    if (!방별.has(it.방)) 방별.set(it.방, []);
    방별.get(it.방).push(it);
  }
  const 총 = [...방별.values()].reduce((a, b) => a + b.length, 0);
  셈.push({ ...g, 총, 방수: 방별.size });
  const 속 = 총 === 0 ? '<div class="note">이 갈래에 아직 그림이 없다.</div>'
    : [...방별.entries()].sort((a, b) => b[1].length - a[1].length).map(([방, 것들]) =>
      `<h2><span>${방}</span><span>${것들.length}장</span></h2><div class="grid">` +
      것들.sort((a, b) => a.이름.localeCompare(b.이름, 'ko')).map((it) =>
        `<div class="it"><div class="p"><img src="${it.경로}" alt="" loading="lazy"></div>` +
        `<div class="n">${it.이름}</div></div>`).join('') + '</div>').join('');
  fs.writeFileSync(path.join(나갈방, `구운것_${g.키}.html`),
    껍데기(`공방 · ${g.이름}`, 머리('BAKED', g.이름,
      `${g.설명} 지금 ${총}장이 ${방별.size}곳에 있다.`, `구운것_${g.키}.html`), 속), 'utf8');
  console.log(`  ✅ 구운것_${g.키}.html — ${총}장 · ${방별.size}곳`);
}

/* ② 앞으로 구울 것 — 제미나이·블렌더 */
for (const [키, 이름, 눈썹] of [['제미나이', '제미나이로 구울 것', 'TO BAKE · GEMINI'],
                                ['블렌더', '블렌더로 구울 것', 'TO BAKE · BLENDER']]) {
  const p = 계획[키];
  const 안내 = `<div class="note"><b>${p['_왜 이쪽인가']}</b><br>${p._한도}</div>`;
  const 속 = 안내 + p.묶음.map((m) => {
    const 한 = m.것들.filter((x) => x.상태 === '구웠다').length;
    return `<h2><span>${m.이름} — ${m['쓰는 곳']}</span><span>${한}/${m.것들.length}</span></h2>` +
      (m.메모 ? `<div class="note">${m.메모}</div>` : '') +
      '<div class="plan">' + m.것들.map((x) =>
        `<div class="p1"><span class="s ${x.상태 === '구웠다' ? 'yes' : 'no'}">${x.상태}</span>` +
        `<div class="t">${x.이름}${x.메모 ? `<div class="m">${x.메모}</div>` : ''}` +
        `${x.파일 ? `<div class="m">${x.파일}</div>` : ''}</div></div>`).join('') + '</div>';
  }).join('');
  fs.writeFileSync(path.join(나갈방, `구울것_${키}.html`),
    껍데기(`공방 · ${이름}`, 머리(눈썹, 이름,
      계획._왜, `구울것_${키}.html`), 속), 'utf8');
  const 총 = p.묶음.reduce((a, m) => a + m.것들.length, 0);
  const 한 = p.묶음.reduce((a, m) => a + m.것들.filter((x) => x.상태 === '구웠다').length, 0);
  console.log(`  ✅ 구울것_${키}.html — ${한}/${총}`);
}

/* ③ 색인 */
const 계획칸 = ['제미나이', '블렌더'].map((k) => {
  const p = 계획[k];
  const 총 = p.묶음.reduce((a, m) => a + m.것들.length, 0);
  const 한 = p.묶음.reduce((a, m) => a + m.것들.filter((x) => x.상태 === '구웠다').length, 0);
  return `<div class="it" style="grid-column:span 2"><div class="n" style="font-size:13px;padding:14px">` +
    `<a href="구울것_${k}.html" style="text-decoration:none"><b style="color:var(--글)">${k} 로 구울 것</b><br>` +
    `${한} / ${총} 구웠다</a></div></div>`;
}).join('');
const 갈래칸 = 셈.map((g) =>
  `<div class="it" style="grid-column:span 2"><div class="n" style="font-size:13px;padding:14px">` +
  `<a href="구운것_${g.키}.html" style="text-decoration:none"><b style="color:var(--글)">${g.이름}</b><br>` +
  `${g.총}장 · ${g.방수}곳</a></div></div>`).join('');
fs.writeFileSync(path.join(나갈방, '색인.html'),
  껍데기('공방 — 브랜드 자산', 머리('WORKSHOP', '공방',
    '우리가 가진 것과, 앞으로 구울 것. 컨셉은 「AI 가 흉내내기 어려운 펠트 재질」이고 범위는 보여지는 곳 전부다.', '색인.html'),
    `<h2><span>앞으로 구울 것</span></h2><div class="grid">${계획칸}</div>` +
    `<h2><span>이미 있는 것</span><span>${셈.reduce((a, g) => a + g.총, 0)}장</span></h2><div class="grid">${갈래칸}</div>`), 'utf8');
console.log(`  ✅ 색인.html — 갈래 ${셈.length} · 그림 ${셈.reduce((a, g) => a + g.총, 0)}장`);
