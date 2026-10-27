'use strict';

// Navigation projection only: opening an app never grants its data permissions.
// Input must be the authenticated synk-account GET response, never profile data
// or renderer/local-storage answers. Company employment is NOT academy staff.
// Retired Studio/SHIFT/Partners grants are ignored; they never grant another app.
const APP_IDS=Object.freeze(['world','messenger','teacher','path','pulse','care','fortune','rehearsal','family-album']);
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=120&&value.trim()===value&&!/[\x00-\x1f\x7f]/.test(value);
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const unavailable=()=>({status:'unavailable',appIds:[]});
function projectLibrary(data,now=Date.now()){
  if(!object(data)||data.ok!==true||!object(data.account)||!identifier(data.account.synk_user_id)||data.account.status!=='active'||!Array.isArray(data.memberships)||!Array.isArray(data.entitlements)||!Number.isFinite(now))return unavailable();
  const visible=new Set();
  for(const member of data.memberships){
    if(!object(member)||member.active!==undefined&&member.active!==true||member.revoked_at!=null)continue;
    if(member.kind==='learner'&&member.role==='student'&&identifier(member.learner_id))visible.add('world');
    if(member.kind==='staff'&&['teacher','director'].includes(member.role)&&identifier(member.staff_id))visible.add('teacher');
  }
  for(const entitlement of data.entitlements){
    if(!object(entitlement)||entitlement.active!==undefined&&entitlement.active!==true||entitlement.revoked_at!=null||entitlement.status!=null&&!['active','granted'].includes(entitlement.status))continue;
    if(entitlement.valid_from!=null&&(typeof entitlement.valid_from!=='string'||!Number.isFinite(Date.parse(entitlement.valid_from))||Date.parse(entitlement.valid_from)>now))continue;
    if(entitlement.valid_until!=null&&(typeof entitlement.valid_until!=='string'||!Number.isFinite(Date.parse(entitlement.valid_until))||Date.parse(entitlement.valid_until)<=now))continue;
    // These keys are explicit server-issued menu entitlements, not company ACLs.
    if(entitlement.product==='platform'&&typeof entitlement.key==='string'&&entitlement.key.startsWith('library.')){
      const id=entitlement.key.slice('library.'.length);if(APP_IDS.includes(id))visible.add(id);
    }
    if(entitlement.product==='world'&&entitlement.key==='practice.plus')visible.add('world');
  }
  return {status:'ready',appIds:APP_IDS.filter(id=>visible.has(id))};
}
module.exports={projectLibrary};
