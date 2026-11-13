// Bounded request waits and unconditional cleanup for the isolated browser QA.
export async function organizationDeadline(promise,label,timeout=15_000){
  let timer;
  try{
    return await Promise.race([promise,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error(`Organization QA timed out: ${label} (${timeout}ms)`)),timeout);
    })]);
  }finally{clearTimeout(timer);}
}

export async function finishOrganizationQa({failure,writeReport,closeBrowser,stopApp,removeDirectory}){
  for(const action of [writeReport,closeBrowser,stopApp,removeDirectory]){
    try{await action();}catch(error){failure ||= error;}
  }
  if(failure)throw failure;
}
