import {savedLang,setLang} from '../brand-opening/world-lang.mjs';

// 화면 언어의 계정 저장(10-19 1판). 고른 언어는 늘 이 기기(world-lang의 저장 키)에 있고, 계정이면 튜터 선택처럼
// 생활 기록(synk.life-korean.progress.v1)의 display 칸에도 둔다. 서버의 Play 계약은 값 속 이름을 보지 않고,
// 옛 판은 이 칸을 몰라도 보존한다(life-progress.mjs validate가 모르는 칸을 막지 않는다).
// choice: 이 페이지에서 계정 기록이 서기 전에 고른 화면 언어를 담는 상자 {language}(첫 화면 언어 단추 · 첫 실행 · 설정, 결정 11-02).
// 첫 계정 복원(scoped)이 한 번만 꺼내 쓰고 비운다 — 그 선택이 계정 값을 한 번 이기고 계정 칸에 쓰이며,
// 손님일 때 고른 언어가 그 뒤 다른 계정들을 덮지 않는다. 범위 밖(손님 · 불러오는 중) 기록에서는 꺼내지 않는다.
export function restoreDisplayLanguage({progress,choice=null}){
 const status=progress.status();
 if(!status.scoped||['loading','conflict','unreadable','stopped'].includes(status.phase)||status.rejected)return null;
 const preferred=choice?.language||null;
 if(choice)choice.language=null;
 if(preferred){
  setLang(preferred);
  if(progress.displayLanguage()!==preferred)try{progress.setDisplayLanguage(preferred);}catch{/* 저장 확인 화면이 따로 알린다. */}
  return preferred;
 }
 // 다른 기기에서 계정에 고른 언어가 이긴다(위 choice가 있으면 그 선택이 먼저). 계정에 아직 없으면 이 기기에서 고른 언어로 채운다.
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
