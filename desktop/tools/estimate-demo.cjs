'use strict';

const { emptyState, inspectThread, updateJob, publicView, fault } = require('../src/estimate-domain.cjs');

function sampleState() {
  const state = emptyState(), ref = Date.UTC(2026,10,20,0);
  state.boxes = [
    {id:'sample-gmail',provider:'gmail',label:'studio@example.com',phase:'complete',checked:4,detail:'받은 편지, 보관한 편지와 보낸 편지를 확인했어요.'},
    {id:'sample-naver',provider:'naver',label:'work@example.net',phase:'complete',checked:2,detail:'등록된 폴더의 마지막 편지까지 확인했어요.'},
    {id:'sample-outlook',provider:'outlook',label:'team@example.org',phase:'complete',checked:3,detail:'등록된 메일함의 마지막 대화까지 확인했어요.'},
  ];
  const rows = [
    [0,'영상 제작 견적 문의', [['30초 제품 영상 한 편의 견적을 부탁드립니다.',false], ['이번 주 제작이 가능합니다.',true], ['금요일까지 1차 시안을 받을 수 있을까요?',false]],5],
    [1,'지난 교육 자료를 요청드립니다', [['지난 교육 때 쓰신 실습 자료를 다시 보내 주세요.',false]],4],
    [2,'자료 전달 일정', [['수정한 이미지는 언제 받을 수 있나요?',false], ['수정본을 목요일까지 보내드리겠습니다.',true]],3],
    [2,'교육 견적 확인', [['교육 견적을 부탁드립니다.',false], ['견적을 첨부했습니다.',true], ['감사합니다',false]],2],
    [0,'월간 소식', [['이번 달 소식을 전해 드립니다.',false]],1],
    [1,'참조로 공유한 회의 내용', [['다음 회의 내용을 공유합니다.',false]],1],
    [0,'동영상 규격을 알려주세요', [['세로 영상 규격을 알려주세요.',false], ['파일 규격은',true]],2],
    [0,'다온전시 봄 전시 영상 견적', [['30초 세로 제품 영상 1편 견적을 부탁드립니다. 희망 납품일은 12월 4일입니다. 수정 1회를 원합니다.',false]],7,'다온전시'],
    [2,'파도문구 신상품 영상 견적', [['안녕하세요. 30초 세로 제품 영상 3편 견적을 부탁드립니다. 수정 2회를 원합니다.',false]],6,'파도문구'],
  ];
  rows.forEach(([idx,subject,parts,days,senderName],n)=>{
    const box=state.boxes[idx];
    const msgs=parts.map(([text,outgoing],i)=>({id:'sample-msg-'+n+'-'+i,at:ref+(days*60+i)*60000,subject,text,outgoing,senderName,
      draft:n===6&&i===1, copied:n===5, automatic:n===4}));
    const row=inspectThread(msgs);
    state.threads.push({...row,id:'sample-thread-'+n,boxId:box.id,boxLabel:box.label});
  });
  state.jobs=[{id:'sample-job-1',title:'30초 제품 소개 영상',scope:'30초 세로 제품 영상',quantity:1,buildMinutes:120,revisionMinutes:60,directCost:20000,subcontractCost:0}];
  return state;
}

function createDemo() {
  const state = sampleState();
  let seq=0;
  const capabilities={connect:false,providers:['gmail','naver','outlook'],import:false,
    connectionNote:'예시 화면에서는 가상의 메일함 세 개를 사용합니다.'};
  const snapshot=()=>({ok:true,data:structuredClone(publicView(state,capabilities))});
  return {snapshot:async()=>snapshot(),action:async(name,input={})=>{
    try {
      if(name==='scan') return snapshot();
      if(name==='connect'||name==='import') throw fault('DEMO','이 화면은 예시 메일함으로 동작해요.');
      const result = updateJob(state,name,input,()=> 'sample-record-'+(++seq),Date.now());
      if (name === 'repeatPreview') return {ok:true, preview:structuredClone(result)};
      return snapshot();
    } catch(error){return {ok:false,code:error.code||'ERROR',message:error.message};}
  }};
}

module.exports={sampleState,createDemo};
