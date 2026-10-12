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
export const stamp=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(date):'';};
export const clock=value=>{const time=Math.max(0,Number(value)||0);return Math.floor(time/60)+':'+String(Math.floor(time%60)).padStart(2,'0');};
