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
  // 사진 상품의 같은 순간(pulse-live.mjs customerBodiesPhoto)
  '첫 장을 만들기 전에 모델을 확인해 주세요.':'Please confirm the model before we make the first photo.',
  '첫 장을 보고 의견을 남기거나, 괜찮으면 그대로 진행해 주세요.':'Look at the first photo and leave notes, or go ahead if it works.',
  '사진을 보고, 바꾸고 싶은 곳에 의견을 남기거나 승인해 주세요.':'Look through the photos, then leave a note on anything you’d change — or approve them.',
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
  '이 메일은 보내 주신 의뢰의 진행 알림이에요. 궁금한 점은 이 메일에 답장해 주세요.':'This is a progress update on your brief. Just reply to this email with any questions.',
  // 판 4(11-10): 결제 알림 · 메일 여덟 순간 · 다시 열기
  '크몽에서 결제해 주세요':'Please pay on Kmong',
  '결제를 확인했어요':'Payment confirmed',
  '결제가 취소됐어요':'Payment cancelled',
  '크몽 메시지로 보내 드린 결제 요청에서 결제해 주세요. 확인되면 이어서 만들어요.':'Pay through the payment request we sent you in Kmong messages. We continue as soon as it is confirmed.',
  '크몽 결제를 확인했어요. 이어서 만들기 시작해요.':'Your Kmong payment is confirmed. We are moving on to the next step.',
  '결제가 취소됐어요. 다시 진행하시려면 담당자에게 알려 주세요.':'The payment was cancelled. Tell your producer if you would like to continue.',
  // 운영 조각 4(11-12): 작업 소식 알림(앱 안 · 기기만 — 메일 없음)
  '작업 중인 화면이 올라왔어요':'New work-in-progress update',
  '완성본이 아니라 작업 중인 화면이에요. 의견은 다음 판이 오면 그때 남겨 주세요.':'This is a work in progress, not the finished version. Please leave your notes once the next version arrives.',
  '이 기기를 기억해 두셨다면 바로 열려요. 다른 기기에서는 「메일로 다시 열기」에 이 메일 주소를 넣으시면 코드를 보내 드려요.':'If you asked us to remember this device, it opens right away. On another device, enter this email address under “Reopen by email” and we will send you a code.',
  '〔SYNK PULSE〕 의뢰를 받았어요 · {number}':'〔SYNK PULSE〕 We received your brief · {number}',
  '〔SYNK PULSE〕 의뢰를 받았어요':'〔SYNK PULSE〕 We received your brief',
  '접수 번호: {number}':'Reference number: {number}',
  '보내 주신 광고 의뢰를 받았어요.':'We received your ad brief.',
  '평일 10~19시에 의뢰서를 확인하고, 빠진 게 있으면 그 칸만 다시 여쭤요. 결제는 글 콘티를 보신 뒤에 크몽에서 해요.':'We review briefs on weekdays, 10:00–19:00 Korea time, and only ask again about anything missing. Payment happens on Kmong after you have seen the script.',
  '의뢰하신 적이 없으면 이 메일은 지우셔도 돼요. 궁금한 점은 이 메일에 답장해 주세요.':'If you did not send a brief, you can delete this email. Reply to this email with any questions.',
  '{title}, 몇 가지만 더 여쭐게요':'{title}: a few quick questions',
  '의뢰서를 확인했어요. 빠진 몇 칸만 알려 주시면 바로 다음 단계로 넘어가요.':'We have read your brief. Answer the few missing items and we will move straight on.',
  '다음 할 일: 앱의 「이것만 더 알려 주세요」 칸에 글이나 파일로 답해 주세요.':'Next: answer the questions in the app, with text or a file.',
  '다음 할 일: 마음에 드는 방향 하나를 골라 주세요. 둘 다 아니면 「둘 다 아니에요」에 한 줄 남겨 주세요.':'Next: pick the direction you like. If neither fits, leave a line under “Neither one”.',
  '{title} 고친 글 콘티가 왔어요':'{title}: your revised script is here',
  '보내 주신 의견을 반영해 글 콘티를 고쳤어요. 컷마다 다시 보시고 의견을 남기시거나, 괜찮으면 다음 단계로 넘겨 주세요.':'We revised the script with your feedback. Look through each shot again and leave notes, or move on if it works.',
  '다음 할 일: 컷마다 좋아요 · 고칠 곳을 남기고 「의견 보내기」나 「이대로 장면 이미지 만들기」를 눌러 주세요.':'Next: mark each shot as good or to fix, then press “Send feedback” or “Make the scene images”.',
  '{title}, 크몽에서 결제해 주세요':'{title}: please pay on Kmong',
  '크몽 메시지로 결제 요청({amount})을 보내 드렸어요. 결제가 확인되면 다음 단계를 만들기 시작해요.':'We sent a payment request ({amount}) in Kmong messages. Once the payment is confirmed, we start on the next step.',
  '크몽 메시지로 결제 요청을 보내 드렸어요. 결제가 확인되면 다음 단계를 만들기 시작해요.':'We sent a payment request in Kmong messages. Once the payment is confirmed, we start on the next step.',
  '다음 할 일: 크몽 메시지의 결제 요청에서 결제해 주세요. 크몽 결제 때 크몽 구매 수수료가 더해져요.':'Next: pay through the request in your Kmong messages. Kmong adds its buyer fee at checkout.',
  '{title} 고친 첫 장이 왔어요':'{title}: your revised first photo is here',
  '{title} 첫 장이 왔어요':'{title}: your first photo is here',
  '보내 주신 의견을 반영해 첫 장을 고쳤어요. 이 결이 맞는지 봐 주세요.':'We revised the first photo with your feedback. Check that the look is right.',
  '나머지 장을 같은 결로 만들기 전에 첫 장을 먼저 보내 드렸어요.':'Before we make the rest in the same look, here is the first photo.',
  '다음 할 일: 첫 장을 보시고 괜찮으면 승인을, 고칠 곳이 있으면 의견을 보내 주세요.':'Next: approve the first photo if it works, or send notes on what to fix.',
  '{title} 고친 장면 이미지가 왔어요':'{title}: your revised scene images are here',
  '{title} 장면 이미지가 왔어요':'{title}: your scene images are here',
  '보내 주신 의견을 반영해 장면 이미지를 고쳤어요. 컷마다 다시 봐 주세요.':'We revised the scene images with your feedback. Please look through each shot again.',
  '영상에 들어갈 컷마다 첫 화면을 완성 화질로 보내 드렸어요. 확인하신 컷으로만 영상을 만들어요.':'Here is the first frame of every shot, at final quality. We only make the film from the shots you approve.',
  '다음 할 일: 컷마다 보시고 「이대로 제작 시작」이나 「의견 보내기」를 눌러 주세요.':'Next: look through each shot, then press “Start production” or “Send feedback”.',
  '다음 할 일: 사진을 보시고 「이 시안 최종 승인」을 누르시거나 바꿀 곳에 의견을 남겨 주세요.':'Next: look at the photos and press “Approve this preview”, or leave notes on what to change.',
  '다음 할 일: 영상을 보시고 「이 시안 최종 승인」을 누르시거나 바꿀 장면에 의견을 남겨 주세요.':'Next: watch the film and press “Approve this preview”, or leave notes on the scenes to change.',
  '다음 할 일: 파일을 받아 보시고 「수령 확인 남기기」를 눌러 주세요.':'Next: download the files and press “Confirm receipt”.',
  '받으실 날({date})은 확인을 기다리는 날만큼 늦어져요.':'Your delivery date ({date}) moves by the days we wait for your reply.',
  '지금은 제작 자리가 차 있어 결제 안내는 자리가 나는 대로 드려요. 기간은 결제한 날부터 세요.':'Our production schedule is full right now, so we’ll send payment details as soon as a spot opens up. The timeline starts on the day you pay.',
  // 알림 명단 메일(운영 조각 6-C, pulse-waitlist.mjs).
  '〔SYNK PULSE〕 제작 자리가 났어요':'〔SYNK PULSE〕 A production spot just opened up',
  '알려 달라고 하신 제작 자리가 났어요. 아래 주소에서 광고 의뢰서를 바로 시작하실 수 있어요.':'You asked us to let you know when a production spot opened up, and one just did. You can start your ad brief right away at the link below.',
  '자리는 먼저 시작하신 분부터 차요.':'Spots are filled in the order people start.',
  '이 알림은 한 번만 보내 드리고, 주소는 알림 명단에서 지웠어요.':'We send this notice only once, and we’ve removed your address from the notification list.',
  // 운영 조각 2-B(11-11): 담당자 답 메일(staff_reply) — 꼬리는 「앱에서 답해 주세요」(메일 답장은 앱 대화로 들어가지 않는다)
  '{title}, 담당자가 답을 남겼어요':'{title}: your producer replied',
  '보내 주신 말씀에 담당자가 답을 남겼어요. 앱의 「담당자와 나눈 말」에서 보실 수 있어요.':'Your producer has replied to your message. You’ll find the reply in the app under “Messages with your producer”.',
  '다음 할 일: 답을 읽어 보시고, 더 궁금한 점이 있으면 앱에서 답해 주세요.':'Next: read the reply, and if you have more questions, reply in the app.',
  '이 메일은 담당자 답 알림이에요. 대화가 한곳에 남도록 답은 앱에서 해 주세요.':'This is a notification that your producer has replied. Please reply in the app so the whole conversation stays in one place.',
  // 운영 조각 6-A(11-13): 받으실 날 고침 — 앱 알림 · 메일(due_changed)
  '받으실 날이 바뀌었어요':'Your delivery date has changed',
  '담당자가 받으실 날을 다시 정했어요. 바뀐 날과 까닭을 확인해 주세요.':'Your producer has set a new delivery date. Take a look at the new date and the reason.',
  '{title}, 받으실 날이 바뀌었어요':'{title}: new delivery date',
  '받으실 날을 {date}로 다시 정했어요.':'We’ve set a new delivery date: {date}.',
  '담당자가 받으실 날을 다시 정했어요. 바뀐 날은 앱에서 보실 수 있어요.':'Your producer has set a new delivery date. You’ll find it in the app.',
  '확인을 기다린 날만큼 날을 옮겼어요.':'It was pushed back by the number of days we waited for your reply.',
  '고칠 범위가 바뀌어 날을 다시 잡았어요.':'The scope of the revisions changed, so we rescheduled.',
  '말씀 나눈 날로 맞췄어요.':'It now matches the date we agreed on with you.',
  '저희 쪽 사정으로 날을 다시 잡았어요. 양해 부탁드려요.':'We had to reschedule on our side. Thank you for your understanding.',
  '다음 할 일: 따로 하실 일은 없어요.':'Next: there’s nothing you need to do.',
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
