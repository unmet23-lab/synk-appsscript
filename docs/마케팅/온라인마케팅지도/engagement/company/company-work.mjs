import {randomUUID} from 'node:crypto';
import {requireWorkspaceFeature,workspaceAccess} from './workspace-access.mjs';

const definitions={PATH:{feature:'path',title:'상담·정착 업무'},SHIFT:{feature:'lectures',title:'강의'}};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function createCompanyWork({store,clock=()=>new Date().toISOString()}){
  function current(actor,company,write=false){
    const definition=definitions[company],user=actor&&store.get('users',actor.id);
    if(!definition)throw fail('업무 공간을 찾지 못했어요.',404);
    requireWorkspaceFeature(user,definition.feature);
    if(write&&user.role==='viewer')throw fail('보기 전용 계정이에요.',403);
    return user;
  }
  const manager=(user,company)=>user.role==='admin'||workspaceAccess(user).memberships.some(row=>row.company===company&&row.role==='manager');
  const allowed=(user,row)=>row.ownerId===user.id||manager(user,row.company);
  function workspace(actor,company){
    const user=current(actor,company);
    return {company,title:definitions[company].title,canWrite:user.role!=='viewer',items:store.all('companyWork').filter(row=>row.company===company&&allowed(user,row)).sort((a,b)=>Number(a.status==='done')-Number(b.status==='done')||(a.date||'9999').localeCompare(b.date||'9999')||b.updatedAt.localeCompare(a.updatedAt)).map(row=>({...row,ownerName:store.get('users',row.ownerId)?.name||'담당자'}))};
  }
  function save(actor,company,id,input){
    return store.transaction(()=>{
      const user=current(actor,company,true),before=id?store.get('companyWork',id):null;
      if(!input||typeof input!=='object'||Array.isArray(input))throw fail('제목·일정·진행 상태를 확인해 주세요.');
      if(id&&(!before||before.company!==company||!allowed(user,before)))throw fail('이 업무를 수정할 수 없어요.',403);
      if(before&&input.revision!==before.revision)throw fail('그사이 업무가 바뀌었어요. 새로 불러와 주세요.',409);
      const title=typeof input.title==='string'?input.title.trim():'',note=input.note===undefined?(before?.note??''):input.note,date=input.date===undefined?(before?.date??''):input.date,status=input.status===undefined?(before?.status??'open'):input.status;
      if(!title||title.length>160||typeof note!=='string'||note.length>2000||!['open','done'].includes(status)||typeof date!=='string'||date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw fail('제목·일정·진행 상태를 확인해 주세요.');
      const at=clock(),row={id:before?.id||randomUUID(),company,ownerId:before?.ownerId||user.id,title,note:note.trim(),date,status,revision:(before?.revision||0)+1,createdAt:before?.createdAt||at,updatedAt:at};
      store.put('companyWork',row.id,row);
      const auditId=randomUUID();store.put('audit',auditId,{id:auditId,userId:user.id,action:before?'company-work-updated':'company-work-created',subject:row.id,company,at});
      return {item:row};
    });
  }
  return {workspace,save};
}
