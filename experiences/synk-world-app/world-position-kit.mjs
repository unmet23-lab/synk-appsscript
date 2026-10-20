// 「내 위치」(10-19 결정, docs/미니게임_TOPIK_I_학습기준.md §7-3)를 화면에 넘기는 한 묶음 — world-learning-ui.mjs
// createWorldEducation의 position. 진단 문항은 앱 서버가 내주지 않는 게임 원고(빈칸 베기·입장 검사·싱크타운 읽기)에서
// 오므로 앱 화면은 계정 묶음(world-account.bundle.mjs)으로, 혼자 여는 홈은 생활 묶음(content/life-standalone.mjs)으로 받는다.
// 한글 판은 Strata 한글 층(49글자·단원)과 한글 만나기가 진도를 두는 자리(progressKey)를 그대로 쓴다.
import * as core from './world-position.mjs';
import {DIAGNOSTIC_ITEMS,diagnosticLabel} from './world-diagnostic-items.mjs';
import {createPositionView} from './world-position-ui.mjs';
import {progressKey} from '../hangul-stage/learning.mjs';
import hangulLayer from '../../strata/hangul.json' with {type:'json'};

export const worldPosition=Object.freeze({...core,items:DIAGNOSTIC_ITEMS,label:diagnosticLabel,createView:createPositionView,
 hangulLayer:Object.freeze({letters:hangulLayer.letters,units:hangulLayer.units}),hangulProgressKey:progressKey});
