'use strict';
const fs=require('fs'),path=require('path'),policy=require('../모델정책.js');
const PROJECT='synk-bake-unmet27';
async function main(){if(policy.벌텍스프로젝트()!==PROJECT)throw Error('PROJECT_MISMATCH');const token=await policy.벌텍스토큰();async function req(endpoint,method='GET',body){const r=await fetch('https://monitoring.googleapis.com/v3/'+endpoint,{method,redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('MONITORING_HTTP_'+r.status);return r.json();}
 const desired=JSON.parse(fs.readFileSync(path.join(__dirname,'alert-policy.json'),'utf8'));
 const channel=await req(desired.notificationChannels[0]);if(channel.type!=='email'||channel.enabled===false||!channel.labels?.email_address)throw Error('APPROVED_CHANNEL_UNAVAILABLE');
 const all=[];let page;do{const r=await req('projects/'+PROJECT+'/alertPolicies'+(page?'?pageToken='+encodeURIComponent(page):''));all.push(...(r.alertPolicies||[]));page=r.nextPageToken;}while(page);
 const found=all.filter(x=>x.displayName===desired.displayName);if(found.length>1)throw Error('POLICY_DUPLICATE');
 const result=found.length?await req(found[0].name+'?updateMask=displayName,enabled,combiner,userLabels,documentation,conditions,notificationChannels,alertStrategy','PATCH',{...desired,name:found[0].name}):await req('projects/'+PROJECT+'/alertPolicies','POST',desired);
 const verified=await req(result.name);if(!verified.enabled||JSON.stringify(verified.notificationChannels)!==JSON.stringify(desired.notificationChannels)||verified.conditions?.[0]?.conditionMatchedLog?.filter!==desired.conditions[0].conditionMatchedLog.filter)throw Error('POLICY_VERIFY_FAILED');
 console.log(JSON.stringify({policy:verified.name,displayName:verified.displayName,enabled:verified.enabled,channel:channel.name,existingEmailChannel:true,newRecipients:0,iamChanges:0}));
}
main().catch(e=>{console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'MONITORING_FAILED');process.exitCode=1;});
