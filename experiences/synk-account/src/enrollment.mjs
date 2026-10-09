// The invitation identifies an existing roster entry, never a role or consent.
// Keep it in this mounted view only; the account host owns authentication.
export function mountEnrollment({container,request,guard=()=>{},onLinked=()=>{}}){
  const doc=container.ownerDocument;
  const node=(tag,text)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const panel=node('section');panel.className='sb-card classroom-enrollment';
  const heading=node('h3','내 반 연결'),help=node('p','선생님이 준 연결 코드를 입력하고, 내 이름과 반이 맞는지 확인해 주세요.');
  help.className='help';const form=node('form'),label=node('label','학생 연결 코드'),input=node('input');
  input.name='invite';input.maxLength=128;input.autocomplete='off';input.spellcheck=false;input.required=true;input.setAttribute('aria-label','학생 연결 코드');
  const previewButton=node('button','이름과 반 확인');previewButton.type='submit';previewButton.className='felt-button';
  const details=node('div'),confirmButton=node('button','이 계정으로 내 반 연결');confirmButton.type='button';confirmButton.className='felt-button primary';confirmButton.hidden=true;
  const consent=node('p','계정 연결 후에도 학습 기록 공유와 TOWN 생활 공유는 각각 직접 선택해요.');consent.className='help';
  const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  label.append(input);form.append(label,previewButton);panel.append(heading,help,form,details,confirmButton,consent,status);container.append(panel);
  let epoch=0,disposed=false,busy=false,verifiedToken=null;
  const current=version=>{guard();if(disposed||version!==epoch)throw Object.assign(new Error('계정 연결이 바뀌었어요.'),{code:'ACCOUNT_CHANGED'});};
  const controls=value=>{busy=value;input.disabled=value;previewButton.disabled=value;confirmButton.disabled=value;};
  function clearPreview(){verifiedToken=null;confirmButton.hidden=true;details.replaceChildren();}
  function report(error,version){if(disposed||version!==epoch||error.code==='ACCOUNT_CHANGED')return;status.textContent=error.message||'연결 코드를 다시 확인해 주세요.';status.className='error';}
  input.addEventListener('input',()=>{epoch++;clearPreview();status.textContent='';});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||disposed)return;const token=input.value.trim(),version=++epoch;clearPreview();status.textContent='';
    if(!/^[A-Za-z0-9_-]{22,128}$/.test(token)){status.textContent='선생님이 준 연결 코드를 그대로 입력해 주세요.';return;}
    controls(true);
    try{current(version);const result=await request('preview',{token});current(version);
      if(!result?.invite||typeof result.invite.className!=='string'||typeof result.invite.learnerLabel!=='string')throw new Error('학생 연결 정보를 확인하지 못했어요.');
      details.append(node('p',result.invite.className+' · '+result.invite.learnerLabel));
      const expires=Date.parse(result.invite.expiresAt);if(Number.isFinite(expires))details.append(node('p','코드 만료: '+new Date(expires).toLocaleString('ko-KR')));
      verifiedToken=token;confirmButton.hidden=false;status.className='help';status.textContent='본인의 이름과 반이 맞을 때만 연결해 주세요.';
    }catch(error){report(error,version);}finally{if(!disposed&&version===epoch)controls(false);}
  });
  confirmButton.addEventListener('click',async()=>{
    if(busy||disposed||!verifiedToken)return;const token=verifiedToken,version=++epoch;controls(true);status.textContent='';
    try{current(version);const result=await request('claim',{token,confirm:true});current(version);
      if(result?.linked!==true)throw new Error('계정 연결 결과를 확인하지 못했어요.');
      input.value='';clearPreview();status.className='help';status.textContent='내 계정과 반을 연결했어요. 학습 기록과 TOWN 공유는 별도로 선택해 주세요.';
      await onLinked(result);current(version);
    }catch(error){report(error,version);}finally{if(!disposed&&version===epoch)controls(false);}
  });
  return Object.freeze({dispose(){disposed=true;epoch++;verifiedToken=null;input.value='';panel.remove();}});
}
