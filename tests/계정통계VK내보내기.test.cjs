const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {otherOwner}=require('../tools/계정통계예약/platform-exports.cjs');
const {vkChartRows}=require('../tools/계정통계예약/vk-chart.cjs');

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
    pageJob:async(ctx,tag,read,args)=>{if(tag==='vk-chart')return {reason:'no_metrics'};result=await read(page,args);return {reason:'test-finished'};}
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

const chart={source:'https://vk.ru/groups/dashboard/@demo',observedAt:'2027-01-01T22:00:00Z',
  range:['31.12.2026','02.01.2027'],points:[{date:'31 December',visitors:'0',views:'1\u00a0234'},
    {date:'1 January',visitors:'4',views:'8'},{date:'2 January',visitors:'999',views:'999'}]};
test('VK 그래프는 공식 선택기의 연도와 모스크바 날짜로 완료일의 정확한 두 값만 읽는다',()=>{
  const result=vkChartRows(chart,'demo');
  assert.deepEqual(result.map(r=>[r.period.start,r.metrics]),[['2026-12-31',{views:1234,visitors:0}],['2027-01-01',{views:8,visitors:4}]]);
});
test('다른 VK 계정이나 겹치거나 축약된 숫자는 그래프 측정값으로 쓰지 않는다',()=>{
  for(const changed of [{source:'https://vk.ru/groups/dashboard/@wrong'},
    {points:[...chart.points,chart.points[0]]},{points:[{...chart.points[0],views:'1.2K'},...chart.points.slice(1)]},
    {points:[{...chart.points[0],date:'30 December'},...chart.points.slice(1)]}]){
    assert.deepEqual(vkChartRows({...chart,...changed},'demo'),[]);
  }
});
test('확인한 날짜만 기록하고 일별 지점이 전부 비었을 때만 화면에 표시된 콘텐츠 기간 합계를 쓴다',()=>{
  const summary=[{label:'Content views',value:'0'},{label:'Content reach',value:'2'}];
  const day=vkChartRows({...chart,points:[{date:'01 January',views:'3',visitors:'1'}],summary},'demo');
  assert.equal(day.length,1);assert.deepEqual(day[0].period,{start:'2027-01-01',end:'2027-01-01'});
  const period=vkChartRows({...chart,points:[],summary},'demo');
  assert.deepEqual(period[0].period,{start:'2026-12-31',end:'2027-01-02'});
  assert.deepEqual(period[0].metrics,{views:0,reach:2});assert.equal(period[0].labels.metricLabels.views,'Content views');
});
test('완전한 관리자 그래프를 받으면 이번 회차 화면 관측으로 제출하고 CSV를 중복 요청하지 않는다',async()=>{
  const profile={browser:'ego',profileId:'profile',communityId:'123'},stages=[],sources=[],jobs=[];
  const result=await otherOwner({account:{id:'vk-test',platform:'vk',handle:'demo',publicUrl:'https://vk.ru/demo'},
    dir:__dirname,profile,setStage:async stage=>stages.push(stage)},{
    pageJob:async(ctx,tag)=>{jobs.push(tag);return chart;},storeBatch:async(ctx,name,evidence,envelope)=>sources.push(envelope)
  });
  assert.equal(result,'limited');assert.deepEqual(stages,['creator-screen']);assert.deepEqual(jobs,['vk-chart']);
  assert.equal(sources[0].sourceType,'creator-screen');assert.equal(sources[0].observations.length,2);
});

