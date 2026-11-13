import {readConfig} from '../synk-account/src/core.mjs';
// 켜고 끄는 기능(설정값): 이 판이 아는 이름이 참일 때만 넘긴다. 켜진 것이 없으면 칸을 쓰지 않는다(공개 설정 줄이 그대로).
// worldFeedback: 연습 끝 화면의 학습자 응답과 「내 계정」의 응답 목록(WORLD 학습자 응답 설계 §6 — 처리방침 문장을 게시한 뒤 켠다).
// worldPush: 학습 알림 2단 「앱을 닫아도 받기」의 화면(설정 줄·동의 상자·손님·아이폰 안내)과 시작 때 상태 읽기(학습 알림 2단 설계 §8 —
// 처리방침 문장을 게시하고 서버 스위치 SYNK_WORLD_PUSH_ENABLED를 켠 뒤 켠다. 서버 스위치는 그 뒤로도 비상 끄기로 남는다).
// atlasNext: Atlas 재설계 단계 4의 새 길(코치 3판 · 엔진이 고르는 짧은 연습 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §6).
// 짓는 동안은 리허설 개발 서버에서만 켠다(SYNK_WORLD_FEATURES=atlasNext). 사용자에게 켜는 것은 WORLD의 모든 면이 새 길을 다 지은 뒤(4-8)다.
// atlasNextGuest: 손님(로그인 전)에게도 새 길(기기가 원천인 손님 저장소)을 준다 — atlasNext가 켜졌을 때만 뜻이 있다. 계정은 서버 스위치
// (SYNK_ATLAS_TRAIL)로 일부부터 켜고, 손님은 이 깃발로 따로 켠다(단계4_계획 §6 스위치 세 겹 — 없으면 atlasNext를 공개 설정에 넘기는 순간
// 손님 전원이 새 길이었다, Fable 5.2 끝 판 둘째 F1 · 설계 주인 11-13). 리허설에서 손님 새 길을 보려면 SYNK_WORLD_FEATURES=atlasNext,atlasNextGuest.
const FEATURES=Object.freeze(['worldFeedback','worldPush','atlasNext','atlasNextGuest']);
// 공개(account) 설정에는 아직 넘기지 않는 이름 — 4-8에서 이 줄을 거둔다(손님 깃발은 계정 카나리를 본 뒤 따로).
const REHEARSAL_ONLY=new Set(['atlasNext','atlasNextGuest']);
function publicFeatures(value){
 const on=FEATURES.filter(name=>value?.features?.[name]===true&&(value.mode==='rehearsal'||!REHEARSAL_ONLY.has(name)));
 return on.length?{features:Object.fromEntries(on.map(name=>[name,true]))}:{};
}
export function publicWorldConfig(value,base){
 if(!value||!['rehearsal','account'].includes(value.mode))throw new TypeError('WORLD connection mode is required');
 const basePath=value.basePath||'/';
 if(!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath))throw new TypeError('Invalid WORLD base path');
 if(value.mode==='rehearsal')return {mode:'rehearsal',basePath,...publicFeatures(value)};
 const account=readConfig(value.account,base);
 if(!account.configured||!account.clients.world.clientId||!account.clients.world.redirectUri)throw new TypeError('Configured public WORLD account is required');
 // readConfig rejects secret/service-role keys and private client fields.
 const {configured,...publicAccount}=account;
 return {mode:'account',basePath,account:publicAccount,...publicFeatures(value)};
}
export async function loadWorldConfig({value=globalThis.__SYNK_WORLD_CONFIG__,base=globalThis.location.href,fetcher=(...args)=>globalThis.fetch(...args)}={}){
 if(value)return publicWorldConfig(value,base);
 const response=await fetcher(new URL('./world-config.json',base).href,{credentials:'omit',cache:'no-store'});
 if(!response.ok)throw new Error('WORLD 계정 연결 설정을 불러오지 못했어요.');
 return publicWorldConfig(await response.json(),base);
}
