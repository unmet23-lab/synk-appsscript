import {awardRace} from '../korean-racing/garage.js';
import {WORDS,STAGES,loadProgress,recordRound,PROGRESS_KEY} from '../korean-racing/learning.js';
import {CAMPAIGN,CHALLENGE_BY_ID} from '../korean-racing/campaign.js';
import {FINALES,FINALE_QUESTION_BY_ID} from '../korean-racing/finales.js';
const fail=()=>{throw Object.assign(new Error('INVALID_PLAY_COMMAND'),{code:'INVALID_PLAY_COMMAND',status:400});};
const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k));
const WORD_IDS=new Set(WORDS.map(word=>word.id));
export function awardAccountRace(wallet,records,args,now){
  if(!Array.isArray(args)||args.length!==3)fail();const [descriptor,answers,options]=args;
  if(!keys(descriptor,['id','questionIds','wordIds'])||typeof descriptor.id!=='string'||descriptor.id.length>180||!keys(options,['automatic','roundId','collisions'])||typeof options.automatic!=='boolean'||typeof options.roundId!=='string'||options.roundId.length>180)fail();
  if(options.collisions!==undefined&&(!Number.isSafeInteger(options.collisions)||options.collisions<0||options.collisions>1_000_000))fail();
  if(!Array.isArray(answers)||answers.length>100||answers.some(a=>!keys(a,['id','answer','correct'])||typeof a.correct!=='boolean'||[a.id,a.answer].some(v=>v!==undefined&&(typeof v!=='string'||v.length>180))))fail();
  let stage=[...STAGES,...CAMPAIGN,...FINALES].find(x=>x.id===descriptor.id);
  if(descriptor.id==='review'){
    const ids=descriptor.wordIds;
    if(Object.hasOwn(descriptor,'questionIds')||!Array.isArray(ids)||!ids.length||ids.length>5||new Set(ids).size!==ids.length||ids.some(id=>!WORD_IDS.has(id)))fail();
    // The vocabulary review button sends wordIds, not campaign questionIds.
    // It practices canonical words without inventing a first-clear course.
    stage={id:'review',review:true,mode:'listen',words:[...ids]};
  }else if(!stage){
    const ids=descriptor.questionIds,bank={...CHALLENGE_BY_ID,...FINALE_QUESTION_BY_ID};
    if(!Array.isArray(ids)||!ids.length||ids.length>10||new Set(ids).size!==ids.length||ids.some(id=>!Object.hasOwn(bank,id)))fail();
    // Adaptive practice can select canonical questions, never claim a finale or
    // mint a fresh first-clear reward under a client-generated course id.
    stage={id:descriptor.id,campaign:true,review:true,finale:false,items:ids.map(id=>bank[id])};
  }
  const beforeProgress=loadProgress({getItem:key=>key===PROGRESS_KEY?records[key]??null:null});
  const reward=awardRace(wallet,stage,answers,{automatic:options.automatic,roundId:options.roundId,beforeProgress,now});
  // Reward and progress share one account transaction and one command receipt.
  // Replays/demos/incomplete rounds must not advance the persisted progress.
  if(reward.reason!==null)return reward;
  const progress=recordRound(beforeProgress,stage,answers,{now,collisions:options.collisions??0});
  return {...reward,records:{...records,[PROGRESS_KEY]:JSON.stringify(progress)}};
}
