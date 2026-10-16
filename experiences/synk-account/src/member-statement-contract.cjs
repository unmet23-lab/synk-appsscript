'use strict';
// Product vocabulary and clarification replay. Core Ask chooses the next useful
// question; Core Interpretation/Domain own evidence and confirmed declarations.
// Frozen ko-1 through ko-8 modules keep saved rows and answer replay unchanged.
const Legacy = require('./member-statement-v1.cjs');
const Previous = require('./member-statement-v2.cjs');
const Previous3 = require('./member-statement-v3.cjs');
const Previous4 = require('./member-statement-v4.cjs');
const Previous5 = require('./member-statement-v5.cjs');
const Previous6 = require('./member-statement-v6.cjs');
const Previous7 = require('./member-statement-v7.cjs');
const Previous8 = require('./member-statement-v8.cjs');
const Ask = require('../../../atlas/ask');
const PARSER_VERSION = 'member-statement-ko-9';
const MEMBER_STATEMENT_LIMITS = Object.freeze({ ...Legacy.MEMBER_STATEMENT_LIMITS, clarifications: 12 });
const VALUES = Object.freeze({ ...Legacy.MEMBER_STATEMENT_VALUES,
  communication: Object.freeze(['listen-organize', 'share-first', 'written', 'spoken']),
  'work-style': Object.freeze(['plan-first', 'try-adjust', 'single-task', 'prioritize']),
  decision: Object.freeze(['evidence', 'compare-options', 'experience', 'consult']),
  'explanation-detail': Object.freeze(['overview-first', 'reasons-detail', 'long-flow']),
  topic: Object.freeze([...Legacy.MEMBER_STATEMENT_VALUES.topic, 'reading-books', 'music', 'exercise', 'cooking', 'photography', 'games', 'nature']) });
const LABELS = Object.freeze({ ...Legacy.MEMBER_STATEMENT_LABELS,
  'listen-organize': '다른 사람의 생각을 듣고 정리하기', 'share-first': '내 의견을 먼저 말하기', written: '글로 소통하기', spoken: '말로 소통하기',
  'plan-first': '계획을 먼저 세우기', 'try-adjust': '시도하며 조정하기', 'single-task': '한 번에 한 가지 처리하기', prioritize: '우선순위를 정해 처리하기',
  evidence: '자료와 근거를 확인해 판단하기', 'compare-options': '여러 선택지를 비교하기', experience: '직접 경험한 내용을 참고하기', consult: '다른 사람과 상의해 판단하기',
  'overview-first': '전체 개요를 먼저 보기', 'reasons-detail': '핵심 근거를 자세히 알기', 'long-flow': '길게 이어지는 설명',
  'reading-books': '독서', music: '음악', exercise: '운동', cooking: '요리', photography: '사진 촬영', games: '게임', nature: '자연·산책' });
// These are independently confirmed habits, not mutually exclusive personality types.
const MULTI_FIELDS = Object.freeze(['communication', 'work-style', 'decision', 'explanation-detail']);
const CONDITIONS = Object.freeze({ ...Legacy.MEMBER_STATEMENT_CONDITIONS, 'after-example': '예시를 본 다음',
  'first-try-after-example': '처음 시도하며 예시를 본 다음', 'familiar-after-example': '익숙한 내용에서 예시를 본 다음', 'busy-after-example': '바쁠 때 예시를 본 다음',
  meeting: '회의할 때', teamwork: '함께 일할 때', planning: '일을 계획할 때', decision: '결정할 때' });
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
const data = (x, key) => { const d = Object.getOwnPropertyDescriptor(x, key);return d?.enumerable === true && Object.hasOwn(d, 'value'); };
const exact = (x, fields) => plain(x) && Reflect.ownKeys(x).length === fields.length && fields.every(key => data(x, key));
const list = (x, max) => Array.isArray(x) && x.length <= max && Reflect.ownKeys(x).length === x.length + 1 && Array.from({ length: x.length }, (_, i) => data(x, String(i))).every(Boolean);
const fail = () => { throw new TypeError('Member statement: invalid confirmed statement'); };
const instant = x => typeof x === 'string' && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x ? Date.parse(x) : fail();
const semanticKey = m => [m.field, m.value, m.polarity, m.condition || 'general'].join(':');
const copy = x => JSON.parse(JSON.stringify(x));
// Synchronous SHA-256 binds question IDs to the complete immutable source in
// browser, desktop and edge runtimes alike (no Node crypto/network dependency).
const SHA_K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sourceKey(text) {
  const bytes = new TextEncoder().encode(text), padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);padded.set(bytes);padded[bytes.length] = 128;
  new DataView(padded.buffer).setUint32(padded.length - 4, bytes.length * 8);
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], w = new Uint32Array(64), ro = (x,n) => (x >>> n) | (x << (32-n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const view = new DataView(padded.buffer, offset, 64);for (let i=0;i<16;i++) w[i]=view.getUint32(i*4);
    for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(ro(x,7)^ro(x,18)^(x>>>3))+w[i-7]+(ro(y,17)^ro(y,19)^(y>>>10)))>>>0;}
    let [a,b,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){const t1=(hh+(ro(e,6)^ro(e,11)^ro(e,25))+((e&f)^(~e&g))+SHA_K[i]+w[i])>>>0,t2=((ro(a,2)^ro(a,13)^ro(a,22))+((a&b)^(a&c)^(b&c)))>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    [a,b,c,d,e,f,g,hh].forEach((v,i)=>{h[i]=(h[i]+v)>>>0;});
  }
  return h.map(n=>n.toString(16).padStart(8,'0')).join('');
}
const POSITIVE = /^(?:좋(?:아(?:해(?:요)?|요)?|다|습니다)?|선호(?:해(?:요)?|한다|합니다)|원(?:해(?:요)?|한다|합니다)|필요(?:해(?:요)?|하다|합니다)|편(?:해(?:요)?|하다|합니다)|편안(?:해(?:요)?|하다|합니다)|마음에들(?:어(?:요)?|어요)|(?:하고|받고|보고)?싶(?:어(?:요)?|다|습니다)|관심(?:이)?있(?:어(?:요)?|다|습니다)|해줘(?:요)?)$/u;
const NEGATIVE = /^(?:싫(?:어(?:요)?|다|습니다)|부담스러(?:워(?:요)?|워요)|좋(?:아하지|지는?|아하진)않(?:아(?:요)?|다|습니다)|선호하지않(?:아(?:요)?|는다|습니다)|원하지않(?:아(?:요)?|는다|습니다)|필요(?:가)?없(?:어(?:요)?|다|습니다)|필요하지않(?:아(?:요)?|다|습니다)|관심(?:이)?없(?:어(?:요)?|다|습니다))$/u;
const SUBJECTS = [
 ['support','independent',/^(?:혼자(?:서)?|스스로|독립적으로)(?:먼저)?(?:시도해보는|시도하는|해보는|해결하는|진행하는|하는|시도해보고|시도하고|해보고|하고)?(?:방식|것|편|게|걸|건|하기)?/u],
 ['support','together',/^(?:(?:다른사람과|누군가와|사람들과)?(?:같이|함께))(?:해보는|하는|해보고|하고)?(?:방식|것|편|게|걸|건|하기)?/u],
 ['support','example',/^(?:예시|예제|샘플)(?:를|가|는|부터)?(?:먼저)?(?:보는|살펴보는|보여주는|보고|보기)?(?:방식|것|편|게|걸|건)?/u],
 ['support','step',/^(?:단계별(?:로)?|차근차근|하나씩차례대로)(?:도움|안내|설명|알려주는|설명해주는)?(?:것|편|게|걸|건)?/u],
 ['support','choose',/^필요할때(?:만)?(?:도움(?:을)?(?:받는|선택하는|받고|선택하고)?)(?:것|편|게|걸|건)?/u],
 ['explanation','brief',/^(?:(?:설명(?:은|을)?)?(?:짧게|간단하게|간결하게|짧고핵심만)(?:설명해주는|설명하는|알려주는)?|(?:짧은|간단한|간결한)설명)(?:것|편|게|걸|건)?/u],
 ['explanation','detailed',/^(?:(?:설명(?:은|을)?)?(?:자세히|상세히|길게)(?:설명해주는|설명하는|알려주는)?|(?:자세한|상세한|긴)설명)(?:것|편|게|걸|건)?/u],
 ['explanation','standard',/^보통길이(?:의)?설명/u], ['practice-mode','mixed',/^듣기와읽기(?:를)?함께(?:하는)?(?:것|편|게|걸|건)?/u],
 ['practice-mode','listening',/^(?:듣기(?:연습)?|듣는연습|듣고배우는것)/u], ['practice-mode','reading',/^(?:읽기(?:연습)?|읽는연습|읽고배우는것)/u],
 ['topic','travel-planning',/^(?:여행일정(?:짜기)?|여행동선|여행계획)/u], ['topic','travel-food',/^(?:여행지음식|현지음식|음식주문)/u],
 ['topic','travel-stay',/^(?:여행지숙소|여행숙소)/u], ['topic','career-interview',/^면접(?:준비)?/u], ['topic','career-planning',/^(?:진로탐색|진로계획)/u],
 ['topic','content-video',/^(?:영상제작|영상만들기|동영상제작|영상만드는것)/u], ['topic','content-design',/^(?:디자인제작|디자인)/u],
 ['topic','ai-tools',/^(?:AI도구(?:활용)?|인공지능도구(?:활용)?)/iu], ['topic','work-collaboration',/^(?:업무협업|업무에서협업)/u]
];
function phrase(body, condition) {
  for(const [field,value,pattern] of SUBJECTS){const match=pattern.exec(body);if(!match)continue;const predicate=body.slice(match[0].length).replace(/^(?:을|를|이|가|은|는|에|엔|도)/u,'');
    const polarity=NEGATIVE.test(predicate)?'avoid':POSITIVE.test(predicate)?'prefer':null;if(polarity)return {field,value,polarity,condition};}
  return null;
}
function expanded(quote) {
  let body=quote.replace(/\s/gu,'').replace(/(?:지만|는데)$/u,'');
  if(/["“”‘’]/u.test(body)||/(?:라고|다고)(?:했|말|들)/u.test(body))return null;
  if(/^(?:(?:내|제)?(?:친구|동료|엄마|아빠|어머니|아버지)|그사람|다른사람|다른분|그녀|그|너|당신)(?:은|는|이|가)/u.test(body))return null;
  if(/(?:예전|과거|전에는|좋아했|선호했|필요했|원했|했었|만약|라면|다면|으면|싫지않|없지않|않지는않)/u.test(body))return null;
  body=body.replace(/^(?:저는|나는|제가|내가|제경우에는|내경우에는)/u,'').replace(/^(?:요즘(?:은|엔)?|지금(?:은|엔)?|현재(?:는)?|평소(?:에는|엔|는)|보통은|일반적으로는)/u,'');
  let condition=null;
  const prefixes=[['first-try',/^(?:처음(?:에는|엔|은)|처음(?:시도)?할때(?:에는|는)?|처음배울때(?:에는|는)?|처음(?:배우는|해보는|하는)(?:일|내용)(?:은|을할때(?:는)?)|낯선(?:일|내용)(?:은|을할때(?:는)?))/u],['familiar',/^(?:익숙할때(?:는)?|익숙한(?:내용|일)(?:일때(?:는)?|은))/u],['busy',/^(?:바쁠때(?:는)?|시간이없을때(?:는)?|바쁜날(?:에는|엔|은))/u]];
  for(const [id,re] of prefixes)if(re.test(body)){condition=id;body=body.replace(re,'');break;}
  const sequence=/^(?:예시|예제|샘플)(?:를|을)?(?:먼저)?(?:(?:보고(?:감을잡은)?|살펴본|본)(?:뒤(?:에)?|다음(?:에)?|후(?:에)?)|보고나서)/u.exec(body);
  if(sequence){const next=phrase(body.slice(sequence[0].length),condition?condition+'-after-example':'after-example');
    if(next?.field==='support'&&next.value==='independent'&&next.polarity==='prefer')return {meanings:[{field:'support',value:'example',polarity:'prefer',condition},next]};return null;}
  const uncertain=/(?:좋을수도있(?:어(?:요)?|다)|좋을것같(?:아(?:요)?|다)|좋(?:아)?하는것같(?:아(?:요)?|다)|편할수도있(?:어(?:요)?|다))$/u.exec(body);
  if(uncertain){const candidate=phrase(body.slice(0,uncertain.index)+(uncertain[0].startsWith('편')?'편해':'좋아'),condition);return candidate?{meanings:[candidate],uncertain:true}:null;}
  if(/(?:것같|듯|모르|아마|어쩌면|일지도|글쎄|수도|때|땐|경우|상황|동안|오늘만|내일만|이번만|퇴근후|출근전)/u.test(body)&&!/^필요할때/u.test(body))return null;
  const result=phrase(body,condition);if(result)return {meanings:[result]};
  const corrected=body.replace(/혼쟈/gu,'혼자').replace(/예씨/gu,'예시');
  if(corrected!==body){const candidate=phrase(corrected,condition);if(candidate)return {meanings:[candidate],typo:true};}
  return null;
}
const ENDING = /^(?:편(?:이에요|이야|입니다|이다)|걸?(?:좋아해요|선호해요)|곤(?:해요|합니다)|하곤해요|합니다|해요|한다|한다는편이에요|좋(?:아해요|아요|습니다|아)|선호(?:해요|합니다|해|한다)|원(?:해요|합니다|해|한다)|편(?:해요|합니다|해|하다)|중요(?:해요|합니다|해)|(?:하고|받고|보고|알고)?싶(?:어요|습니다|어|다))$/u;
const DENIAL = /^(?:싫(?:어요|습니다|어|다)|부담(?:스러워요|스러워|돼요)|선호하지않(?:아요|습니다|아|는다)|좋아하지않(?:아요|습니다|아|는다)|원하지않(?:아요|습니다|아|는다)|피하(?:는편이에요|고싶어요)|하지않(?:아요|습니다|는편이에요))$/u;
const NATURAL_SUBJECTS = [
  ['communication','listen-organize', /^(?:(?:다른|여러)(?:사람(?:들)?|분(?:들)?)|남|동료(?:들)?|팀원(?:들)?|상대(?:방)?)(?:의)?(?:생각|의견|이야기|말)(?:을|를)?(?:먼저)?(?:듣고|들어보고|들어본뒤|들으며)(?:생각을)?(?:정리하(?:는|기)?|정리해보는|정리해)/u],
  ['communication','share-first', /^(?:(?:내|제)(?:생각|의견)(?:을|는)?|의견(?:을|는)?)(?:먼저|앞서)(?:말하(?:는|기)?|내(?:는|기)?|이야기하(?:는|기)?|꺼내(?:는|기)?)/u],
  ['communication','share-first', /^먼저(?:(?:내|제)?(?:생각|의견)(?:을)?)(?:말하(?:는|기)?|내(?:는|기)?|이야기하(?:는|기)?)/u],
  ['communication','written', /^(?:(?:말보다)?(?:글|문자|메시지|메일|이메일)(?:로)?(?:소통하(?:는|기)?|의견을전하(?:는|기)?|정리(?:해서|해)(?:전하|전달하)(?:는|기)?|정리하(?:는|기)?|전달하(?:는|기)?|전하(?:는|기)?|이야기하(?:는|기)?|대화하(?:는|기)?)?)/u],
  ['communication','spoken', /^(?:(?:글보다)?(?:말|대화)(?:로)?(?:소통하(?:는|기)?|의견을전하(?:는|기)?|직접이야기하(?:는|기)?|이야기하(?:는|기)?|대화하(?:는|기)?|설명하(?:는|기)?)?)/u],
  ['work-style','plan-first', /^(?:(?:일|작업)(?:을)?(?:시작하기전에|하기전에))?(?:먼저|미리)?(?:계획|일정|할일목록)(?:을|부터)?(?:먼저|미리)?(?:세우(?:는|기)?|짜(?:는|기)?|정하(?:는|기)?|만드(?:는|기)?)/u],
  ['work-style','try-adjust', /^(?:일단|우선|먼저)?(?:작게)?(?:시도해보(?:고|면서)|해보(?:고|면서)|시작해보(?:고|면서)|실행해보(?:고|면서)|실행하(?:고|면서))(?:조금씩|필요에따라|나중에)?(?:수정하(?:는|기)?|조정하(?:는|기)?|바꿔가(?:는|기)?|고쳐가(?:는|기)?)/u],
  ['work-style','single-task', /^(?:한번에)?(?:한가지(?:일|작업)?|하나)(?:씩|에)?(?:만)?(?:을|를)?(?:집중하(?:는|기)?|처리하(?:는|기)?|끝내(?:는|기)?|하(?:는|기)?)/u],
  ['work-style','prioritize', /^(?:일(?:은|을)|작업(?:은|을))?(?:우선순위(?:를)?(?:먼저)?정(?:해서|해|하고|하는|하기)|중요한(?:일|것)(?:부터))(?:차례로|순서대로)?(?:처리하(?:는|기)?|하(?:는|기)?|진행하(?:는|기)?|해나가(?:는|기)?)?/u],
  ['decision','evidence', /^(?:(?:자료와|데이터와|사실과))?(?:근거|자료|데이터|사실)(?:를|을)?(?:먼저)?(?:확인하(?:고|며)|살펴보(?:고|며)|찾아보(?:고|며)|바탕으로)(?:결정하(?:는|기)?|판단하(?:는|기)?)/u],
  ['decision','evidence', /^(?:(?:자료와|데이터와|사실과))?(?:근거|자료|데이터|사실)(?:를|을)?(?:먼저)?(?:확인하(?:는|기)?|살펴보(?:는|기)?|찾아보(?:는|기)?)/u],
  ['decision','compare-options', /^(?:여러|몇가지|가능한)?(?:선택지|대안|방법)(?:들)?(?:을|를)?(?:서로)?(?:비교하(?:고|며))?(?:(?:장단점)(?:을)?비교하(?:고|며))?(?:비교하(?:는|기)?|비교해보(?:는|기)?|결정하(?:는|기)?|고르(?:는|기)?|판단하(?:는|기)?)/u],
  ['decision','experience', /^(?:직접|제가직접|내가직접)?(?:경험한(?:내용|것)?|해본것|겪어본것)(?:을|를)?(?:참고하(?:는|기)?|바탕으로(?:판단하(?:는|기)?|결정하(?:는|기)?))/u],
  ['decision','experience', /^(?:직접|제가직접|내가직접)?(?:경험해보고|해보고|겪어보고|써보고|사용해보고)(?:판단하(?:는|기)?|결정하(?:는|기)?)/u],
  ['decision','consult', /^(?:다른사람|동료|팀원|주변사람|주변)(?:들)?(?:과|와|에)?(?:상의하(?:고|며)|의견을나누(?:고|며))(?:결정하(?:는|기)?|판단하(?:는|기)?)/u],
  ['decision','consult', /^(?:다른사람|동료|팀원|주변사람|주변)(?:들)?(?:에게|한테)(?:의견을|생각을)?물어보(?:고|며)(?:결정하(?:는|기)?|판단하(?:는|기)?)/u],
  ['decision','consult', /^(?:다른사람|동료|팀원|주변사람|주변)(?:들)?(?:의)?(?:조언|의견)(?:을)?듣(?:고|으며)(?:결정하(?:는|기)?|판단하(?:는|기)?)/u],
  ['explanation-detail','overview-first', /^(?:설명(?:은|는|을들을때(?:는)?))?(?:짧은|간단한)?(?:전체(?:적인)?(?:개요|흐름|그림|구조)|개요|요약|큰그림|핵심요약)(?:(?:을|를|은|는)?(?:짧게|간단히)?(?:먼저|우선)|부터)(?:보는|보기|아는|알기|듣는|듣기|파악하는|파악하기|알고|보고|듣고)/u],
  ['explanation-detail','reasons-detail', /^(?:왜그런지)?(?:핵심(?:적인)?)?(?:근거|이유)(?:는|은|를|을)?(?:자세히|상세히|충분히)(?:알고|듣고|보고|알아보는|살펴보는|설명받는|듣는|보는|아는)?/u],
  ['explanation-detail','long-flow', /^(?:(?:너무|지나치게)?(?:긴|장황한)설명|길게이어지는설명|장황하게이어지는설명)/u],
  ['topic','reading-books', /^(?:독서|책읽기|책(?:을)?읽는것|책읽는것)/u],
  ['topic','music', /^(?:음악(?:감상|듣기|듣는것|듣는)?|노래듣기)/u],
  ['topic','exercise', /^(?:운동|달리기|러닝|수영|등산|자전거타기|헬스)/u],
  ['topic','cooking', /^(?:요리(?:하기|하는것|하는)?|음식만들기|베이킹)/u],
  ['topic','photography', /^(?:사진(?:촬영|찍기|찍는것)|사진)/u],
  ['topic','games', /^(?:게임(?:하기|하는것)?|보드게임|비디오게임)/u],
  ['topic','nature', /^(?:자연(?:속)?(?:풍경)?(?:산책|을보는)?|산책(?:하기|하는것|하는)?|공원산책)/u]
];
const CONDITION_PREFIXES = [
  ['first-try-after-example', /^처음(?:시도|시작)하며(?:예시|예제|샘플)(?:를|을)?본(?:뒤|후|다음)(?:에는|엔|에)/u],
  // The semantic scopes are unchanged; only their noun/verb surface forms vary.
  ['first-try', /^(?:처음(?:시도|시작|연습|학습|공부|도전|경험)하는|처음해보는)(?:때|상황)(?:에는|에서는|라면|는)/u],
  ['familiar', /^(?:(?:내용|일|작업|과제)(?:이|가))?익숙할때(?:에는|라면|는)/u],
  ['familiar', /^(?:같은)?익숙한(?:상황|내용|일|작업)(?:에서는|이라면|에는|일때는)/u],
  ['busy', /^바쁠때(?:라면|에는|에도|는|도)/u],
  ['meeting', /^회의(?:를)?(?:하는|할)(?:때|상황)(?:에는|에서는|는)/u],
  ['planning', /^(?:일|업무|작업)(?:을)?계획하는(?:상황|때)(?:에서는|에는|는)/u],
  ['decision', /^(?:결정|판단|선택)(?:을)?하는(?:때|상황)(?:에는|에서는|는)/u],
  ['after-example', /^(?:그|이)?(?:예시|예제|샘플)(?:를|을)?(?:본|확인한)(?:다음|뒤|후)(?:시도|시작|연습)할때(?:에는|는)/u],
  ['meeting', /^같은회의(?:상황|자리|시간)(?:에서는|에는|엔)/u],
  ['after-example', /^(?:그|이)?(?:예시|예제|샘플)(?:를|을)?(?:보고나서는|보고나서|보고나면|(?:본|보고난|확인한)(?:뒤|후|다음|이후)(?:에는|엔|에))/u],
  ['first-try', /^(?:(?:처음(?:하는|해보는|접하는|배우는|공부하는|시도하는)|새로운|낯선)(?:일|작업|과제|문제|내용))(?:일때(?:에는|는)?|이라면|이면|에서는|에는|은)/u],
  ['familiar', /^(?:이미)?(?:잘아는|손에익은|익숙한)(?:일|작업|과제|문제|내용)(?:일때(?:에는|는)?|이라면|라면|이면|에는|은)/u],
  ['busy', /^(?:시간이(?:촉박하고|부족하고|없고))바쁠때(?:에는|는)?/u],
  ['first-try', /^처음(?:손대는|해보는|접하는|배우는|시도하는)(?:일|작업|과제|내용)(?:에는|이라도|에서는|에서|은|을배울때는)/u],
  ['familiar', /^(?:이미)?(?:손에익은|익숙한)(?:일|작업|과제|내용)(?:이면|이라면|에는|에서는|에서|은)/u],
  ['familiar', /^(?:내용|일|작업)(?:이|은)익숙하고/u],
  ['busy', /^시간에쫓길때(?:에는|는)?/u],
  ['after-example', /^(?:예시|예제|샘플)(?:를|을|도)?(?:한번|이미)?(?:확인하고난|보고난|본)(?:뒤|후|다음|이후)(?:에는|라면|의작업은)/u],
  ['planning', /^(?:일|업무|작업)(?:을)?계획하는단계(?:에서는|에는|는)?/u],
  ['teamwork', /^(?:동료|팀원|다른사람)(?:와|과)(?:함께|같이)일하는(?:상황|경우)(?:에서는|에는|라면)/u],
  ['decision', /^(?:뭔가|무언가|어떤것)(?:를|을)?결정할때(?:에는|는)?/u],
  ['first-try', /^(?:(?:새로운|낯선)(?:걸|것|일|내용)(?:을)?)?처음(?:접하는내용을배울|해보는(?:날|과제|일)|시도하는건|시도하는것|하는과제에서)(?:때(?:는)?|에는|에서|엔|은)?/u],
  ['familiar', /^(?:이건|이것은)?익숙한(?:내용|일)(?:이니까|에서|에서는)/u],
  ['busy', /^(?:(?:할)?일(?:이)?몰려)?바쁜(?:날|와중)(?:에는|에도|에|엔)?/u],
  ['busy', /^(?:할)?일(?:이)?몰려바쁠때(?:에는|는)?/u],
  ['decision', /^(?:뭘|무엇을)?결정해야할때(?:에는|는)?|^결정을앞두면/u],
  ['first-try', /^(?:새로운|낯선)(?:일|내용)(?:을)?(?:처음)?(?:접했을|접할|배우게될)때(?:라면|에는|는)?/u],
  ['meeting', /^회의(?:중|도중)(?:에는|엔|에|은)?/u],
  ['first-try', /^(?:완전히|아주)?처음(?:해보는|시도하는|하는|배우는)(?:일|내용)(?:일때(?:에는|는)?|에대해서(?:는)?)/u],
  ['after-example', /^(?:예시|예제|샘플)(?:를)?보고난(?:뒤|후|다음)(?:라면|에는|엔|에)/u],
  ['busy', /^(?:일이몰려)?바쁠(?:때(?:에는|는)?|수록)/u],
  ['busy', /^바빠서시간이부족할때(?:에는|는)?/u],
  ['familiar', /^(?:이미)?잘아는(?:내용|일)(?:은|일때(?:는)?)/u],
  ['teamwork', /^(?:팀으로)?(?:함께|같이)일하는(?:상황|경우)(?:에서는|에선|에는|엔)/u],
  ['decision', /^결정을내려야할때(?:에는|는)?/u],
  ['busy', /^(?:정신없이|아주|매우)?바쁜(?:상황|경우|때|날)(?:에서는|에는|엔|은|에)?/u],
  ['familiar', /^(?:이미)?익숙(?:해진|한)(?:내용|일)(?:이라면|이면|일경우(?:에는|엔|는)?)/u],
  ['meeting', /^회의(?:시간|자리)(?:에는|에서는|엔|에|에서)/u],
  ['decision', /^(?:뭔가|무언가|어떤것을)?(?:고를|선택할|정할)(?:때|땐)(?:에는|는)?/u],
  ['first-try', /^(?:새로운|낯선)(?:걸|것|일|내용)(?:을)?(?:처음)?(?:배울|할|시도할)때(?:에는|는)?/u],
  ['familiar', /^(?:잘아는|익숙한)(?:내용|일)(?:일때|을할때)(?:에는|는)?/u],
  ['first-try', /^(?:익숙하지않은(?:걸|것|내용|일)(?:을)?(?:처음)?할(?:때|땐)(?:에는|는)?|처음(?:배우거나|시도하거나)?(?:하는|해보는|배우는)(?:걸|것|일|내용)(?:을)?할(?:때|땐)(?:는)?|처음할땐)/u],
  ['familiar', /^(?:이미)?익숙(?:해진|한)(?:내용|일)(?:은|을할땐|을할때(?:는)?)/u],
  ['busy', /^(?:바쁘면|바쁠땐|시간이(?:없|부족하|촉박하)면|시간이촉박할때(?:는)?)/u],
  ['teamwork', /^(?:여럿이)?(?:함께|같이)(?:일|작업)할(?:때|땐)(?:에는|는)?/u],
  ['decision', /^(?:결정|판단|선택)(?:을)?해야할(?:때|땐)(?:는)?/u],
  ['after-example', /^(?:예시|예제|샘플)(?:를|을)?(?:한번)?(?:본|살펴본)(?:뒤|다음|후)(?:에는|엔)/u],
  ['first-try', /^(?:처음(?:에는|엔|은)|처음(?:시도)?할때(?:에는|는)?|처음배울때(?:에는|는)?|처음(?:배우는|해보는|하는)(?:일|내용)(?:은|을할때(?:는)?)|낯선(?:일|내용)(?:은|을할때(?:는)?))/u],
  ['familiar', /^(?:익숙할때(?:는)?|익숙한(?:내용|일)(?:일때(?:는)?|은))/u],
  ['busy', /^(?:바쁠때(?:는)?|시간이없을때(?:는)?|바쁜날(?:에는|엔|은)|시간이부족할때(?:는)?)/u],
  ['meeting', /^(?:회의(?:에서(?:는)?|(?:할)?때(?:에는|는)?|중(?:에는|에)?))/u],
  ['teamwork', /^(?:팀으로일할때(?:에는|는)?|함께일할때(?:에는|는)?|협업할때(?:에는|는)?|협업에서는)/u],
  ['planning', /^(?:일을계획할때(?:에는|는)?|계획을세울때(?:에는|는)?)/u],
  ['decision', /^(?:결정(?:을)?할때(?:에는|는)?|결정을내릴때(?:에는|는)?|판단(?:을)?할때(?:에는|는)?|선택(?:을)?할때(?:에는|는)?)/u]
];
// A bounded morphological layer separates the action from its stance. These
// transformations apply to every supported action, not to complete example
// sentences. All evidence continues to point to the unmodified source.
const STANCE_ENDINGS = [
  ['avoid', /관심(?:이)?없(?:어요|습니다|다|어)$/u],
  ['avoid', /(?:즐기지(?:는)?않(?:아요|습니다|아)|부담스러워서싫(?:어요|습니다|어))$/u],
  ['avoid', /(?:(?:별로|딱히|그다지)?(?:좋아하지|선호하지|원하지|즐기지)(?:는)?않는편(?:입니다|이에요|이다)|(?:(?:저|나)(?:랑|와)|제게|저한테)?(?:잘)?안맞(?:아요|습니다|아|는다))$/u],
  ['avoid', /(?:선호하지|좋아하지|원하지)(?:는)?않(?:아요|습니다|는다|아|아해요)$/u],
  ['avoid', /(?:싫(?:어요|습니다|다|어)|부담스러(?:워요|워)|피하고싶(?:어요|습니다|다|어))$/u],
  ['prefer', /(?:(?:제가|내가)?좋아하는취미(?:예요|입니다)|(?:제)?(?:관심분야|취향)(?:입니다|이에요|예요)|(?:좋아하|즐기)는편(?:이에요|입니다)|마음에들(?:어요|어|었습니다)|즐(?:겨요|깁니다|긴다|겨)|즐거(?:워요|워)|좋(?:더라고요|더라|겠어요|겠습니다))$/u],
  ['prefer', /(?:(?:제게|저한테|내게|나한테)?(?:잘)?맞(?:아요|습니다|아)|(?:요즘|최근)?관심(?:이)?(?:많(?:아요|습니다)|생겼(?:어요|습니다)))$/u],
  ['prefer', /(?:관심(?:이)?|흥미(?:가)?)있고(?:더|직접|한번)?배워보고싶(?:어요|습니다|어|다)$/u],
  ['prefer', /(?:좋아(?:합니다|해요|한다|해)|좋(?:습니다|아요|다|아)|선호(?:합니다|해요|한다|해)|원(?:합니다|해요|한다|해)|마음(?:이)?편(?:합니다|해요|하다|해)|편(?:합니다|해요|하다|해))$/u],
  ['prefer', /(?:관심(?:이)?있(?:습니다|어요|다|어)|관심(?:을)?갖고있(?:습니다|어요|다|어)|흥미(?:가)?있(?:습니다|어요|다|어))$/u],
  ['prefer', /(?:싶(?:습니다|어요|다|어)|편(?:입니다|이에요|이다|이야))$/u]
];
const ACTION_VERBS = [
  ['매기기', /매기(?:는|기)$/u], ['즐기기', /즐기(?:는|기)$/u],
  ['적기', /적(?:는|기)$/u], ['쓰기', /쓰(?:는|기)$/u], ['해결하기', /해결하(?:는|기)$/u], ['알려주기', /알려주(?:는|기|면)$/u], ['따져보기', /따져보(?:는|기)$/u], ['나누기', /나누(?:는|기)$/u],
  ['수정하기', /다듬어가(?:는|기)$/u], ['이어지기', /이어지(?:는|기)$/u],
  ['수정하기', /수정해가(?:는|기)$/u], ['배우기', /배우(?:는|기)$/u], ['보여주기', /보여주(?:는|기)$/u], ['도와주기', /도와주(?:는|기)$/u], ['주문하기', /주문하(?:는|기)$/u],
  ['상의하기', /상의(?:해보는|해보기|하는|하기)$/u], ['시도하기', /시도해보(?:는|기)$/u], ['전하기', /전하(?:는|기)$/u],
  ['꺼내기', /꺼내(?:두|놓)는$/u], ['고쳐가기', /고쳐나가는$/u], ['연습하기', /연습(?:하는|하고|하기)$/u],
  ['만들기', /(?:만들어보는|만들어보기|만드는|만들기)$/u], ['설명해주기', /설명해(?:주는|주면|주기)$/u],
  ['해주기', /해(?:주는|주면|주기)$/u], ['도움받기', /도움받(?:는|기)$/u], ['받기', /받(?:는|기|고)$/u],
  ['시작하기', /시작하면$/u], ['잡기', /잡(?:고|는|기)$/u], ['고르기', /고르(?:는|기)$/u],
  ['해보기', /해보(?:는|기)$/u], ['시도하기', /시도(?:하는|하기)$/u],
  ['길어지기', /길어지(?:는|기)$/u], ['먹기', /먹(?:는|기)$/u], ['짧은', /짧은$/u],
  ['세우기', /(?:세워(?:두|놓)는|세워(?:두|놓)기|세우는|세우고|세우기)$/u],
  ['짜기', /(?:짜(?:두|놓)는|짜(?:두|놓)기|짜는|짜고|짜기)$/u],
  ['정하기', /(?:정해(?:두|놓)는|정해(?:두|놓)기|정하는|정하고|정하기)$/u],
  ['정리하기', /(?:정리해(?:두|놓)는|정리해(?:두|놓)기|정리하는|정리하고|정리하기)$/u],
  ['전달하기', /(?:전달하는|전달하고|전달하기)$/u], ['남기기', /(?:남겨(?:두|놓)는|남기는|남기고|남기기)$/u],
  ['이야기하기', /(?:이야기하는|얘기하는|이야기하고|얘기하고|얘기하기|이야기하기)$/u],
  ['소통하기', /(?:소통하는|소통하고|소통하기)$/u], ['대화하기', /(?:대화하는|대화하고|대화하기)$/u],
  ['주고받기', /(?:주고받는|주고받고|주고받기)$/u], ['말하기', /(?:말하는|말하고|말하기)$/u],
  ['내기', /(?:내는|내고|내기)$/u], ['꺼내기', /(?:꺼내는|꺼내고|꺼내기)$/u],
  ['수정하기', /(?:수정하는|수정하고|수정하기)$/u], ['조정하기', /(?:조정하는|조정하고|조정하기)$/u],
  ['수정하기', /(?:고치는|고치고|고치기)$/u], ['시작하기', /(?:시작하는|시작하고|시작하기)$/u],
  ['바꿔가기', /(?:바꿔가는|바꿔가고|바꿔가기)$/u], ['고쳐가기', /(?:고쳐가는|고쳐가고|고쳐가기)$/u],
  ['집중하기', /(?:집중하는|집중하고|집중하기)$/u], ['처리하기', /(?:처리하는|처리하고|처리하기)$/u],
  ['마무리하기', /(?:마무리하는|마무리하고|마무리하기)$/u], ['끝내기', /(?:끝내는|끝내고|끝내기)$/u],
  ['판단하기', /(?:판단하는|판단하고|판단하기)$/u], ['결정하기', /(?:결정하는|결정하고|결정하기)$/u],
  ['확인하기', /(?:확인하는|확인하고|확인하기)$/u], ['찾아보기', /(?:찾아보는|찾아보고|찾아보기)$/u],
  ['비교하기', /(?:비교하는|비교하고|비교하기)$/u], ['비교해보기', /(?:비교해보는|비교해보고|비교해보기)$/u],
  ['참고하기', /(?:참고하는|참고하고|참고하기)$/u], ['살펴보기', /(?:살펴보는|살펴보고|살펴보기)$/u],
  ['파악하기', /(?:파악하는|파악하고|파악하기)$/u], ['알기', /(?:아는|알고|알기)$/u],
  ['읽기', /(?:읽는|읽고|읽기)$/u], ['듣기', /(?:듣는|듣고|듣기)$/u],
  ['보기', /(?:보는|보고|보기)$/u], ['찍기', /(?:찍는|찍고|찍기)$/u],
  ['하기', /(?:하는|하고|하기)$/u]
];
const FINITE_ACTIONS = [
  ['세우기', /(?:세워요|세웁니다|세운다)$/u], ['짜기', /(?:짜요|짭니다|짠다)$/u],
  ['정하기', /(?:정해요|정합니다|정한다)$/u], ['정리하기', /(?:정리해요|정리합니다|정리한다)$/u],
  ['전달하기', /(?:전달해요|전달합니다|전달한다)$/u], ['남기기', /(?:남겨요|남깁니다|남긴다)$/u],
  ['소통하기', /(?:소통해요|소통합니다|소통한다)$/u], ['이야기하기', /(?:얘기해요|이야기해요|이야기합니다)$/u],
  ['대화하기', /(?:대화해요|대화합니다|대화한다)$/u], ['말하기', /(?:말해요|말합니다|말한다)$/u],
  ['수정하기', /(?:수정해요|수정합니다|수정한다)$/u], ['조정하기', /(?:조정해요|조정합니다|조정한다)$/u],
  ['집중하기', /(?:집중해요|집중합니다|집중한다)$/u], ['처리하기', /(?:처리해요|처리합니다|처리한다)$/u],
  ['마무리하기', /(?:마무리해요|마무리합니다|마무리한다)$/u], ['끝내기', /(?:끝내요|끝냅니다|끝낸다)$/u],
  ['판단하기', /(?:판단해요|판단합니다|판단한다)$/u], ['결정하기', /(?:결정해요|결정합니다|결정한다)$/u],
  ['확인하기', /(?:확인해요|확인합니다|확인한다)$/u], ['찾아보기', /(?:찾아봐요|찾아봅니다|찾아본다)$/u],
  ['비교하기', /(?:비교해요|비교합니다|비교한다)$/u], ['살펴보기', /(?:살펴봐요|살펴봅니다|살펴본다)$/u]
];
function actionAndStance(body) {
  if (/(?:것같|듯|모르|아마|어쩌면|일지도|글쎄|수도|싫지않|싫지는않|없지않|않지는않)/u.test(body)) return null;
  let stance=null, action=body;
  for (const [polarity, ending] of STANCE_ENDINGS) { const match=ending.exec(body);if(match){stance=polarity;action=body.slice(0,match.index);break;} }
  let habitual=false;
  if(!stance){const verb=FINITE_ACTIONS.find(([,ending])=>ending.test(body));if(!verb)return null;action=body.replace(verb[1],verb[0]);stance='prefer';habitual=true;}
  return {...normalizeActionPhrase(action),polarity:stance,habitual};
}
// The same action may be presented as an act, a method, or a nominal clause.
// Normalize that surface form before consulting product vocabulary, instead
// of creating a separate semantic rule for each sentence or polite ending.
function normalizeActionPhrase(source) {
  let action=source;
  // Degree words do not create a stronger score or an opposite preference.
  const finalUnit=phraseUnits(action,true)?.at(-1);
  if(!(finalUnit?.tag==='particle'&&finalUnit.text==='가'&&/(?:내가|제가)$/u.test(action)))action=action.replace(/(?:(?:저는|나는|제가|내가|저에게는|나에게는|제게는|내게는|저에게|나에게|제게|제겐|내겐|저한테|저랑|나랑)?(?:좀더|더욱|훨씬|정말|참|가장|별로|딱히|그다지|더)?)+$/u,'');
  action=action.replace(/기(?:를|는|도|가)$/u,'기').replace(/(?:께서는|으로는|로는)$/u,'');
  // A nominalizer is not the last syllable of a lexical noun (근거, 이메일).
  if(!/(?:근거|이메일|메일)(?:이|은|을|를|도|에|에는)?$/u.test(action))
    action=action.replace(/(?:것|거|방식|쪽|편|시간|일|방법|구성|활동)(?:이|은|을|를|도|에|에는|에도)?$|(?:게|걸|건|데|데에도)$/u,'');
  const nominalHead=/(?:는|기)설명(?:이면|이|은|을|도)?$/u.test(action)?'explanation':null;
  if(nominalHead)action=action.replace(/((?:는|기))설명(?:이면|이|은|을|도)?$/u,'$1');
  // Retain the surface verb: a final -는 can be a relative verb ending rather
  // than a noun particle. The compositional path must not lose that evidence.
  const surfaceAction=action;
  const verb=ACTION_VERBS.find(([,ending])=>ending.test(action));
  if(verb)action=action.replace(verb[1],verb[0]);
  else action=action.replace(/(?:에는|에도|에|을|를|은|는|이|가|도)$/u,'');
  // Preparatory/perfective auxiliaries retain the same action. They do not
  // erase negation, uncertainty, or arbitrary text between supported parts.
  const links={상의한:'상의하고',경험한:'경험하고',체험한:'체험하고',겪어본:'경험하고',세운:'세우고',짠:'짜고',정한:'정하고',비교한:'비교하고'};
  action=action.replace(/(상의한|경험한|체험한|겪어본|세운|짠|정한|비교한)(?:다음|뒤|후)(?:에)?/gu,(_all,stem)=>links[stem])
    .replace(/(확인한|살펴본|찾아본|들은)(?:다음|뒤|후)(?:에)?/gu,(_all,stem)=>({확인한:'확인하고',살펴본:'살펴보고',찾아본:'찾아보고',들은:'듣고'}[stem]))
    .replace(/(?:듣고|보고|짜고|정하고|세우고|확인하고)(?:나서|난뒤|난다음)/gu,s=>s.replace(/(?:나서|난뒤|난다음)$/u,''))
    .replace(/(?:들어본|비교해본|실행한|시도한)(?:다음|뒤|후)(?:에)?/gu,stem=>stem.startsWith('들어')?'듣고':stem.startsWith('비교')?'비교하고':stem.startsWith('실행')?'실행하고':'시도하고')
    .replace(/(참고|상의|확인|비교)해(?=결정|판단)/gu,'$1하고').replace(/자세하게/gu,'자세히').replace(/상세하게/gu,'상세히')
    .replace(/비교해보고(?=고르|정하|판단하|결정하)/gu,'비교하고')
    .replace(/(?:만들어|세워|짜|정해)(?:두고|놓고)/gu,s=>s.startsWith('만들어')?'만들고':s.startsWith('세워')?'세우고':s.startsWith('짜')?'짜고':'정하고')
    .replace(/(생각|의견|계획|근거|자료|데이터|사실|선택지|대안)부터(?:미리|먼저)?/gu,'$1을먼저');
  return {action,nominalHead,surfaceAction};
}
const ACTIONS = [
  ['communication','written', /^(?:(?:내|제)?(?:의견|생각)(?:을)?글(?:로|을)?|글(?:로|을)?)(?:적기|쓰기|전하기|(?:의견|생각)(?:을)?나누기)$/u],
  ['communication','spoken', /^말(?:로)?(?:의견(?:을)?)?전하기$/u],
  ['decision','compare-options', /^(?:여러)?(?:선택지|대안|후보)(?:들)?(?:의)?(?:장단점)?(?:을|를)?(?:따져보기|따져보고(?:결정하기|판단하기|고르기))$/u],
  ['explanation','brief', /^(?:설명(?:은|을))?(?:요점|요지|핵심)만(?:짧게|간단히)?(?:설명해주기|알려주기|알기|듣기)$/u],
  ['explanation','brief', /^(?:간단하게|짧게|간결하게)(?:요지|요점|핵심)만알려주기$/u],
  ['communication','share-first', /^말(?:을)?먼저꺼내서(?:내|제)?(?:의견|생각)(?:을)?(?:이야기하기|말하기|전하기)$/u],
  ['work-style','single-task', /^(?:한가지|하나)(?:일|작업)?(?:를|을)?(?:마무리하고|끝내고)(?:다음|다른)(?:걸|것|일|작업)(?:을)?하기$/u],
  ['decision','experience', /^(?:직접)?(?:겪어본|경험한|해본)(?:경험|일|것)(?:을)?(?:참고하고|바탕으로)(?:판단하기|결정하기)$/u],
  ['decision','consult', /^(?:다른사람|사람|동료|팀원|주변사람)(?:들)?(?:과|와|이랑)(?:먼저)?상의하기$/u],
  ['explanation','detailed', /^(?:설명(?:을)?)?(?:자세히|상세히)(?:듣기|설명받기)$/u],
  ['support','example', /^(?:예시|예제|샘플)(?:가|이)?(?:먼저)?있으면(?:시작|이해|시도)하기편해서(?:그런|그|이런|이)(?:방식)?$/u],
  ['support','step', /^(?:차근차근)?단계별로도와주기$/u],
  ['support','choose', /^(?:도움이)?필요할때(?:만)?도움(?:을)?(?:골라|선택해서|선택해)받기$/u],
  ['practice-mode','listening', /^(?:연습(?:할때(?:는)?|은))?듣(?:는방식|기)$/u],
  ['practice-mode','reading', /^(?:연습(?:할때(?:는)?|은))?읽(?:는방식|기)$/u],
  ['practice-mode','mixed', /^(?:읽기도하고듣기도|듣기도하고읽기도)하는연습$/u],
  ['practice-mode','mixed', /^(?:듣기(?:와|랑)읽기|읽기(?:와|랑)듣기)(?:를)?번갈아하는연습$/u],
  ['topic','travel-food', /^여행지에서음식(?:을)?주문하기$/u],
  ['communication','listen-organize', /^(?:남들|다른사람들?|동료들?|팀원들?)(?:이|의)?(?:무슨)?(?:생각|의견)(?:인지|을)?듣고(?:내|제)?(?:생각|의견)(?:을)?정리하기$/u],
  ['communication','written', /^(?:(?:내|제)?(?:생각|의견)(?:을)?(?:글|문자|메시지|메일|이메일)(?:로)(?:전달하기|남기기|말하기)|(?:메신저|메일|이메일|문자|메시지)(?:에|로)(?:생각|의견|글)(?:을)?(?:(?:적어서|써서)(?:주고받기|전달하기)|주고받기|전달하기))$/u],
  ['communication','spoken', /^입(?:으로)?(?:말하기|이야기하기|대화하기)$/u],
  ['work-style','single-task', /^(?:한|한가지)(?:일|작업)(?:을)?(?:끝낸|마무리한)(?:다음|뒤|후)(?:에)?(?:다른|다음)(?:일|작업)(?:을)?하기$/u],
  ['work-style','prioritize', /^중요한(?:일|것)부터(?:순서(?:를)?매겨|순위를정해)(?:처리하기|하기|마무리하기)$/u],
  ['decision','evidence', /^(?:자료|데이터|문서)(?:에나온|의)(?:근거|사실)(?:를|을)?(?:확인하고|살펴보고)(?:판단하기|결정하기)$/u],
  ['decision','consult', /^(?:다른사람|동료|팀원|주변사람)(?:들)?(?:과|와|이랑)(?:상의하기|(?:상의해서|상의하고|의논해서|의논하고)(?:판단하기|결정하기))$/u],
  ['decision','experience', /^(?:(?:제가|내가)?직접)?(?:(?:겪었던|경험했던)(?:일|것)|경험한(?:걸|내용|것)|해본(?:일|걸|것))(?:을|를)?참고하기$/u],
  ['explanation-detail','overview-first', /^(?:설명(?:은|을들을때(?:는)?))?(?:먼저|우선)(?:전체(?:적인)?(?:윤곽|개요|흐름|구조)|큰그림)(?:을|를)?(?:잡기|파악하기|보기|알기|듣기)$/u],
  ['explanation-detail','reasons-detail', /^(?:핵심)?(?:이유|근거)(?:를|을|도|는|은)?(?:자세히|상세히|충분히)설명해주기$/u],
  ['explanation-detail','long-flow', /^설명(?:이|은)(?:끝없이|너무|지나치게)?길어지기$/u],
  ['explanation','brief', /^(?:(?:간단하게|짧게|간결하게)(?:요지|핵심)(?:만)?알려주는설명|설명(?:은|이)짧은|(?:설명(?:을|은))?짧게(?:설명)?해주기)$/u],
  ['explanation','detailed', /^(?:설명(?:은|이))?(?:내용(?:을)?(?:충분히)?풀어서)?(?:자세히|상세히)(?:풀어서)?(?:설명)?해주기$/u],
  ['support','independent', /^(?:(?:누가|다른사람이)도와주기전(?:에)?(?:제가|내가)?)?(?:혼자(?:서)?|스스로|(?:제|내)힘으로)(?:먼저)?(?:해보기|시도하기|해결하기)$/u],
  ['support','example', /^(?:실제)?(?:예시|예제|샘플)(?:하나)?(?:를|을)?(?:먼저)?(?:보고시작하기|보기)$/u],
  ['support','step', /^(?:하나씩|단계별로)(?:순서에맞춰|차례대로)?도움받기$/u],
  ['support','choose', /^도움(?:이)?필요해지면(?:그때)?(?:제가|내가)?선택해서받기$/u],
  ['support','together', /^(?:다른사람|누군가|누구)(?:이랑|과|와)(?:같이|함께)(?:시도하기|해보기|하기)$/u],
  ['practice-mode','listening', /^(?:소리(?:를)?들으면서연습하기|연습(?:은)?듣기로하기)$/u],
  ['practice-mode','reading', /^(?:(?:문장|글)(?:을)?(?:눈으로)?읽으며연습하기|읽기만하는연습|연습(?:은)?읽기로하기)$/u],
  ['practice-mode','mixed', /^듣기(?:랑|와)읽기(?:를)?(?:섞어서|함께)연습하기$/u],
  ['topic','music', /^(?:노래나음악|음악이나노래)(?:를|을)?듣기$/u],
  ['topic','cooking', /^(?:직접)?음식(?:을)?만들어먹기$/u],
  ['topic','travel-planning', /^여행(?:의)?(?:일정(?:과이동동선)?|동선)(?:을)?짜기$/u],
  ['topic','career-interview', /^면접(?:준비)?$/u],
  ['topic','content-video', /^(?:영상|동영상)(?:을)?만들기$/u],
  ['topic','ai-tools', /^(?:AI|인공지능)도구(?:를)?활용하기$/iu],
  ['communication','listen-organize', /^(?:(?:(?:다른|여러)(?:사람(?:들)?|분(?:들)?)|사람들|남|상대(?:방)?|동료(?:들)?|팀원(?:들)?)(?:의)?|다른)(?:생각|의견|이야기|말)(?:을|를)?(?:먼저|충분히)?(?:듣고|들어보고|들으며)(?:(?:내|제)?(?:생각|의견)(?:을)?)?정리하기$/u],
  ['communication','share-first', /^(?:(?:내|제)?(?:생각|의견)(?:을)?(?:먼저|앞서)|먼저(?:내|제)?(?:생각|의견)(?:을)?)(?:말하기|내기|꺼내기|이야기하기)$/u],
  ['communication','written', /^(?:(?:메신저|메일|이메일|문자|메시지)(?:로)?(?:글(?:을)?|의견(?:을)?)?|글(?:로|을)?)(?:(?:정리해서|정리해)?(?:의견(?:을)?)?(?:전달하기|남기기|주고받기)|소통하기|정리하기|이야기하기|대화하기)$/u],
  ['communication','spoken', /^(?:말|대화)(?:로)?(?:소통하기|이야기하기|대화하기|(?:의견을)?주고받기|의견을전달하기)$/u],
  ['work-style','plan-first', /^(?:(?:일|업무|작업)(?:을)?(?:시작하기전|하기전)(?:에)?)?(?:미리|먼저)?(?:계획|일정|할일목록)(?:을|부터)?(?:미리|먼저)?(?:세우기|짜기|정하기)$/u],
  ['work-style','plan-first', /^(?:먼저|미리)?(?:계획|일정|할일목록)(?:을)?(?:세우고|짜고|정하고|만들고)(?:일(?:을)?)?시작하기$/u],
  ['work-style','try-adjust', /^(?:일단|우선|먼저|시작은)?(?:작게)?(?:시도(?:해보|하)|실행(?:해보|하)|해보|시작해보)(?:고|면서)(?:조금씩|나중에|필요에따라)?(?:수정하기|조정하기|바꿔가기|고쳐가기)$/u],
  ['work-style','single-task', /^(?:(?:일|업무|작업)(?:은|는))?(?:한번에)?(?:한가지(?:일|작업)?|하나)(?:씩|만|에|을|를)?(?:집중해서)?(?:집중하기|처리하기|마무리하기|끝내기|하기)$/u],
  ['work-style','prioritize', /^(?:(?:일|업무|작업)(?:은|는|을))?(?:우선순위(?:를)?(?:먼저)?정(?:해서|해|하고)|중요한(?:일|것)부터|중요한순서대로(?:일(?:을)?)?)(?:차례로|순서대로)?(?:처리하기|하기|마무리하기)$/u],
  ['work-style','prioritize', /^우선순위(?:를)?(?:먼저)?정하기$/u],
  ['work-style','prioritize', /^우선순위대로(?:일(?:을)?)?(?:처리하기|하기|마무리하기)$/u],
  ['decision','evidence', /^(?:근거자료|자료와근거|데이터와근거|근거|자료|데이터|사실)(?:를|을)?(?:먼저)?(?:확인하기|살펴보기|찾아보기|(?:확인하고|살펴보고|찾아보고|바탕으로)(?:판단하기|결정하기))$/u],
  ['decision','compare-options', /^(?:여러|몇가지|가능한|선택할수있는)?(?:선택지|대안|방법|후보)(?:들)?(?:의장단점|장단점)?(?:을|를)?(?:서로|나란히)?(?:비교하기|비교해보기|(?:비교해서|비교하고)(?:정하기|결정하기|판단하기|고르기))$/u],
  ['decision','experience', /^(?:직접)?(?:경험하고|체험하고|경험해보고|체험해보고|해보고|겪어보고|써보고|사용해보고)(?:판단하기|결정하기)$/u],
  ['decision','experience', /^(?:직접)?(?:경험한(?:내용|것)?|해본것|겪어본것)(?:을|를)?(?:참고하기|바탕으로(?:판단하기|결정하기))$/u],
  ['decision','consult', /^(?:다른사람|동료|팀원|주변사람|주변)(?:들)?(?:(?:과|와)(?:상의하고|의견을나누고)|(?:의)?(?:조언|의견)(?:을)?(?:듣고|참고하고)|(?:에게|한테)(?:의견을|생각을)?물어보고)(?:결정하기|판단하기)$/u],
  ['explanation-detail','overview-first', /^(?:설명(?:은|을들을때(?:는)?))?(?:짧은|간단한)?(?:전체(?:적인)?(?:개요|흐름|그림|구조|윤곽)|개요|요약|큰그림|핵심요약)(?:(?:을|를|은|는)?(?:짧게|간단히)?(?:먼저|우선)|부터)(?:보기|알기|듣기|파악하기|보여주기)$/u],
  ['explanation-detail','reasons-detail', /^(?:왜그런지)?(?:핵심(?:적인)?)?(?:근거|이유|이유와근거|근거와이유)(?:는|은|를|을|도)?(?:자세히|상세히|충분히)(?:풀어서)?(?:알기|듣기|보기|살펴보기|알려주기)$/u],
  ['explanation-detail','long-flow', /^(?:(?:너무|지나치게)?(?:긴|장황한)설명|(?:너무|지나치게)?길게이어지는설명)$/u],
  ['topic','reading-books', /^(?:독서|책(?:을)?읽기)$/u],
  ['topic','music', /^(?:음악(?:감상|(?:을)?듣기)?|노래(?:를)?듣기)$/u],
  ['topic','exercise', /^(?:운동(?:하기)?|달리기|러닝|수영|등산|자전거타기|헬스)$/u],
  ['topic','cooking', /^(?:요리(?:하기)?|음식(?:을)?(?:직접)?만들기|베이킹)$/u],
  ['topic','photography', /^(?:(?:풍경|인물)?사진(?:촬영|(?:을)?찍기)?)$/u],
  ['topic','games', /^(?:게임(?:을)?(?:하기)?|보드게임(?:을)?(?:하기)?|비디오게임(?:을)?(?:하기)?)$/u],
  ['topic','nature', /^(?:자연(?:속(?:에서)?)?(?:풍경)?(?:산책(?:하기)?|(?:을)?보기)?|산책(?:하기)?|공원산책|산책(?:하면서|하며)자연(?:을)?보기)$/u]
];
function recognizeAction(body,condition) {
  const parsed=actionAndStance(body);if(!parsed)return null;
  if(parsed.nominalHead==='explanation'&&/^(?:너무|지나치게)?길게이어지기$/u.test(parsed.action))return {meanings:[{field:'explanation-detail',value:'long-flow',polarity:parsed.polarity,condition}]};
  if(/배우기$/u.test(parsed.action)){
    const activity=parsed.action.replace(/(?:것(?:을|이)|걸|것|기(?:를)?)?배우기$/u,'');
    const inner=recognizeAction(activity+'좋아요',condition);
    if(inner?.meanings.length===1&&inner.meanings[0].field==='topic')return {meanings:inner.meanings.map(m=>({...m,polarity:parsed.polarity}))};
  }
  const found=ACTIONS.find(([, , pattern])=>pattern.test(parsed.action));
  // Doing an activity is not evidence that it is an interest. Finite habits
  // are accepted only for an explicitly described method, never topic liking.
  if(found)return !(parsed.habitual&&found[0]==='topic')?{meanings:[{field:found[0],value:found[1],polarity:parsed.polarity,condition}]}:null;
  const known=phrase(parsed.action+'좋아',condition);
  return known&&!parsed.habitual?{meanings:[{...known,polarity:parsed.polarity}]}:null;
}
function selfSurface(quote) {
  // 전 is a first-person contraction only at a lexical subject boundary.
  // Keep temporal 전/전에는 and nouns such as 전기 untouched.
  let surface=quote.replace(/^전\s+/u,'저는 ').replace(/^난\s+/u,'나는 ').replace(/(때(?:는)?|에서는|에는|다음에는)\s+전\s+/gu,'$1 저는 ');
  // Preserve accepted unspaced Korean only when the entire following action
  // is independently licensed. A suffix starting in particles cannot turn
  // the noun 난이도 into a subject contraction.
  if(/^난\S/u.test(surface)){
    const stance=composeStance(surface.slice(1).replace(/\s/gu,'')),units=stance&&phraseUnits(stance.action,true);
    if(units?.length&&units[0].tag!=='particle'&&composeMeaning(phraseUnits(stance.action),stance.nominalHead))surface='나는'+surface.slice(1);
  }
  return surface;
}
function normalizePrefix(quote) {
  let body = selfSurface(quote).replace(/\s/gu, '').replace(/(?:지만|는데)$/u, '').replace(/좋고$/u,'좋아요').replace(/좋아하고$/u,'좋아해요').replace(/편하고$/u,'편해요').replace(/즐겁고$/u,'즐거워요').replace(/싫$/u,'싫어요').replace(/(?:좋아하|선호하)$/u,s=>s.slice(0,-1)+'해').replace(/할땐/gu,'할때는').replace(/배울땐/gu,'배울때는');
  if(/좋지만\s*$/u.test(quote))body=body.replace(/좋$/u,'좋아요');
  if(/일이지만\s*$/u.test(quote))body=body.replace(/일이$/u,'일이에요');
  body=body.replace(/(?:좋아하며|선호하고|선호하며|원하고|원하며|편하며|싫고|관심이있고|관심이많고|원하지않고|선호하지않고|좋아하지않고)$/u,m=>({좋아하며:'좋아해요',선호하고:'선호해요',선호하며:'선호해요',원하고:'원해요',원하며:'원해요',편하며:'편해요',싫고:'싫어요',관심이있고:'관심있어요',관심이많고:'관심많아요',원하지않고:'원하지않아요',선호하지않고:'선호하지않아요',좋아하지않고:'좋아하지않아요'}[m]))
    .replace(/(?:쪽이고|것이고|편이고|활동이고)$/u,m=>m.slice(0,-2)+'이에요')
    .replace(/관심이많$/u,'관심이많아요').replace(/관심이없$/u,'관심이없어요').replace(/좋아하$/u,'좋아해요')
    .replace(/((?:원|좋아|선호)하지)않$/u,'$1않아요').replace(/좋아하$/u,'좋아해요').replace(/좋아하는$/u,'좋아해요');
  body=body.replace(/좋(?:아하)?고요$/u,s=>s.startsWith('좋아')?'좋아해요':'좋아요').replace(/싶고$/u,'싶어요').replace(/을땐/gu,'을때는').replace(/^(?:저라면|나라면)/u,'');
  body = body.replace(/^(?:저는|나는|제가|내가|저한테는|제게는|나한테는|제경우에는|내경우에는)/u, '').replace(/^(?:요즘(?:은|엔)?|지금(?:은|엔)?|이제(?:는|부터는)?|현재(?:는)?|평소(?:에는|엔|는)?|보통은|일반적으로는)/u, '');
  body=body.replace(/^(?:저는|나는|제가|내가)/u,'');
  let condition = null;
  for (const [id, prefix] of CONDITION_PREFIXES) if (prefix.test(body)) { condition = id;body = body.replace(prefix, '');break; }
  body=body.replace(/^,+/u,'');
  if(condition)body=body.replace(/^(?:저는|나는|제가|내가)(?=,|$)/u,'');
  if(['first-try','familiar','busy'].includes(condition)){
    const after=/^(?:예시|예제|샘플)(?:를|을|도|까지|부터)?(?:먼저|이미|한번)?(?:본|보고난|확인한|확인하고난)(?:뒤|후|다음|상태|이후)(?:라면|에는|에도|엔|에서는|의작업은)/u.exec(body);
    if(after){condition+='-after-example';body=body.slice(after[0].length);}
  }
  body=body.replace(/^,+/u,'');
  if(/편하지만$/u.test(quote.replace(/\s/gu,'')))body=body.replace(/편하$/u,'편해요');
  return { body, condition };
}
// Wishes are current declarations, unlike a hypothetical premise. Only the
// final action governed by an explicit wish receives this morphology rewrite;
// embedded negation, subject and context words remain for full consumption.
function surfaceDeclaration(quote) {
  let body=selfSurface(quote).replace(/\s/gu,'');
  // Explicit discourse connectives and inflected stance endings carry no new
  // actor, condition or value. Keep the rest of each clause fully consumed.
  body=body.replace(/^(?:그와별개로|그것과별개로|그렇지만|반대로)(?!는|도)/u,'')
    .replace(/^(?:상황과관계없이|일과별개로|별개로|정확히말하면)/u,'')
    .replace(/(?:즐기고|즐기며|즐기는편이에요)$/u,'즐겨요')
    .replace(/싫어하고$/u,'싫어요').replace(/흥미가있고$/u,'흥미가있어요')
    .replace(/(?:원치않고|원치않으며)$/u,'원하지않고')
    .replace(/원치않(?:아요|습니다|아|는다)$/u,'원하지않아요')
    .replace(/(?:좋으며|좋아하며)$/u,'좋아하고').replace(/마음에들고$/u,'마음에들어요')
    .replace(/관심(?:을)?두고있고$/u,'관심있어요')
    .replace(/관심(?:이)?없고요$/u,'관심없어요')
    .replace(/(?:잘)?맞지만$/u,'맞아요').replace(/원하지만$/u,'원해요')
    .replace(/(?:편하고요|편하며)$/u,'편해요');
  body=body.replace(/^(?:[가-힣]{1,16})(?:와|과)(?:는)?달리(?=저는|나는|제가|내가)/u,'')
    .replace(/관심이있으며$/u,'관심있어요').replace(/관심이없고$/u,'관심없어요').replace(/싶으며$/u,'싶어요').replace(/설명이고$/u,'설명이에요');
  body=body.replace(/(?:선호하고요|원하고요)$/u,m=>m.startsWith('선호')?'선호해요':'원해요')
    .replace(/싶은편(?:이고|이에요|입니다)$/u,'싶어요');
  const chosen=/^(?:제가|내가)(?:고르고싶은|택하고싶은|선호하는)(연습|도움|소통|판단)(?:방식|방법)(?:은|는)(.+?)(?:이에요|예요|입니다)$/u.exec(body);
  if(chosen)body=chosen[1]+'방식은'+chosen[2]+'좋아요';
  const topicPresent=/^(?:관심있는|좋아하는)(?:활동|분야|주제)(?:으로는|로는|에는)(.+?)(?:이|가)있(?:어요|습니다)$/u.exec(body);
  if(topicPresent)body=topicPresent[1]+'관심있어요';
  body=body.replace(/^관심분야(?:를)?말하자면/u,'').replace(/^관심분야를말하면/u,'');
  const rejected=/^(.+?)(?:은|는)(?:제가|내가)?(?:원하지않는|선호하지않는|좋아하지않는)(?:방식|것|쪽|편)(?:이고|이에요|입니다)$/u.exec(body);
  if(rejected)body=rejected[1]+'원하지않아요';
  const desired=/^(?:(설명|도움|소통|연습|판단)(?:에서|에서는))?(?:제가|내가)(?:원하는|선호하는|좋아하는)(?:건|것은|방식은|과정은)(.+?)(?:거예요|것이에요|이에요|예요|입니다)$/u.exec(body);
  if(desired)body=desired[2]+'좋아요';
  body=body.replace(/^(?:제|내)(?:취미|관심분야)(?:얘기|이야기)(?:를)?하자면/u,'');
  // A request to save or display a description does not assert the embedded
  // preference. Likewise, asking someone to do an activity is not liking it.
  if(/(?:저장|기록|입력|등록|설정|표시|분류)(?:해|하|해주|해줘)/u.test(body))return body;
  body=body.replace(/^(?:제|내)경우(?:에는|엔|는)?/u,'')
    .replace(/^(?:저에게는|나에게는|제게는|내게는|저로서는|나로서는)/u,'저는');
  body=body.replace(/^(?:이번에는|이번엔|지금은|지금)(?=(?:저는|나는|제가|내가)?(?:채용|한국어|설명|연습|도움|음악|요리|영상))/u,'');
  body=body.replace(/주시면(?=좋겠|편하겠)/u,'주면')
    .replace(/짧았으면(?:해요|해)$/u,'짧게해주는게좋아요');
  if(/(?:설명|풀이|안내|도움|연습|소통)/u.test(body))body=body
    .replace(/(?:해주시고)$/u,'해주는게좋아요')
    .replace(/(?:해주세요|해줘요|해줘)$/u,'해주는게좋아요');
  body=body.replace(/(?:좋아하|선호하|원하)(?:거든요|거든|잖아요|는걸요)$/u,m=>m.startsWith('좋아')?'좋아해요':m.startsWith('선호')?'선호해요':'원해요')
    .replace(/(?:좋|싫)(?:거든요|거든|잖아요|네요)$/u,m=>m.startsWith('좋')?'좋아요':'싫어요')
    .replace(/(?:편하)(?:거든요|거든|잖아요|네요)$/u,'편해요')
    .replace(/(?:즐기고요|즐기는걸요)$/u,'즐겨요')
    .replace(/(?:편하고요)$/u,'편해요')
    .replace(/(?:좋아하고요)$/u,'좋아해요');
  // Polite requests and first-person choices explicitly express what the
  // member wants here. The action, not the ending, determines the field.
  body=body.replace(/(?:보여주세요|보여줘요|보여줘)$/u,'보여주는게좋아요')
    .replace(/(?:알려주세요|알려줘요|알려줘)$/u,'알려주는게좋아요')
    .replace(/(?:해볼래요|해볼래)$/u,'해보는게좋아요')
    .replace(/(?:할래요|할래)$/u,'하는게좋아요')
    .replace(/(짧게|간단히|자세히)(?:부탁할게요|부탁해요|부탁해)$/u,'$1해주는게좋아요')
    .replace(/(?:쪽으로)?(?:부탁할게요|부탁해요|부탁해)$/u,'좋아요')
    .replace(/(?:풀어줬으면해요|풀어줬으면해)$/u,'풀어주는게좋아요')
    .replace(/(?:해줬으면해요|해줬으면해)$/u,'해주는게좋아요')
    .replace(/(?:해주셨으면해요|해주셨으면해)$/u,'해주는게좋아요')
    .replace(/(?:고마워요|고맙습니다)$/u,'좋아요')
    .replace(/(?:잘)?맞는편(?:이야|이에요|입니다)$/u,'맞아요');
  const wish=/(?:좋겠(?:어요|습니다|어)|편하겠(?:어요|습니다|어))$/u.exec(body);
  if(wish){
    const action=body.slice(0,wish.index).replace(/(?:제일|가장|더|좀더)$/u,'');
    body=action.replace(/(?:할|해볼|볼|들을|읽을)수있으면$/u,m=>m.startsWith('해볼')?'해보는':m.startsWith('할')?'하는':m.startsWith('들을')?'듣는':m.startsWith('읽을')?'읽는':'보는')
      .replace(/(?:였으면|이었으면)$/u,'').replace(/(?:해주면|해주셨으면)$/u,'해주는')
      .replace(/(?:보여주면|보여주셨으면)$/u,'보여주는').replace(/(?:들려주면|들려주셨으면)$/u,'들려주는')
      .replace(/주면$/u,'주는')
      .replace(/(?:받으면)$/u,'받는').replace(/(?:하면)$/u,'하는').replace(/(?:들어가면)$/u,'들어가는').replace(/(?:이면)$/u,'')+'좋아요';
  }
  // A nominal method followed by an actual preference is a topic, not an
  // imagined new personality. "만약" and conditional verbal clauses survive.
  body=body.replace(/(방식|방법|쪽|편)이라면(?=(?:저는|나는|제가|내가)?(?:더|좀더)?(?:좋|편|맞))/u,'$1은');
  body=body.replace(/(이야기|얘기|주제)라면(?=(?:저는|나는)?(?:더)?좋)/u,'$1는');
  const directive=/^(.+?)(?:라고두지않았으면|라고하지않았으면)(?:해요|합니다|해)$/u.exec(body);
  if(directive)body=directive[1].replace(/해보$/u,'해보는').replace(/하$/u,'하는')+'걸원하지않아요';
  return body;
}
function comparative(body) {
  const known=arm=>{
    const cleaned=arm.replace(/^(?:계속|오래)/u,'').replace(/(?:계획)만/u,'계획을');
    return !!natural(cleaned+'좋아요')
      ||/^(?:(?:생각|의견)(?:을)?(?:말로)?(?:바로)?전하는것|말하는것|글로쓰기|혼자정하기|(?:제|내)(?:얘기|이야기)부터하기|동시에벌이기|남(?:의)?(?:얘기|이야기)만듣기|처음부터답을받기|읽는것|듣는것)$/u.test(cleaned);
  };
  const postposed=/^(.+?(?:게|것이|쪽이|방식이|방법이|편이))(.+?)(?:보다는|보다)(.+)$/u.exec(body);
  if(postposed&&known(postposed[2])&&(natural(postposed[1]+postposed[3])?.meanings.length))return postposed[1]+postposed[3];
  const prefix=/^(.+?)(?:보다는|보단|보다)(.+)$/u.exec(body);
  return prefix&&known(prefix[1])?prefix[2]:body;
}
function natural(quote) {
  let { body, condition } = normalizePrefix(quote);
  const coordinated=/^(.+?(?:것|거)도),(.+?(?:것|거)도)(.+)$/u.exec(body);
  if(coordinated){
    const first=natural(coordinated[1]+coordinated[3]),second=natural(coordinated[2]+coordinated[3]);
    if(first?.meanings.length===1&&second?.meanings.length===1&&!first.uncertain&&!second.uncertain){
      const secondGeneral=/^(?:(?:나는|저는|제가|내가))?(?:평소|보통은|일반적으로)/u.test(coordinated[2]);
      return {meanings:[...first.meanings.map(m=>({...m,condition:m.condition||condition})),...second.meanings.map(m=>({...m,condition:m.condition||(secondGeneral?null:condition)}))]};
    }
  }
  const topicList=/^(?:(?:제|내)?(?:취미|관심분야)(?:는|은))?(.+?)(?:이랑|랑|와|과)(.+?)(?:이고|고|을|를)(?:둘다|모두)(.+)$/u.exec(body);
  if(topicList){const first=natural(topicList[1]+topicList[3]),second=natural(topicList[2]+topicList[3]);
    if(first?.meanings.length===1&&second?.meanings.length===1&&[...first.meanings,...second.meanings].every(m=>m.field==='topic'))return {meanings:[...first.meanings,...second.meanings].map(m=>({...m,condition}))};}
  const availability=/^(?:시간날때|시간이날때|여유시간에)(.+)$/u.exec(body);
  if(availability){const activity=natural(availability[1]);if(activity?.meanings.length===1&&activity.meanings[0].field==='topic')return {meanings:activity.meanings.map(m=>({...m,condition}))};}
  // A comparison does not authorize an opposite trait. Only its preferred arm
  // is proposed, and only when that complete arm has a supported predicate.
  body = body.replace(/^(?:(?:내|제)?의견(?:을)?먼저(?:내기|말하기)|(?:내|제)?생각(?:을)?먼저말하기|계획(?:을)?(?:오래|미리)?(?:세우기|짜기)|(?:한꺼번에)?여러(?:일|작업)(?:을)?(?:벌이기|하기))(?:보다는|보다)/u, '');
  body = comparative(body).replace(/^결론뿐아니라(?=왜그런지)/u,'');
  const explanationSequence=/^(.+?)(?:보고|본다음|본뒤)(.+)$/u.exec(body);
  if(explanationSequence){
    const first=natural(explanationSequence[1]+'보는게좋아요'),second=natural(explanationSequence[2]);
    if(first?.meanings.length===1&&second?.meanings.length===1&&first.meanings[0].value==='overview-first'&&second.meanings[0].value==='reasons-detail'&&second.meanings[0].polarity==='prefer')
      return {meanings:[...first.meanings,...second.meanings].map(m=>({...m,condition}))};
  }
  const longEffect = /^(?:설명이|설명은)(?:너무|지나치게)길(?:면|어서)(?:집중이(?:흐트러져요|흐트러지|안돼요|안돼|흐트러집니다)|집중하기(?:어려워요|어려워|힘들어요|힘들어))$/u;
  if (longEffect.test(body)) return { meanings: [{ field:'explanation-detail', value:'long-flow', polarity:'avoid', condition }] };
  const action=recognizeAction(body,condition);if(action)return action;
  for (const [field, value, pattern] of NATURAL_SUBJECTS) {
    const match = pattern.exec(body);if (!match) continue;
    const rest = body.slice(match[0].length).replace(/^(?:방식|것|게|걸|건)(?:이|은|을|도)?/u, '').replace(/^(?:에는|에도|을|를|이|가|은|는|에|엔|도)/u, '').replace(/^마음이(?=편)/u,'').replace(/(?:좋아하|선호하)$/u,s=>s.slice(0,-1)+'해');
    const polarity = DENIAL.test(rest) || NEGATIVE.test(rest) ? 'avoid' : (field!=='topic'&&ENDING.test(rest)) || POSITIVE.test(rest)&&!(field==='topic'&&/^해줘/u.test(rest)) ? 'prefer' : null;
    if (polarity) return { meanings:[{field,value,polarity,condition}] };
  }
  return null;
}
// A recognizable hedged statement remains only a question. This avoids asking
// the member to reselect field/value/polarity/context that their words already
// specify, while Core still requires their answer and final confirmation.
function tentative(quote) {
  let body=quote.replace(/\s/gu,'').replace(/(?:지만|는데)$/u,'');
  const endings=[
    [/(?:좋을수도있(?:어요|겠네요|습니다)|좋은것같(?:아요|습니다)|좋아할수도있(?:어요|겠네요)|좋아하는것같(?:아요|습니다))$/u,'좋아요'],
    [/(?:편한것같(?:아요|습니다)|편할수도있(?:어요|겠네요|습니다))$/u,'편해요'],
    [/(?:싫을수도있(?:어요|겠네요)|싫은것같(?:아요|습니다))$/u,'싫어요'],
    [/(?:편일수도있(?:어요|겠네요)|편일지도몰라요)$/u,'편이에요']
  ];
  const ending=endings.find(([pattern])=>pattern.test(body));if(!ending)return null;
  body=body.replace(ending[0],ending[1]).replace(/^(아마|어쩌면)/u,'').replace(/(?:아마|어쩌면)(?=(?:좀더|더)?(?:좋아요|편해요|싫어요)$)/u,'');
  const parsed=natural(body)||expanded(body);
  return parsed&&!parsed.typo?{...parsed,uncertain:true}:null;
}
function restrictedMethod(quote) {
  const {body,condition}=normalizePrefix(quote);
  if(!/^(?:글|말|문자|메시지|메일|이메일)로만/u.test(body))return null;
  const parsed=natural(body.replace(/^(.+?)로만/u,'$1로'));
  if(parsed?.meanings.length!==1||parsed.meanings[0].field!=='communication')return null;
  // Rejecting use of ONLY one medium does not reject every use of it. Ask
  // about the broader available field instead of dropping the restriction.
  const meanings=parsed.meanings.map(m=>({...m,condition}));
  return {meanings,uncertain:meanings[0].polarity==='avoid',restricted:true};
}
// Korean surface forms are composed from typed phrases here. The lexicon does
// not map complete sentences to traits: particles and verb inflections are
// shared, while semantic rules consume the entire resulting phrase. Unknown
// words, internal negation and unhandled conditions cannot disappear in a
// keyword match. Core still receives only reviewable source-backed proposals.
const COMPOSE_LEXICON = [
  ['use', /^(?:활용|사용)(?=$|도|을|이|법)/u],
  ['communicate', /^소통/u], ['mix', /^한데묶(?:은|는|기)/u], ['make', /^세워(?=일|업무|작업)/u], ['inquiry', /^궁금해서/u],
  ['try', /^(?:손대보(?:는|기|며|면서)|해보며|해본)/u],
  ['experience', /^(?:직접)?(?:겪은|경험한)(?:내용|경험|것|일)/u],
  ['experience', /^직접경험한내용/u],
  ['needhelp', /^필요한(?=도움)/u],
  ['length', /^(?:분량)/u], ['many-options', /^(?:여러개|여러가지)/u],
  ['nominal', /^(?:구성|활동)/u], ['enjoy', /^즐기(?:는|기)/u],
  ['topic-frame', /^분야/u], ['listen', /^들은/u],
  ['person', /^남(?=의|과|에게|이랑)/u],
  ['rank', /^(?:매기(?:는|기|고))/u],
  ['check', /^확인(?=$|을|이|은|도)/u], ['compare', /^비교(?=$|를|가|는|도)/u], ['reference', /^참고(?=$|를|가|는|도)/u],
  ['experience', /^(?:직접)?경험한(?:내용|경험|일|것)/u],
  ['explain', /^안내받(?:는|기|고)/u], ['decide', /^정해(?:서)?/u], ['basis', /^근거해/u],
  ['step', /^(?:차례를하나씩|단계마다)/u], ['reference', /^기대어/u],
  ['order', /^주문/u], ['exercise', /^몸을움직이며/u],
  ['task', /^맡은일/u], ['help', /^도움받(?:는|기)/u],
  ['experience', /^(?:직접)?겪(?:었던|어본|은)경험/u],
  ['detail', /^(?:꼼꼼하고|세세하고|상세하고|자세하고|꼼꼼한)/u],
  ['long', /^길고/u], ['flow', /^(?:흐름으로)/u],
  ['person', /^남(?=과|에게|이랑)/u],
  ['neutral', /^다시/u], ['adjust-context', /^상황에맞춰/u],
  ['reference', /^(?:참고해서)/u],
  ['task', /^(?:이과제|나머지|할일이생기면)/u], ['person', /^(?:여럿)/u],
  ['process', /^(?:풀어가(?:는|기|고)|풀(?:기|고)|푸(?:는)?)/u],
  ['help-time', /^시점/u], ['on', /^(?:켜(?:는|기|고))/u],
  ['short', /^(?:두세문장(?:정도)?로|간추린)/u], ['before-start', /^시작전(?:에)?/u],
  ['practice', /^한국어/u], ['practice', /^문제/u], ['explanation', /^풀이/u],
  ['answer', /^뜻/u], ['know', /^알아맞히(?:는|기|고)/u], ['mix', /^넣어서/u],
  ['step', /^나눠서/u], ['travel', /^여행가서/u], ['stay-verb', /^묵을/u],
  ['interview', /^채용/u], ['prepare', /^준비(?:하는|하기|하고)/u],
  ['topic-frame', /^(?:주제|소재|취미|관한|다루고)/u], ['inquiry', /^(?:무슨일을|어디부터|어느길로)/u],
  ['route', /^(?:돌(?:기|고)|갈지)/u], ['capture', /^촬영(?:하는|하기|하고)/u],
  ['make', /^편집(?:하는|하기|하고)/u], ['design-example', /^화면/u],
  ['design', /^디자인(?:하는|하기|하고)/u], ['basis', /^삼(?:는|기|고)?/u],
  ['topic-context', /^생활/u], ['use', /^써먹는지/u], ['topic-context', /^직장/u],
  ['collaboration', /^(?:나눠맡고|협업(?:하는|하기|하고))/u], ['do', /^하면서/u],
  ['learn', /^익히(?:는|기|고)/u], ['nature', /^산책(?:하는|하기|하고)/u], ['inquiry', /^속/u],
  ['nominal', /^역할/u], ['exchange', /^주고받으며/u], ['neutral', /^(?:전체|관련|맨)(?!적인)/u],
  ['try', /^해나가면서/u], ['one', /^한(?=일)/u], ['finish', /^끝내야/u],
  ['rank', /^매겨/u], ['reference', /^기준으로삼(?:는|기|고)?/u],
  ['overview', /^전체적인큰그림/u], ['explanation-purpose', /^왜그런결론이나왔는지/u],
  ['length', /^길이/u], ['standard', /^(?:보통정도|보통수준)/u],
  ['speech', /^통화/u], ['person', /^(?:누가)/u], ['selfcase', /^(?:나|저)(?=혼자|스스로)/u],
  ['needhelp', /^필요해졌을때/u], ['before-help', /^도움받기전(?:에)?/u],
  ['first', /^(?:그다음은)/u], ['inquiry', /^어떻게하는지/u],
  ['mismatch', /^(?:어긋나는부분|맞지않는점)/u],
  ['multiple', /^(?:여러일을맡아도)/u], ['process-frame', /^처리방식/u],
  ['grasp', /^(?:잡기|잡는)/u],
  ['on', /^(?:켜두기|켜두는)/u], ['sit', /^(?:앉아있는|앉아있기)/u], ['stuck', /^막막하게/u],
  ['look', /^(?:찾기|살펴서|구경(?:하는|하기|하고))/u], ['data', /^(?:자료에있는근거)/u],
  ['communicate', /^(?:대화에참여하는|대화에참여하기)/u],
  ['reason-effect', /^이해하기/u],
  ['topic-frame', /^(?:다루(?:는|기|면)|다뤄주는|다뤄줬으면|주제로|중심으로)/u],
  ['learn', /^(?:배워보고|배우고)/u], ['use', /^(?:써먹는|써먹기)/u],
  ['reserve', /^(?:예약하는|예약하기)/u],
  ['travel', /^(?:여행가기전|다른나라에가서)/u], ['route-inquiry', /^어디부터돌지/u],
  ['cooking', /^(?:먹을음식)/u], ['restaurant', /^식당/u],
  ['choose', /^(?:택할지)/u], ['career', /^진로/u],
  ['neutral', /^(?:오늘도|막|더|집에서|중간중간|계속|나란히)/u], ['cut', /^(?:잘라말하기)/u],
  ['experience', /^(?:직접겪어본경험|겪어본경험)/u],
  ['know', /^(?:알아가는|알아가기|알아보는|알아보기)/u],
  ['method-inquiry', /^(?:어떻게준비하면좋을지|어떻게준비할지)/u],
  ['decision-context', /^(?:판단|결정)/u],
  ['basis', /^(?:바탕|참고로삼는)/u],
  ['eat', /^(?:먹는|먹기)/u],
  ['make', /^(?:만들어)/u], ['rank', /^(?:붙이는|붙이기|붙이고)/u],
  ['reason', /^(?:어떤근거로|무슨근거로|그런결론을내렸는지)/u],
  ['flow', /^(?:잘게끊지않고)/u],
  ['before-help', /^(?:누가|누군가|다른사람이)(?:옆에서)?(?:알려주기|도와주기)(?:전|이전)(?:에)?/u],
  ['before-start', /^(?:작업|일|업무)(?:에)?(?:손대기|들어가기)(?:전|이전)(?:에)?/u],
  ['order', /^(?:(?:제가|내가)?할)?순서에맞춰/u],
  ['needhelp', /^필요하다고느끼는(?:순간|때)(?:에)?(?:만)?/u],
  ['self', /^(?:제손으로|내손으로)/u],
  ['priority', /^(?:중요도(?:의)?순서|중요도|중요한순위|우선순위대로)/u],
  ['rank', /^(?:순서를붙이(?:고|는|기)|순위를붙이(?:고|는|기)|높은순서부터)/u],
  ['overview', /^(?:큰틀|큰줄기|전반적인흐름|전체가어떻게생겼는지)/u],
  ['detail', /^(?:속속들이|세세하게|세세히|구체적인|빠짐없이)/u],
  ['standard', /^(?:중간길이|중간정도(?:의)?길이|적당한분량|보통분량)/u],
  ['outcome', /^(?:결과|반응)/u], ['method', /^(?:방법|방식)/u], ['answer', /^(?:답장|답)/u],
  ['opinion', /^(?:하고싶은이야기|하고싶은말)/u],
  ['listen', /^(?:들려주(?:는|기)|들어가며|들어가는)/u],
  ['send', /^(?:전하(?:는|기|고)|보내(?:는|기|고))/u],
  ['write', /^(?:담아|적어서|써서)/u],
  ['make', /^(?:만들어보(?:는|기|고)|짜두(?:는|기|고)|짜놓(?:는|기|고))/u],
  ['try', /^(?:해보다가|시도하다가|해가면서|해나가(?:는|기)|해볼)/u],
  ['speak', /^(?:꺼내놓(?:는|기)|꺼내두(?:는|기))/u],
  ['reference', /^(?:참고로삼(?:는|기|고)|바탕으로삼(?:는|기|고))/u],
  ['experience', /^(?:실제로겪어본일|겪어본일|겪어본것)/u],
  ['consult', /^(?:의견을구해|의견을구하(?:는|기|고)|조언을구하(?:는|기|고))/u],
  ['explain', /^(?:풀어서)/u],
  ['flow', /^(?:끊지않고|중간에끊지않고|끝까지이어)/u],
  ['neutral', /^(?:처음부터끝까지|무엇을할지|끝까지|제일|살짝|푹빠져|늘|실제로|편안하게)/u],
  ['self', /^(?:내자신|제자신|스스로|혼자서|혼자|독립적으로|내힘으로|제힘으로|자력으로)/u],
  ['person', /^(?:다른사람들?|다른분들?|다른이들|여러사람들?|사람들|상대방|상대|동료들?|팀원들?|주변사람들?|주위사람들?|남들|누군가|누구|모두)/u],
  ['mine', /^(?:나의|저의|제|내)/u],
  ['text', /^(?:이메일|메신저|메시지|메세지|문자|채팅|텍스트|메일|글)/u],
  ['speech', /^(?:목소리|말|대화|입)/u], ['opinion', /^(?:의견|생각|이야기|얘기)/u],
  ['plan', /^(?:할일목록|계획표|계획|일정표|일정)/u], ['task', /^(?:업무|작업|할일|일)/u],
  ['one', /^(?:한가지|한개|하나씩|하나)/u], ['first', /^(?:먼저|우선|앞서|미리|사전에|처음부터)/u],
  ['next', /^(?:다음|그다음|다른)/u], ['priority', /^(?:우선순위|중요한순서|급한순서)/u], ['important', /^(?:중요한|급한)/u],
  ['small', /^(?:작게|조그맣게|작은것부터|작은규모로)/u], ['later', /^(?:나중에|그뒤에|그다음에)/u],
  ['first', /^(?:시작부터)/u],
  ['multiple', /^(?:이것저것|동시에|한꺼번에|여러가지)/u], ['intuition', /^감/u],
  ['both', /^(?:두가지|두방식|둘다)/u], ['identity', /^(?:뭔지|무엇인지)/u], ['similarity', /^(?:같은)/u],
  ['data', /^(?:근거자료|자료|데이터|근거|수치|사실|증거)/u],
  ['options', /^(?:선택지|대안|후보|장단점|차이점|여러방법|방법)/u], ['experience', /^(?:겪어본(?:일|것)|겪었던(?:일|것)|겪은(?:일|경험)|해본(?:일|것)|경험|체험)/u],
  ['overview', /^(?:전체적인(?:개요|흐름|그림|구조|윤곽)|전체(?:개요|흐름|그림|구조|윤곽)|큰그림|개요|윤곽|핵심요약)/u],
  ['reason', /^(?:핵심근거|핵심이유|이유|근거)/u], ['explanation', /^(?:설명|안내)/u],
  ['short', /^(?:한두문장(?:정도)?로|간결하게|간단하게|간단히|짧게|짧(?=거나)|핵심만|요점만|요지만|요점위주로|핵심위주로|짧은|간결한|간단한)/u],
  ['standard', /^(?:보통(?:수준|길이|정도)(?:인)?|적당한길이)/u], ['content', /^(?:세부내용|내용|세부사항)/u],
  ['detail', /^(?:깊이있게|자세하게|상세하게|자세히|상세히|자세한|상세한|구체적으로|꼼꼼하게)/u],
  ['long', /^(?:길어지는|길어지기|길게|길기|장황하게|장황한|너무긴|긴)/u],
  ['example', /^(?:완성된(?:예|예시|결과물)|예시|예제|샘플|보기)/u], ['step', /^(?:한단계씩|단계별로|단계별|차근차근|차례차례|하나씩차례대로|하나씩순서대로)/u],
  ['help', /^(?:도움|도와주(?:는|기|면)|도움받기)/u], ['nohelp', /^(?:(?:다른)?도움없이|도움받지않고)/u],
  ['needhelp', /^(?:도움이)?(?:필요해지는(?:순간|때)(?:에)?|필요한(?:순간|때)(?:에)?|필요할때)(?:만)?/u],
  ['together', /^(?:함께|같이)/u], ['practice', /^(?:연습|학습|공부)/u],
  ['audio', /^(?:소리|귀)/u], ['visual', /^(?:문장|눈)/u], ['basis', /^(?:바탕으로|기반으로)/u],
  ['collaboration', /^(?:협업(?:방식)?)/u], ['design-example', /^(?:포스터|전단지|로고|배너)/u],
  ['mismatch', /^(?:안맞는부분|맞지않는부분|부족한부분|문제점|어긋난부분)/u],
  ['order', /^(?:그순서에맞춰|그순서대로|차례대로|순서대로)/u], ['rank', /^(?:순서를매기고|순위를매기고|순서를매기는|순위를매기는|매겨두고|매겨놓고|매기는)/u],
  ['front', /^(?:앞에놓고|앞에두고)/u],
  ['book', /^(?:책읽기|독서|책)/u], ['music', /^(?:음악감상|음악|노래)/u],
  ['exercise', /^(?:자전거타기|운동|달리기|러닝|조깅|수영|헬스|등산)/u],
  ['cooking', /^(?:음식만들기|요리|베이킹|음식)/u], ['photo', /^(?:사진촬영|사진찍기|풍경사진|인물사진|사진)/u],
  ['game', /^(?:보드게임|비디오게임|게임)/u], ['nature', /^(?:자연풍경|자연|산책|공원산책)/u],
  ['travel', /^(?:여행지|여행)/u], ['route', /^(?:이동동선|동선|일정)/u], ['stay', /^(?:숙소)/u],
  ['interview', /^(?:면접준비|면접)/u], ['career', /^(?:진로탐색|진로계획|진로)/u],
  ['video', /^(?:영상제작|동영상|영상)/u], ['design', /^(?:디자인제작|디자인)/u], ['ai', /^(?:인공지능도구|AI도구)/iu],
  ['learn', /^(?:배워보기|배워보는|배우기|배우는|배우고)/u],
  ['listen', /^(?:들어보고|들어보는|들어보기|들으면서|들으며|들으면|듣고|듣는|듣기|들은)/u],
  ['read', /^(?:읽어가며|읽어가는|읽으면서|읽으며|읽고|읽는|읽기)/u],
  ['look', /^(?:살펴보고|살펴보는|살펴보기|보면서|보며|보고|보는|보기|본)/u],
  ['know', /^(?:알아보기|알아보는|파악하기|파악하는|파악하게|알기|아는|알고)/u],
  ['write', /^(?:적어놓기|적어두기|적어놓는|적어두는|써놓기|써두기|쓰는|쓰기|적는|적기|적어|남기는|남기기)/u],
  ['speak', /^(?:꺼내놓고|꺼내놓기|꺼내기|꺼내는|의견내기|내기|내는)/u],
  ['make', /^(?:정해(?:두|놓)(?:는|기|고)|만들어(?:두|놓)(?:는|기|고)|세워(?:두|놓)(?:는|기|고)|세우기|세우는|세우고|짜(?:두|놓)(?:는|기|고)|짜기|짜는|짜고|만들기|만드는|만들고|잡아(?:주|놔|두)(?:는|기|야)|잡기|잡는|잡고)/u],
  ['try', /^(?:해볼수있는|부딪쳐보는|부딪쳐보기|부딪쳐보고|해보면서|해보는|해보기|해보고|시도해보는|시도해보기|실행해보는|실행해보기)/u],
  ['finish', /^(?:끝내기|끝내는|끝내고|끝낸)/u], ['adjust', /^(?:고쳐나가는|고쳐나가기|고쳐가기|고쳐가는|고치기|고치는|다듬어가기|다듬어가는|바꿔가기|바꿔가는)/u],
  ['decide', /^(?:내리기|내리는|고르기|고르는|고르고|정하기|정하는|정하고|정하며)/u], ['choose', /^(?:골라서|골라|택하고)/u], ['check', /^(?:따져서|찾아보기|찾아보는|찾아보고|따져보기|따져보는|따져보고|따져)/u],
  ['explain', /^(?:알려주기|알려주는|알려주면|전해주는|설명해주기|설명해주는|풀어주기|풀어주는|짚어주는)/u], ['show', /^(?:보여주기|보여주는|보여주면)/u],
  ['exchange', /^(?:주고받아야|주고받기|주고받는|주고받고|나눠|나누는|나누고)/u], ['flow', /^(?:이어가는|이어가기|이어서|이어지는|이어지기|흐름)/u],
  ['cut', /^(?:끊는|끊기)/u], ['omit', /^(?:생략하기|생략하는)/u], ['or', /^(?:거나)/u],
  ['capture', /^(?:찍기|찍는|찍고)/u], ['receive', /^(?:받아가며|받기|받는|받고)/u], ['do', /^(?:해주면|해주는|해주기|하기|하는|하고|하며)/u],
  ['reference', /^(?:떠올리며|떠올리는)/u], ['proceed', /^(?:넘어가는|넘어가기)/u], ['mix', /^(?:섞어주면|섞어주는|섞는|섞기)/u],
  ['sequence-step', /^(?:단계를건너뛰지않고)/u], ['different-opinion', /^(?:다른얘기|다른이야기)/u],
  ['enter', /^(?:들어가기|들어가는)/u], ['occur', /^(?:나오기|나온|나오는)/u], ['more-speech', /^말이많기/u],
  ['before', /^(?:전에)/u], ['conclusion', /^(?:결론)/u], ['before-help', /^(?:남의도움(?:을)?바로받기전에)/u],
  ['start', /^(?:벌이기|벌이)/u],
  ['intent-start', /^(?:이해하고시작하려면)/u], ['present-task', /^(?:지금하는것)/u],
  ['inquiry', /^(?:어디에|어떻게|어떤)/u], ['stay-verb', /^(?:묵을지|묵는)/u], ['possibility', /^(?:할지|수있을지|수있는)/u],
  ['available', /^(?:고를수있는)/u], ['arrange', /^(?:놓고)/u], ['enjoyment-reason', /^(?:생각만해도즐거워서)/u],
  ['only', /^(?:만)/u], ['means', /^(?:하는법|법)/u], ['nominal', /^(?:것|거|방식|식|쪽|편)/u],
  ['before-start', /^(?:착수하기전|시작하기전|벌이기전)/u],
  ['explanation-purpose', /^(?:결론이어떻게나왔는지|왜그런지)/u],
  ['selfcase', /^(?:제가|내가|저는|나는)/u], ['and', /^(?:그리고|또한|또|및)/u],
  ['particle', /^(?:에서는|으로는|로는|자체는|까지|에게|한테|에서|으로|위주로|이랑|끼리|랑|와|과|나|의|을|를|은|는|이|가|로|에|도|들|씩)/u],
  ['first', /^부터/u],
  ['sequence', /^(?:한뒤|한후|한다음|뒤에|후에|다음에|뒤|후|다음|나서|다음에는)/u],
  ['neutral', /^(?:충분히|꼼꼼히|차분히|천천히|한번에|한번|하나하나|서로|직접|몸소|일단|조금씩|차차|자꾸|보통|대체로|주로|여러|가능한|가능한것|먼저부터|각|반복해서|옆에서|쭉|한참|아주|실제|항상|대강|그때그때|앞으로|취미로|지나치게|개인적으로|기본적으로|전반적으로|정말|굉장히|조금더|좀더|훨씬|오히려|꽤|참|다(?=듣))/u]
];
const COMPOSE_VERBS = [
  ['communicate','소통'],['communicate','대화'],['speak','말'],['speak','이야기'],['speak','얘기'],
  ['send','전달'],['organize','정리'],['organize','정돈'],['organize','취합'],['write','기록'],['start','시작'],['try','시도'],['try','실행'],
  ['adjust','조정'],['adjust','수정'],['adjust','보완'],['finish','마무리'],['finish','완료'],['process','처리'],['process','진행'],['process','해결'],['focus','집중'],
  ['decide','결정'],['decide','판단'],['check','확인'],['check','검토'],['check','점검'],['compare','비교'],['reference','참고'],
  ['consult','상의'],['consult','의논'],['consult','상담'],['experience-verb','경험'],['experience-verb','체험'],
  ['explain','설명'],['explain','안내'],['choose','선택'],['practice-verb','연습'],['practice-verb','학습'],['practice-verb','공부'],['use','활용'],['use','사용'],['order','주문'],['make','제작'],['explore','탐색'],['summary','요약']
].map(([tag,stem])=>[tag,new RegExp('^'+stem+'(?:해(?:봐야|보(?:는|기|고|며)|주(?:는|기|면))|해(?:두|놓)(?:는|기|고)|하(?:는|기|고|며|면서|게|여야|여|려)|해야|할|해(?:서|가며|가기|가는)|한)','u')]);
const COMPOSE_UNITS=[...COMPOSE_VERBS,...COMPOSE_LEXICON];
function phraseUnits(action,keepSurface=false) {
  const units=[];let offset=0;
  while(offset<action.length&&units.length<120){
    let best=null;
    for(const [tag,pattern] of COMPOSE_UNITS){const m=pattern.exec(action.slice(offset));if(m&&(!best||m[0].length>best.text.length))best={tag,text:m[0]};}
    if(!best)return null;
    units.push(keepSurface?best:best.tag);offset+=best.text.length;
  }
  return offset===action.length?(keepSurface?units:units.filter(tag=>!['particle','neutral','selfcase','mine','sequence'].includes(tag))):null;
}
function composeMeaning(tags,nominalHead) {
  const words=tags.filter(tag=>!['nominal','means','method'].includes(tag)).join(' '), match=pattern=>pattern.test(words), out=(field,value)=>({field,value});
  if(match(/^(?:person )?(?:(?:opinion|speech) )?(?:first )?listen (?:(?:opinion|speech) )?organize$/u))return out('communication','listen-organize');
  if(match(/^(?:(?:opinion|speech) first |first (?:opinion |speech )?)(?:speak|send)(?: speech start)?$/u))return out('communication','share-first');
  if(match(/^(?:text (?:opinion )?|opinion text )(?:communicate|write|send|organize|speak|explain)(?: send|exchange)?$/u))return out('communication','written');
  if(match(/^speech (?:opinion )?(?:communicate|speak|send)$/u))return out('communication','spoken');
  if(match(/^(?:before-start )?(?:first )?plan (?:first )?(?:make|grasp)(?: start)?$/u))return out('work-style','plan-first');
  if(match(/^(?:first )?(?:small )?(?:try|start)(?: later| mismatch)? adjust$/u))return out('work-style','try-adjust');
  if(match(/^one (?:task )?(?:focus|process|finish)(?: next (?:task )?(?:do|process))?$/u))return out('work-style','single-task');
  if(match(/^(?:task )?priority (?:first )?(?:make|decide|process)(?: process)?$|^important task first (?:process|finish|do)$|^important task identity rank(?: order)? process$/u))return out('work-style','prioritize');
  if(match(/^data (?:(?:and )?data )?(?:first )?(?:check|look|reference)(?: decide)?$|^data basis decide$/u))return out('decision','evidence');
  if(match(/^options (?:options )?(?:compare|check)(?: decide)?$/u))return out('decision','compare-options');
  if(match(/^experience (?:(?:reference|look|basis) )?decide$|^experience (?:reference|look)(?: decide)?$|^(?:experience-verb|try) decide$/u))return out('decision','experience');
  if(match(/^(?:person )?(?:first )?(?:opinion exchange )?consult(?: decide)?$|^person opinion listen decide$/u))return out('decision','consult');
  if(match(/^(?:explanation )?(?:content first )?overview first (?:look|show|know|listen|make)$/u))return out('explanation-detail','overview-first');
  if(match(/^(?:explanation-purpose )?(?:reason|data)(?: (?:and )?(?:reason|data))? detail (?:know|listen|look|explain)$/u))return out('explanation-detail','reasons-detail');
  if(match(/^long(?: flow)?(?: explain)? explanation$/u)||nominalHead==='explanation'&&match(/^long(?: flow)?(?: explain)?$/u))return out('explanation-detail','long-flow');
  if(match(/^(?:explanation )?short(?: short)? (?:explain|listen|know)$|^short explanation(?: listen)?$/u))return out('explanation','brief');
  if(match(/^(?:explanation )?detail (?:explain|listen|know)$|^detail explanation(?: listen)?$/u))return out('explanation','detailed');
  if(match(/^explanation standard$|^standard explanation$/u))return out('explanation','standard');
  if(match(/^(?:self|nohelp) (?:first )?(?:try|do|process)$/u))return out('support','independent');
  if(match(/^(?:person )?together (?:try|do|process)$/u))return out('support','together');
  if(match(/^example (?:first |one )?(?:look|show)(?: start)?$/u))return out('support','example');
  if(match(/^step (?:help )?(?:explain|receive|do)$/u))return out('support','step');
  if(match(/^(?:help )?needhelp (?:help )?(?:choose|decide) (?:help )?receive$/u))return out('support','choose');
  if(match(/^(?:practice )?(?:audio )?listen (?:and )?(?:text |visual )?read (?:both together )?(?:practice|practice-verb|learn)$|^(?:practice )?(?:text |visual )?read (?:and )?(?:audio )?listen (?:both together )?(?:practice|practice-verb|learn)$/u))return out('practice-mode','mixed');
  if(match(/^(?:audio )?listen (?:practice|practice-verb|learn)$|^practice (?:audio )?listen$/u))return out('practice-mode','listening');
  if(match(/^(?:text |visual )?read (?:practice|practice-verb|learn)$|^practice (?:text |visual )?read$/u))return out('practice-mode','reading');
  const topicRules=[['reading-books',/^book(?: read)?(?: learn)?$/u],['music',/^music(?: listen)?(?: learn)?$/u],['exercise',/^exercise(?: do)?(?: learn)?$/u],
    ['cooking',/^cooking(?: make|do)?(?: learn)?$/u],['photography',/^photo(?: capture)?(?: learn)?$/u],['games',/^game(?: do)?$/u],['nature',/^nature(?: nature)?(?: look|do)?$/u],
    ['travel-planning',/^travel (?:route|plan) (?:make|do)$/u],['travel-food',/^travel cooking (?:order|do)$/u],['travel-stay',/^travel stay$/u],['career-interview',/^interview(?: do)?$/u],
    ['career-planning',/^career(?: do)?$/u],['content-video',/^video(?: make|do)?$/u],['content-design',/^(?:design-example similarity )?design(?: make|do)?$/u],['ai-tools',/^ai(?: use)?$/u],
    ['work-collaboration',/^(?:person together task do )?collaboration$/u]];
  const topic=topicRules.find(([,pattern])=>pattern.test(words));return topic?out('topic',topic[0]):composeRoles(tags,nominalHead);
}
// Roles compose independently of noun order, repeated synonyms and light
// auxiliaries. Every meaning-bearing unit must be licensed by the same frame;
// the algorithm never drops an unknown word or a negation to find a keyword.
// Event order is preserved where it changes the meaning (listen then organise,
// try then adjust). Noun order and repetitions do not change that event order.
function composeRoles(units,nominalHead) {
  const tags=units.filter(t=>!['nominal','means','method'].includes(t));
  if(nominalHead==='explanation'&&!tags.includes('explanation'))tags.push('explanation');
  const has=t=>tags.includes(t),any=(...t)=>t.some(has),all=(...t)=>t.every(has),before=(a,b)=>tags.indexOf(a)<tags.indexOf(b);
  // A flexible noun frame must not reverse the order of its actions. The
  // supported "first" choices require their preparation before any start.
  const beforeStart=(...actions)=>!has('start')||actions.some(action=>has(action)&&before(action,'start'));
  // A subordinate "before entering the details" may precede the overview in
  // word order. Completed listening/explaining before it is a different order.
  const beforeOverview=has('overview')?tags.slice(0,tags.indexOf('overview')):[];
  const overviewLeads=beforeOverview.every(t=>['explanation','detail','content','first','enter','before'].includes(t))
    &&(!beforeOverview.includes('enter')||beforeOverview.indexOf('enter')<beforeOverview.indexOf('before'));
  const explained=has('explain')||all('explanation','receive');
  const matches=[],frame=(field,value,licensed,required)=>{const allowed=new Set(licensed.split(' '));if(required&&tags.every(t=>allowed.has(t)))matches.push({field,value});};
  frame('communication','written','text opinion communicate write send organize speak exchange answer receive do',has('text')&&any('communicate','write','send','organize','speak','exchange'));
  frame('communication','spoken','speech opinion communicate speak send exchange do',has('speech')&&any('communicate','speak','send','exchange'));
  frame('communication','listen-organize','person opinion speech first listen organize communicate',any('opinion','speech')&&all('listen','organize')&&before('listen','organize'));
  frame('communication','share-first','opinion speech first speak send start different-opinion occur before',has('opinion')&&any('speak','send')&&(has('first')||all('different-opinion','before')));
  frame('work-style','plan-first','task plan first make decide start before-start do',has('plan')&&any('make','decide')&&beforeStart('make','decide'));
  frame('work-style','try-adjust','small first try start mismatch later adjust outcome look method task do adjust-context',all('try','adjust')&&before('try','adjust'));
  frame('work-style','single-task','task one only focus process finish do next proceed present-task start multiple process-frame',has('one')&&any('focus','process','finish','do','process-frame')&&(!has('next')||has('finish')&&before('finish','next')));
  frame('work-style','prioritize','task priority important first rank order front make decide process finish do identity',has('priority')&&any('rank','make','decide')||any('process','finish','do')&&has('important')&&any('rank','order','front','first'));
  frame('decision','evidence','data first check look reference basis decide conclusion decision-context possibility',has('data')&&any('check','look','reference','basis'));
  frame('decision','compare-options','options available arrange compare check decide conclusion decision-context many-options',has('options')&&any('compare','check'));
  frame('decision','experience','experience reference basis decide conclusion decision-context only',has('experience')&&any('reference','basis'));
  frame('decision','consult','person opinion exchange first consult decide conclusion do',has('consult'));
  frame('explanation-detail','overview-first','explanation overview first detail content enter before look show know listen make explain receive do reason-effect',has('overview')&&overviewLeads&&(any('look','show','know','listen','make')||explained)&&(has('first')||all('content','before')));
  frame('explanation-detail','reasons-detail','explanation-purpose explanation conclusion occur reason data detail know listen look explain receive',any('reason','data')&&has('detail')&&(any('know','listen','look')||explained));
  frame('explanation-detail','long-flow','explanation long flow explain listen',all('explanation','long'));
  frame('explanation','brief','explanation short explain listen know finish receive do length',has('short')&&(has('explanation')||any('explain','listen','know')));
  frame('explanation','detailed','explanation detail content explain listen know receive long',has('detail')&&(has('explanation')||any('explain','listen','know')));
  frame('explanation','standard','explanation standard listen receive length',all('explanation','standard'));
  frame('support','independent','self nohelp first try do process before-help',any('self','nohelp')&&any('try','do','process'));
  frame('support','together','person together first try do process explain help receive',has('together')&&any('try','do','process','explain','help','receive'));
  frame('support','example','example first one look show check start intent-start help method inquiry',has('example')&&any('look','show','check')&&beforeStart('look','show','check'));
  frame('support','step','step sequence-step help explain receive do order person explanation listen',any('step','sequence-step')&&any('explain','receive','do','help','explanation'));
  frame('support','choose','needhelp help choose decide receive',has('needhelp')&&any('choose','decide','receive')&&(has('help')||has('receive')));
  const practice=any('practice','practice-verb','mix'),listen=has('listen'),read=has('read');
  frame('practice-mode',listen&&read?'mixed':listen?'listening':'reading','practice practice-verb audio visual text listen read both together mix do enter multiple',practice&&(listen||read));
  const topicFrames=[
    ['reading-books','book read learn','book'],['music','music listen learn','music'],['exercise','exercise do learn','exercise'],
    ['cooking','cooking make do learn self eat','cooking'],['photography','photo capture enjoyment-reason','photo'],['games','game do','game'],
    ['nature','nature inquiry look do enjoy','nature'],['travel-planning','travel route plan make do route-inquiry','travel'],['travel-food','travel cooking decide order do learn restaurant know method inquiry','travel'],
    ['travel-stay','travel stay inquiry stay-verb know look decide reserve','stay'],['career-interview','interview do practice-verb method-inquiry know','interview'],
    ['career-planning','career inquiry task possibility explore plan make do know choose','career'],['content-video','video make do','video'],
    ['content-design','design design-example similarity make do','design'],['ai-tools','ai inquiry use write possibility know learn','ai'],
    ['work-collaboration','task together do person collaboration method know','collaboration']
  ];
  // A declared interest can be expressed as wanting to learn about a topic.
  // Content nouns and learning verbs are licensed only inside topic frames;
  // they are never globally discarded from an action or somebody's speech.
  for(const [value,licensed,anchor]of topicFrames){const enough=value==='travel-planning'?has('travel')&&any('route','plan'):value==='travel-food'?all('travel','cooking'):value==='travel-stay'?has('stay'):has(anchor);frame('topic',value,licensed+' opinion content topic-frame learn know',enough);}
  return matches.length===1?matches[0]:null;
}
const COMPOSE_STANCES=[
  ['prefer', /(?:(?:둘다|모두)(?:제가|내가)?)(?:좋아하는|선호하는)(?:거|것)(?:예요|이에요|입니다)$/u],
  ['prefer', /(?:제게는|내게는|저에게는|나에게는)?즐거운(?:일|활동)(?:이에요|입니다)$/u],
  ['prefer', /(?:(?:제가|내가)?(?:좋아하는|관심을두는)(?:분야|일|활동))(?:예요|이에요|입니다)$/u],
  ['avoid',/(?:하고)?싶지않(?:아요|습니다|아|다)$/u],
  ['avoid',/(?:빼고|제외하고)싶(?:어요|습니다|어|다)$/u],
  ['prefer',/배워보고싶은마음이커요$/u],
  ['prefer',/(?:제|내)?(?:취향|스타일|선호)(?:이에요|입니다|이야|이다|이죠)$/u],
  ['prefer',/(?:제가|내가)?(?:즐기는|좋아하는)(?:분야|활동)(?:중하나)?(?:예요|이에요|입니다)$/u],
  ['prefer',/(?:즐겁게하는)?취미(?:예요|이에요|입니다)$/u],
  ['prefer',/(?:(?:요즘)?관심(?:이)?커요|흥미(?:를)?느껴요|관심사(?:예요|입니다))$/u],
  ['avoid',/(?:좋아하는편이|맞지는?|맞지)않(?:아요|습니다|아|는다)$/u],
  ['avoid',/좋아하는편이아니(?:에요|야|다)$/u],
  ['avoid',/(?:제|내)(?:취향|스타일)(?:이)?아니(?:에요|예요|야|다)$/u],
  ['avoid',/(?:피하|즐기지않)는편(?:이에요|입니다|이다)$/u],
  ['prefer',/(?:편하|좋|수월하)(?:더라고요|더라고|더라)$/u],
  ['prefer',/(?:한결)?수월(?:해요|합니다|해|하다)$/u],
  ['prefer',/마음(?:이)?놓(?:여요|입니다|여|인다)$/u],
  ['prefer',/(?:딱)?(?:제|내)(?:취향|스타일)(?:이에요|입니다|이야|이다)$/u],
  ['prefer',/(?:낫겠(?:어요|습니다|어)|낫(?:습니다|더라고요|더라)|고를래(?:요)?|(?:것을|걸|쪽을|방식을|편을|방법을)(?:고르고|택하고|선택하고)싶(?:어요|습니다|어|다))$/u],
  ['prefer',/(?:제가|내가)?좋아하는(?:분야|취미)(?:예요|이에요|입니다)$/u],
  ['prefer',/(?:관심(?:이)?가(?:요)?|관심(?:을)?두고있(?:어요|습니다|다))$/u]
];
function composeStance(body) {
  if(/(?:것같|듯|모르|아마|어쩌면|일지도|글쎄|수도|싫지않|없지않|않지는않)/u.test(body))return null;
  for(const [polarity,pattern]of COMPOSE_STANCES){const m=pattern.exec(body);if(m)return{...normalizeActionPhrase(body.slice(0,m.index)),polarity,habitual:false};}
  return actionAndStance(body);
}
// Comparative alternatives and topical frames retain their syntactic roles.
// Only a completely consumed alternative can be left out; it never generates
// the opposite preference. Frames constrain the field rather than supplying it.
const COMPOSE_FRAMES=[
  [/^일(?:을)?처리할때(?:에는|는)?/u,['work-style'],''],
  [/^도움받는방식(?:으로는|은|는)/u,['support'],''],
  [/^판단(?:방법으로|방식은|에서는|에는|에쓸|할)/u,['decision'],''],
  [/^(?:대화|소통)(?:에서|에서는)/u,['communication'],''],
  [/^소통방식(?:은|는)/u,['communication'],''],
  [/^(?:시도하는방식|도움방식)(?:으로는|은|는)/u,['support'],''],
  [/^도움받을때(?:는)?/u,['support'],''],
  [/^설명(?:을)?받는방식(?:은|는)/u,['explanation'],'설명'],
  [/^설명(?:을)?받을때(?:는)?(?:저는|나는)?/u,['explanation','explanation-detail'],'설명'],
  [/^(?:배울때|연습할때)(?:는)?(?=단계|한단계|도움|혼자|같이|함께|예시)/u,['support'],''],
  [/^(?:나한테|저한테|제게|내게)?설명할때(?:는)?/u,['explanation','explanation-detail'],'설명'],
  [/^(?:오늘도)?연습방식(?:은|는)/u,['practice-mode'],'연습'],
  [/^이야기를주고받을때(?:는)?/u,['communication'],''],
  [/^도움(?:은|는)/u,['support'],'도움'],
  [/^어느쪽을고를지,?/u,['decision'],''],
  [/^설명을들을때(?:는)?/u,['explanation','explanation-detail'],'설명'],
  [/^(?:배울때(?:는)?|공부할때(?:는)?|학습할때(?:는)?)/u,['practice-mode'],'연습'],
  [/^(?:대화를(?:나눌|할)때(?:는)?|대화초반에|소통할때(?:는)?)/u,['communication'],''],
  [/^(?:이야기|대화)(?:를)?시작하면/u,['communication'],''],
  [/^(?:도와줄거면|도움을받을때(?:는)?|도움을받을땐|시도할때(?:는)?)/u,['support'],''],
  [/^(?:연습할때|연습은|연습을)/u,['practice-mode'],'연습'],
  [/^설명(?:분량)?(?:은|에서|을)/u,['explanation','explanation-detail'],'설명'],
  [/^(?:판단|선택)(?:은|을)/u,['decision'],''],
  [/^(?:평소)?소통에서는|^생각을전달할때/u,['communication'],'']
];
// A declaration can contain a supported action inside harmless explanation
// or background words. Recover its semantic head and the governing action
// together, rather than requiring a dictionary entry for every adjective.
// This fallback never runs without a current stance, and retains blockers
// for agency, scope, negation and order. It emits the original clause span.
// The noun owns its subject particle even after a possessive prefix, plural
// or honorific ending. "우리 팀원들은" is not the writer's own preference.
const OTHER_PERSON_SUBJECT=/(?:친구|동료|팀원|팀장|상사|선생님?|교수님?|구성원|직원|사람|학생|고객|회원|가족|그녀|그사람|그분|다른분|당신|너|언니|동생|형|누나|오빠|남편|아내|엄마|아빠|어머니|아버지)(?:분)?(?:들)?(?:께서는|께서|에게는|한테는|은|는|이(?!랑|야기)|가)/u;
const CORE_ACTION_ROLES={
  independent:'self nohelp before-help first task try do process finish',together:'person together task try do process finish',
  example:'example first one look show check start before-start inquiry task',step:'help step receive explain do',choose:'help help-time needhelp choose decide on receive use',
  brief:'explanation short receive do explain listen know content',standard:'explanation standard length receive do explain listen know',detailed:'explanation detail receive do explain listen know content',
  'reasons-detail':'explanation-purpose reason data detail know listen look explain receive conclusion',
  'long-flow':'explanation long flow explain receive do listen','overview-first':'explanation content overview first look show know listen make receive',
  written:'text opinion communicate write send organize speak exchange answer',spoken:'speech opinion person communicate speak send exchange',
  'listen-organize':'person opinion speech listen organize do','share-first':'opinion first speak send speech start',
  'plan-first':'before-start first plan make start task','try-adjust':'first small try start later mismatch adjust',
  'single-task':'one task focus process finish next do start','prioritize':'task priority first make decide process important identity rank order',
  evidence:'data first check look reference decide basis decision-context',experience:'before experience reference look decide decision-context basis',
  'compare-options':'options compare check decide front',consult:'person first opinion exchange consult decide',
  reading:'practice audio visual text listen read both mix answer know do',listening:'practice audio visual text listen read both mix answer know do',mixed:'practice audio visual text listen read both mix answer know do'
};
function declaredCore(action,{polarity,habitual},condition,fields,source) {
  if(habitual)return null;
  if(/(?:안|못).{0,8}(?:지는?\s*않|지\s*않)|(?:싫|불편|거부).{0,6}(?:않|아니)/u.test(source))return null;
  let body=action.replace(/,/gu,'');
  if(polarity==='avoid'&&/(?:글|말|문자|메시지|메일|이메일)로만/u.test(body))return null;
  const safeNegation=body.replace(/(?:누구|다른사람의)?도움(?:을)?(?:받지않고|없이)/gu,'혼자')
    .replace(/생략하지않고/gu,'상세하게').replace(/(?:중간중간)?끊(?:기)?지않고/gu,'이어지는')
    .replace(/짧지도길지도않은(?=보통|중간)/u,'');
  if(/(?:않|못|아니|싫|없지|말고|없는|없이|안하|안해|안되|비선호|불편|거부(?:하|감|되))/u.test(safeNegation))return null;
  if(/(?:보다는|보단|보다(?!가)|대신|느니|않|말했|라고|다고|다는|라는|것같|듯|모르|수도|아마)/u.test(safeNegation))return null;
  if(/(?:강요|억지|시키|시켜|명령|할수밖에|해야한다|해야만|잘하고|잘하|능력|실력|시험점수)/u.test(body))return null;
  if(/(?:화면|페이지|앱|프로필)(?:의)?(?:배경|색|버튼|글자|배치)|(?:연습|수업|학습|공부)(?:의)?(?:시간표|날짜|요일|알림)/u.test(body))return null;
  if(OTHER_PERSON_SUBJECT.test(body)||/(?:하는|하던|보는|보던)(?:사람|친구|동료|분)/u.test(body))return null;
  const subject=/^\s*(?:(우리|저희|제|내|그|그들의)\s+)?([^\s]+?)(?:들)?(?:께서는|께서|은|는|이(?!랑)|가)\s+/u.exec(source);
  if(subject&&(/^(?:우리|저희|그|그들의)$/u.test(subject[1]||'')||!/^(?:저|나|제|내|난|설명|도움|연습|한국어|글|말|의견|생각|읽기|듣기|자료|근거|계획|일|작업|업무|판단|결정|요리|음악|독서|게임|운동|사진|영상|디자인|여럿|풀|이번에|그다음에)$/u.test(subject[2])&&!/(?:받|하|되|없|있)$/u.test(subject[2])))return null;
  if(/(?:받고|듣고|보고|읽고|설명하고).*(?:개요|큰그림|전체흐름|큰틀)/u.test(body))return null;
  const scopedBody=body.replace(/(?:도움이)?(?:필요한|필요해졌을|필요할)(?:순간|시점|때)(?:에)?(?:만)?/gu,'필요도움');
  if(/(?:때|땐|라면|다면|경우|상황|기간|동안|날에|오늘만|내일만|이번만|이후의|이전의|에서는|에서만|에는|에만)/u.test(scopedBody)||/에서/u.test(scopedBody.replace(/옆에서/gu,''))&&!/(?:주제|소재|이야기|얘기)/u.test(body))return null;
  // Every remaining surface unit must have an explicit role in the existing
  // grammar. Only known neutral modifiers may disappear; an unrecognised
  // instruction, simulation, subject or condition cannot be ignored here.
  const coreUnits=phraseUnits(normalizeActionPhrase(safeNegation).action);
  if(!coreUnits)return null;
  const results=[],add=(field,value,pass)=>{if(pass&&(!fields||fields.includes(field)))results.push({field,value,polarity,condition});};
  const has=re=>re.test(body),both=(a,b)=>has(a)&&has(b),pos=re=>body.search(re),ordered=(a,b)=>pos(a)>=0&&pos(b)>pos(a);
  const topicContext=has(/(?:주제|소재|관심|분야|취미|배우|배워|공부|다루|익히)/u);
  const practiceContext=has(/(?:연습|문제|학습)/u)&&!has(/(?:주제|소재|관한)/u);
  if(practiceContext){
    const listening=has(/(?:듣기|듣는|듣고|들으며|들으면서|들어)/u),reading=has(/(?:읽기|읽는|읽고|읽으며|읽으면서)/u);
    add('practice-mode',listening&&reading?'mixed':listening?'listening':'reading',listening||reading);
  }
  const noPriorStart=(verb)=>!has(/(?:시작하|시작한|착수하|착수한)/u)||ordered(verb,/(?:시작하|시작한|착수하|착수한)/u);
  add('support','independent',both(/(?:혼자|스스로|제힘으로|내힘으로|도움없이|누구도움없이)/u,/(?:시도|해보|진행|마무리|해결|하[는기고]|끝내)/u)&&!has(/함께|같이/u));
  add('support','together',both(/(?:함께|같이)/u,/(?:해보|해나가|풀어가|푸는|풀기|진행|하는|하기|해결)/u)&&!topicContext&&!has(/혼자|도움없이/u));
  add('support','example',both(/예시|예제|샘플|완성된예/u,/보여|살펴|보고|보는|보기|확인/u)&&noPriorStart(/보여|살펴|보고|보는|확인/u));
  add('support','step',both(/단계별|한단계씩|차근차근|차례차례/u,/도움|도와|안내|알려|짚어|설명|받/u));
  add('support','choose',both(/도움/u,/필요/u)&&has(/골라|고르|선택/u)&&has(/받|켜|사용/u));
  const explanation=has(/설명|알려|풀어|풀이/u),standard=has(/보통|중간길이/u),detail=has(/자세|상세|세세|구체적|속속들이/u),brief=has(/짧|간단|간결|핵심만|요점만/u);
  add('explanation','standard',explanation&&standard&&!detail);
  add('explanation','brief',explanation&&brief&&!standard&&!detail&&!has(/길게|긴설명/u));
  const reasonDetail=has(/근거|이유|왜그런/u)&&detail;
  add('explanation','detailed',explanation&&detail&&!reasonDetail&&!brief&&!standard);
  add('explanation-detail','reasons-detail',reasonDetail&&has(/알|듣|설명|받|보/u));
  add('explanation-detail','long-flow',explanation&&has(/길게이어|길게계속|긴설명을끊|길게설명/u));
  const overview=has(/개요|큰그림|전체흐름|전체구조|큰틀/u);
  add('explanation-detail','overview-first',overview&&has(/먼저|부터|우선/u)&&has(/보|듣|파악|알/u)&&!/(?:듣고|받고|보고|설명하고).*(?:개요|큰그림|전체흐름|큰틀)/u.test(body));
  if(!topicContext&&!practiceContext){
    add('communication','written',both(/글로|문자로|메시지로|메신저로|텍스트로|글을/u,/소통|전달|주고받|쓰|적|남기|정리/u)&&!has(/말로|목소리/u));
    add('communication','spoken',both(/말로|말을|목소리|대화로/u,/소통|주고받|이야기|대화|전달/u)&&!has(/글로|문자로/u));
    add('communication','listen-organize',has(/다른.*(?:생각|말|의견)|상대.*(?:생각|말|의견)|동료.*(?:생각|말|의견)/u)&&ordered(/듣|들어/u,/정리|정돈|취합/u));
    add('communication','share-first',has(/(?:제|내)(?:의견|생각)/u)&&has(/먼저|부터/u)&&has(/말하|꺼내|내는|전하/u));
    add('work-style','plan-first',both(/계획|일정|할일목록/u,/세우|세워|짜|정해|만들/u)&&noPriorStart(/세우|세워|짜|정해|만들/u));
    add('work-style','try-adjust',ordered(/해보|시도|실행/u,/고치|고쳐|조정|수정|보완/u));
    add('work-style','single-task',has(/한번에(?:한가지|하나)|하나씩|한가지만/u)&&has(/처리|하는|하기|끝내|마무리/u));
    add('work-style','prioritize',both(/우선순위|중요한순서|중요도/u,/정하|정한|정해|매겨|매기|처리/u));
    add('decision','evidence',both(/자료|데이터|근거|사실/u,/확인|검토|살펴|바탕|기준|참고/u)&&!reasonDetail);
    add('decision','compare-options',both(/선택지|대안|후보|장단점/u,/비교|따져/u));
    add('decision','experience',both(/겪|경험|체험/u,/참고|바탕|기준/u));
    add('decision','consult',both(/다른사람|동료|팀원|주변사람/u,/상의|의논|의견을구/u));
  }
  if(!practiceContext){
    const topics=[['travel-planning',/여행/u,/일정|동선/u],['travel-food',/여행지|여행|다른나라/u,/음식|식당|주문/u],['travel-stay',/여행/u,/숙소/u],
      ['career-interview',/면접/u,/준비|채용|주제/u],['career-planning',/진로/u,/탐색|계획|선택|주제|이야기/u],['content-video',/영상|동영상/u,/만들|제작|촬영|편집/u],
      ['content-design',/디자인/u,/만들|제작|하는|주제/u],['ai-tools',/AI도구|인공지능도구/iu,/활용|사용|써먹|이야기|주제/u],['work-collaboration',/협업/u,/일|직장|동료|방식/u],
      ['reading-books',/독서|책/u,/읽|독서/u],['music',/음악|노래/u,/음악|노래/u],['exercise',/운동|달리기|수영|등산/u,/운동|달리기|수영|등산/u],
      ['cooking',/요리|베이킹/u,/요리|베이킹/u],['photography',/사진/u,/찍|촬영/u],['games',/게임/u,/게임/u],['nature',/자연|공원/u,/산책|자연/u]];
    for(const [value,noun,verb]of topics)add('topic',value,topicContext&&both(noun,verb));
  }
  const unique=[...new Map(results.map(m=>[semanticKey(m),m])).values()];
  if(unique.length!==1)return null;
  const meaning=unique[0],beforeRole=(role,events)=>{const index=coreUnits.indexOf(role);return index>=0&&coreUnits.slice(0,index).some(t=>events.includes(t));};
  // Known words are not automatically harmless: a game about acting alone
  // is a different object from the writer wanting to act alone. Every role
  // must also belong to this declared action, not an embedded unrelated one.
  if(meaning.field!=='topic'){
    const allowed=new Set((CORE_ACTION_ROLES[meaning.value]||'').split(' ').concat(['nominal','means','method']));
    if(coreUnits.some(tag=>!allowed.has(tag)))return null;
  }
  if(meaning.value==='plan-first'&&beforeRole('plan',['start','try','process','finish','do']))return null;
  if(meaning.value==='example'&&beforeRole('example',['start','try','process','finish','do']))return null;
  if(meaning.value==='overview-first'&&beforeRole('overview',['listen','read','receive','explain','look']))return null;
  return {meanings:unique};
}
function compositional(quote) {
  const nominalSubject=/^([^\s]+?)(?:은|는|이|가|도)\s/u.exec(quote.trim());
  if(nominalSubject&&normalizePrefix(surfaceDeclaration(nominalSubject[0])).body&&!/^(?:저|나|제|내)$/u.test(nominalSubject[1])){
    const head=phraseUnits(nominalSubject[1],true);
    // A complete leading noun cannot consist solely of discarded particles
    // or a possessive (제도/의도). Do not expose a later known topic by
    // silently deleting that head; source token boundaries remain evidence.
    if(head?.length&&head.every(x=>['particle','mine','selfcase'].includes(x.tag)))return null;
  }
  let {body,condition}=normalizePrefix(surfaceDeclaration(quote));
  body=surfaceDeclaration(body);
  body=body.replace(/^(?:저는|나는|제가|내가|제경우엔|내경우엔)(?:요)?/u,'').replace(/^(?:대체로|주로|보통은|보통(?!길이|분량|정도|수준))/u,'');
  let fields=null,head='';
  const ownedExplanation=/^(?:제가|내가)?원하는설명(?:은|는)(.+?)(?:이에요|예요|입니다)$/u.exec(body);
  if(ownedExplanation){body=ownedExplanation[1]+'좋아요';fields=['explanation'];head='설명';}
  const degree=/^(.+?)(?:찾아볼|알아볼|배워볼)만큼(.+)$/u.exec(body);
  if(degree){
    const described=compositional(degree[1].replace(/^(?:쉴때도|여유시간에도)/u,'')+'관심있어요');
    const declared=compositional(degree[2]);
    if(described?.meanings.length===1&&declared?.meanings.length===1&&described.meanings[0].field==='topic'
      &&semanticKey(described.meanings[0])===semanticKey(declared.meanings[0]))return {meanings:declared.meanings.map(m=>({...m,condition:m.condition||condition}))};
    return null;
  }
  const topicNominal=/^(?:(?:제가|내가)?(?:배우고싶은|알고싶은|다루고싶은|좋아하는|관심있는)(?:주제|소재))(?:은|는)(.+?)(?:이에요|예요|입니다|이야|야)$/u.exec(body);
  if(topicNominal){body=topicNominal[1]+'관심있어요';fields=['topic'];}
  // Two explicitly stated versions of the same preference may form one
  // causal sentence. Both sides must independently resolve to that meaning;
  // a reason alone never becomes a second declaration or a dropped clause.
  const causal=/^(.+?)(좋아해서|좋아서|선호해서|편해서)(.+)$/u.exec(body);
  if(causal){
    const first=compositional(causal[1]+(causal[2]==='편해서'?'편해요':causal[2]==='선호해서'?'선호해요':'좋아해요'));
    const second=compositional(causal[3]);
    if(first?.meanings.length===1&&second?.meanings.length===1&&semanticKey(first.meanings[0])===semanticKey(second.meanings[0]))
      return {meanings:first.meanings.map(m=>({...m,condition:m.condition||condition}))};
    return null;
  }
  // The self-owned copular frame supplies an expressed stance, not a trait.
  // Its complement must still be fully understood by the same role grammar.
  const owned=/^(?:(?:제|내)(?:일하는)?(?:취향|관심사|취미|선호)|(?:(?:제가|내가))?(?:좋아하는|선호하는)(?:방식|방법|활동|취미))(?:은|는)(.+?)(?:거예요|것입니다|예요|이에요|입니다)$/u.exec(body);
  if(owned)body=owned[1]+'좋아요';
  // Self-owned nominal predicates state the value after the frame, unlike
  // ordinary action clauses where the preference predicate comes last.
  const nominal=/^(?:(?:제|내)취향(?:은|이)|(?:(?:내가|제가))?원하는(설명길이|연습방식|도움방식|소통방식)(?:는|은))(.+?)(?:이에요|예요|입니다)$/u.exec(body);
  if(nominal){body=nominal[2]+'좋아요';if(nominal[1]==='설명길이'){head='설명';fields=['explanation'];}}
  const framed=/^(?:(?:제|내)(연습|소통|도움|설명)취향(?:은|는)|(?:제게|저에게|내게)(?:편한|필요한)(소통|도움|설명)(?:은|는))(.+?)(?:이에요|예요|입니다)$/u.exec(body);
  if(framed){const domain=framed[1]||framed[2];head=domain==='연습'?'연습':domain==='설명'?'설명':'';fields=[{연습:'practice-mode',소통:'communication',도움:'support',설명:'explanation'}[domain]];body=framed[3]+ '좋아요';if(domain==='소통')body=body.replace(/하는/u,'소통하는');}
  body=body.replace(/^소통(?:은|는)(.+?)하는/u,'$1소통하는');
  for(const [pattern,allowed,heading]of COMPOSE_FRAMES){const m=pattern.exec(body);if(m){fields=allowed;head=heading;body=body.slice(m[0].length);break;}}
  // A named hobby after an explicitly self-owned interest frame is also a
  // declaration. A bare copula or mere participation never becomes liking.
  const interest=/^(?:즐기는|좋아하는)(?:취미|관심분야)(?:를|중)(?:하나)?(?:꼽으면|고르면)(.+?)(?:예요|이에요|입니다)$/u.exec(body);
  let normalized=interest?{...normalizeActionPhrase(interest[1]),polarity:'prefer',habitual:false}:composeStance(body);
  if(!normalized)return null;
  const stripSelf=s=>s.replace(/(?:(?:저|나)(?:는|에게|한테)(?:는)?|제게(?:는)?|제겐|저에겐|내게(?:는)?|내겐)(?:한결|더|잘|딱|그다지)?$/u,'').replace(/(?:자꾸|더|한결|딱|취미로)$/u,'');
  let action=stripSelf(normalized.surfaceAction||normalized.action);
  // Recover an explicitly requested middle length without treating rejection
  // of either extreme as a negative declaration for every detailed answer.
  action=action.replace(/^(설명(?:은|이)?)?(?:너무)?짧거나길게말고(?=중간길이|보통길이)/u,'$1');
  action=action.replace(/^(설명(?:은|이)?)?(?:너무)?짧지도길지도않은(?=보통|중간)/u,'$1');
  action=normalizeActionPhrase(action).surfaceAction;
  action=action.replace(/(?:하는|받는)편$/u,s=>s.slice(0,-1));
  action=normalizeActionPhrase(action).surfaceAction;
  // A trailing mode-of-use phrase retains the stated action. It is not a
  // free deletion rule: the head explicitly constrains the same field below.
  const manner=/^(.+?)(?:쪽|방식|식)(?:으로)(?:소통하고|일하고|일하는|연습하고|진행하고)$/u.exec(action);
  if(manner){fields=[action.endsWith('소통하고')?'communication':action.endsWith('연습하고')?'practice-mode':'work-style'];action=manner[1];}
  const recognizedAlternative=s=>!!phraseUnits(s.replace(/(?:것|거|게)$/u,'').replace(/(?:할때|할땐)$/u,'하기'));
  const comparison=/(?:보다는|보단|보다(?!가)|대신|느니|아닌)/u.exec(action);
  let actions=[action];
  if(comparison){
    const left=action.slice(0,comparison.index),right=action.slice(comparison.index+comparison[0].length);
    const post=/^(.+?(?:면|것이|게|쪽이|방식이|방법이|편이))(.+)$/u.exec(left);
    actions=[];
    if(recognizedAlternative(left))actions.push(right);
    if(post&&recognizedAlternative(post[2]))actions.push(post[1]+right);
    if(!actions.length)return null;
  }
  const variants=[...actions.map(a=>head+a.replace(/^한꺼번에말고/u,'')),head+normalized.action];
  const recognized=[];
  for(const variant of new Set(variants)){const units=phraseUnits(variant);if(!units)continue;
    // A named decision frame binds an otherwise generic final 'do' to that
    // decision. Do not rewrite syllables inside verbs such as 참고하는.
    const roles=fields?.length===1&&fields[0]==='decision'&&units.at(-1)==='do'&&units.includes('data')?[...units.slice(0,-1),'decide']:units;
    const m=composeMeaning(roles,normalized.nominalHead);if(m)recognized.push(m);}
  if(!recognized.length){
    const core=declaredCore(head+action,normalized,condition,fields,quote);if(core)return core;
    // Coordinated clauses may share their final preference predicate. Each
    // arm must independently consume a complete supported action under that
    // same polarity. A known ordered action (try then adjust, listen then
    // organise) has already matched above and never reaches this fallback.
    // Negating a whole sequence does not reject each action separately.
    // Likewise, bound the number of possible coordinations before recursion.
    if(normalized.polarity!=='prefer')return null;
    const separators=[...action.matchAll(/하되(?:,)?|하며(?:,)?|고(?:,)?/gu)];
    if(separators.length>6)return null;
    for(const split of separators){
      const left=split[0].startsWith('하')?action.slice(0,split.index)+'하는':action.slice(0,split.index+1),right=action.slice(split.index+split[0].length);
      if(!right||/[?!]/u.test(left+right))continue;
      const arm=part=>natural(part)||expanded(part)||compositional(part);
      const a=arm(head+left+'좋아요'),b=arm(head+right+'좋아요');
      if(!a?.meanings.length||!b?.meanings.length||a.meanings.some(m=>m.condition)||b.meanings.some(m=>m.condition))continue;
      const joined=[...a.meanings,...b.meanings];
      if(joined.some(m=>!MULTI_FIELDS.includes(m.field))||new Set(joined.map(m=>m.field+':'+m.value)).size<2)continue;
      if(fields&&joined.some(m=>!fields.includes(m.field)))continue;
      return {meanings:joined.map(m=>({...m,polarity:normalized.polarity,condition}))};
    }
    return null;
  }
  if(new Set(recognized.map(m=>m.field+':'+m.value)).size!==1)return null;
  const meaning=recognized[0];
  if(fields&&!fields.includes(meaning.field)||meaning.field==='topic'&&normalized.habitual)return null;
  return {meanings:[{...meaning,polarity:normalized.polarity,condition}]};
}
function coordinatedDeclaration(quote,depth=0,work={remaining:128,cache:new Map()}) {
  if(depth>4||work.remaining<=0)return null;
  let {body,condition}=normalizePrefix(surfaceDeclaration(quote));body=surfaceDeclaration(body);
  if(excludedOrigin(body)||relativePersonClause(body)||CLAUSE_UNSAFE.test(body))return null;
  const normalized=composeStance(body);if(!normalized||normalized.habitual)return null;
  let action=normalized.surfaceAction.replace(/(?:(?:저는|나는|제가|내가)?(?:둘다|모두)|(?:둘다|모두)(?:저는|나는|제가|내가)?)$/u,'').replace(/,+$/u,'');
  action=normalizeActionPhrase(action).surfaceAction.replace(/(?:에는|에도|에)$/u,'');
  const ending=normalized.polarity==='avoid'?'선호하지않아요':'좋아요';
  const read=part=>{
    if(work.remaining--<=0)return null;
    const text=part.replace(/^,+|,+$/gu,'')+ending;
    if(excludedOrigin(text))return null;
    const cacheKey=depth+':'+text;
    const found=work.cache.has(cacheKey)?work.cache.get(cacheKey):natural(text)||expanded(text)||compositional(text)||coordinatedDeclaration(text,depth+1,work);
    work.cache.set(cacheKey,found);
    if(!found?.meanings?.length||found.uncertain||found.typo)return null;
    if(condition&&found.meanings.some(m=>m.condition&&m.condition!==condition))return null;
    return found.meanings.map(m=>({...m,condition:m.condition||condition}));
  };
  const combine=parts=>{
    if(parts.length<2||parts.length>6||parts.some(x=>!x))return null;
    const interpreted=parts.map(read);if(interpreted.some(x=>!x))return null;
    const meanings=interpreted.flat();if(meanings.length>MEMBER_STATEMENT_LIMITS.meanings)return null;
    return {meanings};
  };
  // Repeated additive particles bind the same final predicate to each whole
  // nominal arm. This also licenses an explicit shared negative predicate;
  // an unmarked action sequence is handled separately and never negated twice.
  const nominal=[...action.matchAll(/(?:것|거|방식|시간|활동|쪽|일)도,?|기도,?/gu)];
  if(nominal.length){let start=0;const parts=[];for(const m of nominal){parts.push(action.slice(start,m.index)+(m[0].startsWith('기도')?'기':''));start=m.index+m[0].length;}parts.push(action.slice(start));const found=combine(parts);if(found)return found;}
  const additiveSurface=sourceSurface(quote,action);
  if(/도(?:\s|,)/u.test(additiveSurface)){const found=combine(additiveSurface.split(/도(?:\s+|,\s*)/u).map(x=>x.replace(/\s/gu,'')));if(found)return found;}
  if(action.includes(',')){const found=combine(action.split(','));if(found)return found;}
  const links=[...action.matchAll(/뿐아니라|이랑|랑|와|과|및/gu)];
  if(links.length>8)return null;
  for(const m of links){const found=combine([action.slice(0,m.index),action.slice(m.index+m[0].length)]);if(found)return found;}
  return null;
}
// Clause structure is separate from the activity vocabulary. A purpose or a
// reported benefit explains a preference; it is not another trait and cannot
// supply a missing preference predicate. These bounded clauses must be fully
// consumed. Unknown conditions, speakers, quoted instructions and modality
// are never discarded to expose a familiar activity word.
const PURPOSE_OBJECT='(?:(?:제|내)?(?:생각|의견|기억|집중|이해|내용|핵심|전체|흐름|요점|기록|소리|글자|문장|후회|실수|혼란|부담|시간|일|작업|놓친점|빠뜨린부분|차이점|문제점)(?:이|가|을|를|은|는|부터|와|과)?)*';
const PURPOSE_ACTION='(?:(?:이해|파악|기억|확인|집중|정리|연결|구분)(?:할수있도록|할수있게|하기위해|하려고)|(?:알|익힐|남길|줄일|아낄)(?:수있도록|수있게)|(?:줄이|아끼)(?:기위해|려고|고싶어서)|(?:놓치지않|섞이지않|잊지않|흐려지지않)(?:도록|게))';
const EXPLANATORY_PURPOSE=new RegExp('^(?:(?:왜그런지|어디로가는지|무엇을하는지)|눈으로|귀로)?'+PURPOSE_OBJECT+'(?:더|잘|쉽게|제대로|오래|빠르게|분명하게)?'+PURPOSE_ACTION+'$','u');
const EXPLANATORY_EFFECT=/^(?:(?:이해|정리|집중|기억)(?:가|이)?(?:더|잘|쉽게)?(?:되니까|돼서)|마음(?:이)?(?:더)?편(?:해서|하니까)|(?:더)?(?:편해서|수월해서)|기분(?:이)?(?:더)?나아져서|(?:제|내)?(?:생각|의견)(?:이)?흐려지기전에)$/u;
const CLAUSE_UNSAFE=/(?:강요|억지|시켜|시키|명령|라고|다고|라는|다는|아니에요|아닙니다|아니었|사실이아|잘못|거짓|예전|과거|옛날|내일|어제|작년|가정|만약|것같|모르|아마|어쩌면|일지도|수도|취소|철회|저장|분류|등록)/u;
function safeExplanation(part) {
  if(!part||CLAUSE_UNSAFE.test(part)||OTHER_PERSON_SUBJECT.test(part))return false;
  return EXPLANATORY_PURPOSE.test(part)||EXPLANATORY_EFFECT.test(part);
}
function narrativeBackground(part) {
  // A current factual continuation after an explicit declaration can explain
  // it without becoming another preference. If it contains a new stance or
  // a correction, keep it unresolved instead of silently discarding it.
  return !!part&&!CLAUSE_UNSAFE.test(part)&&!OTHER_PERSON_SUBJECT.test(part)&&!relativePersonClause(part)&&!/(?:는|던|은|한)[가-힣A-Za-z]{1,24}(?:을|를)[가-힣]+(?:요|습니다|다)$/u.test(part)
    &&!/(?:좋|싫|선호|원하|원해|싶|편하|편해|취향|관심|부담|맞아|맞는|않|아니|못|없|안해|안하|[?!])/u.test(part)
    &&/(?:어요|아요|해요|습니다|해두죠|챙겨요|다녀요|봐요|들어요|하죠)$/u.test(part);
}
function relativePersonClause(body) {
  // In "likes A, so ... the colleague whom I know", the liking belongs
  // inside a noun modifier, not to the speaker of the final knowing clause.
  // Keep this distinct from ordinary objects such as listening to a friend.
  if(/(?:는|던|은|한)[가-힣A-Za-z]{1,24}(?:을|를)(?:저는|나는|제가|내가|우리는|저희는)?(?:알아요|알고있어요|알고지내요|만나요|만납니다|만났어요|보았어요|봤어요|찾았어요|소개받았어요|기억해요|본적이있어요)$/u.test(body))return true;
  if(/(?:좋아해서|선호해서|좋아서|편해서)/u.test(body)&&/(?:는|던|은|한)[가-힣A-Za-z]{1,24}(?:을|를)(?:저는|나는|제가|내가)/u.test(body))return true;
  return /(?:는|던|은|한)(?:(?:친한|새로운|한|몇몇|그|어떤|여러|가까운))?(?:친구|동료|사람|분|인물|학생|직원|선생님|가족|아이|회원)(?:들)?(?:을|를|은|는|이(?!야기|랑)|가|에게|한테)/u.test(body);
}
function focusedContrast(quote) {
  const {body,condition}=normalizePrefix(surfaceDeclaration(quote));
  if(excludedOrigin(body)||OTHER_PERSON_SUBJECT.test(body)||relativePersonClause(body))return null;
  const m=/^(.+?)(좋아하는|선호하는|원하는|싫어하는)(?:것|거|편)이지(.+?)(?:좋은|싫은|편한|좋아하는|선호하는)(?:건|것은)(?:아니에요|아닙니다)$/u.exec(body);
  if(!m||!phraseUnits(normalizeActionPhrase(m[3]).action))return null;
  const declared=m[1]+({좋아하는:'좋아해요',선호하는:'선호해요',원하는:'원해요',싫어하는:'싫어요'}[m[2]]);
  const found=natural(declared)||expanded(declared)||compositional(declared);
  return found?.meanings?.length&&!found.uncertain?{meanings:found.meanings.map(x=>({...x,condition:x.condition||condition}))}:null;
}
function universalAside(body) {
  return /^(?:[가-힣]{1,20}(?:이|가|은|는))?(?:무엇이든|뭐든|어떤것이든|어느것이든)(?:지)?$/u.test(body);
}
function sourceSurface(whole,part,tail=false) {
  const positions=[];let compact='';for(let i=0;i<whole.length;i++)if(!/\s/u.test(whole[i])){compact+=whole[i];positions.push(i);}
  const start=compact.indexOf(part);return start<0?part:whole.slice(positions[start],tail?whole.length:positions[start+part.length-1]+1);
}
function adjunctHasActor(body,surface=body) {
  if(!/\s/u.test(surface))return unresolvedSubject(body);
  // Use case particles at lexical boundaries, not an 이/는 inside a noun or
  // inflected verb. Object phrases and nominalized processes are not actors.
  const tokens=surface.trim().split(/\s+/u);
  for(let i=0;i<tokens.length;i++){
    const word=tokens[i].replace(/[,()]/gu,'');
    if(/(?:을|를)$/u.test(word))continue;
    if(/(?:께서는|께서)$/u.test(word))return true;
    if(word==='수는'&&/^(?:알|할|될|볼|읽을|들을|느낄|지킬|찾을|받을|줄일)$/u.test(tokens[i-1]||'')&&/^(?:있|없)/u.test(tokens[i+1]||''))continue;
    if(/려는$/u.test(word)&&/^(?:게|것이)$/u.test(tokens[i+1]||'')&&/^아니라[,)]?$/u.test(tokens[i+2]||''))continue;
    const subject=/^(.+?)(?:은|는|이|가)$/u.exec(word);if(!subject)continue;
    const head=subject[1];
    if(phraseUnits(normalizeActionPhrase(head).action)||new RegExp('^'+PURPOSE_OBJECT+'$','u').test(head))continue;
    // Scan the entire adjunct: a recognized object or non-agent topic does
    // not license ignoring a later subject ("책을 민수는 읽으니까"). A
    // nominalized process licenses its own verb, not an arbitrary -는 name.
    if(/^(?:과정|활동|시간|답|결과|사실|차이|막막함|납득|속도)$/u.test(head))continue;
    if(/^(?:상상|생각|확인|이해|설명|비교|판단|정리|연결|기억|집중)하는$/u.test(word)&&/^(?:과정|활동|시간|답|결과|사실)(?:이|가|은|는)$/u.test(tokens[i+1]||''))continue;
    if(/^(?:과정|활동|시간|답|결과|사실|상태|점)(?:이|가|은|는|니까|때문|$)/u.test(tokens[i+1]||'')){
      const nominal=word.replace(/(?:은|는)$/u,'기').replace(/(?:한|할)$/u,'하기');
      if(phraseUnits(nominal)||word==='있다는'&&tokens[i-1]==='수')continue;
    }
    return true;
  }
  return false;
}
function neutralAside(body) {
  if(/["“”‘’「」『』]/u.test(body)||/(?:좋아|싫어|선호|원하|원해|원치|관심|취향|취소|철회|없던일)/u.test(body))return false;
  return /(?:려는|고자하는)(?:뜻|의미|의도|목적)(?:은|는)?아니(?:고|지만|에요|예요|다|라고요)$/u.test(body)
    ||/해달라는(?:뜻|의미)(?:은|는)?아니(?:고|지만|에요|예요)$/u.test(body)
    ||/(?:야한다는|야된다는)(?:부담|의무)(?:은|는)?없(?:어요|습니다)$/u.test(body)
    ||/(?:해야만).+수있다고생각하지(?:는)?않(?:아요|습니다)$/u.test(body)
    ||/(?:가치|의미)(?:를|을)(?:낮게|작게)(?:보는|평가하는)(?:건|것은)아니(?:지만|고|에요)$/u.test(body);
}
function discourseAside(quote,segments) {
  const meanings=segments.flatMap(s=>s.meanings||[]);if(!meanings.length)return false;
  const body=quote.replace(/\s/gu,'');if(neutralAside(body))return true;
  // A completed declaration may be followed by its reason rather than a new
  // preference. Preserve correction, quotation, agency and scope blockers.
  if(!/(?:좋아|싫|선호|원하|원해|원치|싶|관심|취향|취소|철회|[“”"‘’])/u.test(body)){
    const reason=body.replace(/^그래야/u,'').replace(/(?:라는|다는)점때문(?:이에요|입니다)$/u,'어서')
      .replace(/되거든요$/u,'돼서').replace(/(?:어서|아서|해서|워서|니까)요$/u,m=>m.slice(0,-1));
    if(reason!==body&&clauseAdjunct(reason,false,sourceSurface(quote,body)))return true;
  }
  // A restatement is redundant only when the independently parsed action,
  // polarity and supported scope agree with a previously understood claim.
  const restatement=/^(.+?)(?:(?:방식|방법|쪽)(?:을|를)말하는(?:거예요|것이에요)|(?:좋아한다는|선호한다는|원한다는)(?:뜻|의미)(?:이에요|입니다))$/u.exec(body);
  if(restatement&&!CLAUSE_UNSAFE.test(restatement[1])){
    const declaration=restatement[1]+'좋아요',found=natural(declaration)||expanded(declaration)||compositional(declaration);
    if(found?.meanings?.length&&found.meanings.every(m=>meanings.some(p=>p.field===m.field&&p.value===m.value&&p.polarity===m.polarity&&p.condition===m.condition)))return true;
  }
  if(/^한쪽으로만하지않고(?:두가지|둘)(?:를|을)?(?:함께|같이)연습하고싶어요$/u.test(body)&&meanings.at(-1)?.field==='practice-mode'&&meanings.at(-1)?.value==='mixed'&&meanings.at(-1)?.polarity==='prefer')return true;
  if(/^(?:두|둘|세|여러)(?:방식|취향|사람|의취향|가지)(?:을|를)?(?:같은(?:선호|것)(?:으?로)?|같게)(?:묶|적)(?:고싶지|고싶지는)않아요$/u.test(body))return meanings.length>=2||segments.some(s=>['other','quotation'].includes(s.unresolved?.reason));
  if(/^어느한쪽만(?:편하|좋|싫)다고말하는(?:건|것은)아니에요$/u.test(body))return meanings.length>=2&&meanings.every(m=>m.polarity===meanings[0].polarity);
  const denial=/^(?:그렇다고)?(.+?)(싫어한다는|좋아한다는|선호한다는|원한다는)(?:뜻|의미)(?:은|는)?아니(?:고|지만|에요)$/u.exec(body);
  if(denial){const action=denial[1].replace(/핵심개요/gu,'전체개요'),ending={싫어한다는:'싫어요',좋아한다는:'좋아해요',선호한다는:'선호해요',원한다는:'원해요'}[denial[2]],found=natural(action+ending)||expanded(action+ending)||compositional(action+ending);return !!found?.meanings?.length&&!found.uncertain&&found.meanings.every(m=>!meanings.some(prior=>prior.field===m.field&&prior.value===m.value&&prior.polarity===m.polarity));}
  return false;
}
function pendingScopeAside(body,surface=body) {
  // An inset can explain a yet-unspoken preference, but cannot contribute a
  // preference, actor or scope of its own. Unknown insets remain unresolved.
  body=body.replace(/^,+|,+$/gu,'');
  if(/아니$/u.test(body)&&/아니지만\s*$/u.test(surface))body+='지만';
  if(!body)return true;
  if(universalAside(body)||neutralAside(body)||explanatoryAside(body,{meanings:[{}]}))return true;
  if(clauseAdjunct(body,false,surface))return true;
  // A complete fact followed by "apart from that fact" closes its subject;
  // that subject does not become the actor of the following main clause.
  if(!/["“”‘’「」『』]/u.test(body)&&!/(?:좋아|싫어|선호|원하|원해|취소|철회|만약|라면|다면)/u.test(body)&&/(?:있다는|없다는)사실(?:과|과는)(?:별개로|관계없이)$/u.test(body))return true;
  if(excludedOrigin(body)||OTHER_PERSON_SUBJECT.test(body)||relativePersonClause(body)
    ||/(?:좋아|선호|원하|원해|원치|싫|관심|취향|편하|편해|강요|억지|시켜|시키|명령|취소|철회|저장|분류|등록|때|경우|상황|동안|에만|에서만|에따라|뿐|수밖에|것같|모르|아마|어쩌면|일지도)/u.test(body))return false;
  // Reuse the existing subject/action grammar. A new unknown actor cannot
  // disappear just because its predicate uses an explanatory connective.
  if(adjunctHasActor(body.replace(/려는(?:게|것이)아니라$/u,'려고'),surface))return false;
  // Finite objective reasons/concessions and denied purposes are adjuncts,
  // not independent assertions. Keep the condition until a main clause wins.
  return /(?:니까|어서|아서|해서|여서|워서|러서|라서|더라도|어도|아도|여도|워도|러도|와도|려는(?:게|것이)아니라)$/u.test(body);
}
function clauseAdjunct(prefix, explicitSelf, surface=prefix) {
  if(!prefix||prefix.length>300||/(?:강요|억지|시켜|시키|명령|라고|다고|라는말|다는말|예전|과거|옛날|내일|어제|작년|만약|가정|것같|모르|아마|어쩌면|일지도|수도|취소|철회|저장|분류|등록|수밖에|뿐이라|만가능)/u.test(prefix))return false;
  if(/(?:때|경우라면|상황이라면|날만|에서만|에만|오늘만|이번만|동안|경우에만|에따라|따라서만)/u.test(prefix)||OTHER_PERSON_SUBJECT.test(prefix))return false;
  const purpose=/(?:려고|기위해|기위해서|지않도록|지않게|수있도록|수있게|(?:놓치|빠뜨리|잊|헷갈리)지않으려면)$/u.test(prefix);
  const reason=/(?:니까|어서|아서|해서|여서|워서|러서|라서|이라서|돼서)$/u.test(prefix);
  const concession=/(?:더라도|어도|아도|여도|워도|러도)$/u.test(prefix);
  if(!purpose&&!reason&&!concession)return false;
  if(explicitSelf)return true;
  // Without an explicit new self subject, an unknown topical actor survives.
  // An ordinary objective phrase ending in a purpose is not a new subject.
  if(!/^(?:제가|내가)/u.test(prefix)&&adjunctHasActor(prefix,surface)&&!/^(?:시간|준비|시작|결과|완성|운동|읽는속도)(?:이|가|은|는|까지)/u.test(prefix))return false;
  if(/^[가-힣]{1,20}(?:는|은|가|이)[가-힣]*(?:하려고|하기위해)$/u.test(prefix)&&!/^시간|^내용|^설명|^생각|^기억|^의견/u.test(prefix))return false;
  return true;
}
function structuredDeclaration(quote,depth=0) {
  if(depth>3)return null;
  const brackets=[...quote.matchAll(/\(([^()]*)\)/gu)];
  if(brackets.length&&brackets.length<=3&&brackets.every(m=>neutralAside(m[1].replace(/\s/gu,''))||clauseAdjunct(m[1].replace(/\s/gu,''),false,m[1]))){const main=quote.replace(/\([^()]*\)/gu,'');return natural(main)||expanded(main)||compositional(main)||structuredDeclaration(main,depth+1);}
  // An explanatory inset can interrupt a single nominal subject and its
  // predicate. Rejoin the grammatical skeleton only after fully checking
  // every inset; the original evidence span and its outer scope are retained.
  const commas=quote.split(',');
  if(commas.length===3&&/(?:게|것이|쪽이|방식이|편이|저는|나는|제가|내가)\s*$/u.test(commas[0])&&clauseAdjunct(commas[1].replace(/\s/gu,''),false,commas[1])){
    const main=commas[0]+commas[2],found=natural(main)||expanded(main)||compositional(main)||structuredDeclaration(main,depth+1);if(found)return found;
  }
  const {body,condition}=normalizePrefix(surfaceDeclaration(quote));
  if(CLAUSE_UNSAFE.test(body)||OTHER_PERSON_SUBJECT.test(body)||relativePersonClause(body))return null;
  const read=part=>{
    if(excludedOrigin(part))return null;
    const found=natural(part)||expanded(part)||compositional(part)||structuredDeclaration(part,depth+1);
    if(!found?.meanings?.length||found.uncertain||found.typo)return null;
    if(condition&&found.meanings.some(m=>m.condition&&m.condition!==condition))return null;
    return {meanings:found.meanings.map(m=>({...m,condition:m.condition||condition}))};
  };
  const inset=/^([^,]+),(.+)$/u.exec(body);
  if(inset&&universalAside(inset[1])){const found=read(inset[2]);if(found)return found;}
  // A finite reason, purpose or concession ends before the main declaration.
  // Try the longest boundaries first so a dependent conditional within the
  // reason cannot masquerade as the declaration's scope.
  const adjuncts=[...body.matchAll(/(?:기위해서|기위해|지않도록|지않게|수있도록|수있게|더라도|려고|니까|어서|아서|해서|여서|워서|러서|라서|어도|아도|여도|워도|러도)/gu)];
  if(adjuncts.length<=12)for(const boundary of adjuncts.reverse()){
    const end=boundary.index+boundary[0].length,prefix=body.slice(0,end),rest=body.slice(end).replace(/^,+/u,'');
    if(!rest||!clauseAdjunct(prefix,/^(?:저는|나는|제가|내가)/u.test(rest),sourceSurface(quote,prefix)))continue;
    // A fully asserted preference inside the causal arm is not disposable
    // background. The existing same-meaning causal path resolves it first.
    const stated=/^(.*?)(좋아해서|선호해서|좋아서|편해서)$/u.exec(prefix);
    if(stated){const assertion=stated[1]+({좋아해서:'좋아해요',선호해서:'선호해요',좋아서:'좋아요',편해서:'편해요'}[stated[2]]);if((natural(assertion)||expanded(assertion)||compositional(assertion))?.meanings?.length)continue;}
    const found=read(rest);if(found)return found;
  }
  // Explicit liking followed by a factual reason/consequence asserts only
  // the stated liking. An unsupported second liking is not a background fact.
  const causal=/^(.+?)(좋아해서|선호해서|좋아서|편해서)(.+)$/u.exec(body);
  if(causal&&narrativeBackground(causal[3])){
    const ending=causal[2]==='좋아해서'?'좋아해요':causal[2]==='선호해서'?'선호해요':causal[2]==='편해서'?'편해요':'좋아요';
    const found=read(causal[1]+ending);if(found)return found;
  }
  // Recognise the grammatical purpose boundary, then require an independently
  // complete declared main clause. The purpose never supplies field/polarity.
  for(const boundary of body.matchAll(/(?:수있도록|수있게|않도록|않게|기위해|려고|고싶어서|기전에|돼서|해서|니까)/gu)){
    const end=boundary.index+boundary[0].length,prefix=body.slice(0,end),rest=body.slice(end).replace(/^,+/u,'');
    if(!safeExplanation(prefix))continue;
    const found=read(rest);if(found)return found;
  }
  // "Doing A makes understanding easier, so that method suits me" binds the
  // final demonstrative to A. Both the effect and reference must be explicit;
  // an unidentified "that method" on its own still needs clarification.
  const reference=/^(?:(?:그|이|그런|이런)(?:방식|방법|쪽)(?:이|은|을)?|그렇게|이렇게)(?:더|저는|나는)?(.+)$/u;
  const effectLink=/^(.+?)(하면|해보면|받으면|들으면|보면|읽으면|두면|놓으면)(.+?)(?:그래서)?((?:(?:그|이|그런|이런)(?:방식|방법|쪽)|그렇게|이렇게).+)$/u.exec(body);
  if(effectLink&&safeExplanation(effectLink[3])){
    const stance=reference.exec(effectLink[4]),normalized=stance&&composeStance('하는'+stance[1].replace(/^하고(?=싶)/u,''));
    // The demonstrative's predicate must refer to that method itself. A new
    // actor or action inside it ("that suits my friend", "I like teaching
    // that method") cannot be collapsed into the writer liking the method.
    if(normalized&&!normalized.habitual&&normalized.action==='하기'){
      const verb={하면:'하는',해보면:'해보는',받으면:'받는',들으면:'듣는',보면:'보는',읽으면:'읽는',두면:'두는',놓으면:'놓는'}[effectLink[2]];
      const found=read(effectLink[1]+verb+(normalized.polarity==='avoid'?'걸선호하지않아요':'게좋아요'));
      if(found)return found;
    }
  }
  return null;
}
const EXCLUDED = Object.freeze({ other:'다른 사람의 이야기여서 본인의 선호로 사용하지 않아요.', past:'과거의 설명을 현재 선호로 바꾸지 않았어요.',
  hypothetical:'가정한 내용을 현재 선호로 사용하지 않아요.', quotation:'인용된 말의 주체와 뜻을 분명하게 확인하지 못했어요.',
  unsupported:'이 문장의 뜻을 현재 지원하는 항목으로 정확히 옮기지 못했어요.', sensitive:'이 내용은 성향 항목으로 추정하거나 분류하지 않아요.',
  condition:'이 조건의 범위를 정확히 이해하지 못했어요.', uncertain:'확실하지 않은 뜻은 확인 가능한 선호로 정하지 않았어요.', limit:'이번에 확인할 수 있는 범위를 넘어 남겨 두었어요.' });
function excludedOrigin(body) {
  if (/["“”‘’「」『』]/u.test(body) || /(?:라고|다고)(?:했|하셨|말(?:했|하셨|해|합|하고)|들)|(?:라는|다는)(?:말|이야기)/u.test(body)) return 'quotation';
  if(/^(?:우리|저희).{1,20}?(?:은|는|이(?!랑)|가)/u.test(body)
    ||/^(?:담당|옆자리|새로온|같은팀의)?(?:조장|팀장|부장|대표|리더|담당자|선생님|고객|참가자)(?:님)?(?:은|는|이|가)/u.test(body))return 'other';
  // Topic-marked plural subjects and honorific subjects are unambiguously
  // other people here. A plural -이 clause may instead modify the topic
  // ("팀원들이 함께 일하는 협업 방식에 관심…"); complete existing grammar
  // can recognise that, while the loose semantic fallback rejects its agency.
  if (/^(?:(?:내|제|우리|저희)?(?:친구|동료|팀원|상사|선생님|교수님|엄마|아빠|어머니|아버지|가족|동생|형|오빠|누나|언니)|그사람|다른사람|다른분|그녀|그|너|당신)(?:분)?(?:들(?:은|는|께서는|께서|에게는|한테는)|께서는|께서|에게는|한테는|은|는|이(?!랑)|가)/u.test(body)) return 'other';
  if (/(?:예전|과거|전에는|옛날|어렸을때|어릴때|즐겼|좋아했|선호했|필요했|원했|했었|좋았|편했|싶었|마음에들었|그랬|했어요|했습니다)/u.test(body)) return 'past';
  if (/(?:우울증|불안장애|ADHD|자폐|정신질환|진단|약물|치료|정당|정치성향|진보|보수|대통령|종교|성적지향|성정체성|MBTI|혈액형)/iu.test(body)) return 'sensitive';
  // A recognised factual scope such as familiar material is different from
  // imagining a preference. Unknown conditional clauses remain withheld.
  const scoped=normalizePrefix(surfaceDeclaration(body));
  const hypotheticalBody=(scoped.condition?scoped.body:surfaceDeclaration(body).replace(/^(?:저라면|나라면)/u,'')).replace(/상상하는(?=과정|활동|시간)/gu,'');
  if (/(?:만약|라면|다면|가정하|상상하)/u.test(hypotheticalBody)) return 'hypothetical';
  return null;
}
function pieces(text) {
  const result = [], separator = /\s+(?:하지만|그런데|그리고|반면에?|다만)\s+|(?:즐기고|즐기며|싫어하고|흥미가\s*있고|선호하더라도|마음에\s*들고|원치\s*않고|원치\s*않으며|좋으며|좋아하고|좋아하며|선호하고|선호하며|원하고|원하며|편하고|편하며|좋고|싫고|즐겁고|싶고|관심을\s*두고\s*있고|관심이\s*있고|관심이\s*많고|관심이\s*없고|관심이\s*있으며|싶으며|설명이고|(?:원|선호|좋아)하지\s*않고|지만|는데|쪽이고|것이고|편이고|방식이고|활동이고)(?=\s|,)|[.!?;\n,]+/gu;let start=0, match;
  const push = end => { while(start<end&&/\s/u.test(text[start]))start++;while(end>start&&/\s/u.test(text[end-1]))end--;if(end>start)result.push({start,end,quote:text.slice(start,end)}); };
  while((match=separator.exec(text))){
    if(match[0]===','&&/^(?:(?![.!?;\n]).)*(?:모두|둘\s*다)(?:(?![.!?;\n]).)*(?:선호|좋아|관심|싫|원)/u.test(text.slice(match.index+1)))continue;
    if(match[0]===','){
      const head=text.slice(start,match.index);
      if(/(?:게|것이|쪽이|방식이|편이|저는|나는|제가|내가)\s*$/u.test(head))continue;
      const inset=head.split(',');
      if(inset.length===2&&/(?:게|것이|쪽이|방식이|편이|저는|나는|제가|내가)\s*$/u.test(inset[0])&&clauseAdjunct(inset[1].replace(/\s/gu,''),false,inset[1]))continue;
      if(/기\s*$/u.test(head)&&/^[^.!?;\n]*(?:좋아|선호|관심|싫)/u.test(text.slice(match.index+1)))continue;
      const scope=normalizePrefix(surfaceDeclaration(text.slice(start,match.index)));
      if(scope.condition&&(!scope.body||universalAside(scope.body.replace(/^,+/u,''))))continue;
    }
    if(match[0]===','&&/^\s*(?:(?:저는|나는|제가|내가|제\s*경우에는|내\s*경우에는|제\s*취향은)|(?:처음|익숙한|바쁠|회의할|함께\s*일할))/u.test(text.slice(match.index+1))){push(match.index);start=match.index+1;continue;}
    if(match[0]===','&&/(?:뜻|의미|이야기)(?:은|는)?\s*아니고\s*$/u.test(text.slice(start,match.index))){push(match.index);start=match.index+1;continue;}
    if(match[0]===','){
      const prefix=text.slice(start,match.index),scoped=normalizePrefix(surfaceDeclaration(prefix));
      // A comma may separate a scope from its own predicate. It is not a new
      // preference, nor a reason to lose that scope and ask it again.
      if(scoped.condition&&!scoped.body||/^어느쪽을고를지$/u.test(scoped.body)||/(?:인지|할지|갈지|는지|식으로|방식으로)\s*$/u.test(prefix)||/(?:고|하되|하며)\s*$/u.test(prefix)&&!/해\s*주시고\s*$/u.test(prefix))continue;
    }
    // Coordinated nominal arms share a final predicate, including its negation.
    if(match[0]===','&&(/(?:기도)\s*$/u.test(text.slice(start,match.index))))continue;
    if(match[0]===','&&(/(?:것|거|방식|시간|활동|쪽)(?:도)?\s*$/u.test(text.slice(start,match.index))||/^\s*(?:둘\s*다|모두)/u.test(text.slice(match.index+1))))continue;
    // -고 is not an assertion boundary when it continues into a desiderative
    // or a metalinguistic choice such as "좋고 싫고를 모르겠어요".
    if(/^(?:흥미가\s*있고|관심이\s*있고)$/u.test(match[0])&&/^\s*(?:배워|알아|살펴)\s*보고\s*싶/u.test(text.slice(match.index+match[0].length)))continue;
    if(/^(?:좋고|좋아하고|편하고|즐겁고|즐기고|즐기며|싫어하고|흥미가\s*있고|관심이\s*있고)$/u.test(match[0])){
      const tail=text.slice(match.index+match[0].length);
      if(/^\s*(?:싶|말고|싫고|아니고|그랬|없고)/u.test(tail))continue;
      // A connective inside reported or denied wording is not a completed
      // preference. Its governing quotation/denial may occur after another
      // dependent verb, so inspect that same sentence before cutting it.
      if(/^(?:즐기고|즐기며|싫어하고)$/u.test(match[0])&&/^[^.!?;\n]*(?:(?:다는|라는)\s*(?:말|뜻|의미|문장|이야기)|(?:다고|라고)\s*(?:말|이야기|얘기|하|했|하셨|들))/u.test(tail))continue;
    }
    // A noun ending in -지 followed by the restrictive particle -만 is not
    // the contrastive predicate ending -지만 (for example, 요지만).
    if(match[0]==='지만'&&!/(?:좋|싫|하|되|있|없|않|했|았|었|겠|리|지|많|되|편이|일이|맞|기|겼)$/u.test(text.slice(start,match.index).replace(/\s/gu,'')))continue;
    push(match.index+(!/^[.!?;\n,\s]/u.test(match[0])?match[0].length:0));start=match.index+match[0].length;
  }push(text.length);return result;
}
function unresolvedSubject(quote) {
  // A failed semantic parse is not permission to discard its subject. Inspect
  // the leading noun phrase independently of the preference vocabulary, so an
  // unknown name or role still owns subsequent clauses. Known topic/action
  // heads remain topics; no new list of person names or occupations is needed.
  const compact=quote.replace(/\s/gu,'');
  if(OTHER_PERSON_SUBJECT.test(compact))return true;
  const prefix=normalizePrefix(surfaceDeclaration(quote)).body;
  for(const boundary of prefix.matchAll(/께서는|께서|은|는|이|가/gu)){
    if(boundary.index>40)break;
    const head=prefix.slice(0,boundary.index),whole=prefix.slice(0,boundary.index+boundary[0].length);
    if(!head)continue;
    if(phraseUnits(normalizeActionPhrase(head).action))return false;
    // Inflected adjectives may contain the same surface ending as a topic
    // particle; consume the known modifier before looking for its noun head.
    if(phraseUnits(normalizeActionPhrase(whole).action))continue;
    return true;
  }
  return false;
}
function explanatoryAside(quote,adjacent) {
  if(!adjacent?.meanings?.length)return false;
  const body=quote.replace(/\s/gu,'');
  if(/["“”‘’]/u.test(body)||OTHER_PERSON_SUBJECT.test(body)||/(?:좋아|좋다는|싫어|싫다는|선호|원하|원해|원치|관심|취향|편하다는|강요|시켜|취소|철회|저장|없던일)/u.test(body))return false;
  if(/(?:뜻|의미|이야기)(?:은|는)?아니(?:고|지만)$/u.test(body))return true;
  if(/(?:과는|와는)(?:별개로|관계없이)$/u.test(body))return true;
  if(/(?:이유인데|때문인데)$/u.test(body)&&!/(?:경우|상황|때만|만약|라면|다면|예전|과거)/u.test(body))return true;
  return /(?:더라도|어도|아도|여도|긴하지만)$/u.test(body)&&clauseAdjunct(body.replace(/긴하지만$/u,'더라도'),false);
}
function redundantReference(quote,adjacent) {
  if(!adjacent?.meanings?.length)return false;
  const {body,condition}=normalizePrefix(surfaceDeclaration(quote));
  if(condition||excludedOrigin(body)||CLAUSE_UNSAFE.test(body)||OTHER_PERSON_SUBJECT.test(body))return false;
  const reference=/^(?:(그|이|그런|이런)(?:(업무|일하는|소통|연습|도움|판단)(?:방식|방법)|(?:분야|활동|주제|방식|방법|쪽))|((?:두|둘)(?:분야|활동|주제))|((?:그렇게|이렇게)도움받는))(?:이|가|은|는|을|를)?(.+)$/u.exec(body);
  if(!reference)return false;
  const typed=reference[2],plural=!!reference[3],support=!!reference[4];
  const fields=typed?{업무:'work-style',일하는:'work-style',소통:'communication',연습:'practice-mode',도움:'support',판단:'decision'}[typed]:support?'support':/(?:분야|활동|주제)/u.test(reference[0])?'topic':null;
  const antecedents=adjacent.meanings;
  if(fields&&antecedents.some(m=>m.field!==fields)||plural&&antecedents.length!==2||!plural&&antecedents.length!==1)return false;
  let predicate=reference[5].replace(/^(?:알아보는|살펴보는)(?:게|것이|것은|걸)?/u,'');
  const stance=composeStance('하는'+predicate);
  return !!stance&&!stance.habitual&&stance.action==='하기'&&antecedents.every(m=>m.polarity===stance.polarity);
}
const OPTIONS_END = [{id:'unsure',label:'아직 잘 모르겠어요'},{id:'skip',label:'이 부분은 건너뛸게요'}];
const FIELDS = { support:'도움받는 방식', explanation:'설명 길이', 'practice-mode':'연습 방식', topic:'관심 분야',
  communication:'소통 방식', 'work-style':'일을 진행하는 방식', decision:'판단 방식', 'explanation-detail':'설명에서 원하는 구성' };
function quotedAt(text,end) {
  let quote=null;
  const close={'“':'”','‘':'’','「':'」','『':'』','"':'"'};
  for(let i=0;i<end;i++){const c=text[i];if(quote&&c===quote)quote=null;else if(!quote&&close[c])quote=close[c];}
  return quote!==null;
}
function scopeBoundaryBetween(text,start,end) {
  for(let i=start;i<end;i++)if(/[.!?;\n]/u.test(text[i])&&!quotedAt(text,i))return true;
  return false;
}
function reattributedPreference(body,segments) {
  const restatement=/^(.+?(?:은|는|이|가))(?:좋아한다는|싫어한다는|선호한다는|원한다는|편하다는)(?:뜻|의미)(?:이에요|입니다)$/u.exec(body);
  if(!restatement||!OTHER_PERSON_SUBJECT.test(restatement[1]))return false;
  const prior=segments.at(-1);if(!prior?.meanings?.length)return false;
  // The following nominal restatement corrects the owner of the immediately
  // preceding preference. Asking about the correction alone must not leave
  // that superseded self attribution saved when the question is skipped.
  delete prior.meanings;delete prior.candidate;prior.generic=true;
  prior.unresolved={...prior.evidence,reason:'other',reasonLabel:'뒤 문장에서 선호의 주체를 다른 사람으로 설명해 본인의 선호인지 다시 확인해요.'};
  return true;
}
function analyze(text) {
  // Legacy's literal validator enforces the same 500-code-point/Unicode bounds.
  Legacy.parseMemberStatement(text);
  const segments=[];let inherited=null, previousCondition=false, continuingCondition=null, unknownSubject=false, pendingScope=null;
  for(const evidence of pieces(text)) {
    const insideLiteral=quotedAt(text,evidence.start);
    const body=selfSurface(evidence.quote).replace(/\s/gu,''), self=!insideLiteral&&(/^(?:나는|저는|제가|내가|제경우에는|내경우에는|제취향은|내취향은)/u.test(body)||/^(?:나는|저는|제가|내가|제경우에는|내경우에는|제취향은|내취향은)/u.test(surfaceDeclaration(evidence.quote))), current=/^(?:(?:나는|저는|제가|내가))?(?:지금|요즘|현재|이제)/u.test(body);
    const generalReset=/^(?:(?:나는|저는|제가|내가))?(?:평소|보통은|일반적으로|상황과관계없이|일과별개로|별개로)/u.test(body);
    // A prefix before comma-separated insets owns the following main clause.
    // It lives independently of parsed meanings and coordinating endings.
    if(pendingScope&&(scopeBoundaryBetween(text,pendingScope.end,evidence.start)||generalReset&&!insideLiteral))pendingScope=null;
    if(pendingScope&&insideLiteral)pendingScope={...pendingScope,uncertain:true};
    if(self&&!insideLiteral)unknownSubject=false;
    if(inherited==='quotation'&&self&&!insideLiteral)inherited=null;
    if(!insideLiteral&&reattributedPreference(body,segments)){segments.push({evidence,unresolved:{...evidence,reason:'other',reasonLabel:EXCLUDED.other}});continue;}
    if(/^(?:제|내)(?:방식|선호|취향)(?:은|는)(?:이래요|다음과같아요)$/u.test(body)){segments.push({evidence,meanings:[]});continue;}
    if(discourseAside(evidence.quote,segments)||explanatoryAside(evidence.quote,segments.at(-1))){segments.push({evidence,meanings:[]});continue;}
    if(inherited==='other'&&self || inherited==='past'&&current || inherited==='condition'&&generalReset || inherited==='uncertain'&&current || ['quotation','hypothetical','sensitive'].includes(inherited)&&self&&current)inherited=null;
    const sentenceStart=Math.max(text.lastIndexOf('.',evidence.start-1),text.lastIndexOf('!',evidence.start-1),text.lastIndexOf('?',evidence.start-1),text.lastIndexOf('\n',evidence.start-1))+1;
    const stop=/[.!?\n]/u.exec(text.slice(evidence.end)),sentenceEnd=stop?evidence.end+stop.index:text.length;
    const nounModifier=relativePersonClause(text.slice(sentenceStart,sentenceEnd).replace(/\s/gu,''));
    const localRelative=/(?:좋아하는|싫어하는|선호하는|편한|좋은)[가-힣A-Za-z]{1,24}(?:이|가)(?:제게|저에게|내게|나에게|우리에게)/u.test(body);
    const segment={evidence}, reason=(nounModifier||localRelative?'other':excludedOrigin(body))||inherited;
    if(reason||unknownSubject) {
      inherited=reason;continuingCondition=null;
      // Rejecting a quoted/other-owned inset rejects its content, not the
      // still-open outer condition. A later self reset cannot erase it.
      const outer=normalizePrefix(surfaceDeclaration(body)).condition;
      if(pendingScope)pendingScope={...pendingScope,end:evidence.end,uncertain:true};
      else if(outer&&!insideLiteral&&(/^\s*,/u.test(text.slice(evidence.end))||quotedAt(text,evidence.end)))pendingScope={condition:outer,start:evidence.start,end:evidence.end,uncertain:true};
      segment.unresolved={...evidence,reason:reason||'unsupported',reasonLabel:reason?EXCLUDED[reason]:'앞 문장에 나온 주체를 본인으로 확인하지 못해 이 내용도 성향으로 사용하지 않았어요.'};if(['uncertain','condition'].includes(reason))segment.generic=true;segments.push(segment);continue;
    }
    const prior=segments.findLast(s=>s.meanings?.length);
    let clause=evidence.quote;
    const adjacent=segments.at(-1),exampleAntecedent=adjacent?.meanings?.find(m=>m.field==='support'&&m.value==='example'&&m.polarity==='prefer');
    const exampleReference=exampleAntecedent&&/^(?:(?:그|이)\s*(?:예시|예제|샘플|걸|것을)|(?:예시|예제|샘플)(?:를|을)?\s*(?:본|확인한)\s*(?:다음|뒤|후)\s*(?:시도|시작|연습)할\s*때)/u.test(clause);
    if(exampleAntecedent)clause=clause.replace(/^(?:그걸|그것을)\s*(보고\s*나서(?:는)?|본\s*(?:다음|뒤|후)(?:에는)?)/u,'예시를 본 다음에는');
    const sameScope=previousCondition&&/^(?:그때(?:도|는)|같은\s*상황에서도|그\s*조건에서는)\s*/u.test(clause);
    if(sameScope)clause=clause.replace(/^(?:그때(?:도|는)|같은\s*상황에서도|그\s*조건에서는)\s*/u,'');
    const normalizedClause=normalizePrefix(surfaceDeclaration(clause)),declaredCondition=normalizedClause.condition;
    if(declaredCondition&&pendingScope){
      // Two prefixes before one predicate are simultaneous restrictions.
      // Only existing representable combinations can be composed; a later
      // prefix is never permission to replace the earlier one.
      const combined=declaredCondition===pendingScope.condition?declaredCondition
        :declaredCondition==='after-example'&&['first-try','familiar','busy'].includes(pendingScope.condition)?pendingScope.condition+'-after-example'
        :null;
      pendingScope={...pendingScope,condition:combined||pendingScope.condition,uncertain:pendingScope.uncertain||!combined};
    }
    const antecedentScope=exampleReference&&['first-try','familiar','busy'].includes(exampleAntecedent.condition)?exampleAntecedent.condition:null;
    let inheritedScope=pendingScope?.condition||continuingCondition||(sameScope?previousCondition:null)||antecedentScope;
    if(prior?.meanings.length&&/^그다음\s+/u.test(clause))clause=clause.replace(/^그다음\s+/u,'');
    let found=natural(clause)||expanded(clause)||compositional(clause)||coordinatedDeclaration(clause)||focusedContrast(clause)||structuredDeclaration(clause)||tentative(clause)||restrictedMethod(clause);
    const commaContinuation=/^\s*,/u.test(text.slice(evidence.end));
    if(!found&&(declaredCondition||pendingScope)&&commaContinuation){
      const safe=pendingScopeAside(normalizedClause.body,sourceSurface(evidence.quote,normalizedClause.body,true));
      pendingScope={condition:pendingScope?.condition||declaredCondition,start:pendingScope?.start??evidence.start,end:evidence.end,uncertain:!safe||!!pendingScope?.uncertain};
      if(safe){segment.meanings=[];segments.push(segment);continue;}
    }
    if(!found&&!/^[\s.!?]*\?/u.test(text.slice(evidence.end))&&redundantReference(evidence.quote,adjacent)){segment.meanings=[];segments.push(segment);continue;}
    if(!found&&prior?.meanings.length&&!/^[\s.!?]*\?/u.test(text.slice(evidence.end))){
      const reference=/^(?:(?:저는|나는)?(?:그|이|그런|이런)(?:방식|방법|쪽)(?:이|은|을)|둘다)(.+)$/u.exec(normalizePrefix(body).body);
      const declared=reference&&composeStance('하는'+reference[1]);
      if(declared?.action==='하기'&&!declared.habitual&&prior.meanings.every(m=>m.polarity===declared.polarity)){
        segment.meanings=[];segments.push(segment);continue;
      }
      const compared=/^(?:두|둘)(연습|방식)(?:에대한)?(?:제|내)취향(?:은|이)(?:이렇게|서로)달라요$/u.exec(body);
      const recent=segments.slice(-2).flatMap(s=>s.meanings||[]);
      if(compared&&recent.length>=2&&(compared[1]!=='연습'||recent.every(m=>m.field==='practice-mode'))){segment.meanings=[];segments.push(segment);continue;}
    }
    // An anaphoric explanation adds no new field, condition or preference.
    // It does not make the member answer the same understood claim again.
    if(!found&&!/^[\s.!?]*\?/u.test(text.slice(evidence.end))&&segments.at(-1)?.meanings?.length&&(/^(?:그게|그건|이게|이건|제|내)?(?:취미|관심분야)(?:예요|입니다|거든요|라서요)$/u.test(body)
      ||/^(?:(?:저는|나는)?(?:그쪽|그방식|그방법)(?:이|은)|그래야)(?:더)?(?:편해요|편하더라|좋아요)$/u.test(body)
      ||/^(?:제가|내가)원하는방식(?:이에요|입니다)$/u.test(body)
      ||/^그정도(?:분량|길이)(?:를|을)선호해요$/u.test(body)
      ||segments.at(-1).meanings.some(m=>m.field==='communication'&&m.value==='share-first')&&/^다른얘기(?:는)?그뒤에들을래(?:요)?$/u.test(body))){segment.meanings=[];segments.push(segment);continue;}
    if(!found&&segments.at(-1)?.meanings?.length&&/(?:좋아하고|좋고|편하고|즐겁고)$/u.test(segments.at(-1).evidence.quote.replace(/\s/gu,''))&&narrativeBackground(body)){
      segment.meanings=[];segments.push(segment);continue;
    }
    if(!found) { const old=Legacy.parseMemberStatement(evidence.quote);if(old.meanings.length===1&&!old.unresolved.length)found={meanings:old.meanings}; }
    // An explicit new self-owned interest after a completed method clause is
    // a topic shift. A self subject inside a bare scope prefix is still part
    // of that same scoped clause; a contrast still needs its explicit scope.
    if(found&&self&&!pendingScope&&!declaredCondition&&!previousCondition&&prior?.meanings?.some(m=>m.field!=='topic')&&found.meanings.every(m=>m.field==='topic')){inheritedScope=null;continuingCondition=null;}
    if(found&&inheritedScope&&!generalReset)found={...found,meanings:found.meanings.map(m=>({...m,condition:m.condition==='after-example'&&['first-try','familiar','busy'].includes(inheritedScope)?inheritedScope+'-after-example':m.condition==='after-example'&&/^(?:first-try|familiar|busy)-after-example$/u.test(inheritedScope)?inheritedScope:m.condition||inheritedScope}))};
    const scopedCondition=found?.meanings.at(-1)?.condition||(declaredCondition==='after-example'&&antecedentScope?antecedentScope+'-after-example':declaredCondition)||(!generalReset?inheritedScope:null);
    // Contrast can change the applicable condition. Only additive coordination
    // inherits it implicitly; a contrast needs a new explicit scope or an
    // explicit reference to the same scope, otherwise the old guard asks.
    continuingCondition=scopedCondition&&/(?:고|며)$/u.test(body)?scopedCondition:null;
    let unresolvedCondition=previousCondition&&found?.meanings.some(m=>!m.condition)&&!generalReset;
    if(pendingScope&&found){
      segment.evidence={start:pendingScope.start,end:evidence.end,quote:text.slice(pendingScope.start,evidence.end)};
      if(pendingScope.uncertain)unresolvedCondition=true;
      pendingScope=null;
    }
    if(unresolvedCondition){found=null;inherited='condition';}
    // An unresolved explicitly scoped clause cannot silently turn its next
    // unscoped continuation into a general preference. Keep that question
    // open until a new explicit scope or general reset resolves the boundary.
    previousCondition=scopedCondition&&(!found||/(?:지만|는데)$/u.test(body))?scopedCondition:false;
    const asking=/^[\s.!?]*/u.exec(text.slice(evidence.end))[0].includes('?');
    const uncertain=/(?:것같|듯|모르|아마|어쩌면|일지도|글쎄|수도|싫지않|없지않|않지는않)/u.test(body);
    if(!found&&!uncertain&&!declaredCondition&&/(?:때|땐|경우|상황|동안|날에는|날에만|에만|에서만|에따라|오늘만|내일만|이번만|퇴근후|출근전|(?:뒤|후|다음)(?:에는|엔)|(?:에서|에)는$)/u.test(body)){unresolvedCondition=true;inherited='condition';}
    if(!found&&!self&&!declaredCondition&&!unresolvedCondition&&!uncertain&&unresolvedSubject(evidence.quote))unknownSubject=true;
    if(uncertain&&/(?:지만|는데)$/u.test(body))inherited='uncertain';
    if(asking){if(found)segment.candidate={...found,uncertain:true};else segment.generic=true;segment.unresolved={...evidence,reason:'uncertain',reasonLabel:'질문으로 적은 내용을 현재 선호로 정하지 않았어요.'};}
    else if(found){if(found.uncertain||found.typo||uncertain)segment.candidate={...found,uncertain:found.uncertain||uncertain};else segment.meanings=found.meanings;}
    else segment.generic=true;
    if(!segment.meanings&&!segment.unresolved){const why=uncertain?'uncertain':unresolvedCondition?'condition':'unsupported';segment.unresolved={...evidence,reason:why,reasonLabel:EXCLUDED[why]};}
    segments.push(segment);
    if(segments.length===MEMBER_STATEMENT_LIMITS.unresolved && evidence.end<text.length){const last=segments.at(-1);delete last.meanings;delete last.candidate;delete last.generic;last.evidence={...evidence,end:text.length,quote:text.slice(evidence.start)};last.unresolved={...last.evidence,reason:'limit',reasonLabel:EXCLUDED.limit};break;}
  }
  return segments;
}
function stateFor(text,segments,answers,key) {
  const raw=[],unresolved=[],questions=[];
  const question=(index,stage,label,options,apply)=>{const id=`q.${key}.${index}.${stage}`,answer=answers[id];if(answer!==undefined){apply(answer);return;}questions.push({id,about:id,kind:'follow_up',label,options:[...options,...OPTIONS_END].map(o=>({...o,value:o.id}))});};
  for(let index=0;index<segments.length;index++){
    const s=segments[index],add=meanings=>meanings.forEach(m=>raw.push({...m,evidence:copy(s.evidence)}));
    if(s.meanings){add(s.meanings);continue;}
    let handled=false;
    if(s.candidate){question(index,'confirm',`「${s.evidence.quote}」${s.candidate.typo?'의 표기를 이렇게 이해해도 될까요?':s.candidate.restricted?'에서 한 가지 방식만 쓰는 경우와, 그 방식 자체에 대한 선호를 구분할게요. 다음 뜻까지 맞나요?':'에서 말한 뜻을 현재 선호로 확인할까요?'}`,
      [{id:'confirm',label:s.candidate.meanings.map(meaningLabel).join(' / ')+' — 지금 원하는 내용이 맞아요'},{id:'not-current',label:'현재 선호로 확정하지 않을게요'}],answer=>{handled=true;if(answer==='confirm')add(s.candidate.meanings);});}
    else if(s.generic){question(index,'field',`「${s.evidence.quote}」에서 확인하고 싶은 현재 선호는 어느 쪽인가요?`,Object.entries(FIELDS).map(([id,label])=>({id,label})),field=>{
      handled=true;if(!Object.hasOwn(VALUES,field))return;
      question(index,'value',`${FIELDS[field]}에서 어떤 내용을 확인할까요?`,VALUES[field].map(id=>({id,label:LABELS[id]})),selected=>{
        if(!VALUES[field].includes(selected))return;
        question(index,'polarity',`‘${LABELS[selected]}’을 지금 어떻게 생각하나요?`,[{id:'prefer',label:'원하거나 선호해요'},{id:'avoid',label:'원하거나 선호하지 않아요'}],polarity=>{
          if(!['prefer','avoid'].includes(polarity))return;
          question(index,'condition','이 내용은 어느 상황에 해당하나요?', [{id:'general',label:'특정 상황에 한정하지 않은 현재 선호예요'},...Object.entries(CONDITIONS).map(([id,label])=>({id,label}))],condition=>{
            if(condition==='general'||Object.hasOwn(CONDITIONS,condition))add([{field,value:selected,polarity,condition:condition==='general'?null:condition}]);
          });
        });
      });
    });}
    if(!raw.some(m=>m.evidence.start===s.evidence.start))unresolved.push({...s.unresolved,...(handled?{reasonLabel:'답한 범위에서 확인 중이거나, 이번에는 반영하지 않기로 한 내용이에요.'}:{})});
  }
  const meanings=[],seen=new Set();
  for(const m of raw){const identity=semanticKey(m);if(seen.has(identity))continue;if(meanings.length===MEMBER_STATEMENT_LIMITS.meanings){unresolved.push({...m.evidence,reason:'limit',reasonLabel:'이번에 확인할 수 있는 범위를 넘어 남겨 두었어요.'});continue;}seen.add(identity);meanings.push({id:'p'+meanings.length,field:m.field,value:m.value,polarity:m.polarity,condition:m.condition,evidence:m.evidence});}
  const grouped=new Set();
  for(const m of meanings){if(grouped.has(m.id))continue;const group=meanings.filter(other=>other.id===m.id||meaningsConflict(m,other));if(group.length<2)continue;group.forEach(p=>grouped.add(p.id));
    const id=`q.${key}.conflict.${sourceKey(group.map(p=>p.id+semanticKey(p)).join('|')).slice(0,16)}`,answer=answers[id];
    if(answer===undefined)questions.push({id,about:id,kind:'choice',label:'같은 상황의 뜻이 서로 달라요. 현재 원하는 뜻을 골라 주세요.',options:[...group.map(p=>({id:p.id,label:meaningLabel(p),value:p.id})),...OPTIONS_END.map(o=>({...o,value:o.id}))]});
    else for(const p of group)if(p.id!==answer)p.withheld=true;
  }
  return {meanings:meanings.filter(m=>!m.withheld),unresolved:unresolved.slice(0,MEMBER_STATEMENT_LIMITS.unresolved),questions};
}
function choose(state,text,segments,answers,key) {
  const result=Ask.choose({questions:state.questions,decide:scenario=>{
    const outcome=stateFor(text,segments,{...answers,...scenario},key);
    return {meanings:outcome.meanings.map(m=>semanticKey(m)),questions:outcome.questions.map(q=>q.id)};
  }});
  return result.status==='ask'?{id:result.question.id,label:result.question.label,options:result.question.options.map(({id,label})=>({id,label}))}:null;
}
function parseMemberStatement(text,{clarifications=[],parserVersion=PARSER_VERSION}={}) {
  if(parserVersion===Legacy.PARSER_VERSION){if(clarifications.length)fail();return Legacy.parseMemberStatement(text);}
  if(parserVersion===Previous.PARSER_VERSION)return Previous.parseMemberStatement(text,{clarifications,parserVersion});
  if(parserVersion===Previous3.PARSER_VERSION)return Previous3.parseMemberStatement(text,{clarifications,parserVersion});
  if(parserVersion===Previous4.PARSER_VERSION)return Previous4.parseMemberStatement(text,{clarifications,parserVersion});
  if(parserVersion===Previous5.PARSER_VERSION)return Previous5.parseMemberStatement(text,{clarifications,parserVersion});
  if(parserVersion===Previous6.PARSER_VERSION)return Previous6.parseMemberStatement(text,{clarifications,parserVersion});
  if(parserVersion===Previous7.PARSER_VERSION)return Previous7.parseMemberStatement(text,{clarifications,parserVersion});
  if(parserVersion===Previous8.PARSER_VERSION)return Previous8.parseMemberStatement(text,{clarifications,parserVersion});
  if(parserVersion!==PARSER_VERSION)fail();
  if(!list(clarifications,MEMBER_STATEMENT_LIMITS.clarifications)||clarifications.some(row=>!exact(row,['questionId','optionId'])||typeof row.questionId!=='string'||typeof row.optionId!=='string'))fail();
  const segments=analyze(text),key=sourceKey(text),answers=Object.create(null),clarificationAnswers=[];let state=stateFor(text,segments,answers,key),question=choose(state,text,segments,answers,key);
  for(const row of clarifications){if(!question||question.id!==row.questionId||Object.hasOwn(answers,row.questionId))fail();const option=question.options.find(o=>o.id===row.optionId);if(!option)fail();
    answers[row.questionId]=row.optionId;clarificationAnswers.push({...row,questionLabel:question.label,optionLabel:option.label});state=stateFor(text,segments,answers,key);question=choose(state,text,segments,answers,key);}
  if(clarifications.length===MEMBER_STATEMENT_LIMITS.clarifications&&question){
    const conflicted=state.meanings.filter(a=>state.meanings.some(b=>a!==b&&meaningsConflict(a,b)));
    state.meanings=state.meanings.filter(m=>!conflicted.includes(m));
    state.unresolved=[...state.unresolved,...conflicted.map(m=>({...m.evidence}))].slice(0,MEMBER_STATEMENT_LIMITS.unresolved).map(u=>({...u,reason:'limit',reasonLabel:'추가 질문은 이번에 12개까지만 확인해요. 이 부분은 반영하지 않았어요.'}));question=null;
  }
  return {parserVersion:PARSER_VERSION,meanings:state.meanings,unresolved:state.unresolved,question,clarifications:copy(clarifications),clarificationAnswers};
}
function meaningLabel(m){return `${m.condition?CONDITIONS[m.condition]+' · ':''}${m.polarity==='avoid'?'선호하지 않는 내용':'원하는 내용'}: ${LABELS[m.value]}`;}
function meaningsConflict(a,b) {
  if(a.field!==b.field||a.condition!==b.condition)return false;
  if(a.value===b.value)return a.polarity!==b.polarity;
  return a.field!=='topic'&&!MULTI_FIELDS.includes(a.field)&&a.polarity==='prefer'&&b.polarity==='prefer';
}
function validateMemberStatement(row,{now=Date.now(),enforceTime=false}={}) {
  const parserVersion=plain(row)?Object.getOwnPropertyDescriptor(row,'parserVersion')?.value:null;
  if(parserVersion===Legacy.PARSER_VERSION)return Legacy.validateMemberStatement(row,{now,enforceTime});
  if(parserVersion===Previous.PARSER_VERSION)return Previous.validateMemberStatement(row,{now,enforceTime});
  if(parserVersion===Previous3.PARSER_VERSION)return Previous3.validateMemberStatement(row,{now,enforceTime});
  if(parserVersion===Previous4.PARSER_VERSION)return Previous4.validateMemberStatement(row,{now,enforceTime});
  if(parserVersion===Previous5.PARSER_VERSION)return Previous5.validateMemberStatement(row,{now,enforceTime});
  if(parserVersion===Previous6.PARSER_VERSION)return Previous6.validateMemberStatement(row,{now,enforceTime});
  if(parserVersion===Previous7.PARSER_VERSION)return Previous7.validateMemberStatement(row,{now,enforceTime});
  if(parserVersion===Previous8.PARSER_VERSION)return Previous8.validateMemberStatement(row,{now,enforceTime});
  if(!exact(row,['id','parserVersion','text','at','confirmedAt','meanings','clarifications'])||parserVersion!==PARSER_VERSION||typeof row.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(row.id)||!list(row.meanings,MEMBER_STATEMENT_LIMITS.meanings)||!row.meanings.length)fail();
  const at=instant(row.at),confirmed=instant(row.confirmedAt),cutoff=enforceTime?typeof now==='string'?instant(now):Number.isSafeInteger(now)?now:fail():null;
  if(confirmed<at||enforceTime&&confirmed>cutoff)fail();const parsed=parseMemberStatement(row.text,{clarifications:row.clarifications});if(parsed.question)fail();
  const ids=new Set(),meanings=row.meanings.map(m=>{if(!exact(m,['id','field','value','polarity','condition','evidence'])||!exact(m.evidence,['start','end','quote'])||ids.has(m.id))fail();ids.add(m.id);
    const expected=parsed.meanings.find(p=>p.id===m.id);if(!expected||['field','value','polarity','condition'].some(key=>m[key]!==expected[key])||['start','end','quote'].some(key=>m.evidence[key]!==expected.evidence[key]))fail();return copy(expected);
  }).sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));
  if(meanings.some((a,i)=>meanings.slice(i+1).some(b=>meaningsConflict(a,b))))fail();
  return {id:row.id.toLowerCase(),parserVersion:PARSER_VERSION,text:row.text,at:row.at,confirmedAt:row.confirmedAt,meanings,clarifications:parsed.clarifications};
}
module.exports={PARSER_VERSION,MEMBER_STATEMENT_LIMITS,MEMBER_STATEMENT_VALUES:VALUES,MEMBER_STATEMENT_LABELS:LABELS,MEMBER_STATEMENT_CONDITIONS:CONDITIONS,MEMBER_STATEMENT_MULTI_FIELDS:MULTI_FIELDS,parseMemberStatement,validateMemberStatement,meaningsConflict,meaningLabel};
