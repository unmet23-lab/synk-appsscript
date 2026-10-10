import {mountBrandOpening} from './opening.mjs';
const query=new URLSearchParams(location.search);
const opening=mountBrandOpening({replay:true,companyOnly:query.get('company')==='1',onEnter:reason=>{
  if(query.get('company')!=='1'&&['start','skip','unavailable'].includes(reason)){location.assign(new URL('home.html?welcome=1',location.href));return;}
  document.querySelector('#preview-state').textContent=reason==='company-end'?'회사 오프닝 시안이 끝났어요. 소리는 후보이며 아직 채택되지 않았어요.':'오프닝 시안이 끝났어요.';
  const again=document.createElement('a');again.href=location.href;again.textContent='다시 보기';const line=document.createElement('p');line.append(again);document.querySelector('main').append(line);
}});
window.__synkOpening=opening;
