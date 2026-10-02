(function(root){'use strict';
  const rpc=(name,value,timeoutMs=120000)=>new Promise((resolve,reject)=>{
    if(!root.google?.script?.run)return reject(new Error('온라인 접수 링크에서 다시 열어주세요.'));
    const timer=setTimeout(()=>reject(new Error('응답이 늦어지고 있어요. 답변을 유지했으니 다시 보내주세요. 같은 접수로 이어집니다.')),timeoutMs);
    root.google.script.run.withSuccessHandler(result=>{clearTimeout(timer);resolve(result);}).withFailureHandler(error=>{clearTimeout(timer);reject(new Error(error?.message||'전송하지 못했어요. 잠시 후 다시 시도해주세요.'));})[name](value);
  });
  function available(){return !!(root.SYNK_INTAKE?.invite&&root.google?.script?.run);}
  function base64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error(file.name+' 파일을 읽지 못했어요. 다시 선택해주세요.'));reader.readAsDataURL(file);});}
  let pending=null;
  async function send(payload,files,onProgress=()=>{}){
    if(!available())throw new Error('자동 접수 주소가 아직 연결되지 않았어요. 작성 내용을 파일로 보관할 수 있어요.');
    const invite=root.SYNK_INTAKE.invite;
    onProgress({phase:'hash',done:0,total:files.length,message:'보낼 원본 자료를 확인하고 있어요.'});
    const manifest=[];
    for(const f of files){const digest=await crypto.subtle.digest('SHA-256',await f.file.arrayBuffer());const sha256=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');manifest.push({name:f.name,size:f.size,category:f.category,type:f.file.type||'application/octet-stream',sha256});}
    const fingerprint=JSON.stringify({data:payload.data,manifest});
    const requestKey='synk-pulse-intake-request';
    if(!pending||pending.fingerprint!==fingerprint){
      let prior;try{prior=JSON.parse(sessionStorage.getItem(requestKey)||'null');}catch{}
      pending={fingerprint,requestId:prior?.fingerprint===fingerprint?prior.requestId:crypto.randomUUID(),payload};
      try{sessionStorage.setItem(requestKey,JSON.stringify({fingerprint,requestId:pending.requestId}));}catch{}
    }
    onProgress({phase:'begin',done:0,total:files.length,message:'답변과 자료 목록을 보내고 있어요.'});
    const started=await rpc('beginIntake',{invite,requestId:pending.requestId,payload:pending.payload,manifest,consent:true});
    const validReceipt=value=>value?.ok===true&&value.status==='received'&&typeof value.submissionId==='string'&&value.submissionId.length>0&&value.fileCount===files.length&&typeof value.receivedAt==='string'&&Number.isFinite(Date.parse(value.receivedAt));
    if(started.status==='received'){if(!validReceipt(started))throw new Error('접수 완료를 확인하지 못했어요. 다시 보내주세요.');return started;}
    if(typeof started.submissionId!=='string'||!started.submissionId||typeof started.uploadToken!=='string'||!started.uploadToken||!Array.isArray(started.uploaded)||started.uploaded.some(index=>!Number.isInteger(index)||index<0||index>=files.length))throw new Error('자료 전송 준비를 확인하지 못했어요. 다시 보내주세요.');
    const uploaded=new Set(started.uploaded||[]);
    for(let index=0;index<files.length;index++){
      if(uploaded.has(index))continue;
      onProgress({phase:'file',done:uploaded.size,total:files.length,message:`자료 ${index+1}/${files.length} · ${files[index].name}`});
      const result=await rpc('uploadIntakeFile',{submissionId:started.submissionId,uploadToken:started.uploadToken,index,base64:await base64(files[index].file)});
      if(result.index!==index||result.size!==files[index].size)throw new Error('파일 확인이 끝나지 않았어요. 다시 보내주세요.');
      uploaded.add(index);
    }
    onProgress({phase:'finish',done:files.length,total:files.length,message:'원본 파일과 접수 내역을 확인하고 있어요.'});
    const receipt=await rpc('finishIntake',{submissionId:started.submissionId,uploadToken:started.uploadToken});
    if(!validReceipt(receipt))throw new Error('접수 완료를 확인하지 못했어요. 다시 보내주세요.');
    return receipt;
  }
  const api={available,send,config:()=>available()?rpc('getIntakeConfig',root.SYNK_INTAKE.invite):Promise.resolve({enabled:false})};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SynkBriefIntake=api;
})(typeof globalThis!=='undefined'?globalThis:this);
