// 개인화 화면 글 고침(2026-11-09) — 공개본 계정 묶음에 끼운 이번 주 계획 줄을 실제로 돌린다(프론트후속_공개검사.mjs와 같은 방식).
// 글고침_공개묶음.cjs가 만든 check/ 폴더의 묶음을 import해 같은 계획을 이 작업본의 원천 판과 나란히 그리고, 머리 · 이번 주 칸이 글자까지 같은지 본다. 다르면 멈춘다(종료 코드 1).
//   node docs/_ops/qa/atlas-world-engine-20261108/글고침_공개검사.mjs <check 폴더>
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const dir=path.resolve(process.argv[2]||'');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const at=file=>pathToFileURL(path.join(dir,file)).href,src=file=>pathToFileURL(path.join(ROOT,file)).href;
const live=await import(at('world-account.bundle.mjs')),before=await import(at('live-account.bundle.mjs'));
const source=(await import(src('experiences/synk-world-app/world-position-kit.mjs'))).worldPosition;
const checks=[];const check=(name,fn)=>{fn();checks.push(name);};
const t=(key,values)=>values?`${key}(${Object.entries(values).map(([k,v])=>`${k}=${v}`).join(',')})`:key;
const view=side=>side.createView({t,has:()=>true});
const plan=over=>({exam:{type:'topik1'},week:{start:'2026-11-09'},sessions:{total:3,minutes:15},notes:[],homework:[],checks:[],reach:{confirmed:0,total:16,evidence:1},progress:{listening:{checked:0,total:8},reading:{checked:1,total:8}},
 areas:[{area:'recheck',planned:1,done:0},{area:'listening',planned:1,done:0},{area:'reading',planned:1,done:0},{area:'life',planned:0,done:1}],...over});
const poster=html=>html.match(/<div class="life-poster wpos-poster">[\s\S]*?<\/div>/)[0];
const week=html=>html.match(/<section class="wplan-week">[\s\S]*?<\/section>/)[0];
const both=over=>{const p=plan(over),a=view(live.worldPosition).renderExamPlan({plan:p}),b=view(source).renderExamPlan({plan:p});return {a,b};};

check('끼우기 전 공개본은 옛 머리다(이 검사가 새 줄을 보고 있다)',()=>{
 const html=view(before.worldPosition).renderExamPlan({plan:plan()});
 assert.match(html,/plan\.week\.sessions\(n=3,minutes=15\)/);assert.doesNotMatch(html,/plan\.week\.word/);
});
check('이번 주 계획이 있으면: 큰 제목은 연습 수, 칸 머리는 한 번 길이 — 원천 판과 글자까지 같다',()=>{
 const {a,b}=both();
 assert.equal(poster(a),poster(b));assert.equal(week(a),week(b));
 assert.match(poster(a),/plan\.week\.word\(n=3\)/);assert.match(week(a),/<h3>plan\.week\.length\(minutes=15\)<\/h3>/);
});
check('계획 밖에 한 줄은 아래로 가른다 — 큰 제목의 수에 드는 줄만 위에 남는다',()=>{
 const {a}=both(),html=week(a),[top,rest]=html.split('plan.area.extraTitle');
 assert.ok(rest,'계획 밖 머리가 있다');
 assert.equal((top.match(/<li data-area=/g)||[]).length,3,'계획에 든 셋');
 assert.equal((rest.match(/<li data-area=/g)||[]).length,1,'계획 밖 하나');
 assert.match(rest,/data-area="life"[\s\S]*plan\.area\.extraDays\(done=1,n=1\)/);
});
check('계획 밖이 없으면 그 머리도 없다 · 계획이 비면 옛 제목에 칸 머리 없음 — 원천 판과 같다',()=>{
 const planned=both({areas:plan().areas.slice(0,3)});
 assert.equal(week(planned.a),week(planned.b));assert.doesNotMatch(week(planned.a),/plan\.area\.extraTitle/);
 const empty=both({sessions:{total:0,minutes:0},areas:[{area:'life',planned:0,done:2}]});
 assert.equal(poster(empty.a),poster(empty.b));assert.equal(week(empty.a),week(empty.b));
 assert.match(poster(empty.a),/plan\.week\.title/);assert.doesNotMatch(week(empty.a),/<h3>/);
});
console.log(checks.map(name=>`통과 — ${name}`).join('\n'));
console.log(`${checks.length}/${checks.length}`);
