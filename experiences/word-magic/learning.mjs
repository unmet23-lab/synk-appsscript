/** Puzzle manipulation is not listening evidence. Only first checkpoint choices enter Atlas. */
export const GAME_ID='word-magic';
// v1 exposed the opposite object state before answering. v2 is a separate family:
// those visual-cued attempts must not be treated as prior independent v2 items.
export function checkpointMetadata(check){return {id:`${GAME_ID}.${check.meaningKey}`,itemKey:`${GAME_ID}.${check.meaningKey}.v2`,familyKey:`${GAME_ID}.${check.meaningKey}.v2`,skillId:'ko.listening.word',difficulty:1,modality:'listening',responseFormat:'action',audioRequired:true,confounded:false,conceptIds:[]};}
export class MagicLearning{
 constructor(api=globalThis.SynkLearning,storage){try{this.coach=api?.createGame({gameId:GAME_ID,storage})||null;}catch{this.coach=null;}this.id=null;this.heard=false;this.answered=false;}
 call(name,...args){try{return this.coach?.[name]?.(...args);}catch{return null;}}
 present(check){this.id=this.call('present',checkpointMetadata(check));this.heard=false;this.answered=false;return this.id;}
 delivery(ok){if(this.heard)return;this.call('delivery',this.id,{audio:ok?'completed':'failed'});if(ok)this.heard=true;}
 help(kind){if(this.id)this.call('help',this.id,kind);}
 answer(correct){if(!this.id||this.answered)return null;this.answered=true;return this.call('answer',this.id,{correct,assessable:this.heard,reason:this.heard?undefined:'audio'});}
 abandon(){if(this.id&&!this.answered)this.call('answer',this.id,{correct:false,assessable:false,reason:'skip'});this.id=null;this.answered=false;this.heard=false;}
}
