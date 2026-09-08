#!/usr/bin/env node
/**
 * 캐러셀 굽기 — 인스타 캐러셀 카드를 «펠트 정본»으로 굽는다. (유호 지시 2026-09-08)
 *
 * ■ 왜 새 도구인가
 *   `tools/FB카드굽기.js` 는 페이스북 첫 게시물 «한 장»에 붙박이로 짜여 있다(문안·자리·크기 고정).
 *   캐러셀은 같은 틀 위에 장이 여러 개 서고, 원고가 카드마다 다르다. 그래서 «틀»과 «원고»를 가른다.
 *   굽는 통로(크롬 헤드리스)와 자산 심기는 FB카드굽기 와 같은 처방을 쓴다.
 *
 * ■ 🔴 요소를 얹기 전에 «보이나»를 먼저 잰다 (유호 지시 09-08 「저런게 나가면 절대 안돼 · 싸구려같아」)
 *   ① **바탕과 색이 가까운 부품은 안 보인다.** 크림 실땀을 크림 천 위에 놓았더니 윤곽선만 남은
 *      껍데기가 됐다. 4K 로 다시 구워도 같은 자리에 걸린다 — 색 거리가 문제이지 해상도가 아니다.
 *      ⇒ 조연 실을 **라피스**로 잡아 풀었다(킷 「주연 1실 + 조연 1실」 · 라피스 = 길잡이 직책).
 *   ② **누끼 후광이 남으면 회색 네모가 된다.** 흰 바탕에서 걷으면 크림 보풀 둘레에 옅은 알파가
 *      남는다. 세게 걷으면 이번엔 속이 비어 껍데기가 된다(알파 60 미만만 0 으로).
 *   ③ ⇒ **얹은 뒤 반드시 굽고 그림을 눈으로 본다.** 작은 부품은 잘라서 확대까지 한다.
 *      코드만 보면 셋 다 안 보인다.
 *   🔑 킷 3규칙이 답을 이미 준다 — 「위계는 색이 아니라 «밀도»(크기·웨이트·여백)」.
 *      선을 못 세우는 자리는 여백이 가른다. 요소를 억지로 넣으면 그 순간 싸구려가 된다.
 *
 * ■ 재질은 «구운 자산»에서만 온다
 *   바탕·여권·실땀·진행 점은 전부 공방에서 구운 펠트다. CSS 로 그림자·질감을 만들면 그 순간
 *   브랜드가 갈린다(memory `loom-baked-assets-only-for-ui`).
 *
 * ■ 몽골어가 주인공이다
 *   이 카드를 보는 사람은 몽골 학생이다. 몽골어를 크게, 한국어를 작게 둔다.
 *   키릴은 Inter Tight, 한글은 SUIT 가 그린다(`docs/브랜드_폰트_정본.md`).
 *
 * ■ 틀이 셋이다 — 장마다 결이 다르기 때문이다
 *   `수`   = 큰 수가 주인공(표지·우수 39교)
 *   `글`   = 제목 + 본문(설명하는 장)
 *   `목록` = 이름을 세로로 세운다(학교 넷)
 *
 * ■ 🔑 장식은 «첫 장에만» 몰아 둔다 (유호 09-08 「모든 장에 들어가니까 좀 별론데」)
 *   실땀줄을 여덟 장 모두에 두었더니 넘길 때마다 같은 줄이 나와 지루했다. 표지에만 두면
 *   표지가 «특별한 장»이 되고, 속장은 넘길수록 정보만 남는 흐름이 된다.
 *   ⇒ 규칙을 하나로 둔다: **장식(실땀·여권)은 표지에만 · 몽글이는 처음과 끝.**
 *     여권을 5장에도 두어 봤다가 걷었다 — 속장에 하나만 남으면 덩그러니 보인다.
 *
 * ■ 크기 = 1080×1350 (4:5) — 인스타에서 세로로 가장 크게 서는 비율.
 *
 * 쓰는 법:
 *   node tools/캐러셀굽기.js --묶음 비자          → 여덟 장 전부
 *   node tools/캐러셀굽기.js --카드 비자1         → 한 장만
 *   node tools/캐러셀굽기.js --카드 비자1 --지면만
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const 루트 = path.resolve(__dirname, '..');
const 브랜드폰트 = require('./lib/브랜드폰트.js');
const 마스코트 = require('./lib/마스코트자산.js');   // 경로 정본은 이 파일 하나다
const 토큰 = require(path.join(루트, 'docs', '디자인_토큰.json'));

const 인자 = (() => {
  const a = process.argv.slice(2); const o = {};
  for (let i = 0; i < a.length; i += 1) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2);
    o[k] = (a[i + 1] && !a[i + 1].startsWith('--')) ? a[i += 1] : true;
  }
  return o;
})();

const W = 1080, H = 1350;

/* 색은 토큰이 정본이다 — 여기 값을 적지 않는다(적으면 킷과 갈린다). */
const 킷 = (토큰.색 && 토큰.색.킷) || 토큰.킷;
function 색(이름) {
  const c = 킷.find((x) => x.이름 === 이름);
  if (!c) throw new Error(`디자인_토큰.json 에 «${이름}» 이 없다 — 색 이름이 바뀌었다`);
  return c.hex;
}

/* ── 자산 심기 ─────────────────────────────────────────────────────────── */
function ffmpeg() {
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (r.status === 0) return 'ffmpeg';
  throw new Error('ffmpeg 를 못 찾았다 — 자산을 줄일 수 없다(4K 원본을 그대로 심으면 카드가 20MB 가 된다)');
}

/** 그림 한 장을 폭 N 으로 줄여 webp data URI 로.
 * 🔴 **알파가 있는 부품은 무손실로 줄인다**(09-08 실측 · 유호 「싸구려같아」의 그 자리).
 *   `-q:v 88 -pix_fmt yuva420p` 는 알파를 4:2:0 으로 서브샘플링해 **투명한 바깥이 옅게 살아난다** —
 *   크림 천 위에 얹으면 그것이 «흰 네모»로 보인다. 몽글이 정본은 알파가 완벽했는데(바깥 테두리
 *   알파 최대 0) 변환에서 망가졌다. 원본을 의심하기 전에 «내 변환»을 먼저 잰다.
 * 🔑 여덟 장을 이어 구우므로 결과를 캐시한다 — 같은 부품을 여덟 번 변환할 이유가 없다. */
const 심은것 = new Map();
function 심기(상대경로, 폭, 무손실 = false) {
  const 열쇠 = `${상대경로}|${폭}|${무손실}`;
  if (심은것.has(열쇠)) return 심은것.get(열쇠);
  const src = path.isAbsolute(상대경로) ? 상대경로 : path.join(루트, 상대경로);
  if (!fs.existsSync(src)) throw new Error(`자산이 없다: ${상대경로}`);
  const 임시 = path.join(os.tmpdir(), `synk-car-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`);
  const r = spawnSync(ffmpeg(), ['-y', '-i', src, '-vf', `scale=${폭}:-1:flags=lanczos`,
    '-c:v', 'libwebp',
    ...(무손실 ? ['-lossless', '1', '-pix_fmt', 'bgra']
              : ['-lossless', '0', '-q:v', '88', '-pix_fmt', 'yuva420p']), 임시],
    { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(임시)) {
    throw new Error(`ffmpeg 실패(${상대경로}): ${(r.stderr || '').split('\n').slice(-4).join(' ')}`);
  }
  const b64 = fs.readFileSync(임시).toString('base64');
  fs.unlinkSync(임시);
  const 값 = { uri: `data:image/webp;base64,${b64}`, KB: Math.round(b64.length * 0.75 / 1024) };
  심은것.set(열쇠, 값);
  return 값;
}

/** 공방 자산의 저장소 경로. 목록.json 의 `파일` 값은 `공방/…` 로 시작한다. */
const 공방 = (파일) => path.join('영상', 'public', 파일);

/* 🔴 **부품은 «누끼 판»을 쓴다**(09-08 실측).
 *   공방 원본(`영상/public/공방/공방_*.avif`)은 `yuv420p` 라 **알파가 없다** — 검은 바탕이 그대로
 *   구워져 있어 크림 천 위에 얹으면 검은 네모가 뜬다.
 *   ⇒ `tools/AI누끼.py`(rembg · 색이 아니라 «형태»를 본다)로 걷어 `docs/Loom_자산/누끼/` 에 두었다. */
const 누끼 = (이름) => path.join('docs', 'Loom_자산', '누끼', `${이름}.webp`);

/* ── 카드 원고 ──────────────────────────────────────────────────────────
 * 🔑 원고는 여기 살고 «틀»은 아래 지면짓기() 가 진다. 카드가 늘면 이 표에만 줄을 더한다.
 *   근거 문서 = `.claude/skills/synk-content/references/캐러셀/비자막히는자리_v1.md`
 *   몽골어는 그 문서 §1-2(다섯 겹 검문 통과판)에서 **그대로** 가져온다 — 여기서 새로 짓지 않는다. */
const 꼬리 = 'Хууль зүйн яам · Боловсролын яам 2026.02.12';
const 총쪽 = 8;

const 카드들 = {
  비자1: { 쪽: 1, 틀: '수', 여권: true, 몽글: true, 실땀: true,
    큰수: '20', 수뒤: 'сургууль',
    몽골: '2026 оны 2-р улирлаас эхлэн нэг жилийн турш эдгээр сургуульд элсэгчид оюутны виз авахад хүндрэлтэй болно.',
    한국: '2026년 2학기부터 1년 동안, 이 대학들은 유학생 비자를 받기 어렵습니다.' },

  비자2: { 쪽: 2, 틀: '글',
    제목: 'Эхлээд хэлье',
    몽골: 'Бид оюутны виз гаргаж өгч чадахгүй. Сургуулиа сонгоход тань хэрэг болох мэдээллийг хүргэж байна.',
    한국: '우리는 학생비자를 열어 주지 못합니다. 학교를 고르실 때 쓰시라고 드립니다.' },

  비자3: { 쪽: 3, 틀: '글',
    제목: 'Гурван бүлэг',
    몽골: 'Хууль зүйн яам, Боловсролын яам жил бүр их сургуулиудыг шалгаж гурван бүлэгт хуваадаг.',
    한국: '법무부와 교육부가 해마다 대학을 심사해 인증대학·상담대학·비자정밀 심사대학으로 나눕니다.' },

  비자4: { 쪽: 4, 틀: '글',
    제목: 'Баталгаажсан сургууль',
    몽골: 'Баталгаажсан сургууль зэргийн хөтөлбөрт 181, хэлний бэлтгэлд 123 байна. Эдгээр сургуулийн оюутны визийн шалгалт хялбар болдог.',
    한국: '인증대학은 학위 181개교, 어학연수 123개교입니다. 이 학교 학생은 비자 심사가 쉬워집니다.' },

  비자5: { 쪽: 5, 틀: '수',
    큰수: '39', 수뒤: 'сургууль',
    몽골: 'Тэдгээрийн дотроос шилдэг баталгаажсан 39 сургуулийн хувьд элсэлтийн зөвшөөрлийн бичгээ өгөхөд л визийн шалгалт дуусдаг.',
    한국: '그중 우수 인증대학은 입학허가서만 내면 비자 심사가 끝납니다.' },

  비자6: { 쪽: 6, 틀: '글', 붉은제목: true,
    제목: 'Виз нарийн шалгах',
    몽골: 'Шалгуурт хүрээгүй зэргийн хөтөлбөрийн 16, хэлний бэлтгэлийн 4 сургуульд 2026 оны 2-р улирлаас эхлэн нэг жилийн турш виз олгохыг хязгаарлана.',
    한국: '기준에 못 미친 학위 16개교와 어학연수 4개교는 2026년 2학기부터 1년간 비자 발급이 제한됩니다.' },

  비자7: { 쪽: 7, 틀: '목록',
    제목: 'Хэлний бэлтгэлийн 4 сургууль',
    /* 🔴 학교 이름은 한국어 그대로 둔다 — 학생이 그 글자로 찾기 때문이다. */
    목록: ['대구한의대학교', '상지대학교', '호원대학교', '목포과학대학교'],
    한국: '2025년 심사 결과입니다. 해마다 다시 심사하므로 지원 전에 그해 명단을 보셔야 합니다.' },

  비자8: { 쪽: 8, 틀: '글', 몽글: true,
    제목: 'Өөрөө шалгаарай',
    몽골: 'Бүрэн жагсаалт studyinkorea.go.kr дээр байна. Гадаадад суралцахаар бэлтгэж буй найздаа энэ хуудсыг илгээгээрэй.',
    한국: '전체 명단은 studyinkorea.go.kr 에 있습니다. 유학을 준비하는 친구에게 이 페이지를 보내 주세요.' },
};

const 묶음들 = { 비자: ['비자1', '비자2', '비자3', '비자4', '비자5', '비자6', '비자7', '비자8'] };

/* ── 지면 ──────────────────────────────────────────────────────────────── */
function 지면짓기(카드) {
  const 바탕 = 심기(공방('공방/펠트_종이바탕.webp'), W);
  const 점켬 = 심기(누끼('공방_진행점켜짐'), 96, true);
  const 점끔 = 심기(누끼('공방_진행점꺼짐'), 96, true);
  /* 🔑 조연 실은 «라피스»다(09-08 4K 로 새로 구웠다 · 672원).
     크림 부품이 크림 천에서 안 보이던 자리를 색으로 푼다 — 킷 「주연 1실 + 조연 1실」. */
  const 땀 = 카드.실땀 ? 심기(누끼('공방_실땀한땀라피스'), 200, true) : null;
  const 여권 = 카드.여권 ? 심기(누끼('공방_펠트여권'), 420, true) : null;
  /* 마스코트 정본은 이미 알파를 가졌다(4096² rgba) — 누끼를 다시 뜰 자리가 아니다. */
  const 몽글 = 카드.몽글 ? 심기(마스코트.절대경로('본체', { 누끼: true }), 560, true) : null;

  const 땀줄 = 땀 ? Array.from({ length: 9 }, () => `<img class="땀" src="${땀.uri}" alt="">`).join('') : '';
  const 점들 = Array.from({ length: 총쪽 }, (_, i) => (
    `<img class="점" src="${i + 1 === 카드.쪽 ? 점켬.uri : 점끔.uri}" alt="">`
  )).join('');

  const 머리 = 카드.틀 === '수'
    ? `<div class="수줄"><span class="수">${카드.큰수}</span><span class="수뒤">${카드.수뒤}</span></div>`
    : `<h1 class="제목${카드.붉은제목 ? ' 붉은' : ''}">${카드.제목}</h1>`;

  /* 몽골어 글자 수로 본문 크기를 정한다 — 짧으면 크게, 길면 작게. */
  const 글수 = (카드.몽골 || '').length;
  const 본문크기 = 글수 < 100 ? 56 : (글수 < 140 ? 50 : 46);

  const 몸 = 카드.틀 === '목록'
    ? `<ul class="목록">${카드.목록.map((x) => `<li>${x}</li>`).join('')}</ul>`
    : `<p class="몽골">${카드.몽골}</p>`;

  const 원고 = `<!doctype html><html lang="mn"><head><meta charset="utf-8">
<style>
  /* 🚫 CSS 로 펠트를 흉내내지 않는다 — 재질은 위 자산이 진다. 여기는 «자리»만 정한다. */
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{position:relative;background:${색('Paper')}}
  .바탕{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  /* 🔑 내용을 세로 가운데로 — 첫 판은 위로 붙어 아래가 통째로 비었다(09-08 눈으로 잡음) */
  .판{position:absolute;inset:0;display:flex;flex-direction:column;
      padding:120px 88px 150px;justify-content:center}

  /* 큰 수 — 이 카드의 «신호»이고, 신호는 코랄 하나다(킷 3규칙) */
  .수줄{display:flex;align-items:baseline;gap:34px}
  .수{font:800 300px/0.86 'Inter Tight',sans-serif;color:${색('Coral 3')};
      letter-spacing:-.04em;font-feature-settings:'tnum' 1}
  .수뒤{font:700 76px/1 'Inter Tight',sans-serif;color:${색('Ink')};letter-spacing:-.01em}

  .제목{font:700 88px/1.14 'Inter Tight',sans-serif;color:${색('Ink')};letter-spacing:-.02em;max-width:904px}
  .제목.붉은{color:${색('Coral 3')}}

  /* 손바느질 한 줄 — 라피스 실 한 땀을 나란히 놓는다. 크림 천 위에서 또렷하다 */
  .땀줄{display:flex;align-items:center;gap:10px;margin:30px 0 38px;width:904px}
  .땀{width:72px;height:72px;display:block;flex:0 0 auto}
  /* 실땀이 빠진 장은 «여백»이 가른다 — 킷 3규칙 「위계는 색이 아니라 밀도」 */
  .사이{height:56px}

  /* 몽골어가 주인공 — 키릴은 Inter Tight 가 그린다.
     🔑 글이 짧은 장은 «크게» 세운다 — 요소를 억지로 넣어 빈 자리를 메우면 싸구려가 되고,
        글자를 키우면 빈 자리가 줄면서 읽기도 쉬워진다(09-08 여덟 장 대조판에서 2·3장이 허전했다). */
  .몽골{font:500 ${본문크기}px/1.42 'Inter Tight',sans-serif;color:${색('Ink')};
        letter-spacing:-.005em;max-width:904px}
  /* 학교 이름은 한글이라 SUIT 가 그린다 */
  .목록{list-style:none;max-width:904px}
  .목록 li{font:600 54px/1.66 'SYNK KR','SUIT Variable',sans-serif;color:${색('Ink')}}
  .목록 li::before{content:'';display:inline-block;width:15px;height:15px;border-radius:50%;
                   background:${색('Lapis')};margin-right:26px;vertical-align:middle}
  /* 한국어는 조연 — 몽글이가 있는 장은 폭을 줄여 자리를 비켜 준다 */
  .한국{margin-top:34px;font:500 29px/1.5 'SYNK KR','SUIT Variable',sans-serif;
        color:${색('Ash Wool')};max-width:${카드.몽글 ? 660 : 904}px}

  /* 주제 요소 — 손으로 놓은 듯 살짝 기울인다 */
  .여권{position:absolute;top:96px;right:84px;width:196px;display:block;transform:rotate(-7deg)}
  /* 브랜드 얼굴 — 아래 오른쪽에 앉힌다. 글자와 안 겹치게 바닥 줄 위로 띄운다 */
  .몽글{position:absolute;right:72px;bottom:118px;width:268px;display:block}

  .바닥{position:absolute;left:88px;right:88px;bottom:76px;
        display:flex;align-items:center;justify-content:space-between}
  .꼬리{font:500 24px/1.4 'Inter Tight',sans-serif;color:${색('Ash Wool')}}
  .점들{display:flex;gap:15px;align-items:center}
  /* 🔑 규율 「작은 크기에서 갈린다」 — 16px 에서는 펠트 결이 죽어 그냥 원이 된다 */
  .점{width:21px;height:21px;display:block}
</style></head><body>

<img class="바탕" src="${바탕.uri}" alt="">
${여권 ? `<img class="여권" src="${여권.uri}" alt="">` : ''}

<div class="판">
  ${머리}
  ${땀줄 ? `<div class="땀줄">${땀줄}</div>` : '<div class="사이"></div>'}
  ${몸}
  <p class="한국">${카드.한국}</p>
</div>

${몽글 ? `<img class="몽글" src="${몽글.uri}" alt="">` : ''}

<div class="바닥">
  <span class="꼬리">${꼬리}</span>
  <span class="점들">${점들}</span>
</div>

</body></html>`;

  return { 원고 };
}

/* ── 크롬 ──────────────────────────────────────────────────────────────── */
function 크롬() {
  return [process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
    .filter((p) => p && fs.existsSync(p))[0] || null;
}

function 굽기(지면, out) {
  const exe = 크롬();
  if (!exe) {
    console.error('SKIP: 크롬을 못 찾았다 — **안 구웠다**(성공 아님). CHROME_PATH 로 지정할 수 있다.');
    return 2;
  }
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-캐러셀-'));
  const r = spawnSync(exe, ['--headless=new', '--disable-gpu', '--force-device-scale-factor=1',
    '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=${W},${H}`, `--screenshot=${out}`, `--user-data-dir=${방}`,
    'file:///' + 지면.replace(/\\/g, '/')], { encoding: 'utf8', timeout: 120000 });
  try { fs.rmSync(방, { recursive: true, force: true }); } catch { /* 임시방은 남아도 해가 없다 */ }
  if (!fs.existsSync(out)) {
    console.error('크롬이 그림을 안 냈다:', (r.stderr || '').split('\n').slice(-5).join('\n'));
    return 1;
  }
  return 0;
}

/* ── 실행 ──────────────────────────────────────────────────────────────── */
function 한장(이름) {
  const 카드 = 카드들[이름];
  const { 원고 } = 지면짓기(카드);

  /* 🔴 서체를 지면 «안»에 심는다 — 이 카드는 «진짜 글자»를 쓴다(FB 첫게시물 카드는 글자가 전부
     그림이라 안 심었다). 이름만 부르면 헤드리스 크롬에 그 서체가 없어 시스템 고딕으로 조용히
     떨어지고, 그러면 브랜드가 픽셀에서 갈린다. */
  const 낼원고 = 브랜드폰트.심기(원고).html;

  const 지면경로 = path.join(루트, 'docs', '홍보물', `_src_캐러셀_${이름}.html`);
  fs.mkdirSync(path.dirname(지면경로), { recursive: true });
  fs.writeFileSync(지면경로, 낼원고, 'utf8');

  if (인자['지면만']) { console.log(`■ 지면만 ${path.relative(루트, 지면경로)}`); return 0; }

  const 나갈곳 = path.resolve(인자['out'] || path.join(루트, 'docs', '홍보물', `캐러셀_${이름}.png`));
  fs.mkdirSync(path.dirname(나갈곳), { recursive: true });
  const 코드 = 굽기(지면경로, 나갈곳);
  if (코드 === 0) {
    const KB = Math.round(fs.statSync(나갈곳).size / 1024);
    console.log(`■ ${카드.쪽}/${총쪽} ${이름}  ${W}×${H}  ${KB}KB  틀=${카드.틀}` +
      `${브랜드폰트.심겼나(낼원고) ? ' · 서체✅' : ' · 🔴서체 안 심겼다'}`);
  }
  return 코드;
}

function main() {
  const 묶음 = 인자['묶음'];
  const 이름들 = 묶음 ? 묶음들[묶음] : (인자['카드'] ? [인자['카드']] : null);
  if (!이름들 || 이름들.some((x) => !카드들[x])) {
    console.error(`🔴 --묶음 <${Object.keys(묶음들).join('|')}> 또는 --카드 <이름> 이 필요하다.`);
    console.error(`   있는 카드: ${Object.keys(카드들).join(' · ')}`);
    process.exit(1);
  }
  let 실패 = 0;
  for (const n of 이름들) 실패 += 한장(n) === 0 ? 0 : 1;
  console.log(`■ 합계 ${이름들.length}장 = 성공 ${이름들.length - 실패} + 실패 ${실패}`);
  process.exit(실패 ? 1 : 0);
}

main();
