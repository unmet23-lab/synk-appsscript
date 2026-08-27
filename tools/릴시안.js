#!/usr/bin/env node
/**
 * 릴시안 — 「릴이 어렵고 재미가 없다」의 처방을 유호님 눈 앞에 세운다.
 *
 * 왜 이 지면이 생겼나 (유호 판정 2026-08-27):
 *   09편 3화를 「이해하기가 너무 어려운데?」로 반려하셔서 한국어 137자 → 101자로 줄이고 다시 구웠다.
 *   그 판을 보시고 나온 말씀이 **「지금 느낌도 아직 좀 어렵고 재미가 없어. 대외 홍보물들은 더 쉽고
 *   재밌게 다가가야해」** 였다. 즉 ①쉬움은 줄이기로 되지만 ②재미는 «빼고 남은 것»으로 안 생긴다.
 *   ⇒ 형식을 바꿨다(「장면형」 — 문제가 먼저 서고 표현이 해결로 들어온다 · 30초 → 18초).
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
  const 새09잼 = 클립잼('clip-09-3');
  const 새01잼 = 클립잼('clip-01-1');
  const 구운때 = 시각(path.join(산출방, 'clip-09-3.mp4'));

  const 원고 = `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>릴 — 「어렵고 재미없다」를 고친 판</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.css">
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
    <p class="꼭지">SYNK Loom · Remotion 실굽기 · 2026-08-27</p>
    <h1>릴 — 「어렵고 재미없다」를 고친 판</h1>
    <p class="한줄">줄이기로는 안 됐습니다. 줄이면 <b>교재가 짧아질 뿐</b>이라서입니다.
    문제를 먼저 세우고 표현을 <b>해결</b>로 들여보냈습니다 — 30초 여섯 칸이 <b>18초 여덟 칸</b>이 됐습니다.</p>
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
<thead><tr><th>옛 표형 · 30초 · 여섯 칸</th><th>장면형 · 18초 · 여덟 칸</th></tr></thead>
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
재미는 0이었습니다 — 앞에 세 칸을 <b>새로 세우고도</b> 12초가 짧아진 까닭이 그것입니다.</p>

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

<blockquote class="유리 듦"><code>재미 — 장면형 2/45화 · 문제 먼저 2 · 반전 2 · 참여로 닫음 2 · 평균 18.0초
&nbsp;&nbsp;(옛 표형 43화 · 평균 30.0초)</code></blockquote>

<div class="유리 알림 조용 듦">🔴 <b>이 자는 재미를 «안» 잽니다.</b> 재미는 유호님 눈이 판정 축입니다.
여기서 세는 것은 「재미가 살 <b>자리</b>가 화면에 있나」 — 그것마저 없으면 재미는 원리상 못 생깁니다.
그 문장이 지면에도 실행 로그에도 그대로 붙어 있습니다.</div>

<h2 id="s6" class="듦"><span class="번호">06</span><span>남은 것 — 숨기지 않고 적습니다</span></h2>

<ul class="듦">
<li>🔴 <b>새로 쓴 줄에 몽골어가 없습니다</b>(09편 3화 5칸 · 01편 1화 4칸). 지어내지 않았습니다 —
채워진 둘(표현·쓰임)은 옛 판에서 그대로 옮겨 온 것입니다.
<b>몽골 학생에겐 이게 지금 가장 큰 구멍입니다</b> · 주인 = 몽골어 감수 큐 Q.</li>
<li>⛔ <b>나머지 43화는 아직 옛 표형입니다.</b> 일부러 안 건드렸습니다 — 이 판이 통과해야 한 벌로 쓸어 갑니다
(먼저 쓸면 두 번 쓸게 됩니다).</li>
<li>⛔ <b>씨앗을 편별로 가르는 일이 먼저입니다.</b> 지금은 <code>영상/src/**</code> 를 한 덩어리로 해시해서,
대본 한 화를 고치면 구운 편 전부가 「낡음」으로 찍힙니다. 43화를 쓸 때 계속 걸립니다.</li>
<li>⚠ <b>화면 아래가 여전히 빕니다.</b> 안전여백(300px · 플랫폼 UI)과 가이드 그림의 투명 여백이 겹친 자리입니다.
옛 판과 같은 값이라 이번 판의 후퇴는 아니지만, 「아홉 컷이 그래도 비슷해 보이는」 마지막 몫입니다 —
<b>폭비는 유호님 눈이 판정 축</b>이라 손대지 않았습니다.</li>
<li>⏳ <b>발행 통로는 아직 안 이었습니다.</b> 이 두 편은 내부 시연본입니다.</li>
</ul>

<div class="유리 알림 듦"><b>여쭙는 것은 하나입니다 — 이 방향이 「재밌다」에 닿았습니까?</b><br>
닿았으면 43화를 이 자로 한 벌에 쓸겠습니다. 아니면 <b>어느 칸이 걸리는지</b> 한 마디만 주십시오 —
손잡이 다섯이 전부 값 하나씩이라 그 자리만 고치면 됩니다.</div>

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
