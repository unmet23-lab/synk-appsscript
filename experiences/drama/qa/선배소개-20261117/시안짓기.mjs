#!/usr/bin/env node
/**
 * 선배 소개 움직이는 시안 한 장을 만든다(2026-11-17, 유호님 「네, 만들어」).
 *
 *   node experiences/drama/qa/선배소개-20261117/시안짓기.mjs
 *   → 공용 작업본 .tmp/senior-intro/시안/index.html · img/ · snd/ · vid/ · 파일.json(게시할 파일 짝)
 *
 * 화면은 시안.css, 동작은 시안_재생.js, 인물 글은 아래 「인물」, 시험 결과는 같은 폴더의 결과.mjs(있을 때만)에서 읽는다.
 * 그림과 소리는 git 밖에 있다(그림.mjs · 소리.mjs가 만든다). 아직 굽지 않은 그림은 가까운 그림으로 메우고 무엇을 메웠는지 찍는다.
 * 주소 꼬리: ?auto=yuna|taeo(저절로 보기) · ?v=a(첫 안) · ?order=ty|yt(게시판 줄 순서 고정) · ?mute=1 · ?step=1~5&pick=yuna|taeo
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const req = createRequire(import.meta.url);
const { 공용작업본 } = req(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 폰트 = req(path.join(뿌리, 'tools', 'lib', '브랜드폰트.js'));
const 공용 = 공용작업본(뿌리);
const 굽기 = path.join(공용, '.tmp', 'senior-f-face', 'out');
const 소리폴더 = path.join(공용, '.tmp', 'senior-intro', '소리');
const 끝 = path.join(공용, '.tmp', 'senior-intro', '시안');
for (const d of ['img', 'snd', 'vid']) { fs.rmSync(path.join(끝, d), { recursive: true, force: true }); fs.mkdirSync(path.join(끝, d), { recursive: true }); }

// ── 그림: [나올 이름, 원본, 원본이 없을 때 메울 그림, 긴 변, 자를 자리(원본을 쓸 때만, 왼 · 위 · 오른 · 아래 비율)] ──
// 게시판 사진은 작게 붙으므로 사람이 한눈에 보이게 자른다(구운 원본은 온몸이 작게 들어간 4:3 스냅)
const 자름 = { 태오: [0.22, 0.19, 1.0, 0.97], 유나: [0.16, 0.17, 0.94, 0.95] };
const 태오스틸 = path.join(뿌리, 'experiences/drama/pilot/media/taeo-still.webp');
const 유나스틸 = path.join(굽기, 'sf2-pony_g1.png');
const 그림들 = [
  ['seoha', path.join(공용, '.tmp/student-card-after-20261106/움직임/자산/seoha.jpg'), null, 96],
  ['intro-taeo', path.join(굽기, 'intro-taeo.png'), 태오스틸, 640, 자름.태오],
  ['intro-yuna', path.join(굽기, 'intro-yuna.png'), 유나스틸, 640, 자름.유나],
  ['still-taeo', 태오스틸, null, 1280],
  // 한유나의 식당 스틸은 맞은편 자리에서 본 넓은 컷이다(그림.mjs의 today-yuna2, 없으면 1판). 첫 시험에서 여덟이 「얼굴이 화면에 꽉 찬다」고 해서 얼굴 사진을 스틸로 쓰지 않는다.
  ['still-yuna', path.join(굽기, 'today-yuna2.png'), fs.existsSync(path.join(굽기, 'today-yuna.png')) ? path.join(굽기, 'today-yuna.png') : 유나스틸, 1280],
  ['face-yuna', 유나스틸, null, 900],
  ['selfie-taeo', path.join(뿌리, 'experiences/synk-world-app/me2-assets/sample-scene.webp'), null, 900],
  ['selfie-yuna', path.join(굽기, 'selfie-yuna2.png'), fs.existsSync(path.join(굽기, 'selfie-yuna.png')) ? path.join(굽기, 'selfie-yuna.png') : 유나스틸, 900],
];
const 메움 = [];
const 줄일 = 그림들.map(([이름, 원본, 대신, 긴변, 자를]) => {
  let 쓸 = 원본, 칸 = 자를 || null;
  if (!fs.existsSync(원본)) { if (!대신) throw new Error(`그림 없음: ${원본}`); 쓸 = 대신; 칸 = null; 메움.push(이름); }
  return [쓸, path.join(끝, 'img', `${이름}.jpg`), 긴변, 칸];
});
const r = spawnSync('python', ['-X', 'utf8', '-c', `
import json, sys
from PIL import Image
for src, dst, side, box in json.loads(sys.argv[1]):
    im = Image.open(src).convert('RGB')
    if box: im = im.crop((round(im.width * box[0]), round(im.height * box[1]), round(im.width * box[2]), round(im.height * box[3])))
    k = side / max(im.size)
    if k < 1: im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(dst, quality=86, optimize=True)
`, JSON.stringify(줄일)], { encoding: 'utf8' });
if (r.status !== 0) { console.error('그림 줄이기 실패', r.stderr); process.exit(1); }
// 태오의 「오늘」 한마디는 구워 둔 영상을 그대로 쓴다(첫 장면을 정지 사진으로도 뽑는다)
const 태오오늘 = path.join(뿌리, 'experiences/drama/pilot/media/today-taeo-review.mp4');
fs.copyFileSync(태오오늘, path.join(끝, 'vid', 'today-taeo.mp4'));
const f = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.4', '-i', 태오오늘, '-frames:v', '1', '-q:v', '3', path.join(끝, 'img', 'today-taeo.jpg')], { encoding: 'utf8' });
if (f.status !== 0) { console.error('태오 「오늘」 첫 장면 뽑기 실패', f.stderr); process.exit(1); }

// ── 소리 ──
const 길이 = JSON.parse(fs.readFileSync(path.join(소리폴더, '길이.json'), 'utf8'));
for (const id of Object.keys(길이)) fs.copyFileSync(path.join(소리폴더, '판', `${id}.mp3`), path.join(끝, 'snd', `${id}.mp3`));

// ── 인물 글 — 소개 한 줄은 신입생 때 한 실수 한 가지, 인사는 가장 쉬운 말(이야기 지도 3-5 지킬 것 4 · 7 · 8) ──
// 두 줄의 무게를 맞춘다(지킬 것 2). 소개 한 줄은 둘 다 새로 온 학생이 겪을 만한 쉬운 실수이고, 인사는 둘 다 「나는 3학년 ○○○예요. … 선배라고 불러요.」 꼴이다.
// 첫 시험에서 태오의 「교수님께 “수고하셨어요” 했다가 혼났어요」는 셋이 뜻을 몰랐고, 한유나의 「모르는 거 있으면 물어봐요」는 서하의 물음에 곧바로 답해 아홉 모두 한유나를 골랐다.
// 둘째 시험에서 인사의 꼴을 맞추고 태오의 실수를 「다른 과 수업에 들어가서 끝까지 들었어요」로 바꿨는데도 여덟이 한유나를 골랐다. 까닭은 「정문 지도 앞에서 세 바퀴」가
// 막 도착한 내 처지와 같다는 것이었다. 그래서 태오의 실수도 캠퍼스에서 길을 헤맨 일로 맞췄다(한유나는 정문 지도, 태오는 포스트잇의 그 학생 식당).
// introA · hiA는 처음 안의 글이라 그대로 둔다.
const 인물 = {
  taeo: {
    name: '권태오', en: 'Taeo', year: '국제학부 3학년',
    intro: '식당을 못 찾아서 편의점에서 먹었어요.', introEn: '…couldn’t find the cafeteria, so I ate at a store.',
    hi: '나는 3학년 권태오예요. 편하게 선배라고 불러요.', hiEn: 'I am Kwon Taeo, a third-year. Just call me seonbae.',
    ep1: '저기, 혹시 신입생이에요? 아까 정문 안내 지도 앞에서 빙빙 돌고 있었죠?', ep1En: 'Hey, are you a new student? You were going in circles at the map by the gate, right?',
    ep2: '하하, 여기 처음 오면 다 헤매요. 나는 3학년 권태오예요. 편하게 선배라고 불러요.', ep2En: 'Haha, everyone gets lost here at first. I am Kwon Taeo, third year. Just call me seonbae.', nameAt: 4000,
    todayLine: '그때 했던 대사, 오늘 한 번 더 해 봐요.', todayEn: 'That line from before — try it once more today.',
    photo: 'img/intro-taeo.jpg', still: 'img/still-taeo.jpg', selfie: 'img/selfie-taeo.jpg', face: 'img/still-taeo.jpg', today: { video: 'vid/today-taeo.mp4', poster: 'img/today-taeo.jpg' },
    introA: '신입생 때 교수님께 “수고하셨어요”라고 했다가 혼났어요.', hiA: '3학년 권태오예요. 첫날 밥은 내가 살게요.', hiAEn: 'I am Kwon Taeo, third year. Lunch is on me the first day.',
  },
  yuna: {
    name: '한유나', en: 'Yuna', year: '국제학부 3학년',
    intro: '정문 지도 앞에서 세 바퀴 돌았어요.', introEn: '…walked around the map at the gate three times.',
    hi: '나는 3학년 한유나예요. 그냥 선배라고 불러요.', hiEn: 'I am Han Yuna, a third-year. Just call me seonbae.',
    ep1: '저기, 신입생이죠? 나도 1학년 때 정문 지도 앞에서 세 바퀴 돌았는데, 아까 그랬죠?', ep1En: 'Hey, you are new, right? I circled that map three times in my first year too. That was you just now?',
    ep2: '여기 처음 오면 다 그래요. 나는 3학년 한유나예요. 그냥 선배라고 불러요.', ep2En: 'Everyone does that at first. I am Han Yuna, third year. Just call me seonbae.', nameAt: 2500,
    todayLine: '그때 그 대사요. 오늘 한 번만 더 해요.', todayEn: 'That line from before. Just once more today.',
    photo: 'img/intro-yuna.jpg', still: 'img/still-yuna.jpg', selfie: 'img/selfie-yuna.jpg', face: 'img/face-yuna.jpg', today: { poster: 'img/face-yuna.jpg' },
    introA: '신입생 때 정문 지도 앞에서 세 바퀴 돌았어요.', hiA: '3학년 한유나예요. 식당 찾기 어려우니까 천천히 와요.', hiAEn: 'I am Han Yuna, third year. The cafeteria is hard to find. Take your time.',
  },
};

const 결과파일 = path.join(여기, '결과.mjs');
const 결과 = fs.existsSync(결과파일) ? (await import(`file:///${결과파일.replace(/\\/g, '/')}?t=${Date.now()}`)).default : null;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function 결(잡음, 색, 세기) { return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${잡음}' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${색[0]}  0 0 0 0 ${색[1]}  0 0 0 0 ${색[2]}  0 0 0 ${세기} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)}")`; }

const 소리아이콘 = '<svg class="son" viewBox="0 0 20 20"><path d="M3 7.5h3l4-3.2v11.4l-4-3.2H3z"/><path d="M13 7a4.2 4.2 0 0 1 0 6"/></svg><svg class="soff" viewBox="0 0 20 20"><path d="M3 7.5h3l4-3.2v11.4l-4-3.2H3z"/><path d="M13.2 7.8l4 4.4M17.2 7.8l-4 4.4"/></svg>';
const 마이크 = '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
const 서하줄 = '<div class="who"><i></i><b>서하 · 신입생 도우미</b><em>Seoha, student helper</em></div>';

const 휴대폰 = `
<button class="hud" id="hud" type="button">${소리아이콘}</button>
<i class="tap" id="tap"></i>

<div class="layer b" id="L-board">
 <div class="bd"><i class="stray"></i><div class="slip"><i class="pin"></i><b>선배 소개</b><span>국제학부 학생회 · 2027 봄</span></div></div>
 <div class="pi">개강 첫날,<br>학생 식당에서<br>만나요!<em>— 학생회 지호</em><span class="add"><b></b><svg viewBox="0 0 100 8" preserveAspectRatio="none"><path pathLength="1" d="M1 5C20 2 40 7 60 4s30-1 39 1"/></svg></span></div>
 <div class="q">${서하줄}
  <p class="t swap"><span class="l1"></span><span class="l2"></span></p><p class="sub swap"></p>
  <p class="keep" hidden><span>만난 뒤에도 바꿀 수 있어요.<em></em></span></p></div>
 <div class="heard-box"><div class="hk"><span></span><button type="button">다시 듣기</button></div><p class="ht"></p><p class="he"></p></div>
 <div class="hint"><svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="10"/><path d="M8.6 6.6v8.8L16.2 11z"/></svg><span>눌러서 인사를 들어 봐요<em>Tap to hear them say hi</em></span></div>
 <button class="go" type="button"></button>
 <div class="links"></div>
</div>

<div class="layer chap" id="L-chap"><small>일주일 뒤 · 3월 2일</small><p><span>개강 첫날,</span>학생 식당.</p><div class="mini">학생 식당에서 만나요!<br><i></i></div></div>

<div class="layer ep" id="L-ep"><img class="bg" alt="">
 <span class="chip">1화 · 개강 첫날</span>
 <div class="memo">학생 식당에서 만나요!<br><i></i></div>
 <div class="cap"><span class="tag"></span><p class="ko"></p><p class="en"></p></div>
 <div class="mine"><div><small>내 차례 · 마이크를 눌러 말해요</small><p><u>네, 맞아요. 길을 잃어서 한참 헤맸어요.</u></p></div><button class="mic" type="button" aria-label="말하기">${마이크}</button></div>
 <button class="go" type="button"></button>
</div>

<div class="layer snap" id="L-snap"><div class="film"><div class="pic"><img alt="선배와 함께 찍은 식당 셀카"></div><div class="hw"><span>파이팅!</span><span>3. 2.</span></div></div><i class="flash"></i>
 <div class="q"><p class="t"><span class="l1">밥을 다 먹고,</span><span class="l2">첫 사진을 찍었어요.</span></p><p class="sub">Your first photo together. It stays in your album.</p></div>
 <button class="go" type="button"></button>
</div>

<div class="layer td" id="L-td"><div class="bind"><span>2027 · 03</span><span></span></div>
 <div class="dn"><span class="num">4</span><span class="wd"><b>목요일</b><span>개강 사흘째 · 오늘</span></span></div>
 <div class="say"><span class="bub"></span><div><p class="whoo"></p><p class="line"></p><p class="len"></p></div></div>
 <div class="sec"><span>오늘 할 것</span><b>2</b></div>
 <div class="rw a"><p class="k"><b>1</b>다시 · 1화 식당</p><p class="t">「네, 맞아요.」 한 번 더</p><p class="y">개강 첫날에 끝의 「요」를 빠뜨렸어요.</p></div>
 <div class="rw b"><p class="k"><b>2</b>새로</p><p class="t">처음 보는 상황 하나</p><p class="y">같은 말을 편의점에서 써 봐요.</p></div>
 <button class="go" type="button"></button>
</div>

<div class="layer a" id="L-a"><div class="memo2">개강 첫날, 학생 식당에서 만나요!<em>— 학생회</em><i></i></div>
 <div class="cards"></div>
 <div class="q"><div class="who"><i></i><b></b><em></em></div><p class="t swap"><span class="l1"></span><span class="l2"></span></p><p class="sub swap"></p></div>
 <div class="heard-box"><div class="hk"><span></span></div><p class="ht"></p><p class="he"></p></div>
 <button class="go" type="button"></button>
 <div class="links off"><button type="button">아무나 좋아요</button><small>Anyone is fine</small></div>
</div>`;

const 지킨것 = [
  ['두 줄은 무게가 같다', '두 줄의 크기가 같고, 놓이는 순서는 열 때마다 섞입니다. 미리 골라진 쪽이 없습니다. 소개 한 줄은 둘 다 새로 온 학생이 겪을 만한 실수이고, 인사는 둘 다 같은 꼴입니다.'],
  ['한 사람이 화면을 채우지 않는다', '고르기 전에는 두 사람이 늘 한 게시판에 함께 보입니다. 누른 줄은 조금 들릴 뿐입니다.'],
  ['사진보다 글이 먼저다', '이름과 손으로 쓴 소개 한 줄이 크고, 사진은 작게 붙였습니다. 사진은 정면 얼굴이 아니라 학교에서 일하는 모습입니다. 손글씨는 한글을 막 읽기 시작한 사람도 읽을 수 있게 또박또박한 글꼴을 썼습니다.'],
  ['소개 한 줄은 신입생 때 한 실수 한 가지다', '이상형, 점수, 하트 같은 연애 게임의 낱말과 꾸밈이 없습니다. 밥을 사 준다는 말도 없습니다.'],
  ['누름 세 번 안에 끝난다', '한 줄 듣기, 다른 줄 듣기, 고르기. 「서하가 정해 주세요」를 누르면 한 번에 끝납니다.'],
  ['말이 쉽다', '인사는 가장 쉬운 낱말로 썼고, 다시 듣기와 화면 언어 뜻이 붙습니다. 맞고 틀림을 판정하지 않습니다.'],
  ['선배는 아직 나를 모른다', '서하는 「선배한테는 이것만 말할게요. “신입생이 와요.”」라고 합니다. 식당에서 선배가 「신입생이죠?」 하고 묻는 것이 그래서 맞습니다.'],
  ['만나 본 뒤에도 바꿀 수 있다', '고른 직후에 「만난 뒤에도 바꿀 수 있어요」가 보이고, 「다시 고를래요」로 바로 돌아갑니다. 바꿀 수 있는 때(2화를 시작하기 전)는 1화가 끝날 때 다시 알립니다.'],
];
const 못하는것 = [
  '두 선배의 게시판 인사는 새로 굽지 않고 개강 첫날 식당의 둘째 줄에서 「나는 3학년 ○○○예요. … 선배라고 불러요.」만 잘라 썼습니다. 게시판에서 들은 인사를 식당에서 그대로 다시 듣게 됩니다.',
  '1화 식당의 내 차례는 마이크를 누르면 지나갑니다. 실제 앱은 내가 말한 소리를 듣습니다.',
  '식당 셀카의 학생 얼굴은 견본입니다. 실제 앱에서는 내가 고른 얼굴이 들어갑니다.',
  '한유나의 식당 장면과 「오늘」 한 장은 정지 사진과 목소리입니다. 태오의 「오늘」 한마디는 입이 맞는 영상입니다.',
  '화면 언어는 영어로만 넣었습니다. 몽골어는 공개 전 검수를 거친 뒤에 넣습니다.',
];
const 시험절 = 결과 ? `
<section class="sec" aria-labelledby="h-test">
 <h2 id="h-test">낯선 시험관에게 보인 결과</h2>
 <p>${esc(결과.한줄)}</p>
 ${결과.표.map((표) => `<h3>${esc(표.제목)}</h3>
 <div class="tbl"><table><thead><tr>${표.머리.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${표.줄.map((row) => `<tr>${row.map((c, i) => `<td${i && 표.숫자 && String(c).length <= 12 ? ' class="num"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('\n ')}
 <h3>읽는 법</h3>
 <ul class="note">${결과.읽는법.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
</section>` : '';

const html = `<title>선배 소개 시안</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gamja+Flower&family=Inter+Tight:wght@500;600&family=Nanum+Pen+Script&display=swap" rel="stylesheet">
${폰트.블록()}
<style>
[hidden]{display:none!important}
${fs.readFileSync(path.join(여기, '시안.css'), 'utf8')}
.ph{--noise:${결(0.9, [0.2, 0.18, 0.12], 0.07)};--pnoise:${결(1.3, [0.3, 0.25, 0.1], 0.06)};--cork:${결(0.55, [0.35, 0.22, 0.08], 0.3)};--seoha:url(img/seoha.jpg)}
.ph.tdon .hud{top:24px;left:auto;right:12px;width:40px;height:40px;background:transparent;box-shadow:inset 0 0 0 1px rgba(255,255,255,.3)}.ph.tdon .hud svg{stroke:#f2efe7}
@media (prefers-reduced-motion:reduce){.ph *{transition-duration:.01ms!important;animation-duration:.01ms!important;animation-delay:0s!important;transition-delay:0s!important}}
</style>
<div class="wrap">
<header>
 <p class="slate">SYNK WORLD · 시즌 1 · 학생증을 받은 뒤</p>
 <h1>선배 소개 — 움직이는 시안</h1>
 <p class="lead">학생증 뒷면의 포스트잇을 읽은 뒤, 부스 옆 게시판에서 학교 생활을 물어볼 선배 한 사람을 고르는 자리입니다. 고른 선배가 개강 첫날 식당, 첫 사진, 「오늘」 한 장까지 이어지는 것도 함께 볼 수 있습니다. 휴대폰 화면을 직접 눌러 보세요. 소리는 누른 뒤에 납니다.</p>
</header>

<section class="stage" aria-label="움직이는 시안">
 <div class="frame" id="frame"><div class="ph" id="ph">${휴대폰}</div></div>
 <div class="side">
  <div class="ctl" role="group" aria-label="보는 방법">
   <button class="btn main" type="button" data-run="try">처음부터 직접 해 보기</button>
   <button class="btn" type="button" data-run="auto-yuna">저절로 보기 · 한유나</button>
   <button class="btn" type="button" data-run="auto-taeo">저절로 보기 · 태오</button>
  </div>
  <ol class="steps">
   <li data-step="1"><span class="n">1</span><button type="button" data-run="step-1"><b>게시판에서 고르기.</b> 두 줄을 눌러 인사를 듣고 한 사람을 고릅니다.</button></li>
   <li data-step="2"><span class="n">2</span><button type="button" data-run="step-2"><b>포스트잇에 이름.</b> 서하가 붉은 펜으로 선배 이름을 적고, 선배에게는 「신입생이 와요」라고만 말해 둡니다.</button></li>
   <li data-step="3"><span class="n">3</span><button type="button" data-run="step-3"><b>개강 첫날 식당.</b> 포스트잇의 그 선배가 먼저 말을 겁니다. 이름을 말하는 순간 포스트잇이 다시 뜹니다.</button></li>
   <li data-step="4"><span class="n">4</span><button type="button" data-run="step-4"><b>첫 사진.</b> 밥을 먹고 찍은 사진이 앨범에 남습니다.</button></li>
   <li data-step="5"><span class="n">5</span><button type="button" data-run="step-5"><b>「오늘」 한 장.</b> 그 뒤로 매일 오늘 할 것을 말해 주는 사람도 고른 선배입니다.</button></li>
  </ol>
  <ul class="note">
   <li>번호를 누르면 그 자리로 건너뜁니다. 아직 고르지 않았으면 한유나로 보입니다.</li>
   <li>두 선배의 줄 순서는 열 때마다 섞입니다.</li>
  </ul>
 </div>
</section>

<section class="sec" aria-labelledby="h-keep">
 <h2 id="h-keep">이 화면이 지킨 것</h2>
 <p>이야기 지도 3-5에 적은 「이 자리가 지킬 것」을 화면으로 옮겼습니다.</p>
 <div class="tbl"><table><thead><tr><th>지킬 것</th><th>화면에서</th></tr></thead><tbody>
 ${지킨것.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('\n ')}
 </tbody></table></div>
</section>
${시험절}
<section class="sec" aria-labelledby="h-first">
 <h2 id="h-first">처음 안과 견주기</h2>
 <p>처음 안은 얼굴 사진 카드 두 장을 나란히 놓고 「누구랑 먹을래요?」라고 물었습니다. 글 시험에서 시험관 아홉 가운데 일곱이 소개팅이나 데이팅 앱 같다고 해서 지금 꼴로 바꿨습니다. 아래 단추를 누르면 위 휴대폰에서 처음 안을 볼 수 있습니다.</p>
 <div class="ctl"><button class="btn" type="button" data-run="first">처음 안 보기</button><button class="btn" type="button" data-run="try">지금 안으로 돌아가기</button></div>
</section>

<section class="sec" aria-labelledby="h-not">
 <h2 id="h-not">시안이 못 하는 것</h2>
 <ul class="note">${못하는것.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
</section>
</div>
<script>
const DATA = ${JSON.stringify({ seniors: 인물 })};
const DUR = ${JSON.stringify(길이)};
${fs.readFileSync(path.join(여기, '시안_재생.js'), 'utf8')}
</script>
`;
fs.writeFileSync(path.join(끝, 'index.html'), html);
const 파일 = {};
for (const d of ['img', 'snd', 'vid']) for (const n of fs.readdirSync(path.join(끝, d))) 파일[`${d}/${n}`] = path.join(끝, d, n).replace(/\\/g, '/');
fs.writeFileSync(path.join(끝, '파일.json'), JSON.stringify(파일, null, 1));
console.log('만듦', path.join(끝, 'index.html'), `· 그림 ${fs.readdirSync(path.join(끝, 'img')).length} · 소리 ${fs.readdirSync(path.join(끝, 'snd')).length}`, 메움.length ? `· 아직 굽지 않아 메운 그림: ${메움.join(', ')}` : '');
