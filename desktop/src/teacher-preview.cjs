'use strict';
const path=require('node:path');
const TEACHER=Object.freeze({id:'teacher',name:'SYNK Workspace · 내 수업',appId:'im.synk.teacher.preview',sessionScope:'im.synk.teacher.preview',entry:'http://127.0.0.1:4280/synk-account/teacher.html'});
function teacherPreviewAvailable({packaged,mode,clientId}){return packaged===false&&mode==='development'&&clientId==='platform';}
function createTeacherPreview({packaged,mode,clientId,executable,appRoot,spawn,authConfigPath}){
  let pending=null;
  return {
    available:()=>teacherPreviewAvailable({packaged,mode,clientId}),
    open(){
      if(!teacherPreviewAvailable({packaged,mode,clientId}))return Promise.resolve({ok:false,code:'PREVIEW_DEVELOPMENT_ONLY'});
      if(pending)return pending;
      pending=(async()=>{try{
        const args=[path.join(appRoot,'src','main.cjs'),'--synk-dev','--client=messenger','--view=teaching'];
        if(authConfigPath)args.push('--auth-config='+path.resolve(authConfigPath));
        await new Promise((resolve,reject)=>{const child=spawn(executable,args,{shell:false,detached:true,stdio:'ignore',windowsHide:true});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
        return {ok:true,preview:true,separateClient:false,clientId:'messenger',view:'teaching'};
      }catch{return {ok:false,code:'PREVIEW_LAUNCH_FAILED'};}finally{pending=null;}})();
      return pending;
    },
  };
}
function teacherDocument(value,entry=TEACHER.entry){try{const u=new URL(value),base=new URL(entry);return u.origin===base.origin&&!u.username&&!u.password&&!u.search&&u.pathname===base.pathname;}catch{return false;}}
function teacherNavigation(value,entry=TEACHER.entry){return teacherDocument(value,entry);}
function teacherFrame(value,entry=TEACHER.entry){try{const u=new URL(value),base=new URL(entry);return u.origin===base.origin&&!u.username&&!u.password&&['/teacher-world/','/teacher-world/index.html'].includes(u.pathname)&&u.searchParams.size===1&&u.searchParams.get('account')==='1';}catch{return false;}}
function teacherResource(value,entry=TEACHER.entry){try{const u=new URL(value);return u.origin===new URL(entry).origin&&!u.username&&!u.password&&!u.pathname.startsWith('/api/');}catch{return false;}}
function teacherPolicy(resourceType){return "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; frame-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors "+(resourceType==='subFrame'?"'self'":"'none'");}
function assertTeacherSender(event,window,entry=TEACHER.entry){if(!window||window.isDestroyed()||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!teacherDocument(event.senderFrame?.url,entry))throw Error('UNTRUSTED_SENDER');}
module.exports={TEACHER,teacherPreviewAvailable,createTeacherPreview,teacherNavigation,teacherResource,teacherFrame,teacherPolicy,assertTeacherSender,teacherDocument};
