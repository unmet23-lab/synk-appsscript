import {SUNO_RECORDINGS} from './suno-tracks.mjs';
import {LISTENING} from './listening.mjs';
import {NARRATION} from './narration.mjs';
export const LEVELS = {
  easy: {label:'편하게', step:1, window:.28, perfect:.115, great:.195, approach:3.5},
  normal: {label:'리드미컬', step:.5, window:.23, perfect:.085, great:.155, approach:2.9},
  hard: {label:'도전', step:.5, window:.20, perfect:.065, great:.125, approach:2.55},
};
export const TRACKS=SUNO_RECORDINGS.map((recording,id)=>({id,...recording,
  subtitle:['한국어 시티팝 · 시간과 장소 듣기','한국어 시티팝 · 문장 연결 듣기','한국어 시티팝 · 같은 뜻 알아듣기'][id],
  tag:['듣기 · 일상 표현','듣기 · 문장 연결','듣기 · 뜻 이해'][id],
  color:['#f36f63','#86aaf4','#ffe07a'][id],questions:LISTENING[id],
}));

export function random(seed=1){let a=seed>>>0;return()=>{a+=0x6d2b79f5;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}
export function shuffle(array,rng){const out=[...array];for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
export function timingQuality(delta,level){const d=Math.abs(delta);return d<=level.perfect?1:d<=level.great?.8:d<=level.window?.5:0;}
export function timeAtBeat(track,index){
 const beats=track.beatTimes,whole=Math.floor(index),fraction=index-whole;
 if(whole<0)return beats[0]+index*60/track.bpm;
 if(whole>=beats.length-1)return beats.at(-1)+(index-(beats.length-1))*60/track.bpm;
 return beats[whole]+(beats[whole+1]-beats[whole])*fraction;
}
export function buildChart(track,levelName='easy',seed=1){
  const level=LEVELS[levelName],rng=random(seed),beat=60/track.bpm;
  const gates=[40,...[.30,.48,.66,.84].map(r=>Math.floor(track.beatTimes.length*r/4)*4)];
  const variants=shuffle([0,1,0,1,rng()>.5?1:0],rng);
  const questions=track.questions.map((q,i)=>{
    const allowed=track.variantChoices?.[i];
    const variant=allowed?.length&&!allowed.includes(variants[i])?allowed[0]:variants[i],voice=NARRATION[`t${track.id}q${i}v${variant}`],recallVoice=NARRATION[`t${track.id}q${i}r`];
    const at=gates[i],time=timeAtBeat(track,at),lead=Math.max(voice.duration+3.5,12);
    const showTime=time-lead,voiceEnd=showTime+voice.duration,answerOpen=time-Math.max(2,3*beat);
    if(showTime<1||voiceEnd>answerOpen-.4)throw Error('음성 문항의 듣기 시간이 부족합니다.');
    return {...q,...q.claims[variant],id:`t${track.id}q${i}v${variant}`,sourceIndex:i,variant,beat:at,time,showTime,voiceEnd,answerOpen,closeTime:time+.65,voice,
      recall:{...q.recall,options:['O','X'],voice:recallVoice},options:['O','X'],intent:null,response:null,quality:0,state:'pending'};
  });
  const notes=[],occupied=[0,0];
  const patterns=[[0,1,0,1,1,0,1,0],[0,0,1,0,1,1,0,1],[1,0,0,1,0,1,1,0]];
  const pattern=patterns[Math.floor(rng()*patterns.length)];
  for(let b=4;b<track.beatTimes.length-3;b+=level.step){
    if(levelName==='normal'&&b%1!==0&&Math.floor(b)%4<2)continue;
    if(levelName==='hard'&&b%1!==0&&Math.floor(b)%8===7)continue;
    const idx=Math.floor(b/level.step),lane=(pattern[idx%8]+Math.floor(b/32))%2;
    const time=timeAtBeat(track,b),hold=b%8===0&&b>8&&b<track.beatTimes.length-8&&(levelName!=='easy'||b%16===0);
    const duration=hold?timeAtBeat(track,b+(levelName==='hard'?2:1.5))-time:0,endTime=time+duration;
    if(endTime>track.duration-2||questions.some(q=>endTime>=q.showTime&&time<=q.closeTime+.45))continue;
    if(time>occupied[lane]+.18){notes.push({id:`n${notes.length}`,beat:b,time,lane,duration,endTime,state:'pending',quality:0});occupied[lane]=endTime;}
    if(levelName==='hard'&&b%8===4){const other=1-lane;if(time>occupied[other]+.2){notes.push({id:`n${notes.length}`,beat:b,time,lane:other,duration:0,endTime:time,state:'pending',quality:0});occupied[other]=time;}}
  }
  return {notes,questions,duration:track.duration,beat,level};
}

export class RoundState{
  constructor(track,levelName='easy',seed=1){Object.assign(this,buildChart(track,levelName,seed));this.base=this.level;this.level={...this.level};this.timing=1;this.track=track;this.levelName=levelName;this.combo=0;this.maxCombo=0;this.score=0;this.earned=0;this.processed=0;this.possible=this.notes.reduce((n,x)=>n+(x.duration?2:1),0)+this.questions.length;this.events=[];}
  record(quality,type,lane){this.processed++;this.earned+=quality;this.score+=Math.round(quality*1000);if(quality>0){this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);}else this.combo=0;const event={type,lane,quality,combo:this.combo};this.events.push(event);return event;}
  activeQuestion(time){return this.questions.find(q=>time>=q.showTime&&time<=q.closeTime+1.5);}
  input(lane,time){
    if(lane!==0&&lane!==1)return null;
    const q=this.questions.find(q=>q.state==='pending'&&time>=q.showTime&&time<=q.closeTime);
    if(q){
      if(time<q.answerOpen)return {type:'listening',lane,q};
      q.intent=lane;
      if(time<q.time-this.level.window)return {type:'intent',lane,q};
      q.response=lane;q.quality=timingQuality(time-q.time,this.level);q.state='answered';
      const event=this.record(q.quality,'question',lane);return {...event,q,correct:q.options[lane]===q.answer};
    }
    // An answered gate remains exclusive: a chord cannot submit four answers.
    if(this.questions.some(x=>x.state!=='pending'&&time>=x.time-this.level.window&&time<=x.closeTime))return null;
    const note=this.notes.filter(n=>n.state==='pending'&&n.lane===lane&&Math.abs(n.time-time)<=this.level.window).sort((a,b)=>Math.abs(a.time-time)-Math.abs(b.time-time))[0];
    if(!note)return null;
    note.quality=timingQuality(time-note.time,this.level);note.state=note.duration?'holding':'hit';
    return {...this.record(note.quality,note.duration?'hold-start':'tap',lane),note};
  }
  release(lane,time){
    const note=this.notes.find(n=>n.state==='holding'&&n.lane===lane);if(!note)return null;
    const complete=time>=note.endTime-.10;note.state=complete?'hit':'broken';return {...this.record(complete?note.quality:0,complete?'hold-end':'hold-break',lane),note};
  }
  update(time,pressed=new Set()){
    const out=[];
    for(const n of this.notes){
      if(n.state==='pending'&&time>n.time+this.level.window){n.state='missed';out.push(this.record(0,'miss',n.lane));if(n.duration)out.push(this.record(0,'hold-miss',n.lane));}
      else if(n.state==='holding'&&time>=n.endTime){n.state=pressed.has(n.lane)?'hit':'broken';out.push({...this.record(n.state==='hit'?n.quality:0,n.state==='hit'?'hold-end':'hold-break',n.lane),note:n});}
    }
    for(const q of this.questions){if(q.state==='pending'&&time>q.closeTime){q.response=q.intent;q.state=q.intent===null?'unanswered':'answered';q.quality=0;out.push({...this.record(0,'question',q.response),q,correct:q.response!==null&&q.options[q.response]===q.answer});}}
    return out;
  }
  // Atlas moment-level challenge: how wide the timing windows are for this person (1 = the level's own).
  scaleTiming(factor){const f=Math.min(1.5,Math.max(.7,Number(factor)||1));this.timing=f;this.level={...this.base,window:this.base.window*f,perfect:this.base.perfect*f,great:this.base.great*f};return f;}
  get accuracy(){return this.processed?this.earned/this.processed:0;}
  get correctCount(){return this.questions.filter(q=>q.response!==null&&q.options[q.response]===q.answer).length;}
  get answeredCount(){return this.questions.filter(q=>q.response!==null).length;}
}
