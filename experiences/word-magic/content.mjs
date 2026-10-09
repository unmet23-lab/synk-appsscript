/** Authored scenes. Korean meanings change the scene itself; no timer or grinding. */
export const SPELLS = Object.freeze({
 grow:{ko:'커져요',en:'Grow',property:'size',value:1.55,icon:'grow'},
 shrink:{ko:'작아져요',en:'Shrink',property:'size',value:.62,icon:'shrink'},
 open:{ko:'열어요',en:'Open',property:'open',value:true,icon:'open'},
 close:{ko:'닫아요',en:'Close',property:'open',value:false,icon:'close'},
 up:{ko:'위',en:'Up',property:'level',value:1,icon:'up'},
 down:{ko:'아래',en:'Down',property:'level',value:0,icon:'down'},
});
export const CHAPTERS = [
 {id:'size',ko:'커다란 작은 마을',en:'The very small, very big village',pair:['grow','shrink'],object:'rabbit',color:'butter',prize:'camera',reward:'사진기를 찾았어요!',rewardEn:'A camera for your discoveries!'},
 {id:'doors',ko:'잠든 극장',en:'The sleeping theatre',pair:['open','close'],object:'door',color:'lapis',prize:'book',reward:'이야기책을 찾았어요!',rewardEn:'A storybook full of surprises!'},
 {id:'sky',ko:'하늘 우체국',en:'The sky post office',pair:['up','down'],object:'purse',color:'coral',prize:'umbrella',reward:'하늘 우산을 찾았어요!',rewardEn:'An umbrella for your next adventure!'},
];
const object=(id,asset,x,y,extra={})=>({id,asset,x,y,size:1,open:false,level:0,...extra});
const goal=(id,property,value)=>({id,property,value});
const scene=(id,chapter,title,en,story,storyEn,objects,goals,ending,endingEn)=>({id,chapter,title,en,story,storyEn,objects,goals,ending,endingEn});
export const PUZZLES = [
 scene('size-1',0,'길을 비켜 줄래?','A little room, please','토끼가 너무 커서 길을 막았어요.','The rabbit is too big to pass the arch.',[object('rabbit','rabbit',470,342,{size:1.55}),object('chair','chair',740,380)], [goal('rabbit','size',.62)],'통로가 생겼어요. 같이 가요!','There is room for everyone!'),
 scene('size-2',0,'닿을 수 있어','A step closer','작은 의자로 높은 사진기를 찾아요.','Make a step to reach the camera.',[object('chair','chair',465,388,{size:.62}),object('rabbit','rabbit',720,370)], [goal('chair','size',1.55)],'의자가 훌륭한 계단이 됐어요!','The chair makes a brilliant step!'),
 scene('size-3',0,'소풍의 큰 문제','A very big picnic','커다란 물병과 작은 간식. 둘 다 바꿔 봐요.','A huge bottle and a tiny snack. Make a picnic that fits.',[object('bottle','water-bottle',375,382,{size:1.55}),object('snack','snack',655,376,{size:.62})],[goal('bottle','size',.62),goal('snack','size',1.55)],'딱 좋은 소풍 준비!','A picnic worth sharing!'),
 scene('size-4',0,'곰에게 선물','A gift for Bear','곰의 작은 튜브를 바꿔 주세요.','Bear needs a bigger swimming ring.',[object('ring','swim-ring',395,390,{size:.62}),object('bear','bear',695,350)],[goal('ring','size',1.55)],'곰도 둥실둥실 떠요.','Now Bear can float!'),
 scene('size-5',0,'엉뚱한 소품 사진','A wonderfully odd photo','우산 소품은 크게, 의자는 작게. 재미있는 사진을 찍어요.','A giant umbrella prop and a tiny chair. Set up a funny photo.',[object('umbrella','umbrella',395,330,{size:.62}),object('chair','chair',665,385,{size:1.55})],[goal('umbrella','size',1.55),goal('chair','size',.62)],'커다란 소품과 함께 찰칵!','A wonderfully odd photo. Say cheese!'),
 scene('size-6',0,'함께 찍는 사진','Everybody in the picture','친구들과 사진을 찍을 준비를 해요.','Make room for Rabbit and a seat for Penguin.',[object('rabbit','rabbit',350,350,{size:1.55}),object('chair','chair',590,390,{size:.62}),object('penguin','penguin',800,350,{size:.62})],[goal('rabbit','size',.62),goal('chair','size',1.55)],'모두 사진 속에 쏙 들어왔어요!','Everyone fits in the picture!'),
 scene('doors-1',1,'극장의 첫 손님','The first guest','문을 열면 여우가 들어와요.','Let Fox into the theatre.',[object('door','door',490,330),object('fox','fox',735,360)],[goal('door','open',true)],'여우 손님이 들어왔어요.','Welcome to the show, Fox!'),
 scene('doors-2',1,'바람을 막아요','A windy rehearsal','뒷문으로 바람이 들어와요.','Close the back door before the show.',[object('door','door',450,330,{open:true}),object('book','book',730,384,{open:true})],[goal('door','open',false)],'조용해졌어요. 공연 준비 완료!','Quiet at last. Ready to rehearse!'),
 scene('doors-3',1,'비밀 선물','A secret surprise','선물 상자 속을 보고 싶어요.','Discover the surprise inside the chest.',[object('chest','chest',450,383),object('rabbit','rabbit',730,355)],[goal('chest','open',true)],'작은 친구가 인사해요!','A tiny friend says hello!'),
 scene('doors-4',1,'쉿, 아직 비밀','Not just yet','선물은 닫고, 무대 문은 열어요.','Hide the present and open the stage.',[object('chest','chest',355,389,{open:true}),object('door','door',650,330)],[goal('chest','open',false),goal('door','open',true)],'서프라이즈 준비가 끝났어요!','The surprise is ready!'),
 scene('doors-5',1,'이야기의 시작','Once upon a time','문은 닫고 책을 펼쳐요.','Close the door and open the book.',[object('door','door',350,325,{open:true}),object('book','book',675,385)],[goal('door','open',false),goal('book','open',true)],'펠트 나라의 이야기가 시작돼요.','The story comes to life!'),
 scene('doors-6',1,'커튼콜','The grand finale','책을 덮고 문을 열어 친구들을 만나요.','Close the storybook. Open the door to meet your friends.',[object('book','book',355,383,{open:true}),object('door','door',650,330)],[goal('book','open',false),goal('door','open',true)],'모두가 무대로 나왔어요!','A bow for the whole cast!'),
 scene('sky-1',2,'첫 번째 배달','First delivery','가방을 위로 보내요.','Send the bag to the upper shelf.',[object('bag','purse',465,404),object('penguin','penguin',750,370)],[goal('bag','level',1)],'첫 소포가 도착했어요!','The first parcel has arrived!'),
 scene('sky-2',2,'토끼를 내려 줘요','Rabbit, come down','높이 올라간 토끼를 아래로 데려와요.','Bring Rabbit down for a picnic.',[object('rabbit','rabbit',460,404,{level:1}),object('snack','snack',730,390)],[goal('rabbit','level',0)],'토끼가 소풍에 합류했어요.','Rabbit joins the picnic!'),
 scene('sky-3',2,'엇갈린 소포','Mixed-up parcels','책은 위로, 가방은 아래로 보내요.','Book upstairs. Bag downstairs.',[object('book','book',365,404),object('bag','purse',655,404,{level:1})],[goal('book','level',1),goal('bag','level',0)],'소포가 제자리에 도착했어요.','Both parcels reach their owners!'),
 scene('sky-4',2,'우산 배달','An umbrella delivery','여우의 우산을 위층 보관함으로 보내요.','Send Fox’s umbrella to the upper shelf.',[object('umbrella','umbrella',440,404),object('fox','fox',735,375)],[goal('umbrella','level',1)],'여우의 우산이 안전하게 도착했어요.','Fox’s umbrella arrives safe and sound!'),
 scene('sky-5',2,'사진기 구조 작전','Rescue the camera','사진기를 내리고 튜브를 올려요.','Bring the camera down and send the ring up.',[object('camera','camera',355,404,{level:1}),object('ring','swim-ring',650,404)],[goal('camera','level',0),goal('ring','level',1)],'사진기도 튜브도 안전하게 도착!','Everything arrives safe and sound!'),
 scene('sky-6',2,'하늘 사진관','A photo in the sky','사진기는 위로, 토끼는 아래로. 마지막 사진이에요.','Camera upstairs, Rabbit downstairs. Our final picture!',[object('camera','camera',345,404),object('rabbit','rabbit',660,404,{level:1})],[goal('camera','level',1),goal('rabbit','level',0)],'작은 마을의 모든 친구가 모였어요!','A whole world of new friends!'),
];
export const LAB_OBJECTS=[object('rabbit','rabbit',245,382),object('chest','chest',470,400),object('book','book',705,389),object('umbrella','umbrella',530,245)];
export const LAB_SETS=Object.freeze({
 default:{id:'default',en:'The magic workshop',ko:'기본 마법 실험실',ideaEn:'Make a giant book. Open a tiny chest. Lift your umbrella.',ideaKo:'커다란 책, 작은 상자 속 비밀, 위로 올라간 우산을 만들어 봐요.',objects:LAB_OBJECTS},
 picnic:{id:'picnic',en:'Bear’s picnic playground',ko:'곰과 함께하는 소풍 실험실',ideaEn:'Make a swimming ring for Bear. Grow a snack to share. Open your picnic chest.',ideaKo:'곰에게 맞는 튜브, 나눠 먹을 큰 간식, 소풍 상자 속 친구를 만들어 봐요.',objects:[object('bear','bear',230,379),object('ring','swim-ring',460,415,{size:.62}),object('snack','snack',685,416,{size:.62}),object('chest','chest',740,283)]}
});
