import {mountCourseWriting} from '../teacher-world/course-writing-ui.mjs';
// Class IDs come from the authenticated roster, never from URL/local storage.
export function mountCourseWritingEntry({container,transport,guard=()=>{}}){
 const doc=container.ownerDocument,root=doc.createElement('section'),label=doc.createElement('label'),select=doc.createElement('select'),body=doc.createElement('div'),status=doc.createElement('p');
 root.className='ws-class';label.textContent='과제를 볼 수업 ';label.append(select);root.append(label,status,body);container.append(root);
 let stopped=false,epoch=0,view=null,classes=[],selected='';
 const check=version=>{guard();if(stopped||version!==epoch)throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});};
 const paths={'/api/course':'courseRead','/api/course/submit':'courseSubmit','/api/course/group-sharing':'courseGroupSharing'};
 function choose(){if(view?.hasDraft()&&!doc.defaultView?.confirm('작성 중인 글을 닫고 다른 반 과제를 열까요?')){select.value=selected;return;}view?.dispose();view=null;const version=++epoch,classId=select.value;selected=classId;if(!classes.some(c=>c.id===classId))return;
  view=mountCourseWriting({root:body,guard:()=>check(version),request:(path,payload)=>{check(version);if(!paths[path])throw Error('FORBIDDEN');return transport(paths[path],{classId,...(payload===undefined?{}:{body:payload})}).then(r=>{check(version);return r;});}});void view.reload();
 }
 select.onchange=choose;
 const version=epoch;
 void transport('classes').then(async result=>{check(version);const mine=result.classes.filter(c=>c.role==='learner');
  const active=await Promise.all(mine.map(async c=>{try{const view=await transport('courseRead',{classId:c.id});check(version);return view.tasks?.length?c:null;}catch(error){if(['NOT_FOUND','COURSE_UNAVAILABLE'].includes(error.code))return null;throw error;}}));check(version);classes=active.filter(Boolean);if(!classes.length){root.hidden=true;return;}
  for(const row of classes){const option=doc.createElement('option');option.value=row.id;option.textContent=row.name;select.append(option);}choose();
 }).catch(error=>{if(!stopped&&error.code!=='ACCOUNT_CHANGED')status.textContent='과제 연결을 확인하지 못했어요. 계정을 다시 열어 주세요.';});
 return {hasDraft:()=>!!view?.hasDraft(),dispose(){stopped=true;epoch++;view?.dispose();view=null;root.remove();}};
}
