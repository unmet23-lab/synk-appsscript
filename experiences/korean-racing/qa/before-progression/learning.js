import { WORDS, STAGES } from './curriculum.js';
export { WORDS, STAGES };
export const WORD_BY_ID = Object.fromEntries(WORDS.map(w => [w.id,w]));
export const PROGRESS_KEY = 'SYNK_LAB_PLAY_PROGRESS_V1';
const shuffle = (items,rng) => { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
export function makeQuestions(stage,rng=Math.random) {
  return stage.words.map(id=>{
    const w=WORD_BY_ID[id];
    let pool=stage.mode==='picture'?stage.words.filter(x=>x!==id):WORDS.filter(x=>x.id!==id&&x.pos===w.pos&&Math.abs(x.word.length-w.word.length)<=2).map(x=>x.id);
    if(pool.length<2)pool=WORDS.filter(x=>x.id!==id).map(x=>x.id);
    return {answer:id,word:w.word,mode:stage.mode,prompt:stage.mode==='picture'?`${w.word}의 그림을 찾아줘!`:`들리는 단어를 골라줘!`,
      spoken:`${stage.mode==='picture'?'이 단어의 그림을 찾아줘.':'잘 들어봐. 들리는 단어를 골라줘.'} ${w.word}.`,
      options:shuffle([id,...shuffle(pool,rng).slice(0,2)],rng)};
  });
}
export const emptyProgress = () => ({version:1,words:{},stages:{},rounds:0});
export function loadProgress(storage) {
  try {
    const saved=JSON.parse(storage.getItem(PROGRESS_KEY));
    if(saved?.version!==1||!saved.words||!saved.stages)return emptyProgress();
    const result=emptyProgress();
    for(const [id,p] of Object.entries(saved.words))if(WORD_BY_ID[id]&&p&&Number.isFinite(p.correct)&&Number.isFinite(p.wrong))result.words[id]={seen:Math.max(0,Math.min(1000000,p.seen||0)),correct:Math.max(0,Math.min(1000000,p.correct)),wrong:Math.max(0,Math.min(1000000,p.wrong)),lastAt:Number(p.lastAt)||0,lastCorrect:p.lastCorrect===true};
    for(const s of STAGES){const p=saved.stages[s.id];if(p&&Number.isFinite(p.bestScore))result.stages[s.id]={plays:Math.max(0,Math.min(1000000,p.plays||0)),bestScore:Math.max(0,Math.min(s.words.length,p.bestScore)),cleared:p.bestScore>=Math.ceil(s.words.length*.8)};}
    result.rounds=Math.max(0,Math.min(1000000,saved.rounds||0));return result;
  } catch {return emptyProgress();}
}
export function recordRound(progress,stage,answers,{automatic=false,now=Date.now()}={}) {
  if(automatic)return progress;
  const result=structuredClone(progress);result.rounds++;
  for(const a of answers){if(!WORD_BY_ID[a.answer])continue;const p=result.words[a.answer]||{seen:0,correct:0,wrong:0};p.seen++;p.correct+=a.correct?1:0;p.wrong+=a.correct?0:1;p.lastAt=now;p.lastCorrect=a.correct;result.words[a.answer]=p;}
  if(STAGES.some(s=>s.id===stage.id)){
    const score=answers.filter(a=>a.correct).length,old=result.stages[stage.id]||{plays:0,bestScore:0};
    result.stages[stage.id]={plays:old.plays+1,bestScore:Math.max(old.bestScore,score),cleared:Math.max(old.bestScore,score)>=Math.ceil(stage.words.length*.8)};
  }
  return result;
}
export function reviewStage(progress) {
  const ids=Object.keys(progress.words).filter(id=>WORD_BY_ID[id]).sort((a,b)=>{
    const x=progress.words[a],y=progress.words[b];return Number(x.lastCorrect)-Number(y.lastCorrect)||x.correct-y.correct||x.lastAt-y.lastAt;
  }).slice(0,5);
  return ids.length?{id:'review',number:0,title:'틀린 단어부터 다시',mode:'listen',words:ids,band:'review'}:null;
}
