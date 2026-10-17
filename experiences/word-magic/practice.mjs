/** Session-only practice evidence. Restored progress never restores a claim of hearing audio. */
export function collectPractice(actions,{set='default',spell,objectId,heard=false,changed=false}={}){
 if(!heard||!changed||!['grow','shrink','open','close','up','down'].includes(spell)||typeof objectId!=='string')return actions;
 const qualified=`${set}:${objectId}`;if(actions.some(a=>a.spell===spell&&a.objectId===qualified))return actions;
 return [...actions,{spell,objectId:qualified,heard:true,changed:true}].slice(-24);
}
export function practiceStatus(actions){const words=new Set(actions.map(a=>a.spell)).size,objects=new Set(actions.map(a=>a.objectId)).size;return {count:actions.length,words,objects,ready:actions.length>=3&&words>=2&&objects>=2};}
