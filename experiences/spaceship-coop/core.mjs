import { randomInt, randomBytes } from 'node:crypto';

export const WORDS = Object.freeze({red:'빨간색',blue:'파란색',up:'위',down:'아래',one:'한 번',two:'두 번',three:'세 번'});
export const STAGES = Object.freeze([
  {id:'color',name:'엔진의 불을 켜요',en:'Power the engines',words:['red','blue'],devices:['왼쪽 엔진','오른쪽 엔진','보조 엔진','냉각 장치','동력 장치','비상 전원']},
  {id:'position',name:'안테나를 맞춰요',en:'Align the antennas',words:['up','down'],devices:['왼쪽 안테나','오른쪽 안테나','통신 안테나','탐색 안테나','별빛 수신기','항로 수신기']},
  {id:'count',name:'별빛 연료를 채워요',en:'Pump the starlight fuel',words:['one','two','three'],devices:['왼쪽 연료통','오른쪽 연료통','보조 연료통','추진 연료통','별빛 연료통','이륙 연료통']}
]);
const shuffle = values => {const a=[...values];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
export const token = () => randomBytes(24).toString('base64url');
export class GameError extends Error {constructor(code,message,status=400){super(message);this.code=code;this.status=status;}}
export function requireThat(ok,code,message,status=400){if(!ok)throw new GameError(code,message,status);}
export function newPlayer(slot){return {slot,token:token(),connected:false,ready:false,studied:new Set(),launch:false,seen:new Map(),stats:{listeningAttempts:0,listeningCorrect:0,firstTry:0,replays:0,help:0,signals:0,matchingSignals:0}};}
export function newRoom(code,now=Date.now()) {
  const rounds=STAGES.flatMap((stage,stageIndex)=>{
    // Each role encounters every expression. Fresh order on each expedition.
    const a=shuffle([...stage.words,...stage.words].slice(0,3)),b=shuffle([...stage.words,...stage.words].slice(0,3));
    return Array.from({length:6},(_,i)=>({stage:stageIndex,device:stage.devices[i],target:(i%2?a:b)[Math.floor(i/2)]}));
  });
  return {code,expeditionId:randomBytes(16).toString('hex'),created:now,lastActive:now,revision:0,phase:'lobby',players:[newPlayer(0),null],rounds,round:0,signal:null,signalSerial:0,feedback:null,attempts:0,records:[],completedAt:null};
}
export function stageOf(room){return STAGES[room.rounds[Math.min(room.round,17)].stage];}
export function navigatorSlot(room){return room.round%2;}
export function project(room,slot,now=Date.now()) {
  const p=room.players[slot],other=room.players[1-slot],stage=stageOf(room),isNavigator=slot===navigatorSlot(room);
  const view={code:room.code,expeditionId:room.expeditionId,revision:room.revision,phase:room.phase,slot,role:isNavigator?'navigator':'pilot',round:room.round,total:18,
    stage:{id:stage.id,name:stage.name,en:stage.en,index:room.rounds[Math.min(room.round,17)].stage,words:stage.words},
    players:room.players.map((x,i)=>({slot:i,present:!!x,connected:!!x?.connected,ready:!!x?.ready,launch:!!x?.launch})),
    connected:!!p.connected,partnerConnected:!!other?.connected,paused:room.phase!=='lobby'&&room.phase!=='closed'&&(!p.connected||!other?.connected),
    studied:[...p.studied],stats:{...p.stats},feedback:room.feedback,expiresAt:Math.min(room.lastActive+30*60e3,room.created+2*60*60e3),serverTime:now};
  if(room.phase==='playing'||room.phase==='celebrate'){
    view.device=room.rounds[room.round].device;
    if(isNavigator)view.target=room.rounds[room.round].target;
    if(room.signal)view.signal={id:room.signal.id,clip:room.signal.clip};
    view.attempts=room.attempts;
  }
  if(room.phase==='complete') {
    view.summary={repaired:18,completedAt:room.completedAt,firstTry:room.records.filter(x=>x.firstTry).length,
      expressions:Object.keys(WORDS).length,teamReplays:room.players.reduce((n,x)=>n+x.stats.replays,0),teamHelp:room.players.reduce((n,x)=>n+x.stats.help,0)};
    view.records=room.records.map(r=>({round:r.round,stage:r.stage,word:r.word,firstTry:r.firstTry,attempts:r.attempts}));
  }
  return view;
}
export function validateCommand(body) {
  requireThat(body&&typeof body==='object'&&!Array.isArray(body),'SCHEMA','잘못된 요청이에요.');
  const allowed={study:['clip'],ready:[],send:['clip'],act:['choice'],replay:[],help:[],next:[],launch:[],leave:[]};
  requireThat(Object.hasOwn(allowed,body.type),'SCHEMA','알 수 없는 행동이에요.');
  requireThat(typeof body.id==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(body.id),'SCHEMA','요청 번호가 필요해요.');
  requireThat(Number.isSafeInteger(body.revision)&&body.revision>=0,'SCHEMA','화면 상태 번호가 필요해요.');
  const fields=['type','id','revision',...allowed[body.type]];
  requireThat(Object.keys(body).every(k=>fields.includes(k)),'SCHEMA','허용되지 않은 입력이 있어요.');
  for(const key of allowed[body.type])requireThat(typeof body[key]==='string'&&Object.hasOwn(WORDS,body[key]),'SCHEMA','알 수 없는 표현이에요.');
}
export function command(room,slot,body,now=Date.now()) {
  validateCommand(body);const p=room.players[slot];
  const signature=JSON.stringify({type:body.type,clip:body.clip,choice:body.choice});
  if(p.seen.has(body.id)){requireThat(p.seen.get(body.id)===signature,'ID_REUSED','같은 요청 번호의 내용이 달라요.',409);return false;}
  requireThat(room.phase!=='closed','CLOSED','탐험이 종료되었어요.',410);
  requireThat(body.revision===room.revision,'REVISION','화면을 최신 상태로 맞추고 있어요.',409);
  if(body.type!=='leave'&&body.type!=='study')requireThat(room.players.every(x=>x?.connected),'PARTNER_OFFLINE','친구가 돌아오면 계속할 수 있어요.',409);
  const phase=room.phase,stage=stageOf(room),isNavigator=slot===navigatorSlot(room),current=room.rounds[room.round];
  switch(body.type){
    case 'study':requireThat(phase==='tutorial','PHASE','지금은 연습 시간이 아니에요.',409);requireThat(stage.words.includes(body.clip),'WORD','이번에 배우는 표현을 골라요.');p.studied.add(body.clip);break;
    case 'ready':
      requireThat(phase==='lobby'||phase==='tutorial','PHASE','이미 시작했어요.',409);
      if(phase==='tutorial')requireThat(stage.words.every(x=>p.studied.has(x)),'STUDY_FIRST','그림을 보며 모든 소리를 먼저 들어요.');
      p.ready=true;
      if(room.players.every(x=>x?.ready)){room.players.forEach(x=>{x.ready=false;});room.phase=phase==='lobby'?'tutorial':'playing';}
      break;
    case 'send':
      requireThat(phase==='playing','PHASE','다음 장치에서 보내 주세요.',409);requireThat(isNavigator,'ROLE','설명서를 보는 친구가 보내요.',403);
      requireThat(stage.words.includes(body.clip),'WORD','이번 장치의 표현을 골라요.');
      room.signal={id:++room.signalSerial,clip:body.clip};p.stats.signals++;if(body.clip===current.target)p.stats.matchingSignals++;room.feedback=null;break;
    case 'act':{
      requireThat(phase==='playing','PHASE','다음 장치를 기다려 주세요.',409);requireThat(!isNavigator,'ROLE','조종판을 보는 친구가 조작해요.',403);
      requireThat(room.signal,'NO_SIGNAL','친구가 소리를 보내면 조작할 수 있어요.',409);requireThat(stage.words.includes(body.choice),'WORD','이 장치에 없는 조작이에요.');
      room.attempts++;p.stats.listeningAttempts++;const listening=body.choice===room.signal.clip;if(listening)p.stats.listeningCorrect++;
      const success=body.choice===current.target&&listening;
      room.feedback={id:room.revision+1,success,listeningCorrect:listening,effect:success?'repair':room.attempts%2?'bubbles':'spin',choice:body.choice};
      if(success){const firstTry=room.attempts===1;p.stats.firstTry+=firstTry?1:0;room.records.push({round:room.round,stage:stage.id,word:current.target,firstTry,attempts:room.attempts});room.phase='celebrate';}
      break;
    }
    case 'replay':requireThat(phase==='playing'&&room.signal,'PHASE','먼저 친구의 소리를 받아요.',409);requireThat(!isNavigator,'ROLE','조종사가 다시 들을 수 있어요.',403);p.stats.replays++;break;
    case 'help':requireThat(phase==='playing','PHASE','장치 수리 중에 연습장을 열 수 있어요.',409);p.stats.help++;break;
    case 'next':
      requireThat(phase==='celebrate','PHASE','장치를 먼저 고쳐요.',409);requireThat(!isNavigator,'ROLE','조종사가 다음 장치로 이동해요.',403);
      room.round++;room.signal=null;room.feedback=null;room.attempts=0;
      if(room.round===18){room.phase='launch';break;}
      if(room.round%6===0){room.phase='tutorial';room.players.forEach(x=>{x.studied.clear();x.ready=false;});}else room.phase='playing';
      break;
    case 'launch':
      requireThat(phase==='launch','PHASE','모든 장치를 먼저 고쳐요.',409);p.launch=true;
      if(room.players.every(x=>x.launch)){room.phase='complete';room.completedAt=now;}
      break;
    case 'leave':room.phase='closed';break;
  }
  p.seen.set(body.id,signature);if(p.seen.size>300)p.seen.delete(p.seen.keys().next().value);
  room.revision++;room.lastActive=now;return true;
}
