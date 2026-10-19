'use strict';
// Read-only alert configuration, incident and channel-error audit. No inbox access.
const fs=require('fs'),path=require('path'),policy=require('../모델정책.js');
const PROJECT='synk-bake-unmet27',PREFIX='projects/'+PROJECT;
async function main(){
 if(policy.벌텍스프로젝트()!==PROJECT)throw Error('PROJECT_MISMATCH');
 const token=await policy.벌텍스토큰(),checkedAt=new Date().toISOString();
 async function req(url,body){const r=await fetch(url,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','x-goog-user-project':PROJECT},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};}
 const policyIds=['18443156031886673239','2631536959569911876'],policies=[];
 for(const id of policyIds){const r=await req('https://monitoring.googleapis.com/v3/'+PREFIX+'/alertPolicies/'+id);if(r.status!==200)throw Error('POLICY_READ_FAILED');const p=r.data;policies.push({name:p.name,displayName:p.displayName,enabled:p.enabled,notificationChannels:p.notificationChannels,conditions:p.conditions,validity:p.validity||null,alertStrategy:p.alertStrategy});}
 const channelId=PREFIX+'/notificationChannels/14855206170551846292',channel=await req('https://monitoring.googleapis.com/v3/'+channelId);if(channel.status!==200)throw Error('CHANNEL_READ_FAILED');
 const start=process.argv.find(x=>x.startsWith('--since='))?.slice(8)||'2026-10-18T06:30:00Z';if(!Number.isFinite(Date.parse(start)))throw Error('SINCE_INVALID');
 const alerts=[];let page,alertsHttpStatus;
 do{const r=await req('https://monitoring.googleapis.com/v3/'+PREFIX+'/alerts?'+new URLSearchParams({filter:'open_time >= "'+start+'"',...(page?{pageToken:page}:{})}));alertsHttpStatus=r.status;if(r.status!==200)break;for(const a of r.data.alerts||[]){const p=a.policy||{};if(policies.some(x=>x.name===p.name))alerts.push({name:a.name,state:a.state,openTime:a.openTime||a.open_time,closeTime:a.closeTime||a.close_time,policy:p.name,summaryText:a.summaryText,extractedLabels:a.log?.extractedLabels,notificationFields:Object.keys(a).filter(k=>/notif|deliver/i.test(k))});}page=r.data.nextPageToken;}while(page);
 const log=await req('https://logging.googleapis.com/v2/entries:list',{resourceNames:[PREFIX],filter:'logName="'+PREFIX+'/logs/monitoring.googleapis.com%2Fnotification_channel_events" AND timestamp>="'+start+'"',pageSize:1000,orderBy:'timestamp desc'});
 const events=(log.data.entries||[]).filter(e=>!e.resource?.labels?.notification_channel_id||e.resource.labels.notification_channel_id==='14855206170551846292').map(e=>({timestamp:e.timestamp,severity:e.severity,resource:e.resource,fields:Object.keys(e.jsonPayload||{}),status:e.jsonPayload?.status||null}));
 const result={checkedAt,policies,channel:{name:channel.data.name,type:channel.data.type,enabled:channel.data.enabled!==false,verificationStatus:channel.data.verificationStatus||'not_returned',emailConfigured:!!channel.data.labels?.email_address},alertsHttpStatus,alerts,notificationEventsHttpStatus:log.status,notificationEvents:events,notificationEventsTruncated:!!log.data.nextPageToken,actualEmailReceived:false,actualEmailReceivedReason:'No inbox read; policy, incident and channel-error APIs cannot prove recipient inbox receipt.'};
 const dest=process.argv.find(x=>x.startsWith('--out='))?.slice(6);if(dest)fs.writeFileSync(path.resolve(dest),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'MONITORING_AUDIT_FAILED');process.exitCode=1;});
