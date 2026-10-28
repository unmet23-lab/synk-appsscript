// 등록된 WORLD OAuth 콜백을 한국어 공부 로그인에도 사용한다. WORLD 화면·기록은 열지 않는다.
// 돌아갈 주소를 입력받지 않고 /study/로 고정한다. intent는 같은 탭의 PKCE state와 만료 시각에 묶인다.
export const STUDY_INTENT='synk.study.login.intent',STUDY_SESSION='synk.oauth.session.study';
const age=(at,now)=>Number.isFinite(at)&&at<=now&&now-at<=600000;
export function rememberStudyLogin(storage,{now=Date.now()}={}){
 const p=JSON.parse(storage.getItem('synk.oauth.pending.world')||'null');
 if(!p||typeof p.state!=='string'||p.state.length<32||!age(p.createdAt,now))throw Error('로그인을 다시 시작해 주세요.');
 const intent={v:1,state:p.state,createdAt:p.createdAt,redirectUri:p.redirectUri,clientId:p.clientId};
 storage.setItem(STUDY_INTENT,JSON.stringify(intent));return intent;
}
export function studyCallbackIntent({storage,url,product,now=Date.now()}){
 if(product!=='world')return null;
 const raw=storage.getItem(STUDY_INTENT);if(!raw)return null;
 const clear=()=>{storage.removeItem(STUDY_INTENT);return null;};
 let intent,p;try{intent=JSON.parse(raw);p=JSON.parse(storage.getItem('synk.oauth.pending.world')||'null');}catch{return clear();}
 const u=new URL(url);
 if(u.searchParams.has('error'))return clear();
 if(!u.searchParams.has('code')&&!u.searchParams.has('error'))return clear();
 if(intent?.v!==1||!age(intent.createdAt,now)||!p||intent.state!==p.state||u.searchParams.get('state')!==p.state
   ||intent.clientId!==p.clientId||intent.redirectUri!==p.redirectUri)return clear();
 // URL·code·PKCE 검증은 바로 뒤의 consumeCallback이 수행한다. 이 함수는 용도 결속만 맡는다.
 return intent;
}
export function finishStudyLogin(storage,session,intent){
 const live=JSON.parse(storage.getItem(STUDY_INTENT)||'null');
 if(!intent||live?.state!==intent.state||typeof session?.access_token!=='string'||!session.access_token)throw Error('로그인 연결이 바뀌었어요. 다시 시작해 주세요.');
 storage.setItem(STUDY_SESSION,JSON.stringify(session));storage.removeItem(STUDY_INTENT);
 return '/study/';
}
