const fs=require('fs');
const path=require('path');
const dir=__dirname;
const file=path.join(dir,'공간과_편의시설_좌표_5안.json');
const plan=JSON.parse(fs.readFileSync(path.join(dir,'공간과_디지털수업_좌표_4안.json'),'utf8'));
plan.revision=5;
plan.baseRevision=4;
plan.status='concept-not-measured';
plan.furniture=plan.furniture.filter(f=>!['consult','photo'].includes(f.room));
plan.rooms.find(r=>r.id==='consult').note='2.60 × 4.10 m · 4인 상담 / 가구를 접어 2 × 2 m VR 비움 후보 · 기기·콘텐츠별 여유 미검증';
Object.assign(plan.rooms.find(r=>r.id==='photo'),{name:'사진·편의실',short:'사진·편의',note:'2.15 × 4.10 m · 앞 1.5 m 커피·다과/출입 + 뒤 2.6 m 사진 · 좌석 없음 · 실제 촬영 거리·인원 미검증'});
const rect=(room,kind,x,y,w,h,label,extra={})=>({room,kind,x,y,w,h,label,...extra});
plan.appliances=[
 rect('A','AP',.4,5.0,.38,.38,'공기청정기'),rect('A','H',9.55,5.0,.30,.30,'가습기'),
 rect('B','AP',10.55,6.15,.38,.38,'공기청정기'),rect('B','H',13.85,6.15,.30,.30,'가습기'),
 rect('C','AP',14.85,6.15,.38,.38,'공기청정기'),rect('C','H',18.15,6.15,.30,.30,'가습기'),
 rect('D','AP',1.15,8.9,.38,.38,'공기청정기'),rect('D','H',.45,12.3,.30,.30,'가습기'),
 rect('office','AP',7.25,10.25,.38,.38,'공기청정기'),rect('office','H',7.25,12.10,.30,.30,'가습기'),
 rect('consult','AP',13.98,12.35,.38,.38,'공기청정기'),rect('consult','H',15.95,12.35,.30,.30,'가습기'),
 rect('photo','AP',18.25,12.35,.38,.38,'공기청정기'),rect('photo','H',16.70,12.35,.30,.30,'가습기')
].map((f,i)=>({...f,id:`${f.kind}-${f.room}`,footprintStatus:'제품 미선정 가정',clearanceStatus:'흡배기·급수·제조사 이격 미검증',mist:f.kind==='H'?'분무식이면 전자장비·거울·사람을 직접 향하지 않도록 현장 조정':null}));
plan.consultation={
 defaultMode:'vr',
 vrClearZone:rect('consult','vr-clear',14.20,10.0,2,2,'VR 비움 2 × 2 m',{status:'가구 수납 후 바닥 비움 후보; 기기별 안전 경계나 몸·컨트롤러 움직임 여유 검증 아님'}),
 modes:{
  consult:{label:'4인 상담',furniture:[
   rect('consult','folding-table',14.6,10.65,1.2,.70,'접이식 상담 테이블'),
   ...[14.67,15.32].flatMap(x=>[10.05,11.5].map(y=>rect('consult','folding-chair',x,y,.45,.45,'접이의자')))
  ]},
  vr:{label:'VR 비움',furniture:[
   rect('consult','folded-table',15.12,8.72,1.2,.18,'접은 테이블',{storedCount:1,storageMode:'벽면에 세워 고정',capacityStatus:'1.20 × 0.18 m 수납 footprint 가정; 접이 구조·높이·전도 방지 미확정'}),
   rect('consult','chair-rack',15.55,9.02,.65,.65,'접의자 4개 수납',{storedCount:4,capacityStatus:'0.65 × 0.65 m 묶음 수납 footprint 가정; 4개 적재 가능 여부와 높이 미확정'})
  ]}
 },
 storageShelf:rect('consult','vr-shelf',15.3,8.72,.8,.25,'VR 보관·충전 선반',{mount:'북쪽 벽 상부',floorOccupancy:false,verticalOverlap:'접은 테이블과 평면 투영을 공유하는 상부 선반; 실제 설치 높이·수직 간섭 미확정'}),
 constraint:'상담과 VR 동시 사용 아님. 테이블·의자 수납을 확인한 뒤 전환. 2×2 m 바깥 여유, 문·벽·컨트롤러 충돌은 기기와 콘텐츠별 실증 필요.'
};
plan.photoConvenience={
 frontZone:rect('photo','coffee-zone',16.65,8.7,2.15,1.5,'커피·다과 / 출입',{containsSeating:false}),
 rearZone:rect('photo','photo-zone',16.65,10.2,2.15,2.6,'사진 영역',{status:'용도 구획; 장비·분리판 점유를 빼기 전 면적'}),
 fixtures:[
  rect('photo','coffee-counter',18.35,9.0,.45,1.0,'커피·포장 다과대',{status:'싱크·냉장고 미반영; 기기 크기·급수·전기 미정'}),
  rect('photo','separator',17.6,10.2,1.2,.08,'기기 분리판',{status:'높이·재료 미정; 젖은 대와 건식 장비 별도 수납'}),
  rect('photo','dry-cabinet',18.15,10.55,.55,.60,'프린터·건식 장비함',{status:'프린터 미선정; 배출·급지·환기·점검 여유 미검증'})
 ],
 photoCamera:{id:'P',room:'photo',x:17.725,y:10.5,aim:{x:17.725,y:11.9},mount:'분리판 뒤쪽 고정면 카메라·조작패널 후보',planDistance:1.4,status:'고정면 높이·재료·하중, 실제 카메라·조작패널 두께, 렌즈·공동촬영 구도 미검증; P는 위치 기호이며 바닥 키오스크 footprint는 포함하지 않음'},
 standingTarget:rect('photo','photo-target',17.2,11.55,1.0,.7,'촬영 기준 위치',{status:'촬영 인원 확정치 아님'}),
 separatorPassage:{x:16.65,y:10.2,w:.95,h:.08,status:'명목 0.95 m 용도구획 통과부; 접근성·혼잡 검토 아님'},
 backdrop:{x:17.1,y:12.7,w:1.0,h:.05,status:'배경 위치 후보; H/AP와 실제 프레임 확인'},
 constraint:'사진 장비와 커피·액체는 별도 대에 배치. 대기 인원·공동촬영 구도·실제 촬영 거리·소모품 교체는 미검증. 로비·라운지·좌석을 추가하지 않음.'
};
plan.mainRoom={
 room:'A',
 mirrorCurtain:{x:.45,y:.25,w:9.4,h:.06,label:'전면 거울 + 커튼',status:'기존 메인룸 방향 반영; 실제 거울 폭·커튼·디스플레이 이동/설치 관계 미확정'},
 rearBackdrop:{x:2.0,y:6.62,w:7.9,h:.10,label:'후면 배경 · 코랄 LED',status:'어두운 배경과 코랄 LED 방향; 수업 카메라는 앞쪽 강사를 향해 이 후면 배경을 찍는 구성이 아님'},
 transition:'수업/댄스 전환에는 개인 책상·의자 이동과 수납 용량 검토가 필요. 5안에는 댄스 정원·가구 수납 가능 확정을 하지 않음.'
};
Object.assign(plan.displays.find(d=>d.room==='A'),{mount:'거울 앞 이동형 보드의 수업 위치 후보',status:'가변 설치 후보; 실제 이동식 받침 footprint·보관 위치·커튼 간섭 미확정'});
plan.assumptions=[...plan.assumptions,
 '7개 방에 공기청정기 1대씩과 가습기 1대씩, 총14대의 외곽 가정만 반영. 청정·가습 용량과 소음은 미선정',
 'AP 0.38×0.38 m, H 0.30×0.30 m는 제품 미선정 footprint. 제조사 흡배기·급수·청소·전기 이격 공간이 추가로 필요할 수 있음',
 'VR 2×2 m는 가구를 접어 비운 사각형의 치수. 안전한 움직임·제품 및 콘텐츠 적합성을 보증하지 않음',
 '상담 테이블 1.20×0.70 m와 접었을 때 1.20×0.18 m, 접의자 4개 0.65×0.65 m 수납은 제품 미선정 가정',
 '사진실 앞1.5m/뒤2.6m는 용도 구획이며 실제 촬영 가용 치수가 아님. 사진 카메라의 평면 1.4m 촬영은 검증 전 후보',
 '본 5안은 중앙통로 상부 수업카메라 후보를 유지. 후벽 카메라는 논의한 대안이며 반영·설치 확정하지 않음',
 '메인룸 거울/커튼·후면 배경은 공간 성격 표시. 수업 카메라 방향과 콘텐츠 촬영 방향을 혼동하지 않음'
];
fs.writeFileSync(file,JSON.stringify(plan,null,2)+'\n');
const fragment='C:/Users/q1212/.codex/visualizations/2026/09/27/01a0e247-e6df-7b72-af5d-20238b73ce68/synk-academy-amenity-plan.html';
let html=fs.readFileSync(fragment,'utf8');
html=html.replace(/(<script type="application\/json" id="sa-plan-data">)[\s\S]*?(<\/script>)/,'$1'+JSON.stringify(plan).replaceAll('<','\\u003c')+'$2');
fs.writeFileSync(fragment,html);
console.log(JSON.stringify({file,revision:5,rooms:plan.rooms.length,appliances:plan.appliances.length}));
