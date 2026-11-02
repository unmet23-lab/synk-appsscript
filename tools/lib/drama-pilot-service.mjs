// 첫 회 시범의 관찰/예산. 실제 학습 효과나 발음을 측정하는 평가 엔진이 아니다.
import {judgeLine,findIn,HIT} from './드라마판정.mjs';
import {heardFromTranscription} from './말하기피드백.mjs';
import {PilotError,TRANSCRIBE_USD_PER_MINUTE} from './drama-pilot-audio.mjs';

export function publicLesson(lesson) {
  return {id:lesson.id,title:lesson.title,notices:lesson.notices,role:lesson.role,
    reasks:lesson.reasks,coach:lesson.coach,nextEpisode:lesson.nextEpisode,
    assets:lesson.assets?{listenLoop:lesson.assets.listenLoop,poster:lesson.assets.poster,backdrop:lesson.assets.backdrop}:undefined,
    scene:lesson.scene.map(({spec,...line})=>line),
    transfer:{id:lesson.transfer.id,prompt:lesson.transfer.prompt,skill:lesson.transfer.skill,reviewed:lesson.transfer.spec?.reviewed===true}};
}

// 테이크 하나를 학습 기록(Atlas Trail, 응답 꼴 spoken)에 어떻게 남길지 — 판정과 명세 검수 여부를 아는 서버가 정하고 화면은 적기만 한다.
// 「혼자 해 봄」(assessable)은 검수를 통과한 새 상황 명세에서 모범을 보기 전 첫 판정 테이크가 규칙으로 확신한 것뿐이다
// (pass+sure → 맞음, note → 고칠 점; 기획 §3-5 · 결정 10-31 ②). 장면 · 테이크 2 · 판정 보류 · 검수 전 명세는 시도로만 남고,
// 소리가 안 들린 테이크는 대답 없음(unanswered)이다. 받아 적은 글은 여기 들지 않는다.
export function trailOf({phase,status,transcript='',observation,independentEligible=false,reviewed=false}) {
  const kind=status==='ok'?observation?.kind:null;
  const correct=kind==='pass'?true:kind==='note'?false:null;
  const assessable=phase==='transfer'&&independentEligible===true&&reviewed===true&&(kind==='note'||kind==='pass'&&observation.sure===true);
  const unheard=status==='no_speech'||status==='unclear'&&!String(transcript||'').trim();
  return {correct,assessable,...(unheard?{reason:'unanswered'}:{})};
}

export function observeTranscript(spec,raw,{seconds,speechSeconds}={}) {
  const heard=heardFromTranscription(raw);
  const codes=(Array.isArray(raw?.languages)?raw.languages:[]).map(x=>typeof x==='string'?x:x?.code);
  // 언어를 믿고 예측하지 못한 답은 한국어로 가정하지 않는다. ASR 신뢰도/발음 점수도 만들지 않는다.
  if(!codes.some(x=>['ko','kor'].includes(x)||String(x).startsWith('ko-')))
    return {status:'unclear',transcript:heard.transcript,observation:{kind:'pending',note:null,sure:false}};
  const result=judgeLine(spec,{transcript:heard.transcript,language:heard.audio.language,seconds,speechSeconds});
  const anchored=result.checks?.whole||(spec.keys||[]).some(key=>[key.word,...(key.alts||[])].some(word=>word&&findIn(word,heard.transcript)>=HIT));
  if(result.status!=='ok'||heard.audio.language==='mixed')
    return {status:result.status==='no_speech'?'no_speech':'unclear',transcript:heard.transcript,observation:{kind:'pending',note:null,sure:false}};
  // 글은 받아썼지만 이 명세로 판단할 수 없는 답. 소리가 안 들린 경우와 구분해 인물의 거짓 되묻기를 막는다.
  if(result.checks?.ending?.state==='unclear'||!anchored)
    return {status:'ok',transcript:heard.transcript,observation:{kind:'pending',note:null,sure:false}};
  const kind=result.verdict==='note'?'note':result.sure?'pass':'pending';
  return {status:'ok',transcript:heard.transcript,
    observation:{kind,note:kind==='note'?result.note:null,sure:kind==='pass'}};
}

export class ProcessBudget {
  constructor({maxUSD=.05,maxCalls=30}={}) {
    this.maxUSD=maxUSD;this.maxCalls=maxCalls;this.reservedUSD=0;this.calls=0;this.audioSeconds=0;this.failures=0;
  }
  ensure(seconds) {
    if(!Number.isFinite(seconds)||seconds<=0||seconds>20.04)throw new PilotError('invalid_audio',422);
    const amount=seconds/60*TRANSCRIBE_USD_PER_MINUTE;
    if(this.calls>=this.maxCalls||this.reservedUSD+amount>this.maxUSD+1e-10)throw new PilotError('usage_limit',429);
    return amount;
  }
  reserve(seconds) {
    const amount=this.ensure(seconds);
    this.calls++;this.audioSeconds+=seconds;this.reservedUSD+=amount;
    return {audioSeconds:seconds,estimatedUSD:amount,invoiceVerified:false};
  }
  failure(){this.failures++;}
  snapshot(){return {calls:this.calls,audioSeconds:this.audioSeconds,estimatedUSD:this.reservedUSD,
    upstreamFailures:this.failures,maxUSD:this.maxUSD,invoiceVerified:false,
    note:'실제 해독 길이×공식 분당 단가. 오류/취소 후 과금 여부는 미확인. 영수증 합계가 아니다.'};}
}

export function newAttemptState() {
  return {epoch:0,attempts:new Map(),requests:new Map(),usedRequests:new Set(),transferRevealed:false,transferSubmitted:false};
}
export function resetAttempts(state) {
  state.epoch++;state.attempts.clear();state.requests.clear();
  // 같은 새상황을 이미 보거나 제출한 사실은 다시하기로 지우지 않는다.
  return {ok:true,firstExposure:!state.transferSubmitted&&!state.transferRevealed};
}
export function beginTake(state,{lineId,phase,requestId,transferId}) {
  const key=`${phase}:${lineId}`,attempt=(state.attempts.get(key)||0)+1;
  if(attempt>9)throw new PilotError('take_limit',429);
  const transfer=phase==='transfer';
  const eligible=transfer&&!state.transferRevealed&&!state.transferSubmitted;
  state.attempts.set(key,attempt);
  state.usedRequests.add(requestId);
  return {epoch:state.epoch,requestId,attempt,hinted:transfer?state.transferRevealed:true,independentEligible:eligible};
}
