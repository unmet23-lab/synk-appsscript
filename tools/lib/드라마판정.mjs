// 드라마 말하기 — 대사 한 줄의 판정(2026-10-29 시범 준비). 받아 적은 글과 그 대사의 칸 명세만 보고, 네트워크·파일은 쓰지 않는다.
// 부르는 쪽: 나중에 드라마 장면 화면(`experiences/drama/`)과 SYNK-talk의 드라마 동작(같은 파일을 동봉해 옮긴다).
// 설계: docs/드라마말하기_기획.md §3-4(틀렸을 때) · §4-1(무엇을 재나) · §4-2(노트 고르기)
// · 확신이 없으면 노트를 주지 않는다. 고를 게 없거나 애매하면 노트 없이 통과(「컷, 좋아요」)이고, 그 통과는 sure:false로 남겨 혼자 해냄으로 세지 않게 한다.
// · 노트는 확신이 높은 것부터 하나만: 끝맺음·높임 → 길이 → 빠진 말. 말 빠르기는 공개판부터라 여기서 보지 않는다.
// · 빠진 말은 자모 단위 닮음으로 본다. 2음절 이하 낱말은 빠졌다고 단정하지 않고, 이름은 소리가 달라도 고르지 않는다.
// · 점수·등급·감정 판정을 만들지 않는다. 받아 적은 글만으로 발음 오류를 단정하지 않는다. 노트 문구는 제품 글 표에 두고 여기는 종류만 돌려준다.
import {syllables} from './말하기피드백.mjs';

export const DRAMA_JUDGE_VERSION='drama-judge-1';
// 받아 적은 말이 핵심 말과 HIT만큼 닮으면 말한 것, MISS보다 덜 닮으면 빠진 것으로 본다. 그 사이는 애매라 노트를 주지 않는다(시범값).
export const HIT=0.8,MISS=0.5;
// 통째로 이만큼 닮으면 모범 대사나 허용 변형을 그대로 말한 것으로 본다.
const WHOLE=0.9;
// 사람은 한국어를 1초에 9음절보다 빨리 말하지 못한다 — 말하기 연습의 지어냄 거름망(말하기피드백.mjs)과 같은 선.
const MAX_SYLLABLES_PER_SECOND=9;
// 실제로 말한 시간에 비해 받아 적은 음절이 이보다 적으면 받아 적기가 말을 놓친 것일 수 있다 — 길이 노트를 주지 않는다(시범값).
const MIN_SYLLABLES_PER_SPEECH_SECOND=1.5;
export const ENDINGS=Object.freeze(['formal','polite','plain']);
const text=(value,max=400)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';

const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
// ㅔ→ㅐ · ㅖ→ㅒ · ㅚ·ㅞ→ㅙ: 받아 적기가 자주 바꿔 쓰는 소리라 같게 본다.
const JUNG=['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅐ','ㅕ','ㅒ','ㅗ','ㅘ','ㅙ','ㅙ','ㅛ','ㅜ','ㅝ','ㅙ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG=['','ㄱ','ㄲ','ㄱㅅ','ㄴ','ㄴㅈ','ㄴㅎ','ㄷ','ㄹ','ㄹㄱ','ㄹㅁ','ㄹㅂ','ㄹㅅ','ㄹㅌ','ㄹㅍ','ㄹㅎ','ㅁ','ㅂ','ㅂㅅ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

/** 소리 대조용 자모 줄. 받침과 첫소리를 같은 글자로 두고 소리 없는 첫 ㅇ은 빼서 「있어서」와 「이써서」가 같게 나온다. 한글·숫자·로마자 밖은 버린다. */
export function jamo(value){
 let out='';
 for(const ch of String(value??'')){
  const c=ch.codePointAt(0)-0xAC00;
  if(c>=0&&c<=11171){const cho=CHO[Math.floor(c/588)];out+=(cho==='ㅇ'?'':cho)+JUNG[Math.floor(c%588/28)]+JONG[c%28];}
  else if(/[0-9a-z]/i.test(ch))out+=ch.toLowerCase();
 }
 return out;
}
function distance(a,b){
 const row=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){
  let prev=row[0];row[0]=i;
  for(let j=1;j<=b.length;j++){const keep=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=keep;}
 }
 return row[b.length];
}
const near=(a,b)=>{const n=Math.max(a.length,b.length);return n?1-distance(a,b)/n:1;};
/** 두 말의 자모 닮음(0~1). */
export function similarity(a,b){return near(jamo(a),jamo(b));}
/**
 * 받아 적은 글 안에서 낱말과 가장 닮은 자리의 닮음(0~1) — 낱말은 통째로, 받아 적은 글은 어느 자리에서 시작하고 끝나도 된다(앞뒤의 다른 말·조사·띄어쓰기를 따지지 않음).
 * 닮음 = 1 − (그 자리까지 고친 수 / 낱말의 자모 수).
 */
export function findIn(word,heard){
 const w=jamo(word),t=jamo(heard);
 if(!w.length)return 1;
 let row=new Array(t.length+1).fill(0);
 for(let i=1;i<=w.length;i++){
  const next=[i];
  for(let j=1;j<=t.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+(w[i-1]===t[j-1]?0:1));
  row=next;
 }
 return Math.max(0,1-Math.min(...row)/w.length);
}
const chunks=phrase=>String(phrase).split(/\s+/).filter(Boolean);

// 끝맺음은 합쇼체 → 해요체 → 반말 순으로 본다 — 「합니다」의 「다」, 「합니까」의 「까」를 반말로 읽지 않게 높임부터.
const FORMAL=/(니다|니까|십시오|시오)$/,POLITE=/(요|죠)$/,PLAIN=/(다|어|아|여|해|야|지|니|냐|자|래|줘|봐|라|게|걸|까|구나|군|네)$/;
// 받아 적기에 문장 부호가 없어도, 어른에게 쓰면 틀리는 반말 덩어리는 어디서든 본다 — 홀로 선 낱말일 때만(「잘 몰라서」·「안녕하세요」·띄어 쓴 「안녕 하세요」는 아니다).
// 「어·응」은 머뭇거리는 소리와 헷갈려 넣지 않는다.
const PLAIN_CHUNK=/(^|[\s,.!?~…])(안녕|고마워|감사해|미안해|미안|죄송해|반가워|괜찮아|알았어|몰라|뭐야)(?=$|[\s,.!?~…])(?!\s*(요|하|히))/;
// 문장 끝에 부르는 말이 오면(「안녕하세요, 교수님」) 그 앞 낱말의 끝을 본다. 이름은 이름만이거나 「씨·님」이 붙었을 때만 부르는 말이다
// — 「바야르야」·「바야르예요」의 「야·예요」는 끝맺음이라 남긴다.
const CALLS=/^(교수님|선생님|선배님|선배|사장님|팀장님|과장님|부장님|대표님|매니저님|씨|님)$/;
const isCall=(w,names)=>CALLS.test(w)||names.some(n=>n&&(w===n||w===n+'씨'||w===n+'님'));
/**
 * 낱말 하나의 끝맺음. 합쇼체·해요체는 꼴이 뚜렷해 sure:true다. 반말 꼴은 「한국어·나라·의자」 같은 이름씨 끝과 겹쳐 sure:false로만 낸다
 * — 확신은 대사의 끝말에서 「요」만 뺀 꼴이거나 반말 덩어리일 때 판정 쪽에서 준다.
 */
export function endingOf(word){
 const w=String(word??'').replace(/[^가-힣]/g,'');
 if(!w)return {form:'unclear',sure:false};
 if(FORMAL.test(w))return {form:'formal',sure:true};
 if(POLITE.test(w)||w==='네'||w==='예')return {form:'polite',sure:true};
 if(PLAIN.test(w))return {form:'plain',sure:false};
 return {form:'unclear',sure:false};
}
const lastWord=(sentence,names)=>{
 const words=sentence.split(/[\s,]+/).filter(w=>/[가-힣]/.test(w));
 while(words.length>1&&isCall(words[words.length-1].replace(/[^가-힣]/g,''),names))words.pop();
 return words[words.length-1]||'';
};
/** 대사가 허락하는 끝맺음 — 명세에 없으면 모범 대사의 끝에서 정한다(높임 대사는 해요체·합쇼체, 반말 대사는 반말·해요체). */
export function allowedEndings(spec){
 if(Array.isArray(spec?.ending)&&spec.ending.length)return spec.ending.filter(e=>ENDINGS.includes(e));
 const own=endingOf(lastWord(text(spec?.line),spec?.names||[])).form;
 return own==='plain'?['plain','polite']:['polite','formal'];
}
function endingCheck(spec,heard){
 const names=spec.names||[],allowed=allowedEndings(spec);
 const sentences=heard.split(/[.?!…~\n]+/).map(s=>s.trim()).filter(s=>/[가-힣]/.test(s));
 const lineEnd=lastWord(text(spec.line).split(/[.?!…~\n]+/).filter(s=>/[가-힣]/.test(s)).pop()||'',names).replace(/[^가-힣]/g,'');
 const lineForm=endingOf(lineEnd).form,dropped=lineEnd.replace(/(요|죠)$/,'');
 const forms=sentences.map(s=>{
  const word=lastWord(s,names),own=endingOf(word),w=word.replace(/[^가-힣]/g,'');
  // 모범 대사의 끝말을 끝 음절까지 그대로 말했으면 그 대사의 끝맺음으로 확신한다(반말 대사 「내일 봐」의 「봐」).
  if(!own.sure&&lineEnd&&w.slice(-1)===lineEnd.slice(-1)&&near(jamo(w),jamo(lineEnd))>=HIT)return {form:lineForm,sure:lineForm!=='unclear',at:word};
  // 대사의 끝말에서 「요」만 뺀 꼴(「있어요」 → 「있어」, 「궁금해서요」 → 「궁금해서」)이면 반말로 확신한다 — 가장 흔한 실수다.
  // 반말 꼴 목록에 없는 끝(「-서」·「-이에」)도 잡도록 꼴은 묻지 않고, 이미 높임으로 확실한 말만 뺀다.
  if(!own.sure&&dropped!==lineEnd&&dropped.length&&near(jamo(w),jamo(dropped))>=HIT)return {form:'plain',sure:true,at:word};
  return {...own,at:word};
 });
 const chunk=heard.match(PLAIN_CHUNK);
 if(chunk)forms.push({form:'plain',sure:true,at:chunk[2]});
 const sure=forms.filter(f=>f.sure);
 const off=sure.find(f=>!allowed.includes(f.form));
 if(off)return {state:'off',want:allowed.includes('polite')?'polite':allowed[0],got:off.form,at:off.at};
 const last=forms[forms.length-(chunk?2:1)];
 return {state:last&&last.sure&&allowed.includes(last.form)?'ok':'unclear',want:null,got:last?.form||'unclear',at:last?.at||''};
}
/** 대사의 최소 길이(음절) — 명세에 없으면 모범 대사의 절반(적어도 2). */
export function minSyllablesOf(spec){
 const own=syllables(spec?.line);
 return Number.isInteger(spec?.minSyllables)&&spec.minSyllables>0?spec.minSyllables:Math.max(2,Math.ceil(own/2));
}
function keyCheck(spec,heard){
 const missing=[],unsure=[],names=spec.names||[];
 for(const key of spec.keys||[]){
  const words=[key.word,...(key.alts||[])].filter(Boolean);
  if(!words.length||names.some(n=>n&&words.some(w=>w.includes(n))))continue;
  if(words.some(w=>findIn(w,heard)>=HIT))continue;
  // 없다고 보는 것: 한 어절이면 덜 닮았을 때. 여러 어절이면 세 음절 이상 어절 하나가 없거나 어절이 모두 없을 때 — 「있어요」 같은 끝말이 닮아
  // 「질문이 있어요」가 남아 보이는 일을 막고, 「제출 기한」에서 짧은 「제출」만 빠진 것은 단정하지 않는다.
  const absent=w=>{
   const parts=chunks(w),miss=c=>findIn(c,heard)<MISS;
   return parts.length<2?miss(w):parts.some(c=>syllables(c)>=3&&miss(c))||parts.every(miss);
  };
  // 짧은 낱말은 받아 적기가 자주 빠뜨리고 바꿔 쓴다 — 빠졌다고 단정하지 않는다.
  if(syllables(key.word)>=3&&words.every(absent))missing.push(key.word);else unsure.push(key.word);
 }
 return {missing,unsure};
}
/** 소리 관문: 말이 없거나(no_speech) 한국어가 아니거나(not_korean) 사람이 낼 수 없게 빠르면(too_fast) 판정하지 않는다 — 학생의 약점으로 세지 않는다. */
export function gate({transcript,seconds=0,language=''}={}){
 const t=text(transcript,1200),n=syllables(t);
 if(language==='other'||(n<2&&(t.match(/[A-Za-zА-Яа-яЁёӨөҮү]/g)||[]).length>=6))return 'not_korean';
 if(n<1)return 'no_speech';
 if(Number(seconds)>0&&n/Number(seconds)>MAX_SYLLABLES_PER_SECOND)return 'too_fast';
 return 'ok';
}

/**
 * 대사 한 줄의 판정. spec: 칸 명세 {id, line, to, ending?, keys:[{word, alts?}], names?(장면에 나오는 사람 이름 모두 — 학습자 배역 포함), variants?, minSyllables?}.
 * heard: {transcript, seconds?(녹음 길이), speechSeconds?(실제로 말한 시간), language?}.
 * 돌려주는 것: {status:'ok'|'no_speech'|'not_korean'|'too_fast'|'unclear', verdict:'pass'|'note'|null, note:null|{kind:'ending'|'length'|'missing',…}, sure, checks}
 * — sure는 노트 없이 통과했고 모든 칸이 확실할 때만 true다(혼자 해냄으로 셀 수 있는 통과).
 * — unclear는 오래 말했는데 받아 적은 말이 짧아 받아 적기가 놓친 것으로 보이는 경우다(「잘 안 들렸어요」, 세지 않음).
 */
export function judgeLine(spec,heard={},{whole=true}={}){
 const transcript=text(heard.transcript,1200),status=gate({...heard,transcript});
 if(status!=='ok')return {status,verdict:null,note:null,sure:false,checks:null};
 const n=syllables(transcript),min=minSyllablesOf(spec),speech=Number(heard.speechSeconds)||0;
 if(n<min&&speech>0&&n/speech<MIN_SYLLABLES_PER_SPEECH_SECOND)return {status:'unclear',verdict:null,note:null,sure:false,checks:null};
 const ending=endingCheck(spec,transcript);
 // 통째로 닮아도 끝맺음은 먼저 본다 — 긴 대사에서 「요」 하나 빠진 것은 자모 한두 개 차이라 통째 닮음에 묻힌다.
 // 끝맺음이 애매하면(「…아세요」 대신 「…알아?」) 노트 없이 통과하되 혼자 해냄으로 세지 않는다(10-30 Fable 실측).
 if(whole&&ending.state!=='off'&&[spec.line,...(spec.variants||[])].some(v=>similarity(v,transcript)>=WHOLE))
  return {status,verdict:'pass',note:null,sure:ending.state==='ok',checks:{whole:true,ending}};
 const length={state:n>=min?'ok':'short',min,got:n};
 const keys=keyCheck(spec,transcript);
 let note=null;
 if(ending.state==='off')note={kind:'ending',want:ending.want,got:ending.got,at:ending.at};
 else if(length.state==='short')note={kind:'length',min};
 else if(keys.missing.length)note={kind:'missing',word:keys.missing[0]};
 const sure=!note&&ending.state==='ok'&&length.state==='ok'&&!keys.unsure.length;
 return {status,verdict:note?'note':'pass',note,sure,checks:{whole:false,ending,length,keys}};
}

/**
 * 테이크 다음 걸음(§3-4). attempt: 이번 테이크까지 판정된 횟수(소리 관문에 걸린 테이크는 세지 않는다). unheard: 소리 관문에 잇달아 걸린 횟수(이번 포함).
 * 1번째 어긋남은 상대 인물이 되묻고 노트 하나(있을 때만), 2번째는 모범 읽기를 따라 하게, 3번째는 그대로 통과시키고 다음 촬영일에 다시.
 * 돌려주는 것: {action:'again'|'self_check'|'cut'|'retake'|'model_reading'|'pass_through', note, assisted, counted, again, recognition}
 */
export function nextTake({result,attempt=1,unheard=1}={}){
 // 잘 안 들린 테이크는 세지 않는다. 세 번 잇달아 안 들리면 학생 탓이 아니니 녹음 다시 듣기·따라 말하기(스스로 확인)로 넘긴다.
 if(!result||result.status!=='ok')return {action:unheard>=3?'self_check':'again',note:null,assisted:false,counted:false,again:false,recognition:unheard>=3};
 // 모범 읽기를 들은 뒤(3번째 테이크)의 통과는 도움 받은 통과다.
 if(result.verdict==='pass')return {action:'cut',note:null,assisted:attempt>=3,counted:true,again:false,recognition:false};
 if(attempt<=1)return {action:'retake',note:result.note,assisted:false,counted:true,again:false,recognition:false};
 if(attempt===2)return {action:'model_reading',note:null,assisted:true,counted:true,again:false,recognition:false};
 // 세 번 어긋나면 인식 쪽 문제일 가능성이 크다 — 막지 않고 통과시키고, 인식 품질로 적는다.
 return {action:'pass_through',note:null,assisted:true,counted:true,again:true,recognition:true};
}

/** 칸 명세 점검(대사 틀 검수 앞): 모범 대사와 허용 변형이 자기 명세를 통과하는지, 핵심 말이 대사에 있는지, 이름이 핵심 말에 섞이지 않았는지. 문제 목록을 돌려준다. */
export function checkSpec(spec){
 const problems=[];
 if(!spec?.id)problems.push('id 없음');
 if(!syllables(spec?.line))return [...problems,'대사 없음'];
 const names=spec.names||[];
 for(const key of spec.keys||[]){
  const words=[key.word,...(key.alts||[])].filter(Boolean);
  if(!words.some(w=>findIn(w,spec.line)===1))problems.push(`핵심 말이 대사에 없음: ${key.word}`);
  if(names.some(n=>n&&words.some(w=>w.includes(n))))problems.push(`이름이 핵심 말에 섞임: ${key.word}`);
 }
 if(Number.isInteger(spec.minSyllables)&&spec.minSyllables>syllables(spec.line))problems.push('최소 길이가 대사보다 김');
 const self=judgeLine(spec,{transcript:spec.line},{whole:false});
 if(self.verdict!=='pass'||!self.sure)problems.push('모범 대사가 자기 명세를 확실히 통과하지 못함');
 // 허용 변형은 핵심 말 일부를 다르게 말하는 통째 대사라 통째 닮음으로 본다 — 그래도 끝맺음이 틀린 변형은 걸린다.
 for(const v of spec.variants||[]){const r=judgeLine(spec,{transcript:v});if(r.verdict!=='pass')problems.push(`허용 변형이 통과하지 못함: ${v}`);}
 return problems;
}
