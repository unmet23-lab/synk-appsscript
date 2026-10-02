import { ownerAt } from './organization.mjs';

// Historic snapshots without a trustworthy observation time stay unassigned.
export function observationOwner(row,channel,events){
  if(row.ownership?.known&&Array.isArray(row.ownership.ownerIds))return row.ownership;
  if(!row.checkedAt)return {ownerIds:[],teamId:null,known:false};
  try{return ownerAt(events,channel,row.checkedAt);}catch{return {ownerIds:[],teamId:null,known:false};}
}
export function recordsForOwner(records,channels,events,ownerId,end){
  const channelIndex=new Map(channels.map(c=>[c.id,c]));
  const postIndex=new Map(records.posts.map(p=>[p.id,p]));
  const matches=(row,id)=>{
    const channel=channelIndex.get(id);if(!channel||row.date>end)return false;
    const owner=observationOwner(row,channel,events);return owner.known&&owner.ownerIds.includes(ownerId);
  };
  const grouped=(row,channelId)=>({...row,comparisonGroup:events.filter(e=>e.channelId===channelId&&Date.parse(e.effectiveAt)<=Date.parse(row.checkedAt)&&e.beforeOwnerIds?.includes(ownerId)&&!e.afterOwnerIds?.includes(ownerId)).length});
  const snapshots=records.snapshots.filter(row=>matches(row,postIndex.get(row.postId)?.channelId)).map(row=>grouped(row,postIndex.get(row.postId)?.channelId));
  const channelSnapshots=records.channelSnapshots.filter(row=>matches(row,row.channelId)).map(row=>grouped(row,row.channelId));
  const postIds=new Set(snapshots.map(row=>row.postId));
  const posts=records.posts.filter(p=>postIds.has(p.id)).map(p=>{
    let atPublication;try{atPublication=ownerAt(events,channelIndex.get(p.channelId),p.publishedAt||p.publishedDate+'T00:00:00+09:00');}catch{}
    const publishedAt=Date.parse(p.publishedAt||p.publishedDate+'T00:00:00+09:00');
    const latestObservation=Math.max(...snapshots.filter(row=>row.postId===p.id).map(row=>Date.parse(row.checkedAt)||0));
    const removedSincePublication=events.some(e=>e.channelId===p.channelId&&Date.parse(e.effectiveAt)<=latestObservation&&Date.parse(e.effectiveAt)>=publishedAt&&e.beforeOwnerIds?.includes(ownerId)&&!e.afterOwnerIds?.includes(ownerId));
    const hasOwnershipAtPublication=atPublication?.known&&atPublication.ownerIds.includes(ownerId)&&!removedSincePublication;
    return {...p,requiresRecordedBaseline:!hasOwnershipAtPublication};
  });
  const ids=new Set([...posts.map(p=>p.channelId),...channelSnapshots.map(r=>r.channelId)]);
  return {records:{...records,posts,snapshots,channelSnapshots},channels:channels.filter(c=>ids.has(c.id))};
}
