import {readConfig} from '../synk-account/src/core.mjs';
// 켜고 끄는 기능(설정값): 이 판이 아는 이름이 참일 때만 넘긴다. 켜진 것이 없으면 칸을 쓰지 않는다(공개 설정 줄이 그대로).
// worldFeedback: 연습 끝 화면의 학습자 응답과 「내 계정」의 응답 목록(WORLD 학습자 응답 설계 §6 — 처리방침 문장을 게시한 뒤 켠다).
const FEATURES=Object.freeze(['worldFeedback']);
function publicFeatures(value){
 const on=FEATURES.filter(name=>value?.features?.[name]===true);
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
