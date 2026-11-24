// 배우기 · 놀이 「준비 중」 안내(유호님 11-24): 스위치 한 줄 · 세 언어 글 · 사전예약 주소 · 셸 연결 · 공개 빌드 목록을 못박는다.
// 실제로 누르는 확인은 world-learn-soon-browser.test.mjs(Edge)가 한다.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {LEARN_SOON,SOON_TEXT,SOON_SCREENS,SOON_ENTRIES,SOON_HOME,SOON_HOME_ENTRIES,SOON_PANEL_ENTRIES,reserveHref,soonMarkup,soonTarget,installLearnSoon} from '../world-learn-soon.mjs';

const read=rel=>fs.readFileSync(new URL(`../../../${rel}`,import.meta.url),'utf8');

test('스위치는 한 줄이고 지금은 켜져 있다',()=>{
 const source=read('experiences/synk-world-app/world-learn-soon.mjs');
 assert.equal(source.match(/^export const LEARN_SOON=(true|false);$/gm)?.length,1,'LEARN_SOON 한 줄');
 assert.equal(LEARN_SOON,true);
});

test('세 언어 글이 같은 칸을 갖고, 한국어는 「준비 중」과 「2027년 2월」을 말한다',()=>{
 const keys=Object.keys(SOON_TEXT.ko).sort();
 for(const lang of ['ko','en','mn']){assert.deepEqual(Object.keys(SOON_TEXT[lang]).sort(),keys,lang);for(const key of keys)assert.ok(SOON_TEXT[lang][key].trim(),`${lang}.${key}`);}
 assert.match(SOON_TEXT.ko.title,/준비 중/);assert.match(SOON_TEXT.ko.lead,/2027년 2월/);
 assert.match(SOON_TEXT.en.lead,/February 2027/);assert.match(SOON_TEXT.mn.lead,/2027 оны 2-р сард/);
 // 사전예약 단추는 출시 안내 띠와 같은 말이다(launch-notice.js cta).
 const bar=read('experiences/launch-notice/launch-notice.js');
 for(const lang of ['ko','en','mn'])assert.ok(bar.includes(`cta: '${SOON_TEXT[lang].reserve}'`),`${lang} 사전예약 단추 = 띠`);
});

test('사전예약 주소는 화면 언어와 들어온 곳(world-learn)을 단다',()=>{
 assert.equal(reserveHref('mn'),'https://synk.im/reserve/?from=world-learn&lang=mn');
 assert.equal(reserveHref('en'),'https://synk.im/reserve/?from=world-learn&lang=en');
 assert.equal(reserveHref('ko'),'https://synk.im/reserve/?from=world-learn&lang=ko');
 assert.equal(reserveHref('es'),'https://synk.im/reserve/?from=world-learn&lang=ko','모르는 언어는 한국어');
});

test('안내 판: 사전예약 단추와 닫기, 데스크톱 앱 창은 사전예약 단추를 뺀다',()=>{
 const web=soonMarkup('mn',{art:'x.webp'});
 assert.match(web,/lang="mn"/);assert.match(web,/Удахгүй нээгдэнэ/);assert.match(web,/href="https:\/\/synk\.im\/reserve\/\?from=world-learn&amp;lang=mn"/);
 assert.match(web,/data-learn-soon-close/);assert.match(web,/<img class="learn-soon-art" src="x\.webp" alt=""/);
 const desk=soonMarkup('ko',{desktop:true});
 assert.doesNotMatch(desk,/learn-soon-reserve|learn-soon-note/);assert.match(desk,/learn-soon-close is-only/);
 // 닫기 단추는 홈 · 셸이 듣는 이름(data-close · data-world · data-view …)을 쓰지 않는다 — 판 밖 처리기가 다른 일을 하지 않게.
 assert.doesNotMatch(web,/data-(close|world|view|game|action|nav|launch)\b/);
});

test('꺼져 있으면 듣지 않고, 아무 단추도 막지 않는다',()=>{
 let added=0;const win={document:{},addEventListener:()=>added++};
 const off=installLearnSoon({win,on:false});
 assert.equal(added,0);assert.equal(typeof off.dispose,'function');
 const fake={closest:()=>({closest:()=>({querySelector:()=>true}),matches:()=>true})};
 assert.equal(soonTarget(fake,{on:false}),null);
 assert.ok(soonTarget(fake,{on:true}),'켜져 있으면 같은 단추를 막는다');
});

// 홈 카드 단추의 가짜 요소: 속성 선택자([이름] · [이름="값"])만 맞춰 본다.
function homeButton(attrs,{home=true}={}){
 const one=part=>{const m=/^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(part.trim());return !!m&&Object.hasOwn(attrs,m[1])&&(m[2]===undefined||attrs[m[1]]===m[2]);};
 const el={closest:sel=>sel==='button,a[href]'?el:sel===SOON_HOME&&home?{}:null,matches:sel=>sel.split(',').some(one)};
 return el;
}

test('우리 동네 홈 카드: 복습 · 내 위치 보기는 막고, 맞춤 연습 시작 · 카페 · 생활 팩 · 이야기는 지나간다(11-24 「홈도 막기」)',()=>{
 assert.equal(SOON_HOME,'.life-home-board');
 assert.ok(soonTarget(homeButton({'data-view':'position'})),'내 위치 보기');
 assert.ok(soonTarget(homeButton({'data-view':'review','data-life-review':''})),'복습 줄임 단추');
 assert.equal(soonTarget(homeButton({'data-view':'learn','data-life-next':''})),null,'맞춤 연습 시작(튜터 세션 몫)');
 // 학습 목표(study) 판은 열린다. 그 판 안의 「내 위치 보기」 줄만 막는다(아래 시험). 「이번 주 계획」(plan)은 11-25부터 막는다.
 for(const view of ['cafe','packs','stories','home','study'])assert.equal(soonTarget(homeButton({'data-view':view})),null,view);
 assert.equal(soonTarget(homeButton({'data-view':'position'},{home:false})),null,'홈 카드 밖의 내 위치 단추');
 assert.equal(soonTarget(homeButton({'data-view':'position'}),{on:false}),null,'꺼져 있으면');
 const home=fs.readFileSync(new URL('../../brand-opening/home.html',import.meta.url),'utf8');
 const board=home.slice(home.indexOf('class="lobby-action life-home-board"'),home.indexOf('</main>'));
 assert.match(board,/data-view="position"/);assert.match(board,/data-view="review" data-life-review/);assert.match(board,/id="life-next-button" data-view="learn" data-life-next/);
 assert.ok(SOON_HOME_ENTRIES.split(',').includes('[data-view="position"]')&&SOON_HOME_ENTRIES.split(',').includes('[data-view="review"]'),'홈 막는 단추 목록');
 assert.ok(!SOON_HOME_ENTRIES.includes('learn')&&!SOON_HOME_ENTRIES.includes('data-life-next'),'맞춤 연습 시작은 목록에 없다');
});

// 판 안 단추의 가짜 요소: 클래스(.이름)와 속성 선택자만 맞춰 본다. screen은 그 판이 막는 판인지.
function panelButton({cls=[],attrs={}},{screen=false}={}){
 const one=part=>{part=part.trim();if(part.startsWith('.'))return cls.includes(part.slice(1));const m=/^\[([a-z-]+)(?:="([^"]*)")?\]$/.exec(part);return !!m&&Object.hasOwn(attrs,m[1])&&(m[2]===undefined||attrs[m[1]]===m[2]);};
 const content={querySelector:()=>screen?{}:null};
 const el={closest:sel=>sel==='button,a[href]'?el:sel==='#panel-content'?content:null,matches:sel=>sel.split(',').some(one)};
 return el;
}

test('학습 목표 판의 「내 위치 보기」 줄과 홈 「이번 주 계획」도 막는다(11-25 Fable P2: 홈 막음을 돌아가는 길)',()=>{
 assert.equal(SOON_PANEL_ENTRIES,'.study-position-row');
 assert.ok(soonTarget(panelButton({cls:['life-row','study-position-row'],attrs:{'data-view':'position'}})),'학습 목표 판(막는 판 표시 없음)의 내 위치 줄');
 assert.equal(soonTarget(panelButton({cls:['quiet-button'],attrs:{'data-view':'position'}})),null,'막는 판이 아닌 판의 다른 단추는 지나간다');
 assert.equal(soonTarget(panelButton({cls:['life-row','study-position-row'],attrs:{'data-view':'position'}}),{on:false}),null,'꺼져 있으면');
 assert.ok(soonTarget(homeButton({'data-view':'plan'})),'홈 이번 주 계획');
 const ui=fs.readFileSync(new URL('../world-learning-ui.mjs',import.meta.url),'utf8');
 assert.match(ui,/class="life-row study-position-row" data-view="position"/,'학습 목표 판의 내 위치 줄');
 const home=fs.readFileSync(new URL('../../brand-opening/home.html',import.meta.url),'utf8');
 const board=home.slice(home.indexOf('class="lobby-action life-home-board"'),home.indexOf('</main>'));
 assert.match(board,/id="study-plan-button" data-view="plan"/,'홈 카드의 이번 주 계획');
});

test('막는 판과 단추 목록: 배우기 · 놀이 판의 들어가는 단추만, 돌아가기 · 닫기 · 학습 알림은 빼고',()=>{
 for(const screen of ['.life-hub','.life-pack-head','.life-stories-poster','.play-list','.play-more'])assert.ok(SOON_SCREENS.split(',').includes(screen),screen);
 for(const entry of ['[data-life-pack]','[data-life-lesson]','[data-life-next]','[data-life-review]','[data-life-stories]','[data-view]','[data-game]','[data-world-song]'])assert.ok(SOON_ENTRIES.includes(entry),entry);
 assert.match(SOON_ENTRIES,/\[data-world\]:not\(\[data-world\^="reminder-"\]\)/);
 assert.doesNotMatch(SOON_ENTRIES,/data-life-packs|data-close/);
});

test('로컬 시험 서버는 기본으로 끄고(data-learn-soon="off") SYNK_WORLD_LEARN_SOON=1이면 켠다, 공개본에는 끄는 표시가 없다',()=>{
 const server=read('experiences/synk-world-app/server.mjs'),source=read('experiences/synk-world-app/world-learn-soon.mjs');
 assert.ok(server.includes(`process.env.SYNK_WORLD_LEARN_SOON==='1'?'<html':'<html data-learn-soon="off"'`),'로컬 서버의 끄는 표시');
 assert.ok(source.includes(`if(doc.documentElement?.dataset?.learnSoon==='off')return;`),'모듈이 끄는 표시를 읽는다');
 for(const page of ['experiences/brand-opening/home.html','experiences/synk-world-app/document.mjs','tools/build-world-app-public.mjs'])assert.doesNotMatch(read(page),/data-learn-soon/,page);
});

test('셸이 켜고, 공개 빌드가 모듈을 싣는다',()=>{
 const shell=read('experiences/synk-world-app/app-shell.mjs');
 assert.match(shell,/^import \{installLearnSoon\} from '\.\/world-learn-soon\.mjs';$/m);
 assert.match(shell,/^installLearnSoon\(\{lang:currentLang,art:worldUrl\('brand-opening\/assets\/world-felt\/plans\.webp'\)\}\);$/m);
 assert.ok(fs.existsSync(new URL('../../brand-opening/assets/world-felt/plans.webp',import.meta.url)),'펠트 그림');
 assert.match(read('tools/build-world-app-public.mjs'),/'world-learn-soon\.mjs'/);
});
