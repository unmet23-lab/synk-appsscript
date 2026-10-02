'use strict';
module.exports={
  title:'아직 정하지 않았어요 — 듣고 바꿔 말하기',
  file:'LAB-듣고-바꿔-말하기',duration:65,fps:30,
  sourceAudio:'C:/Users/q1212/Downloads/dive-나나-1789332200728.wav',
  expectedAudioHash:'0c1f75fcee0fe6efe1e37cdc0aa24b3fee910c8c38148d046f1a91490702052b',
  sourceVideo:'docs/홍보물/새첫게시물_20260914/LAB-영상/LAB-읽고-바꿔-말하기.mp4',
  expectedVideoHash:'63f3f1fd05f1a8933ecd3323924c144188c19887a47503f0ebf11a011c808829',
  speechFile:'docs/홍보물/새첫게시물_20260914/LAB-음성/생성대사.txt',
  texts:['어떤 전공을 배우고 싶어요?','아직 정하지 않았어요.','먼저 게임을 만들어 보고 싶어요.','게임을 만들어.','영상을 만들어.','그림을 그려.','아직 정하지 않았어요.','먼저 영상을 만들어 보고 싶어요.','아직 정하지 않았어요.','먼저 그림을 그려 보고 싶어요.'],
  // Measured -38dB / >=0.18s quiet gaps. The midpoint is inside a pause, not an inferred phoneme.
  gaps:[[1.638125,2.132208],[3.588625,4.111646],[5.952042,6.471521],[7.39625,7.927083],[8.884187,9.443625],[10.183729,10.699],[12.105021,12.626854],[14.54075,15.064687],[16.48225,16.964979]],
  groups:[
    {first:0,last:0,start:6.15,window:[6,14],role:'질문'},
    {first:1,last:2,start:14.1,window:[14,24],role:'완성 예문'},
    {first:3,last:3,start:24.35,window:[24,27],role:'게임 동사구'},
    {first:4,last:4,start:27.35,window:[27,30.5],role:'영상 동사구'},
    {first:5,last:5,start:30.85,window:[30.5,34],role:'그림 동사구'},
    {first:6,last:7,start:48.02,window:[48,52.5],role:'영상 완성 예문'},
    {first:8,last:9,start:52.52,window:[52.5,57],role:'그림 완성 예문'}
  ],
  generationRecord:{source:'Root observed official DIVE UI and official download button',voice:'나나',language:'ko',speed:1,pitch:0,volume:50,sentenceSilenceSec:0.4,streaming:false,characters:136,successfulGenerations:1,reportedAccountPlan:'FREE',reportedMeterBefore:'0/30000',reportedMeterAfter:'381/30000',reportedEstimate:408,newPayment:0,downloadTimeKST:'2026-09-14 05:43:21',downloadButtonCalls:1,downloadToolTimeoutButActualFileConfirmed:true},
  boundaries:{humanListeningVerified:false,pronunciationVerified:false,wordAlignmentVerified:false,nativeMongolianReview:false,studentEffectVerified:false,publiclyPosted:false,commercialRedistributionConditionsVerified:false,newTTSCallsInThisBuild:0,newPaidCallsInThisBuild:0,externalTransferBytesInThisBuild:0}
};
