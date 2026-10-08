'use strict';
const text=(v,n)=>typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=n&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{10,200}$/.test(v);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>keys.includes(k));
const urlText=v=>/(?:[a-z][a-z0-9+.-]*:\/\/|www\.|\b[a-z0-9-]+\.[a-z]{2,}(?:\b|\/))/i.test(v);
const privateText=v=>/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(v)
 ||/\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/.test(v)||/\b\d{6}[ -]?[1-8]\d{6}\b/.test(v)
 ||/(?:비밀번호|password|api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+/i.test(v)
 ||/(?:ya29\.|GOCSPX-|-----BEGIN .*PRIVATE KEY-----)/.test(v);
const faqCopy=v=>text(v,600)&&Buffer.byteLength(v)<=600&&!urlText(v)&&!privateText(v)&&!/[\u202a-\u202e\u2066-\u2069]/.test(v);
function validFaq(config){
 if(!exact(config,['version','faqs']))return false;
 if(Object.keys(config).length===0)return true;
 if(config.version!==1||!Array.isArray(config.faqs)||config.faqs.length>20)return false;
 const ids=new Set(),questions=new Set();
 return config.faqs.every(f=>{
  if(!exact(f,['id','questions','answer'])||typeof f.id!=='string'||!(/^[a-z0-9_-]{1,40}$/).test(f.id)||ids.has(f.id)
   ||!Array.isArray(f.questions)||f.questions.length<1||f.questions.length>12||!faqCopy(f.answer))return false;
  ids.add(f.id);return f.questions.every(q=>{
   if(!faqCopy(q)||Array.from(q).length<2||Array.from(q).length>120)return false;
   const k=q.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();if(questions.has(k))return false;questions.add(k);return true;
  });
 });
}
function normalizeDm(raw){
 if(raw===undefined||raw===null)return null;
 if(!exact(raw,['campaign_id','account_id','title','keyword','message','duration_mode','ends_at','resource','public_reply_text','conversation_config'])
  ||typeof raw.account_id!=='string'||!/^\d{5,30}$/.test(raw.account_id)||!text(raw.title,120)||/[\r\n]/.test(raw.title)||!text(raw.message,800)
  ||typeof raw.keyword!=='string'||!/^[a-z0-9가-힣_-]{1,30}$/i.test(raw.keyword)||!['fixed','evergreen'].includes(raw.duration_mode)
  ||(raw.duration_mode==='evergreen'?raw.ends_at!==null:typeof raw.ends_at!=='string'||!Number.isFinite(Date.parse(raw.ends_at)))
  ||(raw.campaign_id!==undefined&&(typeof raw.campaign_id!=='string'||!/^[a-z0-9_-]{1,64}$/.test(raw.campaign_id))))throw Error('DM 자료 설정이 올바르지 않습니다.');
 if(raw.duration_mode==='fixed'&&(new Date(raw.ends_at).toISOString()!==raw.ends_at||Date.parse(raw.ends_at)<=Date.now()||Date.parse(raw.ends_at)>Date.now()+30*86400000))
  throw Error('DM 종료일은 지금부터 30일 이내의 UTC 시각이어야 합니다.');
 const r=raw.resource;
 if(!exact(r,['kind','url','file_id','sha256','folder_id','library_root'])||!id(r.folder_id)||!id(r.library_root)||r.folder_id===r.library_root)
  throw Error('DM 자료 폴더가 올바르지 않습니다.');
 if(r.kind==='drive'){
  if(!id(r.file_id)||!/^[a-f0-9]{64}$/.test(r.sha256||'')||r.url!==undefined)throw Error('Drive 자료 ID와 승인한 파일 지문이 필요합니다.');
 }else if(r.kind==='url'){
  let u;try{if(typeof r.url!=='string')throw Error();u=new URL(r.url);}catch{throw Error('DM 프로그램 URL이 올바르지 않습니다.');}
  if(u.protocol!=='https:'||u.username||u.password||u.hash||(u.port&&u.port!=='443')||/\s/.test(r.url)||r.url.length>1000
   ||!u.hostname.includes('.')||u.hostname.endsWith('.local')||u.hostname.endsWith('.localhost')||u.hostname.startsWith('[')
   ||['drive.google.com','docs.google.com'].includes(u.hostname)||/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(u.hostname)
   ||r.file_id!==undefined||r.sha256!==undefined)throw Error('DM 프로그램 URL이 올바르지 않습니다.');
 }else throw Error('DM 자료는 drive 또는 url이어야 합니다.');
 if(raw.public_reply_text!=null&&(!text(raw.public_reply_text,500)||Buffer.byteLength(raw.public_reply_text)>500||urlText(raw.public_reply_text)))throw Error('공개 댓글 안내 문구가 올바르지 않습니다.');
 if(raw.conversation_config!==undefined&&(!validFaq(raw.conversation_config)||JSON.stringify(raw.conversation_config).length>8000))throw Error('DM FAQ 설정이 올바르지 않습니다.');
 return JSON.parse(JSON.stringify(raw));
}
function instagramUrl(value){
 const match=/^https:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]{1,100})\/$/.exec(value||'');
 if(!match)throw Error('실제 Instagram 게시물의 HTTPS 주소가 필요합니다.');
 return 'https://www.instagram.com/p/'+match[1]+'/';
}
module.exports={normalizeDm,instagramUrl};
