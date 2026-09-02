#!/usr/bin/env node
/**
 * 릴시안 — 「릴이 어렵고 재미가 없다」의 처방을 유호님 눈 앞에 세운다.
 *
 * 왜 이 지면이 생겼나 (유호 판정 2026-08-27):
 *   09편 3화를 「이해하기가 너무 어려운데?」로 반려하셔서 한국어 137자 → 101자로 줄이고 다시 구웠다.
 *   그 판을 보시고 나온 말씀이 **「지금 느낌도 아직 좀 어렵고 재미가 없어. 대외 홍보물들은 더 쉽고
 *   재밌게 다가가야해」** 였다. 즉 ①쉬움은 줄이기로 되지만 ②재미는 «빼고 남은 것»으로 안 생긴다.
 *   ⇒ 형식을 바꿨다(「장면형」 — 문제가 먼저 서고 표현이 해결로 들어온다 · 30초 → 18초).
 *   🔑 18초가 처음엔 23.6초로 늘었다 — 몽골어 병기를 다 실으면 읽는 시간 하한이 그만큼 먹는다.
 *     유호 확정 08-28 ㉯로 「쓰임」(예문) 칸을 홍보 릴에서 빼면서 18초로 돌아왔다(예문은 앱 레슨판 몫).
 *
 * 🔴 이 지면의 판정 축은 **나란히 놓기**다. 한 컷씩 보면 「일곱 칸이 같다」가 안 보인다 —
 *   그것이 NPC 배지 반려문(「다 똑같이 생겼고」)과 정확히 같은 병이고, 같은 처방(띠로 세우기)이 듣는다.
 *
 * 구조: 원고(HTML)만 짓고 `<!--펠트스킨-->` 에 `tools/펠트문서.js`(Loom L4)가 지면을 주입한다.
 *   프레임 띠는 ffmpeg 로 webp 인라인 — **그림은 자립형**이라 언제 어디서 열어도 남는다.
 *   ⚠ 영상(mp4)만 상대경로다. `영상/out/` 은 git 밖이라 이 기계에서만 재생된다 — 지면이 그렇게 말한다.
 *     그림과 영상을 갈라 둔 까닭: 판정의 «증거»는 그림이 지고, 영상은 «편의»다.
 *
 * 사용법:  node tools/릴시안.js          → docs/릴_재미_시안.html
 *   먼저 구워야 하는 것(넷 다 있어야 지면이 선다):
 *     node 영상/굽기.js clip-09-3   &&  node 영상/프레임뽑기.js clip-09-3.mp4
 *     node 영상/굽기.js clip-01-1   &&  node 영상/프레임뽑기.js clip-01-1.mp4
 *   옛 판 둘은 `영상/out/_옛판/` 에 떠 놓았다(형식이 갈리기 «전»의 실물 — 다시 못 만든다).
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 산출방 = path.join(루트, '영상', 'out');
const 출력 = path.join(루트, 'docs', '릴_재미_시안.html');

/** 프레임 띠 한 장 → webp data URI. 실패는 던진다(빈 칸이 조용히 나가면 판정이 헛것이 된다). */
function 인라인(파일) {
  if (!fs.existsSync(파일)) {
    throw new Error(`띠가 없다: ${path.relative(루트, 파일)} — 위 「먼저 구워야 하는 것」을 돌린다`);
  }
  const 임시 = path.join(os.tmpdir(), `릴시안-${process.pid}-${path.basename(파일, '.png')}.webp`);
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', 파일, '-quality', '84', 임시], { stdio: 'ignore' });
    return 'data:image/webp;base64,' + fs.readFileSync(임시).toString('base64');
  } finally { try { fs.unlinkSync(임시); } catch { /* 정리 실패는 결과를 안 바꾼다 */ } }
}

/** 파일 시각 — 「보여 드리는 것이 지금 것인가」를 지면이 스스로 말한다(08-24 실측: 네 시간 반 어긋난 적 있다). */
const 시각 = (f) => new Date(fs.statSync(f).mtimeMs).toLocaleString('ko-KR', { hour12: false });

/**
 * 「재미」 줄을 **대본읽기가 찍은 그대로** 가져온다.
 *
 * 🔴 첫 판은 이 줄을 지면에 «문자열로 박아» 뒀다(이종 검수 08-27이 잡았다). 그러면 장면형 편수가
 *   늘거나 평균 초가 바뀌어도 지면 숫자가 그대로라 — 이 저장소가 가장 자주 앓는 「지면이 거짓말한다」다.
 * 🔑 자를 여기서 «다시 계산»하지도 않는다. 계산이 두 곳에 있으면 언젠가 갈린다.
 *   자는 `대본읽기.js` 하나가 쥐고, 지면은 그 출력을 인용만 한다.
 */
function 재미줄() {
  const r = execFileSync(process.execPath, [path.join(루트, '영상', '대본읽기.js'), '--검사'], {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  const 줄들 = r.split('\n').map((l) => l.replace(/\r$/, ''));
  const i = 줄들.findIndex((l) => l.trim().startsWith('재미 —'));
  if (i < 0) throw new Error('대본읽기 출력에 「재미」 줄이 없다 — 자가 사라졌거나 이름이 바뀌었다');
  /* 다음 줄은 그 자의 «한계 고백»(⚠ 이 자는 재미를 안 잰다)이다. 둘은 한 벌이라 같이 옮긴다 —
     숫자만 떼어 오면 지면이 「기계가 재미를 쟀다」로 읽힌다.
     그다음 🔴 줄이 있으면 «겨냥 초과»다 — 있을 때만 온다(없으면 안 넘쳤다는 뜻이라 빈 문자열). */
  const 넘침 = (줄들[i + 2] || '').trim();
  /* 몽골어 빈 칸 줄도 같이 가져온다 — 그 수가 이 형식의 «가장 큰 구멍»이라 지면이 손으로 적으면
     쓸 때마다 낡는다(45화를 쓸면 9 → 235 로 뛴다). 자를 쥔 쪽은 여기서도 대본읽기 하나다. */
  const 빈칸 = (줄들.find((l) => l.trim().startsWith('몽골어 빈 칸')) || '').trim();
  return {
    값: 줄들[i].trim(),
    한계: (줄들[i + 1] || '').trim(),
    넘침: 넘침.startsWith('🔴 겨냥') ? 넘침 : '',
    빈칸,
  };
}

/** 초·컷 수를 «데이터»에서 읽는다 — 지면에 손으로 적으면 형식을 고친 날 지면이 거짓말한다. */
function 클립잼(id) {
  const s = fs.readFileSync(path.join(루트, '영상', 'src', '클립', '생성', '대본클립들.ts'), 'utf8');
  // eslint-disable-next-line no-eval
  const 목록 = eval(s.slice(s.indexOf('['), s.lastIndexOf(']') + 1));
  const c = 목록.find((x) => x.id === id);
  if (!c) throw new Error(`대본클립들에 ${id} 가 없다`);
  return { 초: (c.전체프레임 / 30).toFixed(1), 컷: c.장면들.length + 1 };
}

function main() {
  const 띠 = {
    옛09: 인라인(path.join(산출방, '_옛_clip-09-3_프레임.png')),
    새09: 인라인(path.join(산출방, 'clip-09-3_프레임.png')),
    옛01: 인라인(path.join(산출방, '_옛판', 'clip-01-1_프레임.png')),
    새01: 인라인(path.join(산출방, 'clip-01-1_프레임.png')),
  };
  const 재미 = 재미줄();
  const 새09잼 = 클립잼('clip-09-3');
  const 새01잼 = 클립잼('clip-01-1');
  const 구운때 = 시각(path.join(산출방, 'clip-09-3.mp4'));

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>릴 — 「어렵고 재미없다」를 고친 판</title>
<!-- 브랜드 서체(SUIT)는 «굽기»가 지면 안에 싣는다 — 바깥에서 부르면 아티팩트 CSP 가 조용히 막는다(정본 tools/lib/브랜드폰트.js) -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap">
<!-- 자동 생성: node tools/릴시안.js — 손 편집 금지(재생성이 덮는다) -->
<!-- 재료 = 영상/out/*_프레임.png (Remotion 실굽기) · 지면 = tools/펠트문서.js -->
<meta name="theme-color" content="#08090C">
<!--펠트스킨-->
<style>
  /* 이 지면 고유 — 띠 하나가 «한 편 전체»다. 나란히 놓는 것이 이 지면의 판정 축이다. */
  .띠{margin:var(--숨) 0 var(--칸);border-radius:14px;overflow:hidden;
     border:1px solid rgba(var(--chalk-rgb),.14);background:rgba(var(--graphite2-rgb),.5);}
  .띠 img{display:block;width:100%;height:auto}
  .띠표{display:flex;gap:var(--칸);flex-wrap:wrap;margin:var(--칸) 0 0;
       font-size:.84em;color:var(--ash);letter-spacing:.02em}
  .띠표 span{white-space:nowrap}
  /* 🔴 띠는 «전폭»이어야 한다. 첫 판은 옛/새를 두 칸에 나란히 놨는데, 아홉 컷이 340px 안에
     들어가 한 컷이 38px 이 됐다 — 「나란히 놓기」가 판정 축인 지면에서 판정이 안 되는 크기다.
     그래서 띠는 위아래로 쌓고(각각 전폭), «영상»만 두 칸으로 나란히 둔다. */
  .릴짝{display:grid;gap:var(--단);grid-template-columns:1fr;margin-top:var(--칸)}
  @media(min-width:720px){.릴짝{grid-template-columns:1fr 1fr}}
  .릴{display:block;width:100%;max-width:260px;border-radius:14px;background:#000}
  .꺼{color:var(--ash2)}
</style>

<div class="판">

<nav class="레일" aria-label="차례">
  <p class="꼭지">릴 재미</p>
  <ol>
    <li><a href="#s1"><span class="n">01</span> 진단 — 일곱 컷이 같다</a></li>
    <li><a href="#s2"><span class="n">02</span> 처방 — 장면형</a></li>
    <li><a href="#s3"><span class="n">03</span> 반려하신 그 편</a></li>
    <li><a href="#s4"><span class="n">04</span> 고르신 그 편</a></li>
    <li><a href="#s5"><span class="n">05</span> 재미 자</a></li>
    <li><a href="#s6"><span class="n">06</span> 남은 것</a></li>
  </ol>
</nav>

<div class="글">

<header class="표지">
  <div class="오브" aria-hidden="true">릴</div>
  <div>
    <p class="꼭지">SYNK Loom · Remotion 실굽기 · 45화 전량 장면형</p>
    <h1>릴 — 「어렵고 재미없다」를 고친 판</h1>
    <p class="한줄">줄이기로는 안 됐습니다. 줄이면 <b>교재가 짧아질 뿐</b>이라서입니다.
    문제를 먼저 세우고 표현을 <b>해결</b>로 들여보냈습니다 — 30초 여섯 칸이
    <b>${새09잼.초}초 ${새09잼.컷}컷</b>이 됐고, <b>45화 전부</b> 이 형식으로 갈렸습니다.</p>
    <p class="메타">같은 표현 · 같은 가이드 · 같은 곡 — <b>형식만</b> 갈렸습니다 ·
    구운 때 ${구운때} · <code>node 영상/굽기.js clip-09-3</code></p>
  </div>
</header>

<div class="유리 알림 듦"><b>유호님 판정(08-27)</b> — 「지금 느낌도 아직 좀 어렵고 재미가 없어.
대외 홍보물들은 더 쉽고 재밌게 다가가야해. 지금은 좀 어려운 느낌이 커.」<br>
그 전에 한국어 137자 → <b>101자</b>로 줄인 판을 보시고 나온 말씀입니다.
그래서 이번 판은 <b>글자 수를 더 줄인 판이 아닙니다</b> — 구조를 바꾼 판입니다.</div>

<h2 id="s1" class="듦"><span class="번호">01</span><span>진단 — 일곱 컷이 «똑같이 생겼다»</span></h2>

<p class="듦">한 컷씩 보면 안 보입니다. 구운 영상에서 컷을 뽑아 <b>나란히 세우니</b> 바로 보였습니다 —
일곱 칸이 전부 <b>코랄 알약 + 한국어 + 몽골어</b>이고, 30초 내내 화면이 한 장입니다.
가이드는 마지막 칸에서야 눈을 감습니다.</p>

<div class="띠표"><span class="꺼">옛 판 · 01편 1화 「안녕하세요」</span><span class="꺼">30.0초 · 7컷</span></div>
<div class="띠 듦"><img src="${띠.옛01}" alt="옛 판 프레임 띠 — 일곱 컷이 같은 구성"></div>

<p class="듦">여기서 두 가지가 같이 나옵니다.</p>
<ul class="듦">
<li><b>「어렵다」의 정체</b> — 화면이 안 변하니 보는 사람이 하는 일이 <b>읽기</b>뿐입니다. 읽기는 어렵습니다.</li>
<li><b>「재미없다」의 정체</b> — 여섯 칸이 전부 <b>주는</b> 칸입니다(표현·뜻·예문·예문·따라하기·완료).
<b>궁금해지는 칸이 0</b>이라, 짧게 만들어도 「교재를 짧게 만든 것」이 됩니다.</li>
</ul>

<div class="유리 알림 조용 듦"><b>제 오독을 먼저 적습니다.</b> 앞 세션이 「맘에 드네」를 <b>통과선</b>으로 읽고
그 자로 44화를 짜려 했습니다. 그건 <b>둘 중 나은 쪽</b>이었지 통과선이 아니었습니다.
그래서 이번에는 <b>반려하신 편</b>과 <b>고르신 편</b>을 둘 다 새 형식으로 구워 나란히 놓습니다.</div>

<h2 id="s2" class="듦"><span class="번호">02</span><span>처방 — 「장면형」. 표현이 «해결»로 들어온다</span></h2>

<p class="듦">앞 세 칸이 <b>문제를 세웁니다.</b> 그다음에 표현이 들어오면 같은 문장인데도
「배우는 것」이 아니라 <b>「구해 주는 것」</b>이 됩니다. 그 순간이 재미입니다.</p>

<div class="유리 표틀 듦">
<table>
<thead><tr><th>옛 표형 · 30초 · 여섯 칸</th><th>장면형 · ${새09잼.초}초 · 여덟 칸</th></tr></thead>
<tbody>
<tr><td class="꺼">표현</td><td><b>상황</b> — 손님이 셋. 나는 하나.</td></tr>
<tr><td class="꺼">뜻</td><td><b>실수</b> — 기다려! <span class="작게 흐린">(회색 · 취소선)</span></td></tr>
<tr><td class="꺼">예문 1</td><td><b>반응</b> — 손님 얼굴이 굳어요</td></tr>
<tr><td class="꺼">예문 2</td><td><b>표현</b> — 잠시만 기다려 주세요 <span class="작게 흐린">(가장 큰 글자 · 정답면)</span></td></tr>
<tr><td class="꺼">따라하기</td><td><b>쓰임</b> — 잠시만 기다려 주세요. 금방 나와요.</td></tr>
<tr><td class="꺼">클로징</td><td><b>짧게</b> — 잠시만요!</td></tr>
<tr><td class="꺼">—</td><td><b>따라하기</b> — 눈 보고 두 번!</td></tr>
<tr><td class="꺼">—</td><td><b>참여</b> — 알바 첫날, 뭐가 제일 무서웠어요?</td></tr>
</tbody>
</table>
</div>

<p class="듦"><b>예문 두 칸을 하나로 합쳤습니다.</b> 같은 값을 두 번 주던 자리라 정보 밀도만 올리고
재미는 0이었습니다 — 앞에 세 칸을 <b>새로 세우고도</b> 짧아진 까닭이 그것입니다.</p>

<h3 class="듦">손잡이 다섯 — 하나만 바꾸면 여전히 한 장으로 읽힌다</h3>
<ul class="듦">
<li><b>글자 크기</b> 41 → 138px. 「반응」이 가장 작고 「표현」이 가장 큽니다. 대비가 다음 칸을 크게 만듭니다.</li>
<li><b>면</b> — 맨 종이(상황·반응·참여) / 코랄 알약(실수·쓰임·짧게·따라하기) / <b>정답면 Meadow</b>(표현 하나뿐).</li>
<li><b>바탕</b> — 「표현」 칸에서 <b>화면 전체</b>에 코랄 후광이 뜹니다. 띠에서 눈에 먼저 들어오는 것이 이것입니다.</li>
<li><b>몸</b> — 실수에서 움찔 커지고(1.06) 반응에서 움츠러들고(0.93) 표현에서 펄쩍(1.12).
가이드가 <b>배경이 아니라 인물</b>이 되는 자리입니다.</li>
<li><b>소리</b> — 여덟 칸에 여덟 소리(옛 판은 다섯). 실수·반응에는 <b>내려앉는 소리만</b> 둡니다 —
몽글 목소리 정본의 「밝은 소리를 오답 옆에 두지 않는다」를 그대로 지킨 자리입니다.</li>
</ul>

<div class="유리 알림 조용 듦"><b>새 색을 만들지 않았습니다.</b> 킷에 「오답 빨강」이 없습니다
(정답 Meadow · 안내 Lapis · 보상 Butter · 기념 Pop). 그래서 실수는 <b>색이 아니라 «상태»</b>로 냅니다 —
회색(Ash Wool) + 취소선 + 움츠린 몸. 새 hex 는 0개입니다.</div>

<h2 id="s3" class="듦"><span class="번호">03</span><span>나란히 — 09편 3화(반려하신 그 편)</span></h2>

<div class="띠표"><span class="꺼">옛 표형</span><span class="꺼">30.1초 · 7컷</span><span class="꺼">표현·뜻·예문1·예문2·따라하기·클로징</span></div>
<div class="띠 듦"><img src="${띠.옛09}" alt="옛 판 09편 3화 프레임 띠"></div>

<div class="띠표"><span><b>장면형</b></span><span>${새09잼.초}초 · ${새09잼.컷}컷</span><span>상황·실수·반응·<b>표현</b>·쓰임·짧게·따라하기·참여</span></div>
<div class="띠 듦"><img src="${띠.새09}" alt="장면형 09편 3화 프레임 띠"></div>

<div class="릴짝 듦">
<div><p class="작게 흐린">옛 표형 · 30.1초</p>
<video class="릴" src="../영상/out/_옛판/clip-09-3.mp4" controls preload="metadata" playsinline></video></div>
<div><p class="작게"><b>장면형 · ${새09잼.초}초</b></p>
<video class="릴" src="../영상/out/clip-09-3.mp4" controls preload="metadata" playsinline></video></div>
</div>

<p class="듦 작게 흐린">▶ <b>영상은 이 기계에서만</b> 재생됩니다(<code>영상/out/</code> 은 git 밖입니다).
띠 그림은 지면 «안»에 박혀 있어 언제 어디서 열어도 남습니다 — 판정의 증거는 그림이 집니다.</p>

<h2 id="s4" class="듦"><span class="번호">04</span><span>나란히 — 01편 1화(「맘에 드네」 하신 그 편)</span></h2>

<p class="듦">같은 형식을 <b>고르신 편</b>에도 얹었습니다. 「안녕!」은 <b>틀린 한국어가 아니라 자리가 다른 한국어</b>라,
취소선 회색으로 서고 바로 다음 칸이 정답면이라 「이 자리에선 이것」으로 읽힙니다 — 반말을 가르치는 것이 아닙니다.</p>

<div class="띠표"><span class="꺼">옛 표형</span><span class="꺼">30.0초 · 7컷</span></div>
<div class="띠 듦"><img src="${띠.옛01}" alt="옛 판 01편 1화 프레임 띠"></div>

<div class="띠표"><span><b>장면형</b></span><span>${새01잼.초}초 · ${새01잼.컷}컷</span><span>「짧게」 칸이 없다 — 없는 칸을 억지로 채우지 않는다</span></div>
<div class="띠 듦"><img src="${띠.새01}" alt="장면형 01편 1화 프레임 띠"></div>

<div class="릴짝 듦">
<div><p class="작게 흐린">옛 표형 · 30.0초</p>
<video class="릴" src="../영상/out/_옛판/clip-01-1.mp4" controls preload="metadata" playsinline></video></div>
<div><p class="작게"><b>장면형 · ${새01잼.초}초</b></p>
<video class="릴" src="../영상/out/clip-01-1.mp4" controls preload="metadata" playsinline></video></div>
</div>

<h2 id="s5" class="듦"><span class="번호">05</span><span>재미 자 — 없던 장치를 세웠습니다</span></h2>

<p class="듦">지금까지 자는 <b>①쉬움</b>(글자 수)만 쟀습니다. <b>②재미</b>는 세는 장치가 <b>아예 없었습니다</b>.
그래서 <code>node 영상/대본읽기.js</code> 가 매번 한 줄을 더 찍습니다:</p>

<blockquote class="유리 듦"><code>${재미.값}</code></blockquote>

<div class="유리 알림 조용 듦">🔴 <b>이 자는 재미를 «안» 잽니다.</b> 재미는 유호님 눈이 판정 축입니다.
여기서 세는 것은 「재미가 살 <b>자리</b>가 화면에 있나」 — 그것마저 없으면 재미는 원리상 못 생깁니다.
실행 로그가 스스로 그렇게 말합니다: <code>${재미.한계}</code><br>
<span class="작게 흐린">▲ 위 두 줄은 이 지면이 만든 문장이 아니라 <code>node 영상/대본읽기.js</code> 의 출력을
그대로 옮긴 것입니다 — 자가 바뀌면 이 지면도 같이 바뀝니다(숫자를 손으로 적어 두면 지면이 거짓말합니다).</span></div>

${재미.넘침 ? `<h3 class="듦">🔴 겨냥은 18초였는데 ${새09잼.초}초가 됐습니다 — 유호님 판정이 필요한 맞바꿈입니다</h3>

<blockquote class="유리 듦"><code>${재미.넘침}</code></blockquote>

<p class="듦">까닭은 하나입니다. <b>몽골어를 다 실으면 못 줄입니다.</b> 「쓰임」 칸이 한국어 19자 +
몽골어 37자라 <b>읽는 데만 4.3초</b>가 듭니다. 첫 판은 이걸 3.2초로 눌러서 18초를 맞췄는데 —
<b>못 읽는 3.2초는 짧은 게 아니라 없는 것</b>이라 되돌렸습니다(이종 검수가 잡아 준 자리입니다).</p>

<p class="듦">줄이는 길이 셋 있고, <b>셋 다 무언가를 내줍니다.</b> 제가 고르지 않았습니다:</p>
<ul class="듦">
<li><b>㉮ 예문을 짧게</b> — 「손님, 잠시만 기다려 주세요」처럼. <span class="작게 흐린">내주는 것 = 예문이 주던 «금방 나와요» 같은 곁말</span></li>
<li><b>㉯ 「쓰임」 칸을 아예 빼기</b> — 홍보 릴에서는 빼고 앱 레슨판에만 둡니다(18초로 바로 돌아옵니다).
<span class="작게 흐린">내주는 것 = 문장 안에서 쓰는 걸 보여 주는 자리 하나. 표현·짧게·따라하기로 세 번은 여전히 나옵니다</span></li>
<li><b>㉰ 몽골어를 「표현」 칸에만</b> — 예문은 한국어만. <span class="작게 흐린">내주는 것 = 초급 학생의 예문 이해. <b>제 눈엔 이게 가장 비쌉니다</b></span></li>
</ul>

<div class="유리 알림 조용 듦">제 의견을 물으시면 <b>㉯</b>입니다 — 홍보물은 «먼저 재밌고 그다음에 배운다»가
유호님이 세우신 축이고, 빼는 것이 학생에게서 뺏는 게 아니라 <b>자리를 옮기는</b> 것이라서입니다.
다만 이건 콘텐츠 판정이라 유호님 자리입니다.</div>` : ''}

<h2 id="s6" class="듦"><span class="번호">06</span><span>남은 것 — 숨기지 않고 적습니다</span></h2>

<ul class="듦">
<li>🔴 <b>새로 쓴 줄에 몽골어가 없습니다 — 이게 지금 가장 큰 구멍입니다.</b> 지어내지 않았습니다.
채워진 것은 <b>「표현」 칸 하나뿐</b>이고 그것도 옛 판에서 그대로 옮겨 온 것입니다.
45화를 쓸면서 빈 칸이 그만큼 늘었습니다 — 실행 로그가 세어 줍니다:
<br><code>${재미.빈칸}</code>
<br>주인 = 몽골어 감수 큐 Q. <b>몽골 학생이 볼 화면이라, 여기가 채워지기 전에는 대외 발행을 안 합니다.</b></li>
<li>✅ <b>45화 전부 장면형으로 갈았습니다</b>(유호 확정 08-28 「㉯로 가고 43화 전부 쓸어줘」).
「쓰임」 칸은 홍보 릴에서 빠졌고 앱 레슨판 몫으로 옮겼습니다 — 그래서 18초로 돌아왔습니다.
<b>덤으로 쉬움 자도 같이 통과했습니다</b>: 긴 훅 36 → <b>0</b>/45화 · 한 화면에 둘 5 → <b>0</b>줄 ·
긴 자막 83 → 21줄. 장면 칸이 짧을 수밖에 없는 형식이라 «줄이기»가 저절로 따라왔습니다.</li>
<li>🔵 <b>실수 축을 편마다 갈랐습니다</b> — 01 반말·직역 / 02 낱말만 / 03 교과서 한국어 /
04 비슷한 말 / 05 「맛있어요」 하나로 / 06 교실에서 말이 짧아짐 / 07 급해서 낱말만 / 08 못 받아침 /
09 침묵·명령조. <b>편 안에서는 통일, 편 사이에서는 갈림</b> — 아홉 편이 같은 축이면 45화가 한 편으로 읽힙니다.</li>
<li>⛔ <b>씨앗을 편별로 가르는 일이 먼저입니다.</b> 지금은 <code>영상/src/**</code> 를 한 덩어리로 해시해서,
대본 한 화를 고치면 구운 편 전부가 「낡음」으로 찍힙니다. <b>90클립을 다시 구울 때 계속 걸립니다.</b></li>
<li>⛔ <b>구운 것은 아직 표본 넷입니다</b>(01-1 · 08-1 · 09-1 · 09-3). 90클립 전량 굽기는 한 편에 40~60초라
<b>한 시간 남짓</b> 걸립니다 — 유호님이 이 넷을 보고 「가자」 하시면 그때 한 벌로 돕니다.</li>
<li>⚠ <b>화면 아래가 여전히 빕니다.</b> 안전여백(300px · 플랫폼 UI)과 가이드 그림의 투명 여백이 겹친 자리입니다.
옛 판과 같은 값이라 이번 판의 후퇴는 아니지만, 「아홉 컷이 그래도 비슷해 보이는」 마지막 몫입니다 —
<b>폭비는 유호님 눈이 판정 축</b>이라 손대지 않았습니다.</li>
<li>⏳ <b>발행 통로는 아직 안 이었습니다.</b> 이 두 편은 내부 시연본입니다.</li>
</ul>

<div class="유리 알림 듦"><b>여쭙는 것은 하나입니다 — 이 넷을 보시고 90클립을 다 구울까요?</b><br>
45화 대본은 전부 갈렸고, 구운 표본은 넷입니다. 「가자」 하시면 한 시간 돌려 전량을 냅니다.
어느 칸이 걸리시면 그 자리만 말씀해 주십시오 — 손잡이 다섯이 전부 값 하나씩이라 45화가 같이 따라옵니다.</div>

</div><!--/글-->
</div><!--/판-->
</html>`;

  const 임시 = path.join(os.tmpdir(), `릴시안-${process.pid}.html`);
  fs.writeFileSync(임시, 원고, 'utf8');
  try {
    execFileSync(process.execPath, [path.join(루트, 'tools', '펠트문서.js'), '--굽기', 임시, 출력],
      { stdio: ['ignore', 'inherit', 'inherit'] });
  } finally { try { fs.unlinkSync(임시); } catch { /* */ } }

  const html = fs.readFileSync(출력, 'utf8');
  console.log(`■ 릴 재미 시안  ${path.relative(루트, 출력)}  (${Math.round(Buffer.byteLength(html) / 1024)}KB · 띠 4장)`);
  /* 🔑 그림만 «자립» 을 요구한다 — 영상은 일부러 상대경로다(위 머리말). 둘을 한 자로 재면
     「영상을 붙였다」는 이유로 자립 검사가 늘 빨개지고, 늘 빨간 가드는 신호로서 죽는다. */
  const 밖그림 = (html.match(/<img[^>]+src="(?!data:)/g) || []).length;
  if (밖그림) { console.error(`🔴 인라인 안 된 그림 ${밖그림}건 — 판정 증거가 자립형이 아니다`); process.exit(1); }
  const 영상수 = (html.match(/<video/g) || []).length;
  console.log(`   ✅ 그림 자립형(외부 그림 0) · 영상 ${영상수}개는 이 기계의 out/ 참조 — 지면이 그렇게 적어 뒀다`);
}

if (require.main === module) main();
