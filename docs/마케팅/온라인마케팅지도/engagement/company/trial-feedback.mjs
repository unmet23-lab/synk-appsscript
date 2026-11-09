import {createHmac,createHash} from 'node:crypto';

export const TRIAL_FEEDBACK_VERSION='trial-feedback.v1-final';
export const TRIAL_FEEDBACK_CONSENT='2026-11-09';
export const TRIAL_FEEDBACK_LIMITS=Object.freeze({participants:5000,events:1200000,perDay:60,noteChars:100,collectionDays:30,retentionDays:90});
export const TRIAL_FEEDBACK_OPTIONS=Object.freeze({
  fun:['fun_4','fun_3','fun_2','fun_1'],
  stuck:['listen','read','howto','control','sound','perf','none'],
  again:['again_1d','again_7d','again_unsure','again_no'],
  mode:['normal','daily'],kind:['visit','round_start','round_complete'],
});
const DAY=86400000,CLOCK_SKEW=300000,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const COHORT=/^[a-z0-9-]{1,24}$/,STAFF=new Set(['admin','manager','member','viewer']);
export const trialFeedbackError=(code,status=400,field)=>Object.assign(new Error(code),{status,trialCode:code,...(field?{field}:{})});
const invalid=field=>{throw trialFeedbackError('invalid',400,field);};
const seoulDate=ms=>new Date(ms+9*3600000).toISOString().slice(0,10);
const dateNumber=date=>Date.parse(date+'T00:00:00.000Z')/DAY;
const canonical=value=>JSON.stringify(value,(_,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.keys(entry).sort().map(key=>[key,entry[key]])):entry);
function object(value,keys,required=keys,field='body'){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key))||required.some(key=>!Object.hasOwn(value,key)))invalid(field);
  return value;
}
function uuid(value,field){if(typeof value!=='string'||!UUID.test(value))invalid(field);return value;}
function enumeration(value,choices,field){if(!choices.includes(value))invalid(field);return value;}
function integer(value,min,max,field){if(!Number.isSafeInteger(value)||value<min||value>max)invalid(field);return value;}
function cohortValue(value='open'){if(typeof value!=='string'||!COHORT.test(value)||value==='all')invalid('cohort');return value;}
function common(input,keys,required=keys){object(input,keys,required);if(input.v!==1)invalid('v');if(input.app!=='talk-rally')invalid('app');uuid(input.participantId,'participantId');}
function timestamp(value,field){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))invalid(field);return Date.parse(value);}
function roundValue(value,complete=true,first=false){
  const keys=complete?['roundId','mode','total','correct','helped','soundOn']:['roundId','mode'];if(first)keys.push('startedAt');
  object(value,keys,undefined,'round');uuid(value.roundId,'round.roundId');
  enumeration(value.mode,TRIAL_FEEDBACK_OPTIONS.mode,'round.mode');
  if(first)timestamp(value.startedAt,'round.startedAt');
  if(!complete)return {roundId:value.roundId,mode:value.mode};
  const total=integer(value.total,1,20,'round.total');
  integer(value.correct,0,total,'round.correct');integer(value.helped,0,total,'round.helped');
  if(typeof value.soundOn!=='boolean')invalid('round.soundOn');
  return {roundId:value.roundId,mode:value.mode,total,correct:value.correct,helped:value.helped,soundOn:value.soundOn,...(first?{startedAt:value.startedAt}:{})};
}
function answersValue(value){
  object(value,['fun','stuck','stuckNote','again'],undefined,'answers');
  const result={fun:value.fun,stuck:value.stuck,again:value.again};
  if(value.fun!==null)enumeration(value.fun,TRIAL_FEEDBACK_OPTIONS.fun,'answers.fun');
  if(value.again!==null)enumeration(value.again,TRIAL_FEEDBACK_OPTIONS.again,'answers.again');
  if(value.stuck!==null){
    if(!Array.isArray(value.stuck)||!value.stuck.length||value.stuck.length>7||new Set(value.stuck).size!==value.stuck.length)invalid('answers.stuck');
    for(const key of value.stuck)enumeration(key,TRIAL_FEEDBACK_OPTIONS.stuck,'answers.stuck');
    if(value.stuck.includes('none')&&value.stuck.length!==1)invalid('answers.stuck');
    result.stuck=value.stuck.length?[...value.stuck].sort():null;
  }
  if(value.stuckNote!==null&&typeof value.stuckNote!=='string')invalid('answers.stuckNote');
  const note=(value.stuckNote||'').trim();
  if((value.stuckNote!==null&&!note)||[...note].length>TRIAL_FEEDBACK_LIMITS.noteChars||/[\u0000-\u001f\u007f-\u009f]/u.test(note))invalid('answers.stuckNote');
  if(!result.fun&&!result.stuck&&!result.again&&!note)throw trialFeedbackError('empty');
  return {answers:result,note};
}

/** Anonymous, consent-only trial feedback. Never joins the account or learning stores. */
export function createTrialFeedback({store,clock=()=>new Date().toISOString(),origins=['https://synk.im']}={}){
  const originSet=new Set(origins),rates=new Map();let lastPrune=-Infinity;
  const nowMs=()=>{const ms=Date.parse(clock());if(!Number.isFinite(ms))throw new Error('Invalid trial clock');return ms;};
  const hmac=(domain,value)=>createHmac('sha256',store.key).update(domain+'\0'+value).digest('hex');
  const participantKey=value=>'tp-'+hmac('trial-participant',value);
  const eventKey=value=>'te-'+hmac('trial-event',value);
  const noteKey=id=>'trial-note:'+id;
  // Partial indexes stay within this service's document kinds. No existing row or schema is rewritten.
  store.db.exec("CREATE INDEX IF NOT EXISTS trial_event_participant_date ON documents(json_extract(body,'$.participant'),json_extract(body,'$.seoulDate')) WHERE kind='trialEvents'");
  store.db.exec("CREATE INDEX IF NOT EXISTS trial_event_round ON documents(json_extract(body,'$.participant'),json_extract(body,'$.roundId'),json_extract(body,'$.kind')) WHERE kind='trialEvents'");
  const eventRows=store.db.prepare("SELECT body FROM documents WHERE kind='trialEvents' AND json_extract(body,'$.participant')=? AND json_extract(body,'$.roundId')=? AND json_extract(body,'$.kind')=? LIMIT 1");
  const dayCount=store.db.prepare("SELECT count(*) AS n FROM documents WHERE kind='trialEvents' AND json_extract(body,'$.participant')=? AND json_extract(body,'$.seoulDate')=?");
  const dayVisit=store.db.prepare("SELECT body FROM documents WHERE kind='trialEvents' AND json_extract(body,'$.participant')=? AND json_extract(body,'$.seoulDate')=? AND json_extract(body,'$.kind')='visit' LIMIT 1");
  function currentUser(user){const current=store.get('users',user?.id);if(!current?.active)throw trialFeedbackError('login',401);if(!STAFF.has(current.role))throw trialFeedbackError('role',403);return current;}
  function allowOrigin(origin){return typeof origin==='string'&&originSet.has(origin);}
  function rate(context={}){
    if(!allowOrigin(context.origin))throw trialFeedbackError('origin',403);
    const now=nowMs(),window=Math.floor(now/60000);
    for(const [key,row] of rates)if(row.window!==window)rates.delete(key);
    const client='client:'+createHash('sha256').update(String(context.client||'unknown')).digest('hex'),keys=[['global',600],[client,30]];
    for(const [key,limit] of keys){const row=rates.get(key);if((row?.count||0)>=limit||(!row&&rates.size>=5000)){throw Object.assign(trialFeedbackError('rate_limited',429),{retryAfterSeconds:Math.max(1,60-Math.floor(now/1000)%60)});}}
    for(const [key] of keys){const row=rates.get(key)||{window,count:0};row.count++;rates.set(key,row);}
  }
  function removeParticipant(id){store.removeWhere('trialEvents',"json_extract(body,'$.participant')=?",id);store.deleteSecret(noteKey(id));store.remove('trialParticipants',id);}
  function maintain(force=false){
    const now=nowMs();if(!force&&now-lastPrune<60000)return;
    const expired=store.all('trialParticipants').filter(row=>Date.parse(row.deleteAt)<=now);
    store.transaction(()=>{for(const row of expired)removeParticipant(row.id);store.removeWhere('trialWithdrawn',"json_extract(body,'$.until')<=?",new Date(now).toISOString());});
    lastPrune=now;
  }
  const withdrawnKey=id=>'tw-'+id.slice(3);
  const contentHash=input=>hmac('trial-content',canonical(input));
  const enrollmentReply=(row,duplicate)=>({ok:true,duplicate,consentAt:row.consentAt,expiresAt:row.expiresAt,deleteAt:row.deleteAt});
  function putEvent(participant,{id,kind,at,round,contentHash:hash}){
    const row={id,participant:participant.id,kind,seoulDate:seoulDate(at),at:new Date(at).toISOString(),contentHash:hash,cohort:participant.cohort,synthetic:participant.synthetic};
    if(round){const {roundId,startedAt,...details}=round;row.roundId=roundId;row.round=details;}
    store.put('trialEvents',id,row);return row;
  }
  function enroll(input,context){
    rate(context);maintain();
    common(input,['v','app','surface','participantId','submissionId','cohort','consentAt','consent','round','answers']);
    if(input.surface!=='lab-web')invalid('surface');uuid(input.submissionId,'submissionId');
    const cohort=cohortValue(input.cohort),submittedAt=timestamp(input.consentAt,'consentAt'),round=roundValue(input.round,true,true),{answers,note}=answersValue(input.answers);
    object(input.consent,['version','age14'],undefined,'consent');
    if(input.consent.version!==TRIAL_FEEDBACK_CONSENT||input.consent.age14!==true)throw trialFeedbackError('consent');
    const id=participantKey(input.participantId),hash=contentHash(input),previous=store.get('trialParticipants',id);
    if(store.get('trialWithdrawn',withdrawnKey(id)))throw trialFeedbackError('withdrawn',410);
    if(previous){
      if(previous.submissionId!==input.submissionId)throw trialFeedbackError('already_enrolled',409);
      if(previous.contentHash!==hash)throw trialFeedbackError('conflict',409);
      return enrollmentReply(previous,true);
    }
    const now=nowMs();
    // Do not mix a server-day enrollment with a future device-day return.
    if(submittedAt>now+CLOCK_SKEW)invalid('consentAt');
    const consentAt=submittedAt>=now-3*DAY?submittedAt:now;
    if(store.count('trialParticipants')>=TRIAL_FEEDBACK_LIMITS.participants||store.count('trialEvents')+3>TRIAL_FEEDBACK_LIMITS.events)throw trialFeedbackError('full',503);
    const row={id,app:'talk-rally',cohort,synthetic:cohort.startsWith('qa-'),consentVersion:TRIAL_FEEDBACK_CONSENT,questionsVersion:TRIAL_FEEDBACK_CONSENT,submissionId:input.submissionId,contentHash:hash,consentAt:new Date(consentAt).toISOString(),D:seoulDate(consentAt),expiresAt:new Date(consentAt+30*DAY).toISOString(),deleteAt:new Date(consentAt+90*DAY).toISOString(),receivedAt:new Date(now).toISOString(),answers,hasNote:!!note,firstRoundId:round.roundId};
    store.transaction(()=>{
      store.put('trialParticipants',id,row);if(note)store.setSecret(noteKey(id),note);
      for(const kind of ['visit','round_start','round_complete']){
        const eventId='te-'+hmac('trial-initial',id+'\0'+kind),at=kind==='round_start'?Math.max(consentAt-3*3600000,Math.min(consentAt,Date.parse(round.startedAt))):consentAt;
        putEvent(row,{id:eventId,kind,at,round:kind==='visit'?undefined:kind==='round_start'?{roundId:round.roundId,mode:round.mode}:round,contentHash:hash});
      }
    });
    return enrollmentReply(row,false);
  }
  function event(input,context){
    rate(context);maintain();
    const keys=['v','app','participantId','eventId','kind','occurredAt'];
    common(input,[...keys,'round'],keys);uuid(input.eventId,'eventId');enumeration(input.kind,TRIAL_FEEDBACK_OPTIONS.kind,'kind');
    const timestampMs=timestamp(input.occurredAt,'occurredAt');
    let round;if(input.kind==='visit'){if(Object.hasOwn(input,'round'))invalid('round');}else round=roundValue(input.round,input.kind==='round_complete');
    const participant=store.get('trialParticipants',participantKey(input.participantId));
    if(!participant)throw trialFeedbackError('not_enrolled',404);
    const id=eventKey(input.eventId),hash=contentHash(input),previous=store.get('trialEvents',id);
    if(previous){if(previous.participant!==participant.id||previous.contentHash!==hash)throw trialFeedbackError('conflict',409);return {ok:true,duplicate:true};}
    const now=nowMs(),lower=Math.max(Date.parse(participant.consentAt)-CLOCK_SKEW,now-3*DAY),at=timestampMs;
    // Never move an event to another day: late delivery is not a return visit.
    // The client discards a 400 event, while accepted event IDs still retry above.
    if(at<lower||at>now+CLOCK_SKEW)invalid('occurredAt');
    if(at>=Date.parse(participant.expiresAt))throw trialFeedbackError('expired',410);
    const day=seoulDate(at);
    const semantic=input.kind==='visit'?dayVisit.get(participant.id,day):eventRows.get(participant.id,round.roundId,input.kind);
    if(semantic)return {ok:true,duplicate:true};
    if(dayCount.get(participant.id,day).n>=TRIAL_FEEDBACK_LIMITS.perDay)throw Object.assign(trialFeedbackError('rate_limited',429),{retryAfterSeconds:3600});
    if(store.count('trialEvents')>=TRIAL_FEEDBACK_LIMITS.events)throw trialFeedbackError('full',503);
    putEvent(participant,{id,kind:input.kind,at,round,contentHash:hash});return {ok:true,duplicate:false};
  }
  function withdraw(input,context){
    rate(context);maintain();common(input,['v','app','participantId']);
    const id=participantKey(input.participantId),key=withdrawnKey(id),old=store.get('trialWithdrawn',key);
    // A missing enrollment can still be in flight. Keep its opaque withdrawal marker too.
    if(!old&&!store.get('trialParticipants',id)&&store.count('trialWithdrawn')>=50000)throw trialFeedbackError('full',503);
    store.transaction(()=>{removeParticipant(id);if(!old)store.put('trialWithdrawn',key,{id:key,until:new Date(nowMs()+90*DAY).toISOString()});});
    return {ok:true,deleted:true};
  }
  function summary(user,query={}){
    const actor=currentUser(user);object(query,['cohort','days','data'],[],'query');
    const filter={cohort:query.cohort??'all',days:query.days??'30',data:query.data??'real'};
    if(filter.cohort!=='all')cohortValue(filter.cohort);
    if(!['7','30','90'].includes(String(filter.days)))invalid('days');filter.days=Number(filter.days);
    enumeration(filter.data,['real','synthetic'],'data');maintain();
    const now=nowMs(),today=seoulDate(now),T=dateNumber(today),synthetic=filter.data==='synthetic';
    const all=store.all('trialParticipants').filter(row=>Date.parse(row.consentAt)>=now-filter.days*DAY),byCohort=new Map();
    for(const row of all.filter(row=>row.synthetic===synthetic))byCohort.set(row.cohort,(byCohort.get(row.cohort)||0)+1);
    const selectedCohort=row=>filter.cohort==='all'||row.cohort===filter.cohort;
    const participants=all.filter(row=>row.synthetic===synthetic&&selectedCohort(row)),byId=new Map(participants.map(row=>[row.id,row]));
    const denominators={participants:participants.length,visits:0,returnVisits:0,participantsReturned:0,roundStarts:0,roundCompletes:0,roundsStartedNotCompleted:0,roundsCompletedWithoutStart:0};
    const distribution=choices=>({answered:0,skipped:0,counts:Object.fromEntries(choices.map(key=>[key,0]))});
    const fun=distribution(TRIAL_FEEDBACK_OPTIONS.fun),stuck={...distribution(TRIAL_FEEDBACK_OPTIONS.stuck),note:'참여 번호 수. 여럿 고름이라 합이 응답 수를 넘습니다.'};
    const againVsReturn=[...TRIAL_FEEDBACK_OPTIONS.again,null].map(again=>({again,participants:0,within1d:{eligible:0,returned:0},within7d:{eligible:0,returned:0}}));
    // Group in SQLite: even the 1.2M event cap must not become 1.2M JavaScript objects.
    const stats=new Map(participants.map(row=>[row.id,{days:new Set(),first:null}])),ids=JSON.stringify([...byId.keys()]);
    const daysSql="SELECT json_extract(body,'$.participant') AS participant,json_extract(body,'$.seoulDate') AS day FROM documents WHERE kind='trialEvents' AND json_extract(body,'$.participant') IN (SELECT value FROM json_each(?)) GROUP BY participant,day";
    for(const row of store.db.prepare(daysSql).iterate(ids))if(row.day>=byId.get(row.participant).D)stats.get(row.participant).days.add(row.day);
    const roundsSql=`SELECT sum(started) AS starts,sum(completed) AS completes,
      sum(CASE WHEN started=1 AND completed=0 AND startDate<? THEN 1 ELSE 0 END) AS unfinished,
      sum(CASE WHEN started=0 AND completed=1 THEN 1 ELSE 0 END) AS unpaired FROM (
      SELECT json_extract(body,'$.participant') AS participant,json_extract(body,'$.roundId') AS roundId,
        max(CASE WHEN json_extract(body,'$.kind')='round_start' THEN 1 ELSE 0 END) AS started,
        max(CASE WHEN json_extract(body,'$.kind')='round_complete' THEN 1 ELSE 0 END) AS completed,
        min(CASE WHEN json_extract(body,'$.kind')='round_start' THEN json_extract(body,'$.seoulDate') END) AS startDate
      FROM documents WHERE kind='trialEvents' AND json_extract(body,'$.roundId') IS NOT NULL
        AND json_extract(body,'$.participant') IN (SELECT value FROM json_each(?)) GROUP BY participant,roundId)`;
    const totals=store.db.prepare(roundsSql).get(today,ids);
    denominators.roundStarts=totals.starts||0;denominators.roundCompletes=totals.completes||0;
    denominators.roundsStartedNotCompleted=totals.unfinished||0;denominators.roundsCompletedWithoutStart=totals.unpaired||0;
    for(const person of participants){const row=eventRows.get(person.id,person.firstRoundId,'round_complete');if(row)stats.get(person.id).first=JSON.parse(row.body).round;}
    const ratios=[];let helped=0,soundOff=0;
    for(const person of participants){
      const state=stats.get(person.id),returns=[...state.days].filter(day=>day>person.D),D=dateNumber(person.D);
      denominators.visits+=state.days.size;denominators.returnVisits+=returns.length;if(returns.length)denominators.participantsReturned++;
      if(person.answers.fun){fun.answered++;fun.counts[person.answers.fun]++;}else fun.skipped++;
      if(person.answers.stuck?.length){stuck.answered++;for(const key of person.answers.stuck)stuck.counts[key]++;}else stuck.skipped++;
      const again=againVsReturn.find(row=>row.again===person.answers.again);again.participants++;
      for(const [span,key] of [[1,'within1d'],[7,'within7d']])if(T>=D+span+1){again[key].eligible++;if(returns.some(date=>dateNumber(date)<=D+span))again[key].returned++;}
      if(state.first){ratios.push(state.first.correct/state.first.total);if(state.first.helped>0)helped++;if(!state.first.soundOn)soundOff++;}
    }
    ratios.sort((a,b)=>a-b);const n=ratios.length,median=n?(ratios[Math.floor((n-1)/2)]+ratios[Math.floor(n/2)])/2:null;
    const commentsHidden=!['admin','manager','member'].includes(actor.role);
    const comments=commentsHidden?null:participants.filter(row=>row.hasNote).sort((a,b)=>b.consentAt.localeCompare(a.consentAt)).slice(0,50).map(row=>({date:row.D,cohort:row.cohort,...row.answers,note:store.secret(noteKey(row.id))}));
    return {ok:true,contractVersion:TRIAL_FEEDBACK_VERSION,generatedAt:new Date(now).toISOString(),today,unit:'참여 수는 이 브라우저의 익명 참여 번호 수이며 사람 수와 다릅니다.',filter,cohorts:[...byCohort].sort(([a],[b])=>a.localeCompare(b)).map(([cohort,participants])=>({cohort,participants})),otherDataCount:all.filter(row=>row.synthetic!==synthetic&&selectedCohort(row)).length,denominators,fun,stuck,againVsReturn,performance:{label:'판 안 수행 — 학습 효과 아님',firstRound:{n,medianCorrectRatio:median,helpedRoundShare:n?helped/n:null,soundOffShare:n?soundOff/n:null}},comments,commentsHidden};
  }
  return {allowOrigin,enroll,event,withdraw,summary,maintain,prune:maintain};
}
