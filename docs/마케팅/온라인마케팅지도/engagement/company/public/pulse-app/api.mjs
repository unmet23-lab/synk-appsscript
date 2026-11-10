export class PulseError extends Error {
  constructor(message,status=0,code=''){super(message);this.name='PulseError';this.status=status;if(code)this.code=code;}
}
// 서버 오류 문장(다국어 판 1 · 11-09, 기획 12-2 「서버 오류」): 한국어 화면은 받은 문장 그대로다. 다른 언어는 손님 글이 끼는 동적 문장을
// 코드로(서버 pulse-requests.mjs의 SYNK_PULSE_…), 고정 문장은 그 한국어 문장을 키로 번역한다. 사전에 없으면 한국어 원문이 나온다.
// 의견 · 문의 글(client-projects customerAction — 칸 이름이 끼는 서버 문장)은 손님이 보낸 글 하나를 가리키는 고정 문장으로 옮긴다(판 2).
export const ERROR_CODE_TEXT=Object.freeze({SYNK_PULSE_FILE_MISSING:k('올린 파일 하나를 찾지 못했어요. 지우고 다시 올려 주세요.'),SYNK_PULSE_INVALID_MESSAGE:k('보내실 글을 확인해 주세요. 3,000자까지 보낼 수 있어요.'),SYNK_PULSE_REQUIRED_MESSAGE:k('보내실 글을 적어 주세요.'),SYNK_PULSE_PERSONA_STALE:k('새 판이 도착했어요. 새 판을 보고 다시 확인해 주세요.'),
  // 판 4 내 모델 · 다시 쓰기(pulse-workspaces.mjs). 직원 길 code(연결 요청 · 동의 범위 · 참조)도 표에 둔다 — 서버가 SYNK_ code를 그대로 내리기 때문이다(직원 화면은 한국어 문장 그대로).
  SYNK_PULSE_PROOF:k('확인 시간이 지났거나 맞지 않아요. 화면에서 다시 시도해 주세요.'),SYNK_PULSE_ATTACH_STALE:k('내 모델에서 다시 골라 주세요. 로그인이 필요할 수 있어요.'),SYNK_PULSE_MODEL_UNUSABLE:k('지금은 이 모델로 의뢰할 수 없어요. 내 모델에서 상태를 확인해 주세요.'),
  SYNK_PULSE_MODEL_PAUSED:k('사용 중지된 모델이에요. 담당자가 중지를 먼저 풀고, 그 뒤 보관 동의를 새로 하셔야 다시 써요.'),SYNK_PULSE_REUSE_UNAVAILABLE:k('지금은 이 모델의 보관을 정할 수 없어요. 내 모델을 새로 불러와 주세요.'),SYNK_PULSE_REUSE_STALE:k('보관 조건이 바뀌었어요. 새 조건을 보고 다시 확인해 주세요.'),
  SYNK_PULSE_CLAIM_STALE:k('손님이 다시 요청해야 해요. 초대 링크가 바뀌었거나 닫힌 프로젝트예요.'),SYNK_PULSE_CONSENT_SCOPE:k('당사자 동의 범위 밖이에요. 새 당사자 동의를 받은 뒤 확인해 주세요.'),SYNK_PULSE_PERSONA_REFERENCED:k('이 인물을 쓰는 끝나지 않은 프로젝트나 의뢰가 있어요. 그 일을 먼저 끝내거나 정리해 주세요.')});
export const errorText=(message,code='')=>locale()==='ko'?message:Object.hasOwn(ERROR_CODE_TEXT,code)?t(ERROR_CODE_TEXT[code]):t(message);
export const serverError=(result,status,fallback)=>{const message=typeof result?.error==='string'?result.error:result?.error?.message||fallback,code=typeof result?.code==='string'?result.code:'';return new PulseError(errorText(message,code),status,code);};
// member(판 4): 고객 SYNK ID 회원 경로(/api/customer/*)는 직원 경로처럼 X-CSRF-Token을 쓴다. 보관 조건이 바뀐 409(SYNK_PULSE_REUSE_STALE)는 새 조건(offer)을 오류에 싣는다.
export async function request(path,{body,csrf='',staff=false,member=false,file,headers={},signal,method}={}){
  if(!path.startsWith('/pulse/api/')&&!path.startsWith('/api/'))throw new PulseError(t('요청 주소를 확인해 주세요.'));
  let response;
  try{response=await fetch(path,{method:method||(body!==undefined||file?'POST':'GET'),credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',signal,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(csrf?{[staff||member?'X-CSRF-Token':'X-Pulse-CSRF']:csrf}:{}),...headers},body:file|| (body!==undefined?JSON.stringify(body):undefined)});}
  catch(error){if(error.name==='AbortError')throw error;throw new PulseError(t('연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'));}
  const result=await response.json().catch(()=>({}));
  // 서버가 문장을 주지 않았을 때의 대신 글은 serverError(errorText)가 지금 언어로 옮긴다.
  if(!response.ok){const error=serverError(result,response.status,k('요청을 저장하지 못했어요. 다시 시도해 주세요.'));if(result?.offer&&typeof result.offer==='object')error.offer=result.offer;throw error;}
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
import {t,k,locale,intlLocale} from './i18n.mjs';
export const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// 날짜는 「10월 13일 오전 8:54」처럼 읽는 말로 쓴다. 올해가 아니면 연도를 붙인다(2026-10-13 글자 2판).
// 영어 화면은 같은 내용을 그 언어의 꼴로(「Nov 13, 8:54 AM」).
export const stamp=value=>{const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';const year=date.getFullYear()!==new Date().getFullYear();return new Intl.DateTimeFormat(intlLocale(locale()),{...(year?{year:'numeric'}:{}),month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}).format(date);};
// 날짜만 있는 값(YYYY-MM-DD)은 「10월 31일 (금)」. 형식이 다르면 받은 글자를 그대로 둔다. 한국어 꼴의 글자(요일 · 년 · 월 · 일)는 번역할 문장이 아니다 — 다른 언어는 같은 줄의 Intl 갈래.
export const day=value=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));if(!m)return String(value||'');const date=new Date(+m[1],+m[2]-1,+m[3]);if(date.getMonth()!==+m[2]-1)return String(value);if(locale()!=='ko')return new Intl.DateTimeFormat(intlLocale(locale()),{...(date.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{}),month:'short',day:'numeric',weekday:'short'}).format(date);const week='일월화수목금토'[date.getDay()];return (date.getFullYear()!==new Date().getFullYear()?date.getFullYear()+'년 ':'')+(date.getMonth()+1)+'월 '+date.getDate()+'일 ('+week+')';}; // i18n-skip
export const keepDots=html=>String(html).replace(/([^\s<>]+·[^\s<>]+)/g,'<span class="nw">$1</span>');
export const clock=value=>{const time=Math.max(0,Number(value)||0);return Math.floor(time/60)+':'+String(Math.floor(time%60)).padStart(2,'0');};
