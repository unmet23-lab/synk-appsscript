// WORLD 화면 마감(2026-11-09): synk.im 「쓸수록 달라지는 것」에 실제 화면 조각으로 실린 자리의 결함이 되살아나지 않게 지킨다.
// 이유 문장의 낫표는 experiences/brand-opening/qa/world-lang.test.mjs, 화면 측정은 docs/디자인/synk.im_개인화면_20261108/README.md 7절.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const homeJs=read('../../brand-opening/home.mjs'),homeCss=read('../../brand-opening/home.css'),lifeCss=read('../life-ui.css'),lifeJs=read('../life-ui.mjs');
const rule=(css,selector)=>{const at=css.indexOf(`${selector}{`);assert.ok(at>=0,`규칙이 없다: ${selector}`);return css.slice(at+selector.length+1,css.indexOf('}',at));};

test('홈이 스크립트로 초점을 주는 단추는 키보드를 쓰기 전에는 고리를 그리지 않는다',()=>{
 const targets=homeJs.match(/function focusHomeAction\(\)\{\[\.\.\.document\.querySelectorAll\('([^']+)'\)\]/)?.[1];
 assert.ok(targets,'focusHomeAction이 고르는 단추 목록을 못 읽었다');
 const quiet=homeCss.match(/html:not\(\[data-input=keyboard\]\) :is\(([^)]+)\):focus-visible\{outline:none\}/)?.[1];
 assert.ok(quiet,'고리를 끄는 규칙이 없다');
 // focusHomeAction에 단추를 더하면 이 규칙에도 더해야 한다(첫 화면 흰 단추의 이중 고리가 되살아난다).
 for(const target of targets.split(','))assert.ok(quiet.split(',').includes(target),`고리 규칙에 없다: ${target}`);
 // 키를 누르면 바로 보이고, 화면을 누르면 다시 숨는다.
 assert.match(homeJs,/addEventListener\('keydown',event=>\{if\(!\['Shift','Control','Alt','Meta'\]\.includes\(event\.key\)\)document\.documentElement\.dataset\.input='keyboard';\},true\)/);
 assert.match(homeJs,/addEventListener\('pointerdown',\(\)=>\{document\.documentElement\.dataset\.input='pointer';\},true\)/);
 // 전체 초점 규칙은 그대로다 — 끄는 것은 위 단추의 키보드 전 상태뿐이다.
 assert.match(homeCss,/^:focus-visible\{outline:2px solid var\(--w-ink\);outline-offset:3px\}/m);
});

test('튜터 카드 이유 줄은 세 줄까지 — 두 줄 제한은 좁은 폰에서 문장 끝을 잘랐다',()=>{
 assert.match(rule(homeCss,'#home-tutor .home-tutor-context'),/-webkit-line-clamp:3/);
 assert.doesNotMatch(homeCss,/\.home-tutor-context\{-webkit-line-clamp:2/);
});

test('다시 확인 1 · 7 · 30일은 눌리는 칸이 아니라 1px 선으로 나눈 글 세 칸이다',()=>{
 const step=rule(lifeCss,'.wfol-steps>li');
 for(const tile of ['background','box-shadow','border-radius','border:'])assert.ok(!step.includes(tile),`칸에 ${tile}이 되살아났다 — 단추처럼 보인다`);
 assert.match(step,/border-left:1px solid var\(--w-line-2\)/);
 assert.ok(!lifeCss.includes('.wfol-steps>li[data-status=due]{'),'지금 칸의 테두리가 되살아났다 — 고른 단추처럼 보인다');
 // 작은 점 타임라인은 이 구역 첫 시안에서 기각된 꼴이다(슬롭 점검표 36 · docs/디자인/그래프_문법.md).
 assert.doesNotMatch(lifeCss,/\.wfol-steps>li[^{]*::(?:before|after)\{/,'점 타임라인이 되살아났다');
 const windowName=rule(lifeCss,'.wfol-window');
 assert.ok(!windowName.includes('--w-mono'),'고정폭 글꼴은 관리 화면처럼 읽혔다');
 assert.match(windowName,/font-size:13px/,'한글은 13px 밑으로 내리지 않는다');
});

test('돌아올 · 돌아온 표현 목록의 머리는 화면 언어다',()=>{
 for(const old of ['>COMING BACK<','>BACK AGAIN<',"'BACK AGAIN'"])assert.ok(!lifeJs.includes(old),`영어 머리가 되살아났다: ${old}`);
 assert.ok(lifeJs.includes(`<p class="life-section-label\${listHead()}">\${t('life.comingBack')}</p>`));
 assert.ok(lifeJs.includes(`<p class="life-section-label\${listHead()}">\${t(s.dueCount>s.dueReviews.length?'life.reviewFirstList':'life.backWord')}</p>`));
 assert.ok(lifeJs.includes(`learnedList(items,t('life.reviewedList'),listHead(),`));
 // 디자인 규칙: 한글은 모노로 쓰지 않고 13px 밑으로 내리지 않는다(docs/디자인/월드_시그널/README.md) — 한국어 화면에서만 모노 라벨 꼴을 벗는다.
 assert.match(lifeJs,/const listHead=\(\)=>currentLang\(\)==='ko'\?' is-text':'';/);
 const text=rule(lifeCss,'.life-section-label.is-text');
 assert.match(text,/font-family:var\(--w-sans\)/);assert.match(text,/font-size:13px/);assert.match(text,/letter-spacing:0/);assert.match(text,/text-transform:none/);
 // 글자마다 찍는 타이핑은 영문 모노 라벨의 움직임이다.
 assert.ok(!/querySelectorAll\('[^']*\.life-section-label(?!:not\(\.is-text\))[^']*'\)/.test(lifeJs),'화면 언어 머리에 타이핑이 걸린다');
});
// 11-09 다듬기 세션 F1: 내 위치 · 연습 화면에 남았던 작은 한글 둘 — 근거 줄 날짜(12px 모노)와 한국어 항목 이름 라벨(11px 모노 대문자).
test('내 위치 · 연습 화면도 한국어를 모노 · 13px 밑으로 쓰지 않는다(근거 날짜 · 항목 이름 라벨)',()=>{
 const time=rule(lifeCss,'.wpos-evidence time');
 assert.doesNotMatch(time,/--w-mono/);assert.match(time,/font-size:13px/);
 const label=rule(lifeCss,'html[lang=ko] :is(.wpos-run-skill,.wpos-change>.life-section-label)');
 assert.match(label,/font-family:var\(--w-sans\)/);assert.match(label,/font-size:13px/);assert.match(label,/letter-spacing:0/);assert.match(label,/text-transform:none/);
});
