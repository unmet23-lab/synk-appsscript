import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {DIAGNOSTIC_ITEMS,DIAGNOSTIC_GAPS,diagnosticLabel} from '../world-diagnostic-items.mjs';
import {selectDiagnostic,createDiagnosticSession,buildPositionMap} from '../world-position.mjs';
import {LISTENING_CHECKS,checkMetadata} from '../../korean-runner/listening-check.mjs';
import {TRACKS} from '../../korean-rhythm/core.mjs';
import {rhythmItem} from '../../korean-rhythm/personalization.mjs';
import {ITEMS as BLANKS} from '../../blank-slice/content.mjs';
import {itemMetadata as blankMetadata} from '../../blank-slice/learning.mjs';
import {READING_CHECKS,readingMetadata} from '../../synk-town/understanding.mjs';
import {VENUES} from '../../entry-check/content.mjs';
import {caseMetadata} from '../../entry-check/learning.mjs';

const require=createRequire(import.meta.url);
const worldLearning=require('../../../atlas/game-browser.js');
const experiences=fileURLToPath(new URL('../../',import.meta.url));
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
let tick=Date.parse('2026-10-19T01:00:00Z');
const coach=()=>worldLearning.engine.createGame({gameId:'world-home',storage:memory(),clock:()=>new Date(tick+=1000).toISOString()});
const SKILLS=['ko.listening.word','ko.listening.detail','ko.listening.negation','ko.listening.sequence','ko.listening.reason','ko.listening.condition','ko.listening.main',
 'ko.reading.vocabulary','ko.reading.grammar','ko.reading.detail','ko.reading.negation','ko.reading.sequence','ko.reading.reason','ko.reading.condition','ko.reading.main'];

test('묶음의 문항은 모두 그 게임의 메타 함수와 같은 열쇠다(새 문항을 만들지 않는다)',()=>{
 const expected=new Map();
 for(const item of LISTENING_CHECKS)expected.set(checkMetadata(item).itemKey,checkMetadata(item));
 for(const track of TRACKS)track.questions.forEach((_,index)=>{for(const variant of [0,1]){const meta=rhythmItem(track.id,{sourceIndex:index,variant});expected.set(meta.itemKey,meta);}});
 for(const item of BLANKS)expected.set(blankMetadata(item).itemKey,blankMetadata(item));
 for(const item of READING_CHECKS)expected.set(readingMetadata(item).itemKey,readingMetadata(item));
 for(const venue of VENUES)for(const item of venue.cases)expected.set(caseMetadata(item).itemKey,caseMetadata(item));
 for(const item of DIAGNOSTIC_ITEMS){
  const meta=expected.get(item.itemKey);assert.ok(meta,`원고에 없는 문항 ${item.itemKey}`);
  for(const key of ['id','familyKey','skillId','difficulty','modality','responseFormat','audioRequired'])assert.deepEqual(item[key],meta[key],`${item.itemKey} ${key}`);
 }
 assert.equal(new Set(DIAGNOSTIC_ITEMS.map(item=>item.familyKey)).size,DIAGNOSTIC_ITEMS.length,'한 계열은 한 번만');
 assert.equal(new Set(DIAGNOSTIC_ITEMS.map(item=>item.id)).size,DIAGNOSTIC_ITEMS.length);
 // 입장 검사는 글만으로 풀게 쓴 손님만, 리듬은 계열마다 한 갈래만.
 assert.ok(DIAGNOSTIC_ITEMS.filter(item=>item.source==='entry-check').every(item=>VENUES.some(venue=>venue.cases.some(c=>caseMetadata(c).itemKey===item.itemKey&&c.textOnly))));
 assert.equal(DIAGNOSTIC_ITEMS.filter(item=>item.source==='korean-rhythm').length,15);
});

test('모든 문항이 실제 코치의 제시 검사를 통과하고, 보기·정답·소리가 다 있다',()=>{
 const c=coach();
 for(const item of DIAGNOSTIC_ITEMS){
  assert.doesNotThrow(()=>c.present(item),item.itemKey);
  assert.ok(item.choices.length>=2&&item.choices.every(choice=>choice.id&&choice.label),item.itemKey);
  assert.equal(new Set(item.choices.map(choice=>choice.id)).size,item.choices.length,item.itemKey);
  assert.equal(item.choices.filter(choice=>choice.id===item.correctId).length,1,item.itemKey);
  const listening=item.modality==='listening';
  assert.equal(item.audioRequired,listening,item.itemKey);
  if(listening){assert.ok(item.audio,item.itemKey);assert.ok(fs.existsSync(`${experiences}${item.audio}`),`소리 파일 ${item.audio}`);}
  else{assert.equal(item.audio,null);assert.ok(item.prompt||item.card||item.question,item.itemKey);}
  assert.ok(diagnosticLabel(item.itemKey),item.itemKey);
 }
});

test('할 일 지시(ask)는 빈칸 베기·입장 검사에만 있고, 화면 언어 표에 그 줄이 있다',async()=>{
 const {default:STRINGS}=await import('../../brand-opening/world-strings.mjs');
 for(const item of DIAGNOSTIC_ITEMS){
  const expected={'blank-slice':'blank','entry-check':'entry'}[item.source]??undefined;
  assert.equal(item.ask,expected,item.itemKey);
  if(item.ask)assert.equal(STRINGS[`position.diagnostic.ask.${item.ask}`]?.ko,item.question,item.itemKey);
 }
});

test('15개 항목 중 다루는 것과 모자란 것이 정확히 나뉜다',()=>{
 const covered=new Set(DIAGNOSTIC_ITEMS.map(item=>item.skillId));
 assert.deepEqual(SKILLS.filter(id=>!covered.has(id)),Object.keys(DIAGNOSTIC_GAPS));
 assert.equal(covered.size,12);
});

test('정답이 자리나 O/X 한쪽으로 쏠리지 않는다',()=>{
 const rhythm=DIAGNOSTIC_ITEMS.filter(item=>item.source==='korean-rhythm').map(item=>item.correctId);
 assert.ok(rhythm.includes('korean-rhythm.o')&&rhythm.includes('korean-rhythm.x'));
 const blank=new Set(DIAGNOSTIC_ITEMS.filter(item=>item.source==='blank-slice').map(item=>item.choices.findIndex(choice=>choice.id===item.correctId)));
 assert.deepEqual([...blank].sort(),[0,1,2,3]);
 // 원고 순서가 늘 첫 보기 정답인 빈칸 베기도, 문항 대부분에서 첫 자리가 아니다.
 const first=DIAGNOSTIC_ITEMS.filter(item=>item.source==='blank-slice'&&item.choices[0].id===item.correctId).length;
 assert.ok(first<DIAGNOSTIC_ITEMS.filter(item=>item.source==='blank-slice').length/2);
});

test('처음 온 사람의 진단은 12문항(항목당 하나·새 계열)이고 세 항목은 모자람으로 돌려준다',()=>{
 const c=coach(),plan=selectDiagnostic({summary:c.summary(),items:DIAGNOSTIC_ITEMS,seen:item=>c.exposure(item).seen});
 assert.equal(plan.status,'ready');assert.equal(plan.items.length,12);
 assert.deepEqual(plan.missing,[{skillId:'ko.listening.word',reason:'no-item'},{skillId:'ko.reading.reason',reason:'no-item'},{skillId:'ko.reading.main',reason:'no-item'}]);
 assert.equal(new Set(plan.items.map(row=>row.skillId)).size,12);
 // 같은 항목에 보기 고르기 문항이 있으면 O/X보다 먼저.
 for(const row of plan.items)if(['ko.listening.detail','ko.listening.negation'].includes(row.skillId))assert.equal(row.item.source,'korean-runner');
 const quiet=selectDiagnostic({summary:c.summary(),items:DIAGNOSTIC_ITEMS,seen:item=>c.exposure(item).seen,audioAvailable:false});
 assert.equal(quiet.items.length,6);assert.ok(quiet.items.every(row=>row.item.modality==='reading'));
});

test('진단 한 바퀴: 답은 혼자 푼 첫 시도로 남고, 다음 진단은 모두 다른 계열에서 고른다',()=>{
 const c=coach(),first=selectDiagnostic({summary:c.summary(),items:DIAGNOSTIC_ITEMS,seen:item=>c.exposure(item).seen});
 const session=createDiagnosticSession({coach:c,items:first.items});
 let view;while((view=session.next())){if(view.item.audioRequired)session.delivery('completed');session.answer(view.item.correctId);}
 const results=session.results();
 assert.equal(results.length,12);assert.ok(results.every(row=>row.verdict==='correct'&&row.independent===true&&row.skipped===false));
 const map=buildPositionMap({summary:c.summary(),events:c.events()});
 assert.deepEqual(map.counts,{independent:0,practicing:12,notyet:3},'한 문항만으로는 혼자 해냄이 되지 않는다');
 assert.ok(map.skills.filter(skill=>skill.cell==='practicing').every(skill=>skill.status==='checking'&&skill.evidence.length===1));
 const second=selectDiagnostic({summary:c.summary(),items:DIAGNOSTIC_ITEMS,seen:item=>c.exposure(item).seen});
 const used=new Set(first.items.map(row=>row.item.familyKey));
 assert.ok(second.items.every(row=>!used.has(row.item.familyKey)));
 // 듣기 조건 문항은 하나뿐이라 두 번째 진단에서는 모자람으로 돌아온다.
 assert.deepEqual(second.missing.find(row=>row.skillId==='ko.listening.condition'),{skillId:'ko.listening.condition',reason:'all-seen'});
});
