import manifest from './review/holdout-20261028.json' with {type:'json'};
export const HOLDOUT=Object.freeze(manifest.items.map(item=>Object.freeze({...item})));
const families=new Set(HOLDOUT.map(item=>item.familyKey));
const sets=new Set(HOLDOUT.map(item=>item.setId).filter(Boolean));
// Reserve the entire shared source, including revisions and another question in its set.
export function isHeldout(item){
 const family=item?.familyKey||(item?.family?`topik-items.${item.family}`:null);
 return families.has(family)||sets.has(item?.setId||item?.set?.id);
}
