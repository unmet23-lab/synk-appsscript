'use strict';
// Product vocabulary and clarification replay. Core Ask chooses the next useful
// question; Core Interpretation/Domain own evidence and confirmed declarations.
// Frozen ko-1 through ko-4 modules keep saved rows and answer replay unchanged.
const Legacy = require('./member-statement-v1.cjs');
const Previous = require('./member-statement-v2.cjs');
const Previous3 = require('./member-statement-v3.cjs');
const Previous4 = require('./member-statement-v4.cjs');
const Ask = require('../../../atlas/ask');
const PARSER_VERSION = 'member-statement-ko-5';
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
  if(/^(?:(?:내|제)?(?:친구|동료|엄마|아빠|어머니|아버지)|그사람|다른사람|그녀|그|너|당신)(?:은|는|이|가)/u.test(body))return null;
  if(/(?:예전|과거|전에는|좋아했|선호했|필요했|원했|했었|만약|라면|다면|으면|싫지않|없지않|않지는않)/u.test(body))return null;
  body=body.replace(/^(?:저는|나는|난|제가|내가|제경우에는|내경우에는)/u,'').replace(/^(?:요즘(?:은|엔)?|지금(?:은|엔)?|현재(?:는)?|평소(?:에는|엔|는)|보통은|일반적으로는)/u,'');
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
  action=action.replace(/(?:(?:저는|나는|제가|내가|저에게|나에게|제게|제겐|내겐|저한테|저랑|나랑)?(?:좀더|더욱|훨씬|정말|참|가장|별로|딱히|그다지|더)?)+$/u,'')
    .replace(/(?:것|거|방식|쪽|편|시간|일|방법)(?:이|은|을|를|도|에|에는)?$|(?:게|걸|건|데)$/u,'');
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
    .replace(/참고해(?=결정|판단)/gu,'참고하고').replace(/자세하게/gu,'자세히').replace(/상세하게/gu,'상세히')
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
function normalizePrefix(quote) {
  let body = quote.replace(/\s/gu, '').replace(/(?:지만|는데)$/u, '').replace(/좋고$/u,'좋아요').replace(/좋아하고$/u,'좋아해요').replace(/편하고$/u,'편해요').replace(/즐겁고$/u,'즐거워요').replace(/싫$/u,'싫어요').replace(/(?:좋아하|선호하)$/u,s=>s.slice(0,-1)+'해').replace(/할땐/gu,'할때는').replace(/배울땐/gu,'배울때는');
  body=body.replace(/좋(?:아하)?고요$/u,s=>s.startsWith('좋아')?'좋아해요':'좋아요').replace(/^(?:저라면|나라면)/u,'');
  body = body.replace(/^(?:저는|나는|난|제가|내가|저한테는|제게는|나한테는|제경우에는|내경우에는)/u, '').replace(/^(?:요즘(?:은|엔)?|지금(?:은|엔)?|이제(?:는|부터는)?|현재(?:는)?|평소(?:에는|엔|는)?|보통은|일반적으로는)/u, '');
  let condition = null;
  for (const [id, prefix] of CONDITION_PREFIXES) if (prefix.test(body)) { condition = id;body = body.replace(prefix, '');break; }
  return { body, condition };
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
      const secondGeneral=/^(?:(?:나는|난|저는|제가|내가))?(?:평소|보통은|일반적으로)/u.test(coordinated[2]);
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
  ['both', /^(?:두가지|둘다)/u], ['identity', /^(?:뭔지|무엇인지)/u], ['similarity', /^(?:같은)/u],
  ['data', /^(?:근거자료|자료|데이터|근거|수치|사실|증거)/u],
  ['options', /^(?:선택지|대안|후보|장단점|차이점|여러방법|방법)/u], ['experience', /^(?:겪어본(?:일|것)|겪었던(?:일|것)|겪은(?:일|경험)|해본(?:일|것)|경험|체험)/u],
  ['overview', /^(?:전체적인(?:개요|흐름|그림|구조|윤곽)|전체(?:개요|흐름|그림|구조|윤곽)|큰그림|개요|윤곽|핵심요약)/u],
  ['reason', /^(?:핵심근거|핵심이유|이유|근거)/u], ['explanation', /^(?:설명|안내)/u],
  ['short', /^(?:한두문장(?:정도)?로|간결하게|간단하게|간단히|짧게|짧(?=거나)|핵심만|요점만|요지만|짧은|간결한|간단한)/u],
  ['standard', /^(?:보통(?:수준|길이|정도)(?:인)?|적당한길이)/u], ['content', /^(?:세부내용|내용|세부사항)/u],
  ['detail', /^(?:깊이있게|자세하게|상세하게|자세히|상세히|자세한|상세한|구체적으로|꼼꼼하게)/u],
  ['long', /^(?:길어지는|길어지기|길게|길기|장황하게|장황한|너무긴|긴)/u],
  ['example', /^(?:완성된(?:예|예시|결과물)|예시|예제|샘플|보기)/u], ['step', /^(?:한단계씩|단계별로|단계별|차근차근|차례차례|하나씩차례대로|하나씩순서대로)/u],
  ['help', /^(?:도움|도와주기|도움받기)/u], ['nohelp', /^(?:(?:다른)?도움없이|도움받지않고)/u],
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
  ['decide', /^(?:내리기|내리는|고르기|고르는|고르고|정하기|정하는|정하고|정하며)/u], ['choose', /^(?:골라서|골라|택하고)/u], ['check', /^(?:찾아보기|찾아보는|찾아보고|따져보기|따져보는|따져보고|따져)/u],
  ['explain', /^(?:알려주기|알려주는|알려주면|전해주는|설명해주기|설명해주는|풀어주기|풀어주는|짚어주는)/u], ['show', /^(?:보여주기|보여주는)/u],
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
  ['selfcase', /^(?:제가|내가|저는|나는|난)/u], ['and', /^(?:그리고|또한|또|및)/u],
  ['particle', /^(?:에서는|으로는|로는|자체는|에게|한테|에서|으로|위주로|이랑|끼리|랑|와|과|의|을|를|은|는|이|가|로|에|도|들|씩)/u],
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
].map(([tag,stem])=>[tag,new RegExp('^'+stem+'(?:해(?:봐야|보(?:는|기|고)|주(?:는|기|면))|해(?:두|놓)(?:는|기|고)|하(?:는|기|고|며|면서|게|여야|여|려)|해야|할|해(?:서|가며|가기|가는)|한)','u')]);
const COMPOSE_UNITS=[...COMPOSE_VERBS,...COMPOSE_LEXICON];
function phraseUnits(action) {
  const units=[];let offset=0;
  while(offset<action.length&&units.length<120){
    let best=null;
    for(const [tag,pattern] of COMPOSE_UNITS){const m=pattern.exec(action.slice(offset));if(m&&(!best||m[0].length>best.text.length))best={tag,text:m[0]};}
    if(!best)return null;
    units.push(best.tag);offset+=best.text.length;
  }
  return offset===action.length?units.filter(tag=>!['particle','neutral','selfcase','mine','sequence'].includes(tag)):null;
}
function composeMeaning(tags,nominalHead) {
  const words=tags.filter(tag=>!['nominal','means'].includes(tag)).join(' '), match=pattern=>pattern.test(words), out=(field,value)=>({field,value});
  if(match(/^(?:person )?(?:opinion|speech) listen (?:(?:opinion|speech) )?organize$/u))return out('communication','listen-organize');
  if(match(/^(?:(?:opinion|speech) first |first (?:opinion |speech )?)(?:speak|send)(?: speech start)?$/u))return out('communication','share-first');
  if(match(/^(?:text (?:opinion )?|opinion text )(?:communicate|write|send|organize|speak)(?: send|exchange)?$/u))return out('communication','written');
  if(match(/^speech (?:opinion )?(?:communicate|speak|send)$/u))return out('communication','spoken');
  if(match(/^(?:before-start )?(?:first )?plan (?:first )?make(?: start)?$/u))return out('work-style','plan-first');
  if(match(/^(?:first )?(?:small )?(?:try|start)(?: later| mismatch)? adjust$/u))return out('work-style','try-adjust');
  if(match(/^one (?:task )?(?:focus|process|finish)(?: next (?:task )?(?:do|process))?$/u))return out('work-style','single-task');
  if(match(/^(?:task )?priority (?:first )?(?:make|decide|process)(?: process)?$|^important task first (?:process|finish|do)$|^important task identity rank(?: order)? process$/u))return out('work-style','prioritize');
  if(match(/^data (?:(?:and )?data )?(?:first )?(?:check|look|reference)(?: decide)?$|^data basis decide$/u))return out('decision','evidence');
  if(match(/^options (?:options )?(?:compare|check)(?: decide)?$/u))return out('decision','compare-options');
  if(match(/^experience (?:reference|look)(?: decide)?$|^(?:experience-verb|try) decide$/u))return out('decision','experience');
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
  const tags=units.filter(t=>!['nominal','means'].includes(t));
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
  frame('communication','written','text opinion communicate write send organize speak exchange',has('text')&&any('communicate','write','send','organize','speak','exchange'));
  frame('communication','spoken','speech opinion communicate speak send exchange',has('speech')&&any('communicate','speak','send','exchange'));
  frame('communication','listen-organize','person opinion speech first listen organize',any('opinion','speech')&&all('listen','organize')&&before('listen','organize'));
  frame('communication','share-first','opinion speech first speak send start different-opinion occur before',has('opinion')&&any('speak','send')&&(has('first')||all('different-opinion','before')));
  frame('work-style','plan-first','task plan first make decide start before-start',has('plan')&&any('make','decide')&&beforeStart('make','decide'));
  frame('work-style','try-adjust','small first try start mismatch later adjust',all('try','adjust')&&before('try','adjust'));
  frame('work-style','single-task','task one focus process finish do next proceed present-task',has('one')&&any('focus','process','finish','do'));
  frame('work-style','prioritize','task priority important first rank order front make decide process finish do identity',any('process','finish','do')&&(has('priority')&&any('rank','make','decide')||has('important')&&any('rank','order','front','first')));
  frame('decision','evidence','data first check look reference basis decide conclusion',has('data')&&any('check','look','reference','basis'));
  frame('decision','compare-options','options available arrange compare check decide conclusion',has('options')&&any('compare','check'));
  frame('decision','experience','experience reference basis decide conclusion',has('experience')&&any('reference','basis'));
  frame('decision','consult','person opinion exchange first consult decide conclusion',has('consult'));
  frame('explanation-detail','overview-first','explanation overview first detail content enter before look show know listen make explain receive do',has('overview')&&overviewLeads&&(any('look','show','know','listen','make')||explained)&&(has('first')||all('content','before')));
  frame('explanation-detail','reasons-detail','explanation-purpose explanation conclusion occur reason data detail know listen look explain receive',any('reason','data')&&has('detail')&&(any('know','listen','look')||explained));
  frame('explanation-detail','long-flow','explanation long flow explain',all('explanation','long'));
  frame('explanation','brief','explanation short explain listen know finish receive',has('short')&&(has('explanation')||any('explain','listen','know')));
  frame('explanation','detailed','explanation detail content explain listen know receive',has('detail')&&(has('explanation')||any('explain','listen','know')));
  frame('explanation','standard','explanation standard',all('explanation','standard'));
  frame('support','independent','self nohelp first try do process before-help',any('self','nohelp')&&any('try','do','process'));
  frame('support','together','person together first try do process',has('together')&&any('try','do','process'));
  frame('support','example','example first one look show start intent-start',has('example')&&any('look','show')&&beforeStart('look','show'));
  frame('support','step','step sequence-step help explain receive do',any('step','sequence-step')&&any('explain','receive','do'));
  frame('support','choose','needhelp help choose decide receive',has('needhelp')&&any('choose','decide')&&(has('help')||has('receive')));
  const practice=any('practice','practice-verb','mix'),listen=has('listen'),read=has('read');
  frame('practice-mode',listen&&read?'mixed':listen?'listening':'reading','practice practice-verb audio visual text listen read both together mix do',practice&&(listen||read));
  const topicFrames=[
    ['reading-books','book read learn','book'],['music','music listen learn','music'],['exercise','exercise do learn','exercise'],
    ['cooking','cooking make do learn','cooking'],['photography','photo capture enjoyment-reason','photo'],['games','game do','game'],
    ['nature','nature look do','nature'],['travel-planning','travel route plan make do','travel'],['travel-food','travel cooking decide order do learn','travel'],
    ['travel-stay','travel stay inquiry stay-verb know look','stay'],['career-interview','interview do practice-verb','interview'],
    ['career-planning','career inquiry task possibility explore plan do know','career'],['content-video','video make do','video'],
    ['content-design','design design-example similarity make do','design'],['ai-tools','ai inquiry use possibility know learn','ai']
  ];
  for(const [value,licensed,anchor]of topicFrames){const enough=value==='travel-planning'?has('travel')&&any('route','plan'):value==='travel-food'?all('travel','cooking'):value==='travel-stay'?all('travel','stay'):has(anchor);frame('topic',value,licensed,enough);}
  return matches.length===1?matches[0]:null;
}
const COMPOSE_STANCES=[
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
  [/^(?:도와줄거면|도움을받을때(?:는)?|도움을받을땐|시도할때(?:는)?)/u,['support'],''],
  [/^(?:연습할때|연습은|연습을)/u,['practice-mode'],'연습'],
  [/^설명(?:분량)?(?:은|에서|을)/u,['explanation','explanation-detail'],'설명'],
  [/^판단(?:은|을)/u,['decision'],''],
  [/^(?:평소)?소통에서는|^생각을전달할때/u,['communication'],'']
];
function compositional(quote) {
  let {body,condition}=normalizePrefix(quote);
  body=body.replace(/^(?:저는|나는|난|제가|내가|제경우엔|내경우엔)(?:요)?/u,'').replace(/^(?:대체로|주로|보통은|보통)/u,'');
  let fields=null,head='';
  // Self-owned nominal predicates state the value after the frame, unlike
  // ordinary action clauses where the preference predicate comes last.
  const nominal=/^(?:(?:제|내)취향(?:은|이)|(?:(?:내가|제가))?원하는(설명길이|연습방식|도움방식|소통방식)(?:는|은))(.+?)(?:이에요|예요|입니다)$/u.exec(body);
  if(nominal){body=nominal[2]+'좋아요';if(nominal[1]==='설명길이'){head='설명';fields=['explanation'];}}
  for(const [pattern,allowed,heading]of COMPOSE_FRAMES){const m=pattern.exec(body);if(m){fields=allowed;head=heading;body=body.slice(m[0].length);break;}}
  // A named hobby after an explicitly self-owned interest frame is also a
  // declaration. A bare copula or mere participation never becomes liking.
  const interest=/^(?:즐기는|좋아하는)(?:취미|관심분야)(?:를|중)(?:하나)?(?:꼽으면|고르면)(.+?)(?:예요|이에요|입니다)$/u.exec(body);
  let normalized=interest?{...normalizeActionPhrase(interest[1]),polarity:'prefer',habitual:false}:composeStance(body);
  if(!normalized)return null;
  const stripSelf=s=>s.replace(/(?:(?:저|나)(?:는|에게|한테)|제게|제겐|저에겐|내게|내겐)(?:한결|더|잘|딱|그다지)?$/u,'').replace(/(?:자꾸|더|한결|딱|취미로)$/u,'');
  let action=stripSelf(normalized.surfaceAction||normalized.action);
  action=normalizeActionPhrase(action).surfaceAction;
  action=action.replace(/(?:하는|받는)편$/u,s=>s.slice(0,-1));
  action=normalizeActionPhrase(action).surfaceAction;
  const recognizedAlternative=s=>!!phraseUnits(s.replace(/(?:것|거|게)$/u,'').replace(/(?:할때|할땐)$/u,'하기'));
  const comparison=/(?:보다는|보단|보다|대신|느니|아닌)/u.exec(action);
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
  for(const variant of new Set(variants)){const units=phraseUnits(variant);if(!units)continue;const m=composeMeaning(units,normalized.nominalHead);if(m)recognized.push(m);}
  if(!recognized.length||new Set(recognized.map(m=>m.field+':'+m.value)).size!==1)return null;
  const meaning=recognized[0];
  if(fields&&!fields.includes(meaning.field)||meaning.field==='topic'&&normalized.habitual)return null;
  return {meanings:[{...meaning,polarity:normalized.polarity,condition}]};
}
const EXCLUDED = Object.freeze({ other:'다른 사람의 이야기여서 본인의 선호로 사용하지 않아요.', past:'과거의 설명을 현재 선호로 바꾸지 않았어요.',
  hypothetical:'가정한 내용을 현재 선호로 사용하지 않아요.', quotation:'인용된 말의 주체와 뜻을 분명하게 확인하지 못했어요.',
  unsupported:'이 문장의 뜻을 현재 지원하는 항목으로 정확히 옮기지 못했어요.', sensitive:'이 내용은 성향 항목으로 추정하거나 분류하지 않아요.',
  condition:'이 조건의 범위를 정확히 이해하지 못했어요.', uncertain:'확실하지 않은 뜻은 확인 가능한 선호로 정하지 않았어요.', limit:'이번에 확인할 수 있는 범위를 넘어 남겨 두었어요.' });
function excludedOrigin(body) {
  if (/["“”‘’「」『』]/u.test(body) || /(?:라고|다고)(?:했|하셨|말(?:했|하셨|해|합|하고)|들)|(?:라는|다는)(?:말|이야기)/u.test(body)) return 'quotation';
  if (/^(?:(?:내|제|우리)?(?:친구|동료|팀원|상사|선생님|교수님|엄마|아빠|어머니|아버지|가족|동생|형|오빠|누나|언니)|그사람|다른사람|그녀|그|너|당신)(?:은|는|이(?!랑)|가)/u.test(body)) return 'other';
  if (/(?:예전|과거|전에는|옛날|어렸을때|좋아했|선호했|필요했|원했|했었|좋았|편했|싶었|마음에들었|그랬|했어요|했습니다)/u.test(body)) return 'past';
  if (/(?:우울증|불안장애|ADHD|자폐|정신질환|진단|약물|치료|정당|정치성향|진보|보수|대통령|종교|성적지향|성정체성|MBTI|혈액형)/iu.test(body)) return 'sensitive';
  // A recognised factual scope such as familiar material is different from
  // imagining a preference. Unknown conditional clauses remain withheld.
  const scoped=normalizePrefix(body);
  if (/(?:만약|라면|다면|가정하|상상하)/u.test(scoped.condition?scoped.body:body.replace(/^(?:저라면|나라면)/u,''))) return 'hypothetical';
  return null;
}
function pieces(text) {
  const result = [], separator = /\s+(?:하지만|그런데|그리고|반면에?|다만)\s+|(?:지만|는데|좋고|좋아하고|편하고|즐겁고)(?=\s)|[.!?;\n,]+/gu;let start=0, match;
  const push = end => { while(start<end&&/\s/u.test(text[start]))start++;while(end>start&&/\s/u.test(text[end-1]))end--;if(end>start)result.push({start,end,quote:text.slice(start,end)}); };
  while((match=separator.exec(text))){
    // Coordinated nominal arms share a final predicate, including its negation.
    if(match[0]===','&&/(?:것|거)도\s*$/u.test(text.slice(start,match.index))&&/^\s*.+?(?:것|거)도/u.test(text.slice(match.index+1)))continue;
    // -고 is not an assertion boundary when it continues into a desiderative
    // or a metalinguistic choice such as "좋고 싫고를 모르겠어요".
    if(/^(?:좋고|좋아하고|편하고|즐겁고)$/u.test(match[0])&&/^\s*(?:싶|말고|싫고|아니고|그랬)/u.test(text.slice(match.index+match[0].length)))continue;
    // A noun ending in -지 followed by the restrictive particle -만 is not
    // the contrastive predicate ending -지만 (for example, 요지만).
    if(match[0]==='지만'&&!/(?:좋|싫|하|되|있|없|않|했|았|었|겠|리|지|되|편이)$/u.test(text.slice(start,match.index).replace(/\s/gu,'')))continue;
    push(match.index+(/^(?:지만|는데|좋고|좋아하고|편하고|즐겁고)$/u.test(match[0])?match[0].length:0));start=match.index+match[0].length;
  }push(text.length);return result;
}
const OPTIONS_END = [{id:'unsure',label:'아직 잘 모르겠어요'},{id:'skip',label:'이 부분은 건너뛸게요'}];
const FIELDS = { support:'도움받는 방식', explanation:'설명 길이', 'practice-mode':'연습 방식', topic:'관심 분야',
  communication:'소통 방식', 'work-style':'일을 진행하는 방식', decision:'판단 방식', 'explanation-detail':'설명에서 원하는 구성' };
function analyze(text) {
  // Legacy's literal validator enforces the same 500-code-point/Unicode bounds.
  Legacy.parseMemberStatement(text);
  const segments=[];let inherited=null, previousCondition=false, continuingCondition=null;
  for(const evidence of pieces(text)) {
    const body=evidence.quote.replace(/\s/gu,''), self=/^(?:나는|난|저는|제가|내가)/u.test(body), current=/^(?:(?:나는|난|저는|제가|내가))?(?:지금|요즘|현재|이제)/u.test(body);
    const generalReset=/^(?:(?:나는|난|저는|제가|내가))?(?:평소|보통은|일반적으로)/u.test(body);
    if(inherited==='other'&&self || inherited==='past'&&current || inherited==='condition'&&generalReset || inherited==='uncertain'&&current || ['quotation','hypothetical','sensitive'].includes(inherited)&&self&&current)inherited=null;
    const segment={evidence}, reason=excludedOrigin(body)||inherited;
    if(reason) { inherited=reason;continuingCondition=null;segment.unresolved={...evidence,reason,reasonLabel:EXCLUDED[reason]};if(['uncertain','condition'].includes(reason))segment.generic=true;segments.push(segment);continue; }
    let found=natural(evidence.quote)||expanded(evidence.quote)||compositional(evidence.quote)||tentative(evidence.quote)||restrictedMethod(evidence.quote);
    // An anaphoric explanation adds no new field, condition or preference.
    // It does not make the member answer the same understood claim again.
    if(!found&&segments.at(-1)?.meanings?.length&&/^(?:그게|그건|이게|이건|제|내)?(?:취미|관심분야)(?:예요|입니다|거든요|라서요)$/u.test(body)){segment.meanings=[];segments.push(segment);continue;}
    if(!found) { const old=Legacy.parseMemberStatement(evidence.quote);if(old.meanings.length===1&&!old.unresolved.length)found={meanings:old.meanings}; }
    if(found&&continuingCondition&&!generalReset)found={...found,meanings:found.meanings.map(m=>({...m,condition:m.condition||continuingCondition}))};
    continuingCondition=found?.meanings.at(-1)?.condition&&/(?:좋고|좋아하고|편하고|즐겁고)$/u.test(body)?found.meanings.at(-1).condition:null;
    let unresolvedCondition=previousCondition&&found?.meanings.some(m=>!m.condition)&&!generalReset;
    if(unresolvedCondition)found=null;
    previousCondition=!!found?.meanings.some(m=>m.condition)&&/(?:지만|는데)$/u.test(body);
    const asking=/^[\s.!?]*/u.exec(text.slice(evidence.end))[0].includes('?');
    const uncertain=/(?:것같|듯|모르|아마|어쩌면|일지도|글쎄|수도|싫지않|없지않|않지는않)/u.test(body);
    if(!found&&!uncertain&&/(?:때|땐|경우|상황|동안|오늘만|내일만|이번만|퇴근후|출근전)/u.test(body)){unresolvedCondition=true;inherited='condition';}
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
