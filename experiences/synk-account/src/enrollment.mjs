// The invitation identifies an existing roster entry, never a role or consent.
// Keep it in this mounted view only; the account host owns authentication.
export function mountEnrollment({container,request,guard=()=>{},beforeClaim=()=>true,onLinked=()=>{}}){
  const doc=container.ownerDocument;
  const node=(tag,text)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const panel=node('section');panel.className='sb-card classroom-enrollment';
  const heading=node('h3','내 반 연결'),help=node('p','선생님이 준 연결 코드를 입력하고, 내 이름과 반이 맞는지 확인해 주세요.');
  help.className='help';const form=node('form'),label=node('label','학생 연결 코드'),input=node('input');
  input.name='invite';input.maxLength=128;input.autocomplete='off';input.spellcheck=false;input.required=true;input.setAttribute('aria-label','학생 연결 코드');
  input.setAttribute('autocapitalize','none');input.setAttribute('autocorrect','off');
  const previewButton=node('button','이름과 반 확인');previewButton.type='submit';previewButton.className='felt-button';
  const details=node('div'),confirmButton=node('button','이 계정으로 내 반 연결');confirmButton.type='button';confirmButton.className='felt-button primary';confirmButton.hidden=true;
  const consent=node('p','반에 연결한 뒤에도 학습 기록 연결과 TOWN 생활 공유는 따로 켜요.');consent.className='help';
  const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  label.append(input);form.append(label,previewButton);panel.append(heading,help,form,details,confirmButton,consent,status);container.append(panel);
  let epoch=0,disposed=false,busy=false,verifiedToken=null;
  const current=version=>{guard();if(disposed||version!==epoch)throw Object.assign(new Error('계정 연결이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});};
  const controls=value=>{busy=value;input.disabled=value;previewButton.disabled=value;confirmButton.disabled=value;};
  function clearPreview(){verifiedToken=null;confirmButton.hidden=true;details.replaceChildren();}
  function report(error,version){if(disposed||version!==epoch||error.code==='ACCOUNT_CHANGED')return;status.textContent=enrollmentMessage(error);status.className='error';}
  input.addEventListener('input',()=>{epoch++;clearPreview();status.textContent='';});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||disposed)return;const token=normalizeInviteCode(input.value),version=++epoch;clearPreview();status.textContent='';
    if(!/^[A-Za-z0-9_-]{22,128}$/.test(token)){status.textContent='선생님이 준 연결 코드를 그대로 입력해 주세요.';return;}
    controls(true);
    try{current(version);const result=await request('preview',{token});current(version);
      if(!result?.invite||typeof result.invite.className!=='string'||typeof result.invite.learnerLabel!=='string')throw new Error('반 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      details.append(node('p',result.invite.className+' · '+result.invite.learnerLabel));
      const expires=Date.parse(result.invite.expiresAt);if(Number.isFinite(expires))details.append(node('p','코드 만료: '+new Date(expires).toLocaleString('ko-KR')));
      verifiedToken=token;confirmButton.hidden=false;status.className='help';status.textContent='본인의 이름과 반이 맞을 때만 연결해 주세요.';
    }catch(error){report(error,version);}finally{if(!disposed&&version===epoch)controls(false);}
  });
  confirmButton.addEventListener('click',async()=>{
    if(busy||disposed||!verifiedToken)return;const token=verifiedToken,version=++epoch;controls(true);status.textContent='';
    try{current(version);if(await beforeClaim()===false)return;current(version);const result=await request('claim',{token,confirm:true});current(version);
      if(result?.linked!==true)throw new Error('반에 연결됐는지 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      input.value='';clearPreview();status.className='help';status.textContent='내 계정과 반을 연결했어요. 학습 기록 연결과 TOWN 생활 공유는 따로 켜 주세요.';
      await onLinked(result);current(version);
    }catch(error){report(error,version);}finally{if(!disposed&&version===epoch)controls(false);}
  });
  return Object.freeze({dispose(){disposed=true;epoch++;verifiedToken=null;input.value='';panel.remove();}});
}
// 선생님 화면은 32자리 소문자 16진 코드를 낸다(서버는 소문자만 받는다). 휴대폰 자판의 자동 대문자·띄어쓰기·줄바꿈으로 옮겨 적은 코드도 같은 코드로 보낸다.
export function normalizeInviteCode(value){const raw=String(value??'').replace(/\s+/g,''),hex=raw.replace(/-/g,'');return /^[0-9a-f]{32}$/i.test(hex)?hex.toLowerCase():raw;}
// 서버는 거절 까닭을 코드 그대로(INVALID_INVITE 등) 글로 보낸다. 학생에게는 코드 대신 할 일을 보인다.
// 꼴은 맞지만 없는 코드(한 글자 오타)도 INVITE_UNAVAILABLE이라 그 안내는 다시 확인하기를 먼저 둔다.
const REFUSALS=Object.freeze({
  INVALID_INVITE:'연결 코드가 맞지 않아요. 선생님께 받은 코드를 다시 확인해 넣어 주세요.',
  INVITE_UNAVAILABLE:'연결 코드를 한 글자씩 다시 확인해 주세요. 그래도 안 되면 기한이 지났거나 이미 쓴 코드일 수 있으니 선생님께 새 코드를 받아 주세요.',
  ACCOUNT_ALREADY_ENROLLED:'이 계정은 이미 다른 반 학생으로 연결돼 있어요. 반을 옮기려면 선생님께 알려 주세요.',
  LEARNER_ALREADY_LINKED:'이 이름은 이미 연결돼 있어요. 선생님께 확인해 주세요.',
  PRODUCT_FORBIDDEN:'WORLD에 로그인한 계정으로만 반에 연결할 수 있어요. 다시 로그인한 뒤 연결해 주세요.',
  AUTH_REQUIRED:'로그인이 끝났어요. 다시 로그인한 뒤 연결해 주세요.',
  FORBIDDEN:'이 계정으로는 반에 연결할 수 없어요. 선생님께 확인해 주세요.',
  ENROLLMENT_UNAVAILABLE:'지금은 반에 연결할 수 없어요. 잠시 뒤 다시 해 주세요.'});
// 화면·계정 통로가 던진 한국어 글만 그대로 보인다. 브라우저 쪽 실패(Failed to fetch·중단·응답 해석)와 모르는 코드는 일반 안내로 바꾼다.
export function enrollmentMessage(error){const message=typeof error?.message==='string'?error.message:'';return (Object.hasOwn(REFUSALS,error?.code??'')?REFUSALS[error.code]:null)||(/[가-힣]/.test(message)?message:'연결하지 못했어요. 인터넷 연결을 확인하고 잠시 뒤 다시 해 주세요.');}
