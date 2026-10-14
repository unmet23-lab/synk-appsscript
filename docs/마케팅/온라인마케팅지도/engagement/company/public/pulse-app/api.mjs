export class PulseError extends Error {
  constructor(message,status=0){super(message);this.name='PulseError';this.status=status;}
}
export async function request(path,{body,csrf='',staff=false,file,headers={},signal,method}={}){
  if(!path.startsWith('/pulse/api/')&&!path.startsWith('/api/'))throw new PulseError('요청 주소를 확인해 주세요.');
  let response;
  try{response=await fetch(path,{method:method||(body!==undefined||file?'POST':'GET'),credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',signal,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(csrf?{[staff?'X-CSRF-Token':'X-Pulse-CSRF']:csrf}:{}),...headers},body:file|| (body!==undefined?JSON.stringify(body):undefined)});}
  catch(error){if(error.name==='AbortError')throw error;throw new PulseError('연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');}
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new PulseError(typeof result.error==='string'?result.error:result.error?.message||'요청을 저장하지 못했어요. 다시 시도해 주세요.',response.status);
  return result;
}
export function parseInvite(value){
  const text=String(value||'').trim();if(/^[A-Za-z0-9_-]{16,500}$/.test(text))return text;
  try{const url=new URL(text);if(!['https:','http:'].includes(url.protocol))return '';const token=new URLSearchParams(url.hash.slice(1)).get('invite');return /^[A-Za-z0-9_-]{16,500}$/.test(token||'')?token:'';}catch{return '';}
}
export function safeUrl(value,{media=false}={}){
  if(typeof value!=='string'||!value||/[\u0000-\u0020]/.test(value))return '';
  try{const url=new URL(value,location.origin);if(url.username||url.password)return '';if(url.origin===location.origin&&['http:','https:'].includes(url.protocol))return url.href;if(!media&&url.protocol==='https:')return url.href;return '';}catch{return '';}
}
export const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// 날짜는 「10월 13일 오전 8:54」처럼 읽는 말로 쓴다. 올해가 아니면 연도를 붙인다(2026-10-13 글자 2판).
export const stamp=value=>{const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';const year=date.getFullYear()!==new Date().getFullYear();return new Intl.DateTimeFormat('ko-KR',{...(year?{year:'numeric'}:{}),month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date);};
// 날짜만 있는 값(YYYY-MM-DD)은 「10월 31일 (금)」. 형식이 다르면 받은 글자를 그대로 둔다.
export const day=value=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));if(!m)return String(value||'');const date=new Date(+m[1],+m[2]-1,+m[3]);if(date.getMonth()!==+m[2]-1)return String(value);const week='일월화수목금토'[date.getDay()];return (date.getFullYear()!==new Date().getFullYear()?date.getFullYear()+'년 ':'')+(date.getMonth()+1)+'월 '+date.getDate()+'일 ('+week+')';};
export const keepDots=html=>String(html).replace(/([^\s<>]+·[^\s<>]+)/g,'<span class="nw">$1</span>');
export const clock=value=>{const time=Math.max(0,Number(value)||0);return Math.floor(time/60)+':'+String(Math.floor(time%60)).padStart(2,'0');};
