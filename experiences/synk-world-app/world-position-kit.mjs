// 「내 위치」(10-19 결정, docs/미니게임_TOPIK_I_학습기준.md §7-3)를 화면에 넘기는 한 묶음 — world-learning-ui.mjs
// createWorldEducation의 position. 진단 문항은 앱 서버가 내주지 않는 게임 원고(빈칸 베기·입장 검사·싱크타운 읽기)에서 오므로
// 앱 화면은 계정 묶음(world-account.bundle.mjs)으로, 혼자 여는 홈은 생활 묶음(content/life-standalone.mjs)으로 받는다.
// 한글 판은 Strata 한글 층(49글자·단원)과 한글 만나기가 진도를 두는 자리(progressKey)를 그대로 쓴다.
// 10-20 TOPIK 맞춤 재설계: 읽기 짧은 연습(문항 검수 판정 목록에서 통과한 문항만)과 시험 계획도 같은 묶음으로 넘긴다.
// 10-21 ④: 공개 TOPIK 은행(world-topik-items.json, 검수 통과 문항만)은 묶음에 싣지 않고 topik.load(url)로 필요할 때 불러온다.
// 그 뒤로 진단·짧은 연습·시험 형식 연습의 문항 풀은 「검수를 통과한 기존 문항 + 은행 문항」이다 — 판정이 없는 게임 원고 문항
// (바람길 지시문·리듬 O/X·레이싱 낱말)은 진단에서 빠졌다(최종 제안 §2-2 #8 · 학생에게는 검수 통과 문항만).
import * as core from './world-position.mjs';
import {DIAGNOSTIC_ITEMS,diagnosticLabel} from './world-diagnostic-items.mjs';
import {createPositionView} from './world-position-ui.mjs';
import {progressKey} from '../hangul-stage/learning.mjs';
import hangulLayer from '../../strata/hangul.json' with {type:'json'};
import verdicts from '../topik-items/review/existing-verdicts.json' with {type:'json'};
import * as reading from './world-reading-practice.mjs';
import * as exam from './world-exam-plan.mjs';
import * as examForm from './world-exam-form.mjs';
import {createTopikBank} from './world-topik-items.mjs';
import {positionCheckCandidate} from './world-learning-plan.mjs';
import {supplementalItems} from '../korean-rhythm/supplemental.mjs';
import {worldMap} from './world-learning-map.mjs';
const followupBank=createTopikBank();

const topik=createTopikBank();
// 검수를 통과한 기존 문항(판정 목록의 pass, 메타가 같은 것). 바람길 듣기 확인(행동 지시문)과 말의 리듬(물음 없는 O/X)은
// 판정을 통과해도 진단에 내지 않는다 — 시험 듣기와 다른 형식이라서(최종 제안 §2-2 #8, 10-21 ④). 그 게임 안의 연습은 그대로다.
const NOT_EXAM_FORM=new Set(['korean-runner','korean-rhythm']);
const passed=reading.passedItems({items:DIAGNOSTIC_ITEMS,verdicts,modalities:['listening','reading']}).filter(item=>!NOT_EXAM_FORM.has(item.source));
// 빈칸 베기는 공식 유형표(strata/topik-types.json games)에서 TOPIK I 34~39번 빈칸 4지와 이어진다(「문항 내용은 시험형 빈칸 그대로」) —
// 은행에 그 유형이 없어 시험 형식 연습의 그 자리를 검수 통과 빈칸 베기 문항으로 채운다.
const asTopik34=item=>Object.freeze({...item,exam:'topik-i',form:'pbt',officialType:'TI-R-34'});
let cached=null;
function pools(){
 if(cached?.bank===topik.items)return cached;
 const bank=topik.items,ids=new Set(passed.map(item=>item.id));
 cached={bank,
  diagnostic:Object.freeze([...passed,...bank.filter(item=>!ids.has(item.id))]),
  practice:reading.practicePool({items:DIAGNOSTIC_ITEMS,verdicts,bank:[...bank,...supplementalItems()]}),
  mock:Object.freeze([...bank,...passed.filter(item=>item.source==='blank-slice'&&item.choices.length===4).map(asTopik34)]),
  byId:new Map([...DIAGNOSTIC_ITEMS,...bank,...supplementalItems()].map(item=>[item.id,item]))};
 return cached;
}
export const worldPosition=Object.freeze({...core,
 // 짧은 진단 문항 풀(검수 통과 기존 문항 + 은행). 은행을 불러오면 그 문항이 더해진다.
 get items(){return pools().diagnostic;},
 get itemsById(){return pools().byId;},
 label:itemKey=>diagnosticLabel(itemKey)??topik.label(itemKey),
 createView:createPositionView,
 hangulLayer:Object.freeze({letters:hangulLayer.letters,units:hangulLayer.units}),hangulProgressKey:progressKey,
 topik,
 followups:Object.freeze({bank:followupBank,pool:seen=>[...followupBank.items,...supplementalItems({purpose:'delayed',seen})]}),
 recommendedBefore:id=>worldMap.recommendedBefore(id),
 practice:Object.freeze({...reading,get pool(){return pools().practice;}}),
 exam:Object.freeze({...exam}),
 mock:Object.freeze({...examForm,get pool(){return pools().mock;},get forms(){return topik.forms;}}),
 checkCandidate:positionCheckCandidate});
