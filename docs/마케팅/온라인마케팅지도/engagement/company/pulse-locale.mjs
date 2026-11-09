// 서버가 만드는 손님 문구의 언어(다국어 판 2 · 기획 12-2 「서버가 만드는 문구」).
// 알림 제목 · 본문, 단계 이름, 메일은 저장하지 않고 보기 · 메일 조립 때 프로젝트 언어를 입힌다(저장값은 늘 한국어).
// 화면 사전(public/pulse-app/i18n/en.mjs)과 따로 둔다 — 서버 문구는 서버 코드와 같은 판(회사 이미지)으로만 바뀌고, 화면 사전은 화면 묶음으로 바뀐다.
// 키는 한국어 문장 그대로이고 한국어는 받은 문장을 그대로 돌려준다(바이트 그대로). 자리표는 이름 있는 {name}만.
import {translateWith,DEFAULT_LOCALE} from './public/pulse-app/i18n.mjs';
import {projectLocaleOf} from './pulse-features.mjs';

const EN=Object.freeze({
  // 알림 제목(손님) — client-notifications.mjs titles · clientNotificationTitle
  '몇 가지만 더 여쭤봐요':'A few quick questions',
  '모델을 확인해 주세요':'Please confirm the model',
  '방향 제안이 도착했어요':'Your direction proposal is here',
  '1차안이 도착했어요':'Your first draft is here',
  '새 시안이 왔어요':'A new preview is ready',
  '최종본이 왔어요':'Your final film is here',
  '제작팀이 답했어요':'Your producer replied',
  '문의에 자동 안내가 왔어요':'An automatic reply came in',
  '제작 설계를 확인해 주세요':'Please review the production plan',
  '콘셉트가 바뀌었어요':'A concept was updated',
  '장면 구성이 바뀌었어요':'The scene lineup changed',
  '참고 자료가 바뀌었어요':'References were updated',
  '납품 규격을 확인해 주세요':'Please review the delivery specs',
  '보낸 의견의 수정 범위와 일정이 정리됐어요':'The scope and schedule for your notes are set',
  '준비할 자료에 새 소식이 있어요':'An update on the materials to prepare',
  '고친 장면을 확인해 주세요':'Please check the revised scene',
  '수정본 검토가 끝났어요. 시안을 확인해 주세요':'The revised version has been checked. Please take a look at the preview',
  '새 콘셉트가 도착했어요':'A new concept is here',
  '새 장면이 도착했어요':'A new scene is here',
  '장면이 바뀌었어요':'A scene was updated',
  '프로젝트가 바뀌었어요':'Your project was updated',
  // 앱 안 알림함에서 묶은 제목 — pulse-live.mjs groupedTitle
  '참고 자료가 바뀌었어요 · {count}건':{one:'References were updated · {count} change',other:'References were updated · {count} changes'},
  '새 콘셉트 {count}개가 도착했어요':{one:'{count} new concept is here',other:'{count} new concepts are here'},
  '콘셉트 {count}개가 바뀌었어요':{one:'{count} concept was updated',other:'{count} concepts were updated'},
  '새 콘셉트 {fresh}개 · 바뀐 콘셉트 {changed}개':'{fresh} new · {changed} updated concepts',
  '새 장면 {count}개가 도착했어요':{one:'{count} new scene is here',other:'{count} new scenes are here'},
  '장면 {count}개가 바뀌었어요':{one:'{count} scene was updated',other:'{count} scenes were updated'},
  '새 장면 {fresh}개 · 바뀐 장면 {changed}개':'{fresh} new · {changed} updated scenes',
  // 알림 본문 — pulse-live.mjs customerBodies · genericBody
  '프로젝트를 열어 새 내용과 다음 할 일을 확인해 주세요.':'Open your project to see what’s new and what comes next.',
  '아래 칸만 답해 주시면 바로 1차안을 만들어요.':'Fill in the fields below and we’ll start the first draft right away.',
  '장면을 만들기 전에 모델을 확인해 주세요.':'Please confirm the model before we build any scenes.',
  '요청하신 내용은 그대로 두고 방향을 나눠 보내 드렸어요. 하나를 고르시면 글 콘티를 만들어 드려요.':'Everything you asked for stays. We’ve sent a few directions — pick one and we’ll write the script.',
  '컷마다 보고 의견을 남기거나, 괜찮으면 다음 단계로 넘겨 주세요.':'Look through each shot and leave notes, or move on to the next step if it all works.',
  '영상을 재생해 보고, 바꾸고 싶은 장면에 의견을 남기거나 승인해 주세요.':'Play the film, then leave a note on any scene you’d change — or approve it.',
  '최종 파일을 받아 보고 사용 안내를 확인한 뒤 수령 확인을 남겨 주세요.':'Download the final files, read the usage notes, then confirm receipt.',
  '보낸 의견이나 문의에 대한 답을 확인해 주세요.':'There’s a reply to your note or question.',
  '남긴 문의에 자동 안내가 먼저 답했어요. 담당자도 이어서 확인해요.':'An automatic reply answered your question first. Your producer will follow up too.',
  '메시지·근거·행동을 살펴보고, 이대로 진행해도 되면 확인을 남겨 주세요.':'Review the message, the proof and the call to action, and confirm if we can go ahead.',
  '받을 파일 목록과 규격을 살펴보고 확인을 남겨 주세요.':'Review the list of files and specs you’ll receive, then confirm.',
  '콘셉트를 나란히 비교하고 마음에 가까운 방향을 골라 주세요.':'Compare the concepts side by side and pick the one closest to what you want.',
  '장면의 흐름과 문구를 확인하고, 바꾸고 싶은 곳이 있으면 의견을 남겨 주세요.':'Check the flow and wording of the scenes, and leave a note on anything you’d change.',
  '제작팀이 정리한 참고 자료를 확인해 주세요.':'Take a look at the references your producer put together.',
  '보낸 의견을 어떻게 반영할지와 일정 안내를 확인해 주세요.':'See how your notes will be handled, and when.',
  '제작을 시작하기 전에 준비할 자료를 확인해 주세요.':'Check the materials to prepare before production starts.',
  '고친 장면을 보고 확인을 남겨 주세요.':'Look at the revised scene and confirm it.',
  '이 시안을 기준으로 최종 제작을 승인할 수 있어요.':'You can approve final production based on this preview.',
  // 단계 이름 — client-projects.mjs CLIENT_STAGES(손님 보기의 stageLabel)
  '접수':'Received','협의':'In discussion','제작':'In production','고객 확인':'Your review','납품':'Delivered','보관':'Archived',
  // 기본 다음 할 일(client-projects.mjs가 저장하는 문장 — 손님 보기에서만 옮긴다)
  '승인 감사해요. 이제 최종본과 사용 안내를 준비할게요.':'Thanks for approving. We’re now preparing the final film and usage notes.',
  '최종본과 사용 안내를 보내 드렸어요. 궁금한 점은 후속 문의에 남겨 주세요.':'We’ve sent the final film and usage notes. Send any questions as a follow-up message.',
  '새 시안을 보시고 의견이나 승인을 남겨 주세요.':'Take a look at the new preview and leave notes or approve it.',
  '접수 내용을 보고 일정과 범위를 고객과 정해요.':'We’ll review your request and agree on timing and scope with you.',
  // 담당자 이름(영문 표시 이름이 없을 때)
  'PULSE 담당자':'Your producer',
  // 다른 직원(담당자가 아닌 사람)이 쓴 글의 작성자 — 영문 이름이 없으면 사람 이름을 지어내지 않고 팀으로(GPT GA1)
  'PULSE 팀':'PULSE team',
  // 메일 — pulse-mail.mjs pulseMailCompose
  '{product} 광고':'Your {product} ad',
  '요청하신 광고':'Your ad',
  '{title}, 방향을 골라 주세요':'{title}: choose a direction',
  '요청하신 내용은 그대로 두고, 무엇으로 기억에 남길지만 방향을 나눠 보내 드렸어요. 하나를 고르시면 글 콘티를 만들어 드려요.':'Everything you asked for stays. The directions only differ in how the ad will be remembered. Pick one and we’ll write the script.',
  '{title} 글 콘티가 왔어요':'{title}: the script is here',
  '장면마다 무엇을 보여 주고 어떤 말을 할지 글로 먼저 정리했어요. 컷마다 의견을 남기시거나, 괜찮으면 다음 단계로 넘겨 주세요.':'We’ve written out what each scene shows and says. Leave notes on any shot, or move on to the next step if it works.',
  '{title} 사진을 확인해 주세요':'{title}: the photos are ready for review',
  '{title} 영상을 확인해 주세요':'{title}: the film is ready for review',
  '사진을 보시고, 바꾸고 싶은 곳에 의견을 남기시거나 승인해 주세요.':'Look through the photos, then leave a note on anything you’d change — or approve them.',
  '영상을 재생해 보시고, 바꾸고 싶은 장면에 의견을 남기시거나 승인해 주세요.':'Play the film, then leave a note on any scene you’d change — or approve it.',
  '{title} 최종 파일이 준비됐어요':'{title}: the final files are ready',
  '최종 파일을 받아 보시고 사용 안내를 확인한 뒤 수령 확인을 남겨 주세요.':'Download the final files, read the usage notes, then confirm receipt.',
  '〔SYNK PULSE〕 {subject}':'[SYNK PULSE] {subject}',
  '{who}님, SYNK PULSE입니다.':'Hi {who}, this is SYNK PULSE.',
  '안녕하세요, SYNK PULSE입니다.':'Hello, this is SYNK PULSE.',
  'PULSE 앱에서 확인해 주세요: {url}':'Open it in the PULSE app: {url}',
  '이 기기를 기억해 두셨다면 바로 열려요. 처음 받으신 프로젝트 링크로도 열 수 있어요.':'If you asked us to remember this device, it opens right away. Your original project link works too.',
  '이 메일은 보내 주신 의뢰의 진행 알림이에요. 궁금한 점은 이 메일에 답장해 주세요.':'This is a progress update on your brief. Just reply to this email with any questions.',
});
export const SERVER_DICTIONARIES=Object.freeze({en:EN});
// 서버 문구를 그 언어로. 사전에 없거나 한국어면 원문.
export const serverText=(loc,text,vars)=>loc&&loc!==DEFAULT_LOCALE?translateWith(SERVER_DICTIONARIES[loc],loc,text,vars):translateWith(null,DEFAULT_LOCALE,text,vars);
// 프로젝트의 소통 언어(메일 · 알림 · 손님 보기): 스위치가 허락한 contactLocale, 아니면 한국어. features는 pulse-features.mjs의 서비스.
export function createProjectLocale(features){
  return row=>{
    if(!features||!row)return DEFAULT_LOCALE;
    try{return projectLocaleOf(features.read(),row?.studio?.request?.answers);}catch{return DEFAULT_LOCALE;}
  };
}
// 손님 화면에 보일 담당자 이름: 한국어는 저장된 이름, 다른 언어는 영문 표시 이름(users.nameEn — 유호님이 정하면 넣는다), 없으면 「Your producer」.
export function staffDisplayName(loc,user,fallback){
  if(!loc||loc===DEFAULT_LOCALE)return fallback;
  const english=typeof user?.nameEn==='string'?user.nameEn.trim():'';
  return english&&english.length<=60?english:serverText(loc,'PULSE 담당자');
}
// 직원 글의 작성자 이름(글마다 저장된 한국어 이름) → 손님 언어의 표시 이름(GPT GA1 — 담당자 이름으로 모두 덮으면 관리자 · 옛 담당자의 글이 지금 담당자가 쓴 것처럼 보인다).
// 글에는 이름만 남아 있으므로, 그 이름이 직원 한 사람만 가리킬 때만 그 사람으로 본다 — 지금 담당자면 담당자 표시 이름, 다른 직원이면 그 사람의 영문 이름.
// 이름이 겹치거나(같은 한국어 이름의 직원이 둘 이상), 그 이름의 직원이 없거나, 영문 이름이 없는 다른 직원이면 사람 이름을 짓지 않고 「PULSE team」. 한국어면 저장된 이름 그대로.
export function createStaffNames(loc,{owner=null,users=[]}={}){
  const producer=staffDisplayName(loc,owner,owner?.name),team=()=>serverText(loc,'PULSE 팀');
  let byName=null;
  return name=>{
    if(!loc||loc===DEFAULT_LOCALE||typeof name!=='string'||!name)return name;
    if(!byName){
      byName=new Map();const seen=new Set();
      for(const user of [...(owner?[owner]:[]),...users]){if(typeof user?.name!=='string'||!user.name)continue;const key=user.id??user;if(seen.has(key))continue;seen.add(key);const entry=byName.get(user.name);byName.set(user.name,entry?{count:entry.count+1,user:null}:{count:1,user});}
    }
    const entry=byName.get(name);
    if(!entry||entry.count!==1)return team();
    if(owner&&(entry.user===owner||entry.user.id!==undefined&&entry.user.id===owner.id))return producer;
    const english=typeof entry.user.nameEn==='string'?entry.user.nameEn.trim():'';
    return english&&english.length<=60?english:team();
  };
}
