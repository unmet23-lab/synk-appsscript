export const TUTOR_IDS=Object.freeze(['marin','kkamong','mongle']);
export const choiceKey=owner=>'synk.world.tutor.v1:'+encodeURIComponent(owner||'guest');
export function readTutorChoice(storage,owner='guest'){
 try{const data=JSON.parse(storage?.getItem(choiceKey(owner))||'null');return data?.version===1&&data.completed===true&&TUTOR_IDS.includes(data.tutor)?data.tutor:null;}catch{return null;}
}
export function saveTutorChoice(storage,owner,tutor){
 if(!TUTOR_IDS.includes(tutor))throw new TypeError('Unknown tutor');
 try{storage.setItem(choiceKey(owner),JSON.stringify({version:1,completed:true,tutor}));return true;}catch{return false;}
}
