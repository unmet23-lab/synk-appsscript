// 합성 답과 합성 AI 응답. 실제 모델의 정확성 증거로 쓰지 않는다.
export const ANSWER='중고 거래 앱 이용자가 줄었다. 2020년에는 300만 명이었다. 2024년에는 1,200만 명이었다.';
export const ACCOUNT='11111111-1111-4111-8111-111111111111';
export const feedbackFixture=()=>({version:1,kind:'study',source:'ai-reference',status:'focus',summary:'중고 거래 앱 이용자의 변화를 설명했어요.',good:'두 시점의 숫자를 썼어요.',
 focus:{skill:'data.accuracy',target:'trend',quote:'이용자가 줄었다',taskQuote:'1,200',observation:'숫자는 커졌는데 줄었다고 썼어요.',cause:'read-data',certainty:'hypothesis'},
 check:{prompt:'이용자가 어떻게 바뀌었나요?',options:[{id:'a',text:'이용자가 줄었다.'},{id:'b',text:'이용자가 늘었다.'}],correct:'b',why:'뒤의 숫자가 더 커요.'},
 help:{explanation:'두 시점의 숫자를 먼저 비교해 보세요.',example:'이용자가 300만 명에서 1,200만 명으로 늘었다.'},
 practice:{prompt:'변화 방향에 맞는 연결은?',options:[{id:'a',text:'이용자가 늘어 1,200만 명이 되었다.'},{id:'b',text:'이용자가 줄어 1,200만 명이 되었다.'}],correct:'a',why:'뒤의 수치가 더 커졌어요.'},rewrite:'첫 문장의 변화 방향을 고쳐 볼까요?'});
export function memoryStore(){const rows=new Map();return {getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,String(v)),removeItem:k=>rows.delete(k)};}
export const configFor=base=>({version:1,supabaseUrl:base,supabasePublishableKey:'sb_publishable_fixture',portalUrl:base+'/account/',clients:{world:{clientId:'world-fixture',redirectUri:base+'/account/client.html?product=world'}}});
