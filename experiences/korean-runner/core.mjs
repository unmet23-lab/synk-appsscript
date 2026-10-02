import {INSTRUCTIONS,actionLabel} from './instructions.mjs';
import {VOICE_SECONDS} from './voice-timing.mjs';
export const LANES=[-2.35,0,2.35];
export function rng(seed=137){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export function obstacleHit(type,x,lane,y,sliding){
  if(Math.abs(x-LANES[lane])>.85)return false;
  return type==='barrier'?y<1.02:type==='arch'?!sliding||y>.15:true;
}
export class RunnerModel{
  constructor({mode='tour',learning='listen',seed=Date.now(),chooseInstruction=null}={}){
    this.mode=mode;this.learning=learning;this.random=rng(seed);this.elapsed=0;this.distance=0;this.speed=13;
    this.chooseInstruction=chooseInstruction;this.scheduledInstructions=new Set();
    this.x=0;this.lane=1;this.y=0;this.vy=0;this.slide=0;this.hearts=3;this.shield=0;this.invincible=0;
    this.coins=0;this.score=0;this.near=0;this.correct=0;this.combo=0;this.maxCombo=0;this.lanterns=0;
    this.answers=[];this.finished=false;this.reason='';this.events=[];this.missions=[];this.notices=[];
    this.nextMission=65;this.nextWave=30;this.nextCoin=12;this.missionCount=0;this.resolvedCount=0;
    this.currentMission=null;this.reviewQueue=[];this.generated=0;this.generate();
  }
  emit(type,data={}){this.notices.push({type,...data});}
  get currentStep(){return this.currentMission?.steps.find(s=>!s.resolved)||null;}
  input(action){
    if(this.finished)return;
    if(action==='left')this.lane=Math.max(0,this.lane-1);
    if(action==='right')this.lane=Math.min(2,this.lane+1);
    const step=this.currentStep;
    if(step&&step.d-this.distance<=26&&step.d>this.distance){
      if(action==='jump'||action==='slide')step.inputs.push(action);
      if(step.action==='lane'&&(action==='left'||action==='right'))step.inputMatched=this.lane===step.target;
      if(action===step.action)step.inputMatched=true;
    }
    if(action==='jump'&&this.y===0){this.vy=8.8;this.slide=0;this.emit('jump');}
    if(action==='slide'&&this.y===0){this.slide=.92;this.emit('slide');}
  }
  makeMission(d,instruction){
    let source=instruction;
    if(!source){
      const due=this.reviewQueue.find(q=>q.after<=this.resolvedCount);
      if(due){source=due.instruction;this.reviewQueue.splice(this.reviewQueue.indexOf(due),1);}
      else if(this.chooseInstruction){
        if(this.scheduledInstructions.size===INSTRUCTIONS.length)this.scheduledInstructions.clear();
        const candidates=INSTRUCTIONS.filter(item=>!this.scheduledInstructions.has(item.id));
        const selected=this.chooseInstruction(candidates);
        source=candidates.find(item=>item.id===selected?.id)||candidates[0];
        this.scheduledInstructions.add(source.id);
      }else source=INSTRUCTIONS[this.missionCount<INSTRUCTIONS.length?this.missionCount:6+Math.floor(this.random()*(INSTRUCTIONS.length-6))];
    }
    const cueDistance=Math.max(74,((VOICE_SECONDS[source.id]||5)+1.3)*19);
    const mission={id:source.id,text:source.text,skill:source.skill,explanation:source.explanation,index:this.missionCount++,d,cueDistance,
      instruction:source,resolved:false,announced:false,steps:source.steps.map((s,i)=>({...s,d:d+i*27,index:i,inputs:[],inputMatched:false,resolved:false,status:null}))};
    mission.end=mission.steps.at(-1).d;this.missions.push(mission);
    for(const step of mission.steps){
      this.events.push({kind:'mark',d:step.d,mission,step,resolved:false});
      if(step.action==='jump'||step.action==='slide')for(const lane of [0,1,2])this.events.push({kind:'obstacle',type:step.action==='jump'?'barrier':'arch',lane,d:step.d,mission,resolved:false});
    }
    return mission;
  }
  generate(){
    const horizon=this.distance+230;
    while(this.nextMission<horizon+130){const m=this.makeMission(this.nextMission);this.nextMission=m.end+125+this.random()*14;}
    while(this.nextWave<horizon){
      const d=this.nextWave;
      if(!this.missions.some(m=>d>m.d-m.cueDistance&&d<m.end+23)){
        const lanes=[0,1,2].sort(()=>this.random()-.5),count=d>350?2:1;
        for(const lane of lanes.slice(0,count))this.events.push({kind:'obstacle',type:['barrier','arch','tram'][Math.floor(this.random()*3)],lane,d,resolved:false});
      }
      this.nextWave+=29+this.random()*10;
    }
    while(this.nextCoin<horizon){
      const d=this.nextCoin;
      if(!this.missions.some(m=>d>m.d-26&&d<m.end+8)){
        const free=[0,1,2].filter(l=>!this.events.some(e=>e.kind==='obstacle'&&Math.abs(e.d-d)<10&&e.lane===l));
        if(free.length)this.events.push({kind:'coin',d,lane:free[Math.floor(this.random()*free.length)],resolved:false});
      }
      this.nextCoin+=9;
    }
    this.generated=horizon;
  }
  resolveStep(event){
    const {mission,step}=event;
    const executed=step.action==='lane'?Math.abs(this.x-LANES[step.target])<.65:
      step.action==='jump'?this.y>=1.02:step.action==='slide'?this.slide>0&&this.y<.15:
      this.y<.15&&this.slide===0&&!step.inputs.some(a=>a==='jump'||a==='slide');
    const matched=step.action==='lane'?this.lane===step.target:step.action==='stay'?executed:step.inputMatched;
    step.resolved=true;step.executed=executed;step.inputMatched=matched;
    step.status=executed?'done':matched?'timing':step.inputs.length?'different':'missed';
    if(executed){this.lanterns++;this.emit('step',{step,mission});}
    this.emit('stepResult',{step,mission});
    if(mission.steps.every(s=>s.resolved)){
      mission.resolved=true;this.resolvedCount++;this.currentMission=null;
      const correct=mission.steps.every(s=>s.executed);
      const record={id:mission.id,text:mission.text,explanation:mission.explanation,skill:mission.skill,learning:mission.learning,correct,
        steps:mission.steps.map(s=>({action:s.action,target:s.target,status:s.status,inputMatched:s.inputMatched,executed:s.executed,label:actionLabel(s)}))};
      this.answers.push(record);
      if(correct){this.correct++;this.combo++;this.maxCombo=Math.max(this.combo,this.maxCombo);this.score+=80;
        if(this.combo%3===0){this.shield=1;this.emit('earnedShield');}this.emit('correct',{mission});
      }else{this.combo=0;this.reviewQueue.push({instruction:mission.instruction,after:this.resolvedCount+2});this.emit('wrong',{mission,record});}
    }
  }
  step(dt){
    if(this.finished)return;dt=Math.max(0,Math.min(dt,.05));this.elapsed+=dt;
    this.slide=Math.max(0,this.slide-dt);this.invincible=Math.max(0,this.invincible-dt);
    this.x+=(LANES[this.lane]-this.x)*(1-Math.exp(-19*dt));
    if(this.vy!==0||this.y>0){this.vy-=23*dt;this.y+=this.vy*dt;if(this.y<=0){this.y=0;this.vy=0;this.emit('land');}}
    const mission=this.missions.find(m=>!m.resolved&&m.d-this.distance<m.cueDistance&&m.end>=this.distance);
    if(mission&&!mission.announced){mission.announced=true;mission.learning=this.learning;this.currentMission=mission;this.emit('instruction',{mission});}
    this.speed=13+Math.min(6,this.elapsed*.055);
    const before=this.distance;this.distance+=this.speed*dt;this.score+=this.speed*dt;
    const crossed=this.events.filter(e=>!e.resolved&&e.d<=this.distance&&e.d>=before-.001).sort((a,b)=>a.d-b.d||(a.kind==='mark'?-1:b.kind==='mark'?1:0));
    for(const e of crossed){
      e.resolved=true;
      if(e.kind==='mark')this.resolveStep(e);
      else if(e.kind==='coin'){if(Math.abs(this.x-LANES[e.lane])<.8&&this.y<2){this.coins++;this.score+=10;this.emit('coin');}}
      else if(obstacleHit(e.type,this.x,e.lane,this.y,this.slide>0)){
        if(this.invincible>0)continue;
        if(this.shield){this.shield=0;this.invincible=1.1;this.emit('shield');}
        else{this.hearts--;this.invincible=1.35;this.emit('hit');if(this.hearts<=0){this.finish('collision');break;}}
      }else if(Math.abs(this.x-LANES[e.lane])<1.5||(e.type!=='tram'&&this.lane===e.lane)){this.near++;this.score+=25;this.emit('near');}
    }
    if(this.distance+180>this.generated)this.generate();
    this.events=this.events.filter(e=>e.d>this.distance-24);this.missions=this.missions.filter(m=>m.end>this.distance-24);
    if(this.mode==='tour'&&this.elapsed>=90&&!this.finished)this.finish('tour');
  }
  finish(reason){this.finished=true;this.reason=reason;this.emit('finish');}
  drain(){const out=this.notices;this.notices=[];return out;}
}
// Visible, labelled demonstration. Its performance is never learner evidence.
export function driveDemo(model){
  const step=model.currentStep,remaining=step?.d-model.distance;
  if(step){
    if(step.action==='lane'){while(model.lane!==step.target)model.input(model.lane<step.target?'right':'left');}
    if(step.action==='jump'&&remaining<model.speed*.32&&remaining>0&&model.y===0)model.input('jump');
    if(step.action==='slide'&&remaining<model.speed*.40&&remaining>0&&model.slide===0)model.input('slide');
    return;
  }
  const next=model.events.filter(e=>e.kind==='obstacle'&&!e.mission&&!e.resolved&&e.d>model.distance).sort((a,b)=>a.d-b.d)[0];
  if(next&&next.d-model.distance<15){
    const same=model.events.filter(e=>e.kind==='obstacle'&&!e.resolved&&Math.abs(e.d-next.d)<.1),own=same.find(e=>e.lane===model.lane);
    if(own){const target=[0,1,2].find(l=>!same.some(e=>e.lane===l));while(model.lane!==target)model.input(model.lane<target?'right':'left');}
  }
}
