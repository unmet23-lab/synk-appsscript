import {savedLang,setLang} from '../brand-opening/world-lang.mjs';

// 화면 언어의 계정 저장(10-19 1판). 고른 언어는 늘 이 기기(world-lang의 저장 키)에 있고, 계정이면 튜터 선택처럼
// 생활 기록(synk.life-korean.progress.v1)의 display 칸에도 둔다. 서버의 Play 계약은 값 속 이름을 보지 않고,
// 옛 판은 이 칸을 몰라도 보존한다(life-progress.mjs validate가 모르는 칸을 막지 않는다).
export function restoreDisplayLanguage({progress}){
 const status=progress.status();
 if(!status.scoped||['loading','conflict','unreadable','stopped'].includes(status.phase)||status.rejected)return null;
 // 다른 기기에서 계정에 고른 언어가 이긴다. 계정에 아직 없으면 이 기기에서 고른 언어로 채운다.
 const saved=progress.displayLanguage();
 if(saved){setLang(saved);return saved;}
 const device=savedLang();
 if(device)try{progress.setDisplayLanguage(device);}catch{/* 저장 확인 화면이 따로 알린다. */}
 return device;
}

export async function commitDisplayLanguage({progress,language,guard=()=>{}}){
 guard();
 if(!progress?.status().scoped)return {saved:true,mode:'device'};
 progress.setDisplayLanguage(language);
 try{await progress.flush();}catch{/* 보내지 못한 변경은 기록의 대기열에 남는다. */}
 guard();
 const status=progress.status();
 return {saved:status.saved===true,mode:'account',pending:status.saved!==true};
}
