const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {otherOwner}=require('../tools/계정통계예약/platform-exports.cjs');

async function vkExport(buttons) {
  const clicks=[];
  let downloadArmed=false;
  let result;
  const currentChecks=[true,true,true],settled=[];
  function dialogState(fn,arg){
    const inputs=currentChecks.map((checked,index)=>({checked,click(){currentChecks[index]=false;}}));
    const dialog={getClientRects:()=>[1],innerText:'Export statistics Data types',
      querySelectorAll:s=>s==='input'?[{value:'CSV (.csv)'}]:inputs};
    return vm.runInNewContext('('+fn.toString()+')(arg)',{document:{querySelectorAll:()=>[dialog]},arg});
  }
  const page={
    async waitForFunction(fn,arg){
      if(arg&&typeof arg.index==='number'){assert.equal(dialogState(fn,arg),true);settled.push(arg.index);}
    },
    async evaluate(fn,arg){
      if(arg&&typeof arg.index==='number')return dialogState(fn,arg);
      if(typeof arg==='string'&&arg.includes('[role="dialog"]')) {
        const context={document:{querySelectorAll:()=>buttons},arg};
        return vm.runInNewContext('('+fn.toString()+')(arg)',context);
      }
      return arg===undefined?['09.11.2026','15.11.2026']:true;
    },
    async click(selector) {
      clicks.push(selector);
      if(selector.startsWith('loc=css:[role="dialog"]')){
        assert.equal(downloadArmed,true);
        assert.deepEqual(currentChecks,[true,false,false]);
        assert.deepEqual(settled,[0,1,2]);
      }
    },
    async snapshot(){return 'dialog "Export statistics"\n combobox [ref=83]';},
    async waitForEvent(event,options){
      assert.equal(event,'download');
      assert.equal(options.timeout,60000);
      downloadArmed=true;
      return {suggestedFilename:()=>'123_community_common_2026-11-09_2026-11-15.csv',saveAs:async()=>{}};
    }
  };
  await otherOwner({account:{id:'vk-test',platform:'vk',handle:'demo',publicUrl:'https://vk.ru/demo'},dir:__dirname,
    profile:{browser:'ego',profileId:'test-profile',communityId:'123'},setStage:async()=>{}},{
    pageJob:async(ctx,tag,read,args)=>{result=await read(page,args);return {reason:'test-finished'};}
  });
  return {clicks,downloadArmed,result};
}
const exportButton={innerText:'Export',getClientRects:()=>[1],disabled:false};
test('VK는 소유자 내보내기 창의 준비된 버튼에 다운로드를 건 뒤 클릭한다',async()=>{
  const {clicks,downloadArmed,result}=await vkExport([exportButton]);
  assert.equal(downloadArmed,true);
  assert.match(clicks.at(-1),/^loc=css:\[role="dialog"\] button/);
  assert.equal(result.filename,'123_community_common_2026-11-09_2026-11-15.csv');
});
test('VK는 내보내기 대상이 모호하거나 비활성일 때 다른 버튼을 누르지 않는다',async()=>{
  for(const buttons of [[exportButton,exportButton],[{...exportButton,disabled:true}],[{...exportButton,innerText:'Cancel'}]]){
    const checked=await vkExport(buttons);
    assert.equal(checked.result.reason,'format');
    assert.equal(checked.downloadArmed,false);
  }
});

