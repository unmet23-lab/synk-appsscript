import test from 'node:test';
import assert from 'node:assert/strict';
import {jamo,similarity,findIn,endingOf,allowedEndings,minSyllablesOf,gate,judgeLine,nextTake,checkSpec,HIT,MISS} from '../tools/lib/드라마판정.mjs';
// 드라마 말하기 대사 판정(2026-10-29, docs/드라마말하기_기획.md §3-4·§4-1·§4-2): 자모 닮음, 끝맺음·높임, 길이, 빠진 말, 소리 관문, 테이크 다음 걸음, 칸 명세 점검.
// 네트워크·모델을 부르지 않는다. 대사는 1화 장면 1의 시안이다(대본 확정 전).

const L1={id:'ep1-s1-1',line:'교수님, 안녕하세요.',to:'professor',keys:[{word:'안녕하세요'}]};
const L2={id:'ep1-s1-2',line:'저는 몽골에서 온 바야르예요.',to:'professor',names:['바야르'],keys:[{word:'몽골에서'}]};
const L3={id:'ep1-s1-3',line:'과제에 대해 질문이 있어서 왔어요.',to:'professor',keys:[{word:'과제'},{word:'질문이 있어서',alts:['질문이 있어요','여쭤볼 게 있어서']}],variants:['과제 때문에 여쭤볼 게 있어서 왔어요.']};
const L4={id:'ep1-s1-4',line:'제출 기한이 언제까지예요?',to:'professor',keys:[{word:'언제까지'},{word:'제출 기한'}]};
const L5={id:'ep1-s1-5',line:'감사합니다. 다음 주에 뵙겠습니다.',to:'professor',keys:[{word:'감사합니다',alts:['감사해요','고맙습니다']},{word:'다음 주에 뵙겠습니다'}]};
const F1={id:'ep1-s2-1',line:'고마워, 내일 봐.',to:'friend',ending:['plain'],keys:[{word:'고마워'}]};
const SPECS=[L1,L2,L3,L4,L5,F1];
const say=(spec,transcript,extra={})=>judgeLine(spec,{transcript,...extra});

test('자모: 연음·받침·소리 없는 ㅇ·ㅔ와 ㅐ를 같게 본다',()=>{
 assert.equal(jamo('있어서'),jamo('이써서'));
 assert.equal(jamo('없어요'),jamo('업서요'));
 assert.equal(jamo('세요'),jamo('새요'));
 assert.ok(jamo('도서과네').includes(jamo('도서관')));
 assert.equal(jamo('TOPIK 2급'),'topik2'+jamo('급'));
 assert.equal(similarity('교수님','교수님'),1);
});

test('빠진 말 문턱: 말했지만 잘못 받아 적힌 말은 HIT 위, 정말 빠진 말은 MISS 아래(10-29 재보기)',()=>{
 const said=[['질문이 있어서','과제에 대해 지문이 이써서 왔어요'],['몽골에서','저는 몽고에서 온 바야르예요'],['언제까지','제출 기하니 언제가지예요'],
  ['안녕하세요','교수님 안녕하세여'],['감사합니다','감사함니다 다음 주에 뵙겠습니다'],['도서관','도서과네 가요'],['여쭤볼 게 있어서','여쭈어 볼 게 있어서 왔어요']];
 for(const [w,h] of said)assert.ok(findIn(w,h)>=HIT,`${w} | ${h} → ${findIn(w,h)}`);
 const absent=[['질문이 있어서','과제 때문에 왔어요'],['질문이 있어서','교수님 안녕하세요'],['몽골에서','저는 바야르예요'],['언제까지','제출 기한이 뭐예요'],
  ['안녕하세요','교수님 질문 있어요'],['다음 주에 뵙겠습니다','감사합니다'],['여쭤볼 게 있어서','과제 때문에 왔어요'],['도서관','학교에 가요']];
 for(const [w,h] of absent)assert.ok(findIn(w,h)<MISS,`${w} | ${h} → ${findIn(w,h)}`);
});

test('끝맺음 낱말: 합쇼체·해요체는 확실하고, 반말 꼴은 이름씨 끝과 겹쳐 확실하지 않다',()=>{
 assert.deepEqual(endingOf('감사합니다'),{form:'formal',sure:true});
 assert.deepEqual(endingOf('합니까'),{form:'formal',sure:true});
 assert.deepEqual(endingOf('있어요'),{form:'polite',sure:true});
 assert.deepEqual(endingOf('네'),{form:'polite',sure:true});
 assert.deepEqual(endingOf('몰라'),{form:'plain',sure:false});
 // 「한국어」·「나라」는 이름씨다 — 반말로 확신하면 틀린 노트가 나간다.
 assert.equal(endingOf('한국어').sure,false);
 assert.equal(endingOf('나라').sure,false);
 assert.deepEqual(allowedEndings(L1),['polite','formal']);
 assert.deepEqual(allowedEndings(F1),['plain']);
 assert.deepEqual(allowedEndings({line:'내일 봐.'}),['plain','polite']);
 assert.equal(minSyllablesOf(L3),7);
 assert.equal(minSyllablesOf({line:'네',minSyllables:3}),3);
});

test('통과: 모범 대사·허용 변형·끝에 부르는 말·이름이 다르게 들린 것은 확실한 통과',()=>{
 for(const spec of SPECS){const r=say(spec,spec.line);assert.equal(r.verdict,'pass',spec.id);assert.equal(r.sure,true,spec.id);assert.equal(r.note,null);}
 assert.equal(say(L3,'과제 때문에 여쭤볼 게 있어서 왔어요').sure,true);
 const call=say(L1,'안녕하세요, 교수님');
 assert.equal(call.verdict,'pass');assert.equal(call.sure,true);
 // 이름은 소리가 달라도 고르지 않는다(바야르 → 바이어).
 const name=say(L2,'저는 몽골에서 온 바이어예요');
 assert.equal(name.verdict,'pass');assert.equal(name.sure,true);
 // 받아 적기가 조금 틀려도 핵심 말을 찾는다.
 assert.equal(say(L3,'과제에 대해 지문이 이써서 왔어요').verdict,'pass');
});

test('노트 1순위 — 끝맺음·높임: 반말 덩어리, 「요」만 뺀 끝말, 반말 대사에 높임',()=>{
 const hi=say(L1,'교수님 안녕');
 assert.equal(hi.verdict,'note');assert.deepEqual(hi.note,{kind:'ending',want:'polite',got:'plain',at:'안녕'});
 const dropped=say(L3,'과제에 대해 질문이 있어서 왔어');
 assert.equal(dropped.note.kind,'ending');assert.equal(dropped.note.at,'왔어');
 const copula=say(L2,'저는 몽골에서 온 바야르야');
 assert.equal(copula.note?.kind,'ending');
 const friend=say(F1,'고마워요, 내일 봐요');
 assert.deepEqual(friend.note,{kind:'ending',want:'plain',got:'polite',at:'봐요'});
 // 끝맺음이 틀렸으면 다른 노트(빠진 말)가 있어도 끝맺음 하나만 준다.
 const both=say(L3,'과제 때문에 왔어');
 assert.equal(both.note.kind,'ending');
 // 반말 덩어리는 홀로 선 낱말일 때만 — 높인 문장 안의 「몰라서」, 띄어 쓴 「안녕 하세요」, 머뭇거림 「어」에는 노트가 없다.
 assert.notEqual(say(L3,'과제를 잘 몰라서 질문이 있어서 왔어요').note?.kind,'ending');
 assert.equal(say(L1,'교수님 안녕 하세요').note,null);
 assert.equal(say(L1,'어 교수님 안녕하세요').note,null);
 assert.equal(say(L1,'교수님 반가워').note?.kind,'ending');
});

test('통째로 닮아도 끝맺음이 애매하면 혼자 해냄으로 세지 않는다(10-30 Fable)',()=>{
 // 「바야르예요」 대신 이름으로 끝냄 — 통째 닮음은 0.9를 넘지만 끝맺음을 알 수 없다.
 const r=say(L2,'저는 몽골에서 온 바야르');
 assert.equal(r.verdict,'pass');assert.equal(r.note,null);assert.equal(r.sure,false);
});

test('노트 2순위 — 길이, 3순위 — 빠진 말(2음절 이하는 단정하지 않음)',()=>{
 const short=say(L3,'질문');
 assert.deepEqual(short.note,{kind:'length',min:7});
 const missing=say(L3,'과제 때문에 왔어요');
 assert.deepEqual(missing.note,{kind:'missing',word:'질문이 있어서'});
 // 교수님께 「봐요」는 칸 명세가 허락하지 않은 말이다 — 「뵙겠습니다」가 빠진 것으로 본다(허락하려면 명세의 alts에 「봬요」를 넣는다).
 assert.deepEqual(say(L5,'감사해요 다음 주에 봐요').note,{kind:'missing',word:'다음 주에 뵙겠습니다'});
 // 「제출」·「과제」처럼 짧은 낱말은 빠져도 노트를 주지 않는다 — 대신 확실한 통과가 아니다.
 const shortKey=say(L4,'기한이 언제까지예요');
 assert.equal(shortKey.verdict,'pass');assert.equal(shortKey.sure,false);
});

test('확신이 없으면 노트 없음: 이름씨로 끝난 말·애매한 닮음은 노트 없이 통과하고 sure:false',()=>{
 const noun=say(L2,'저는 몽골 사람');
 assert.equal(noun.verdict,'pass');assert.equal(noun.note,null);assert.equal(noun.sure,false);
 assert.equal(noun.checks.ending.state,'unclear');
 // 「언제까지」를 「언제」로만 말했는지 받아 적기가 「까지」를 놓쳤는지 모른다 — 닮음이 문턱 사이라 노트를 주지 않는다.
 const half=say(L4,'제출 기한이 언제예요');
 assert.equal(half.note,null);assert.equal(half.sure,false);assert.deepEqual(half.checks.keys.unsure,['언제까지']);
 // 점수·등급처럼 읽히는 칸을 만들지 않는다.
 for(const r of [noun,half,say(L3,'질문'),say(L1,'교수님 안녕')])assert.ok(!/score|grade|점수|등급/i.test(JSON.stringify(r)));
});

test('소리 관문: 말 없음·한국어 아님·사람이 낼 수 없는 빠르기·받아 적기가 놓친 말은 판정하지 않는다',()=>{
 assert.equal(gate({transcript:''}),'no_speech');
 assert.equal(gate({transcript:'Hello my name is Bayar'}),'not_korean');
 // 들은 언어가 다르다고 와도 받아 적은 글이 한글이면 한국어로 본다 — 짧은 대답에서 언어를 틀린다(10-31 리허설 「과제요.」 → zh).
 assert.equal(gate({transcript:'과제요.',language:'other'}),'ok');
 assert.equal(gate({transcript:'안녕하세요',language:'other'}),'ok');
 assert.equal(gate({transcript:'Hello, professor.',language:'other'}),'not_korean');
 assert.equal(gate({transcript:'课题哟',language:'other'}),'not_korean');
 assert.equal(gate({transcript:'안녕 Bayar Bold',language:'other'}),'not_korean','한글이 다른 글자의 두 배가 안 되면 들은 언어를 믿는다');
 // 다른 글자는 문자권을 가리지 않고 센다(GPT 2차 검수 GA2 — 버마어가 0으로 빠졌다).
 assert.equal(gate({transcript:'네 မင်္ဂလာပါ',language:'other'}),'not_korean');
 assert.equal(gate({transcript:'မင်္ဂလာပါ ခင်ဗျာ'}),'not_korean');
 assert.equal(gate({transcript:'과제에 대해 질문이 있어서 왔어요 제출 기한이 언제까지예요',seconds:2}),'too_fast');
 assert.equal(gate({transcript:'과제에 대해 질문이 있어서 왔어요',seconds:4}),'ok');
 assert.equal(say(L3,'').status,'no_speech');
 // 4초를 말했는데 두 음절만 받아 적혔으면 받아 적기가 놓친 것으로 본다 — 길이 노트를 주지 않는다.
 const lost=say(L3,'질문',{speechSeconds:4});
 assert.equal(lost.status,'unclear');assert.equal(lost.note,null);
 // 짧게 말했으면(1초에 두 음절) 길이 노트다.
 assert.equal(say(L3,'질문',{speechSeconds:1}).note.kind,'length');
});

test('테이크 다음 걸음: 안 들림은 세지 않음 → 되묻기 + 노트 → 모범 읽기 → 그대로 통과',()=>{
 const unheard=say(L3,'');
 assert.deepEqual(nextTake({result:unheard,attempt:1,unheard:1}),{action:'again',note:null,assisted:false,counted:false,again:false,recognition:false});
 assert.equal(nextTake({result:unheard,unheard:3}).action,'self_check');
 const off=say(L1,'교수님 안녕');
 assert.deepEqual(nextTake({result:off,attempt:1}),{action:'retake',note:off.note,assisted:false,counted:true,again:false,recognition:false});
 assert.equal(nextTake({result:off,attempt:2}).action,'model_reading');
 assert.equal(nextTake({result:off,attempt:2}).assisted,true);
 assert.deepEqual(nextTake({result:off,attempt:3}),{action:'pass_through',note:null,assisted:true,counted:true,again:true,recognition:true});
 const ok=say(L1,L1.line);
 assert.equal(nextTake({result:ok,attempt:1}).action,'cut');
 assert.equal(nextTake({result:ok,attempt:1}).assisted,false);
 // 모범 읽기를 들은 뒤(3번째)의 통과는 도움 받은 통과다.
 assert.equal(nextTake({result:ok,attempt:3}).assisted,true);
});

test('칸 명세 점검: 시안 대사는 문제 없음, 틀린 명세는 고를 곳을 낸다',()=>{
 for(const spec of SPECS)assert.deepEqual(checkSpec(spec),[],spec.id);
 const bad={id:'x',line:'저는 바야르예요.',names:['바야르'],keys:[{word:'바야르'},{word:'도서관'}],minSyllables:9,variants:['나는 바야르야.']};
 const problems=checkSpec(bad);
 assert.ok(problems.includes('핵심 말이 대사에 없음: 도서관'));
 assert.ok(problems.includes('이름이 핵심 말에 섞임: 바야르'));
 assert.ok(problems.includes('최소 길이가 대사보다 김'));
 assert.ok(problems.some(p=>p.startsWith('허용 변형이 통과하지 못함')));
 assert.deepEqual(checkSpec({line:''}),['id 없음','대사 없음']);
});

test('통째로 닮아도 핵심 말은 먼저 본다 — 짧은 핵심 말 하나를 바꾸면 확신하지 않고, 빠진 핵심 말이 있으면 통째 통과가 아니다(GPT 2차 검수 GA2)',()=>{
 const spec={id:'t6',line:'길을 잃었어요. 새솔대 정문이 어디에 있는지 아세요?',to:'stranger',keys:[{word:'길을 잃었어요',alts:['길을 잃어서']},{word:'정문'},{word:'어디에 있는지',alts:['어디 있는지']}]};
 const swapped=judgeLine(spec,{transcript:'길을 잃었어요. 새솔대 후문이 어디에 있는지 아세요?'});
 assert.ok(similarity(spec.line,'길을 잃었어요. 새솔대 후문이 어디에 있는지 아세요?')>=0.9,'통째 닮음은 0.9를 넘는다');
 assert.deepEqual([swapped.verdict,swapped.note,swapped.sure],['pass',null,false]);
 assert.deepEqual(judgeLine(spec,{transcript:spec.line}).sure,true);
 const library={id:'7',line:'네, 선배님! 그런데 혹시 도서관이 어디에 있는지 아세요?',to:'senior',names:['태오'],keys:[{word:'도서관'},{word:'어디에 있는지'}]};
 const missing=judgeLine(library,{transcript:'네, 선배님! 그런데 혹시 화장실이 어디에 있는지 아세요?'});
 assert.deepEqual([missing.checks.whole,missing.verdict,missing.note?.kind,missing.note?.word],[false,'note','missing','도서관'],'빠진 핵심 말이 있으면 통째 통과로 넘기지 않는다');
 // 소리가 닮은 말(도서실)은 애매라 빠졌다고 단정하지 않는다 — 통과하되 확신 아님.
 assert.deepEqual([judgeLine(library,{transcript:'네, 선배님! 그런데 혹시 도서실이 어디에 있는지 아세요?'}).sure],[false]);
});

test('스스로 만드는 말(free — 처음 보는 대사)은 빠진 말 노트를 주지 않는다: 바꿔 말한 맞는 말은 확신 없음, 끝맺음 · 길이 노트는 그대로, 확실한 통과는 핵심 말이 모두 들릴 때만(drama-judge-4)',()=>{
 const scene={id:'7',line:'네, 선배님! 그런데 혹시 도서관이 어디에 있는지 아세요?',to:'senior',names:['태오'],keys:[{word:'도서관'},{word:'어디에 있는지'}]};
 const free={...scene,free:true};
 const other='네, 선배님! 그런데 혹시 화장실이 어디에 있는지 아세요?';
 assert.equal(judgeLine(scene,{transcript:other}).note?.kind,'missing','장면 대사는 그대로 빠진 말 노트');
 const withheld=judgeLine(free,{transcript:other});
 assert.deepEqual([withheld.verdict,withheld.note,withheld.sure,withheld.checks.keys.missing,withheld.checks.keys.unsure],['pass',null,false,[],['도서관']]);
 assert.equal(judgeLine(free,{transcript:'네, 선배님! 그런데 혹시 도서관이 어디에 있는지 알아?'}).sure,false,'끝맺음 애매는 그대로 확신 아님');
 assert.equal(judgeLine(free,{transcript:'네, 선배님! 그런데 혹시 도서관이 어디에 있는지 아세?'}).note?.kind,'ending','대사 끝에서 「요」만 뺀 꼴은 끝맺음 노트');
 assert.equal(judgeLine(free,{transcript:'도서관이요?'}).note?.kind,'length','한두 낱말은 길이 노트');
 assert.equal(judgeLine(free,{transcript:scene.line}).sure,true);
 assert.deepEqual(checkSpec(free),[],'모범 대사는 그대로 확실한 통과');
});

test('명시한 허용 변형은 다른 핵심 어휘도 통과하되 닮은 다른 장소는 확신하지 않는다',()=>{
 const spec={id:'accepted-variant',line:'아이스크림을 주세요.',to:'staff',ending:['polite','formal'],keys:[{word:'아이스크림'}],variants:['빙과를 주세요.']};
 for(const transcript of ['빙과를 주세요.','빙과를  주세요!']){
  const r=judgeLine(spec,{transcript});
  assert.deepEqual([r.verdict,r.note,r.sure,r.checks.exactVariant],['pass',null,true,true]);
 }
 assert.deepEqual(checkSpec(spec),[],'허용 변형은 자기 명세 검문도 통과');
 const location={id:'variant-place',line:'네, 선배님! 그런데 혹시 도서관이 어디에 있는지 아세요?',to:'senior',keys:[{word:'도서관'},{word:'어디에 있는지'}],variants:['선배님, 도서관이 어디에 있어요?']};
 const wrong=judgeLine(location,{transcript:'선배님, 화장실이 어디에 있어요?'});
 assert.notEqual(wrong.sure,true,'허용 변형과 가까운 다른 장소는 예외가 아니다');
 assert.equal(wrong.note?.kind,'missing');
 const rude=judgeLine({...spec,variants:['고마워. 빙과를 주세요.']},{transcript:'고마워. 빙과를 주세요.'});
 assert.equal(rude.note?.kind,'ending','허용 목록에 있어도 상대에 맞지 않는 끝맺음은 통과하지 않는다');
 assert.notEqual(rude.sure,true);
});
