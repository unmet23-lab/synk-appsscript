import { WORDS, STAGES } from './curriculum.js';
import { CAMPAIGN, CHALLENGE_BY_ID, CHOICE_BY_ID, medalFor } from './campaign.js';
import { FINALES, FINALE_QUESTION_BY_ID, FINALE_CHOICE_BY_ID } from './finales.js';
export { WORDS, STAGES };
export const WORD_BY_ID = {...Object.fromEntries(WORDS.map(w => [w.id,w])),...CHOICE_BY_ID,...FINALE_CHOICE_BY_ID};
const QUESTION_BY_ID = {...CHALLENGE_BY_ID,...FINALE_QUESTION_BY_ID};
const RECORDED_STAGES = [...STAGES,...CAMPAIGN,...FINALES];
export const PROGRESS_KEY = 'SYNK_LAB_PLAY_PROGRESS_V1';
const shuffle = (items,rng) => { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
export function makeQuestions(stage,rng=Math.random) {
  if(stage.campaign)return stage.items.map(q=>({...q,options:shuffle(q.options,rng)}));
  return stage.words.map(id=>{
    const w=WORD_BY_ID[id];
    let pool=stage.mode==='picture'?stage.words.filter(x=>x!==id):WORDS.filter(x=>x.id!==id&&x.pos===w.pos&&Math.abs(x.word.length-w.word.length)<=2).map(x=>x.id);
    if(pool.length<2)pool=WORDS.filter(x=>x.id!==id).map(x=>x.id);
    return {answer:id,word:w.word,mode:stage.mode,prompt:stage.mode==='picture'?`${w.word}의 그림을 찾아줘!`:`들리는 단어를 골라줘!`,
      spoken:`${stage.mode==='picture'?'이 단어의 그림을 찾아줘.':'잘 들어봐. 들리는 단어를 골라줘.'} ${w.word}.`,
      options:shuffle([id,...shuffle(pool,rng).slice(0,2)],rng)};
  });
}
export const emptyProgress = () => ({version:1,words:{},stages:{},challenges:{},rounds:0,cleanRuns:0});
export function loadProgress(storage) {
  try {
    const saved=JSON.parse(storage.getItem(PROGRESS_KEY));
    if(saved?.version!==1||!saved.words||!saved.stages)return emptyProgress();
    const result=emptyProgress();
    for(const [id,p] of Object.entries(saved.words))if(WORDS.some(w=>w.id===id)&&p&&Number.isFinite(p.correct)&&Number.isFinite(p.wrong))result.words[id]={seen:Math.max(0,Math.min(1000000,p.seen||0)),correct:Math.max(0,Math.min(1000000,p.correct)),wrong:Math.max(0,Math.min(1000000,p.wrong)),lastAt:Number(p.lastAt)||0,lastCorrect:p.lastCorrect===true};
    for(const [id,p] of Object.entries(saved.challenges||{}))if(QUESTION_BY_ID[id]&&p&&Number.isFinite(p.correct)&&Number.isFinite(p.wrong))result.challenges[id]={seen:Math.max(0,Math.min(1000000,p.seen||0)),correct:Math.max(0,Math.min(1000000,p.correct)),wrong:Math.max(0,Math.min(1000000,p.wrong)),lastAt:Number(p.lastAt)||0,lastCorrect:p.lastCorrect===true};
    for(const s of RECORDED_STAGES){const p=saved.stages[s.id],total=s.campaign?s.items.length:s.words.length;if(p&&Number.isFinite(p.bestScore))result.stages[s.id]={plays:Math.max(0,Math.min(1000000,p.plays||0)),bestScore:Math.max(0,Math.min(total,p.bestScore)),cleared:p.bestScore>=Math.ceil(total*.8)};}
    result.cleanRuns=Math.max(0,Math.min(1000000,saved.cleanRuns||0));
    result.rounds=Math.max(0,Math.min(1000000,saved.rounds||0));return result;
  } catch {return emptyProgress();}
}
export function recordRound(progress,stage,answers,{automatic=false,now=Date.now(),collisions=0}={}) {
  if(automatic)return progress;
  const result=structuredClone(progress);result.challenges??={};result.cleanRuns??=0;result.rounds++;if(collisions===0&&answers.length>=5)result.cleanRuns++;
  for(const a of answers){const target=stage.campaign?result.challenges:result.words,id=stage.campaign?a.id:a.answer;if(stage.campaign?!QUESTION_BY_ID[id]:!WORD_BY_ID[id])continue;const p=target[id]||{seen:0,correct:0,wrong:0};p.seen++;p.correct+=a.correct?1:0;p.wrong+=a.correct?0:1;p.lastAt=now;p.lastCorrect=a.correct;target[id]=p;}
  if(RECORDED_STAGES.some(s=>s.id===stage.id)&&answers.length===(stage.campaign?stage.items.length:stage.words.length)){
    const score=answers.filter(a=>a.correct).length,old=result.stages[stage.id]||{plays:0,bestScore:0};
    result.stages[stage.id]={plays:old.plays+1,bestScore:Math.max(old.bestScore,score),cleared:medalFor(Math.max(old.bestScore,score),stage.campaign?stage.items.length:stage.words.length)>=2};
  }
  return result;
}
export function reviewStage(progress,kind='words') {
  if(kind==='campaign'){
    const ids=Object.keys(progress.challenges||{}).filter(id=>QUESTION_BY_ID[id]).sort((a,b)=>{const x=progress.challenges[a],y=progress.challenges[b];return Number(x.lastCorrect)-Number(y.lastCorrect)||x.correct-y.correct||x.lastAt-y.lastAt;}).slice(0,5);
    return ids.length?{id:'challenge-review',title:'놓친 문장을 다시',campaign:true,review:true,chapter:1,level:1,scene:'bloom',mode:'mixed',skill:'문장 복습',words:[],items:ids.map(id=>QUESTION_BY_ID[id])}:null;
  }
  const ids=Object.keys(progress.words).filter(id=>WORD_BY_ID[id]).sort((a,b)=>{
    const x=progress.words[a],y=progress.words[b];return Number(x.lastCorrect)-Number(y.lastCorrect)||x.correct-y.correct||x.lastAt-y.lastAt;
  }).slice(0,5);
  return ids.length?{id:'review',number:0,title:'틀린 단어부터 다시',mode:'listen',words:ids,band:'review'}:null;
}
