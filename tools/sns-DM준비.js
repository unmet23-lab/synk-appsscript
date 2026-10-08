#!/usr/bin/env node
'use strict';
// Local content-package configuration only: no account access, upload, sharing, or delivery.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {normalizeDm}=require('./lib/sns-dm.js');
function configure(file,options){
 const raw=JSON.parse(fs.readFileSync(file,'utf8'));
 if(String(raw.platform).toLowerCase()!=='instagram')throw Error('Instagram 원고만 설정합니다.');
 if(Boolean(options.url)===Boolean(options.fileId))throw Error('자료 URL 또는 Drive 파일 ID 중 하나가 필요합니다.');
 if(Boolean(options.evergreen)===Boolean(options.endsAt))throw Error('상시 또는 종료일 중 하나를 명시합니다.');
 const resource={kind:options.url?'url':'drive',folder_id:options.folderId,library_root:options.libraryRoot};
 if(options.url)resource.url=options.url;
 else {if(!options.materialFile)throw Error('승인할 원본 파일이 필요합니다.');resource.file_id=options.fileId;resource.sha256=crypto.createHash('sha256').update(fs.readFileSync(options.materialFile)).digest('hex');}
 const dm=normalizeDm({account_id:options.accountId,title:options.title,keyword:options.keyword,message:options.message,
  duration_mode:options.evergreen?'evergreen':'fixed',ends_at:options.evergreen?null:new Date(options.endsAt).toISOString(),resource,
  ...(options.publicReply!==undefined?{public_reply_text:options.publicReply}:{}),
  ...(options.faqFile?{conversation_config:JSON.parse(fs.readFileSync(options.faqFile,'utf8'))}:{})});
 const tmp=file+'.dm-preparing';fs.writeFileSync(tmp,JSON.stringify({...raw,dm},null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,file);
 return {configured:true,kind:resource.kind,duration_mode:dm.duration_mode,approval_required:true};
}
function main(args){
 const names={'--원고':'file','--계정ID':'accountId','--자료명':'title','--키워드':'keyword','--문구':'message','--자료URL':'url','--자료ID':'fileId',
 '--자료원본':'materialFile','--자료폴더':'folderId','--자료함':'libraryRoot','--종료':'endsAt','--상시':'evergreen','--공개안내':'publicReply','--FAQ':'faqFile'};
 const o={};for(let i=0;i<args.length;i++){const k=names[args[i]];if(!k||Object.hasOwn(o,k))throw Error('인자를 확인해 주세요.');o[k]=k==='evergreen'?true:args[++i];}
 if(!o.file)throw Error('--원고 경로가 필요합니다.');return configure(path.resolve(o.file),o);
}
if(require.main===module){try{console.log(JSON.stringify(main(process.argv.slice(2))));}catch{console.error('DM 준비 실패: 원고·자료·인자를 확인해 주세요.');process.exitCode=1;}}
module.exports={configure,main};
