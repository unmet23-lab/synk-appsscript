'use strict';
const path=require('node:path');
const TEACHER=Object.freeze({id:'teacher',name:'WORLD · 교사',appId:'im.synk.teacher.preview',sessionScope:'im.synk.teacher.preview',entry:'http://127.0.0.1:4290/'});
function teacherPreviewAvailable({packaged,mode,clientId}){return packaged===false&&mode==='development'&&clientId==='platform';}
function createTeacherPreview({packaged,mode,clientId,executable,appRoot,spawn}){
  let pending=null;
  return {
    available:()=>teacherPreviewAvailable({packaged,mode,clientId}),
    open(){
      if(!teacherPreviewAvailable({packaged,mode,clientId}))return Promise.resolve({ok:false,code:'PREVIEW_DEVELOPMENT_ONLY'});
      if(pending)return pending;
      pending=(async()=>{try{
        await new Promise((resolve,reject)=>{const child=spawn(executable,[path.join(appRoot,'src','classroom-main.cjs'),'--synk-classroom-preview'],{shell:false,detached:true,stdio:'ignore',windowsHide:true});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
        return {ok:true,preview:true,separateClient:true};
      }catch{return {ok:false,code:'PREVIEW_LAUNCH_FAILED'};}finally{pending=null;}})();
      return pending;
    },
  };
}
function teacherDocument(value){try{const u=new URL(value);return u.origin===new URL(TEACHER.entry).origin&&!u.username&&!u.password&&!u.search&&['/','/index.html'].includes(u.pathname);}catch{return false;}}
function teacherNavigation(value){if(teacherDocument(value))return true;try{const u=new URL(value);return u.origin===new URL(TEACHER.entry).origin&&!u.username&&!u.password&&['/student','/student.html'].includes(u.pathname)&&[...u.searchParams.keys()].every(k=>k==='learner')&&u.searchParams.getAll('learner').length<=1&&(!u.searchParams.has('learner')||/^[a-zA-Z0-9_-]{1,120}$/.test(u.searchParams.get('learner')));}catch{return false;}}
function teacherResource(value){try{const u=new URL(value);return u.origin===new URL(TEACHER.entry).origin&&!u.username&&!u.password;}catch{return false;}}
function teacherPolicy(){return "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";}
function assertTeacherSender(event,window){if(!window||window.isDestroyed()||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!teacherDocument(event.senderFrame?.url))throw Error('UNTRUSTED_SENDER');}
module.exports={TEACHER,teacherPreviewAvailable,createTeacherPreview,teacherNavigation,teacherResource,teacherPolicy,assertTeacherSender,teacherDocument};
