import {lessonById} from './life-content.mjs';

export const CAFE_LESSON_ID='cafe-apply';
export const CAFE_COMPOSE_ID='cafe-compose';
export const CAFE_ACTIVITY_VERSION=1;
const phases=['welcome','choose','repair','response','break','complete'];
const clone=value=>JSON.parse(JSON.stringify(value));
export const CAFE_SEATS={window:'창가 자리',garden:'화분 옆 자리'};
export const CAFE_STEPS=[
 {name:'음료 주문',goal:'서하와 둘이 차가운 주스를 한 잔씩 마셔요.',staff:'어서 오세요. 어떤 음료로 드릴까요?',friend:'제 주스도 같이 주문해 줄래요?',speaker:'seoha',hint:'둘이 한 잔씩이면 두 잔이에요. 차가운 주스 두 잔 주세요.',next:'마실 곳 정하기',
  options:{a:{label:'차가운 주스 · 한 잔',drink:'cold',count:1,response:'차가운 주스 한 잔이요. 친구분도 함께 드시나요?',friend:'어? 한 잔이에요? 우리 둘이 한 잔씩 마셔요!'},b:{label:'차가운 주스 · 두 잔',drink:'cold',count:2,response:'네, 차가운 주스 두 잔 주문받았어요.',friend:'좋아요! 우리 둘이 한 잔씩이에요!'},c:{label:'따뜻한 주스 · 두 잔',drink:'warm',count:2,response:'따뜻한 주스 두 잔이요. 차가운 주스를 찾으셨던 것 같은데, 맞을까요?',friend:'저는 오늘 차가운 주스를 마시고 싶어요!'}}},
 {name:'마실 곳',goal:'서하와 카페 안의 테이블에서 마시려고 해요.',staff:'가져가실 건가요?',friend:'저기 자리가 있어요! 카페 안에서 마셔요!',speaker:'seoha',hint:'카페 안의 테이블에서 마실 때는 여기서 마실게요.',next:'주스 받아 자리로 가기',
  options:{a:{label:'포장해 주세요.',drink:'cold',count:2,response:'포장으로 준비할게요. 카페 안에 앉으실 거면 매장 이용으로 바꿔 드릴까요?',friend:'어? 우리는 카페 안에서 마시려고 했어요!'},b:{label:'아직 안 마셨어요.',drink:'cold',count:2,response:'네. 음료를 카페 안에서 드실지, 밖으로 가져가실지 알려 주세요.',friend:'여기서 마신다고 말해 볼까요?'},c:{label:'여기서 마실게요.',drink:'cold',count:2,response:'네, 매장 컵에 준비했어요. 두 잔 모두 가져가세요.',friend:'좋아요! 어디에 앉을까요?'}}},
 {name:'포장 부탁',goal:'이번에는 주문한 차를 가지고 학교에 가려고 해요.',staff:'따뜻한 차가 준비됐어요. 매장에서 드시나요?',friend:'저는 이제 수업이 있어요. 차는 가지고 갈게요.',speaker:'jiho',hint:'음료를 학교로 가져가려면 포장해 주세요.',next:'차 받아 학교로 가기',
  options:{a:{label:'포장해 주세요.',drink:'takeout',count:1,response:'네, 뚜껑을 닫아 포장했어요. 따뜻하니 조심해서 가져가세요.',friend:'고마워요. 따뜻할 때 가지고 갈게요.'},b:{label:'매장에서 마실게요.',drink:'tea',count:1,response:'매장 컵으로 드릴게요. 학교로 가져가시려면 포장 컵으로 바꿔 드릴까요?',friend:'저는 학교에 가야 해요. 가지고 갈 컵이 필요해요.'},c:{label:'주문을 취소할게요.',drink:null,count:0,response:'취소하시겠어요? 학교에 가져갈 차가 필요하시면 주문을 유지하고 포장해 드릴게요.',friend:'차는 필요해요. 포장을 부탁해 주세요.'}}},
];

const order=(drink,count,label,place='매장 이용')=>({drink,count,label,place});
export const CAFE_VISITS=[
 {id:CAFE_LESSON_ID,number:1,title:'같이 마실 주스, 내가 주문해 볼까?',caption:'오늘은 내가 주문하는 날',description:'서하와 카페에서 쉬고, 학교에 가는 지호에게 차를 챙겨 줘요.',steps:CAFE_STEPS,seatStep:1,breakStep:2,
  ending:{title:'주문부터 컵을 받기까지.',text:'친구와 마실 주스 두 잔, 지호가 학교에 가져갈 차 한 잔을 챙겼어요.',orders:[order('cold',2,'차가운 주스 두 잔','매장에서 함께'),order('takeout',1,'따뜻한 차 한 잔','학교로 가져가기')]}},
 {id:'cafe-visit-taste',number:2,title:'태오의 따뜻한 한 잔',caption:'두 번째 방문 · 친구의 취향',description:'따뜻한 차를 마시고 싶은 태오. 친구가 원하는 음료를 같이 골라요.',seatStep:2,
  steps:[
   {name:'친구의 취향',staff:'어서 오세요. 오늘은 어떤 음료를 드릴까요?',speaker:'taeo',friend:'저는 오늘 따뜻한 차를 마시고 싶어요.',hint:'태오가 원하는 것은 따뜻한 차예요. 종류와 온도를 함께 봐요.',next:'함께 마실 수량 정하기',menu:true,before:order(null,0,'태오의 취향을 골라 주세요','마실 곳은 아직'),options:{
    a:{...order('warm',1,'따뜻한 주스 한 잔'),response:'따뜻한 주스 한 잔이요. 친구분은 차를 원하셨던 것 같은데, 다시 확인할까요?',friend:'음, 주스 말고 차가 좋아요.'},
    b:{...order('tea',1,'따뜻한 차 한 잔'),response:'네, 따뜻한 차로 주문받았어요. 함께 드실 수량도 알려 주세요.',friend:'맞아요! 따뜻한 차예요.'},
    c:{...order('cold',1,'차가운 주스 한 잔'),response:'차가운 주스 한 잔이요. 오늘은 따뜻한 차로 바꾸실까요?',friend:'저는 따뜻한 차가 좋아요. 오늘은 추워요.'}}},
   {name:'함께 마실 수량',staff:'따뜻한 차를 몇 잔 준비할까요?',speaker:'jiho',friend:'태오 한 잔, 그리고 한 잔 더. 두 잔이에요.',hint:'두 사람이 한 잔씩 마시니까 따뜻한 차 두 잔 주세요.',next:'마실 곳 알려 주기',menu:true,before:order('tea',1,'따뜻한 차 한 잔','수량 확인 중'),options:{
    a:{...order('tea',1,'따뜻한 차 한 잔'),response:'한 잔이요. 두 분이 한 잔씩 드시면 두 잔으로 바꿔 드릴까요?',friend:'한 잔은 부족해요. 두 사람이 마셔요.'},
    b:{...order('tea',3,'따뜻한 차 세 잔'),response:'세 잔이요. 두 분의 컵만 필요하면 두 잔으로 바꿀 수 있어요.',friend:'두 사람이 마셔요. 두 잔이면 돼요.'},
    c:{...order('tea',2,'따뜻한 차 두 잔'),response:'따뜻한 차 두 잔, 확인했어요. 여기서 드시나요?',friend:'네, 두 잔이 맞아요.'}}},
   {name:'함께 쉬는 자리',staff:'가져가실 건가요, 여기서 드실 건가요?',speaker:'seoha',friend:'비가 와요. 여기서 같이 쉬어요!',hint:'카페 안에서 쉬며 마시니까 여기서 마실게요.',next:'차 받아 친구와 앉기',before:order('tea',2,'따뜻한 차 두 잔','마실 곳 확인 중'),options:{
    a:{...order('tea',2,'따뜻한 차 두 잔'),response:'네, 매장 컵 두 잔 준비했어요. 편한 자리를 골라 주세요.',friend:'좋아요! 같이 앉아요!'},
    b:{...order('takeout',2,'따뜻한 차 두 잔','포장 요청'),response:'포장으로 준비할게요. 카페 안에서 쉬실 거면 매장 이용으로 바꿀까요?',friend:'어? 우리는 안에서 쉬려고 했어요!'},
    c:{...order(null,0,'취소 확인 중','아직 수령하지 않음'),response:'취소하시겠어요? 따뜻한 차를 마시려면 주문을 유지하실 수 있어요.',friend:'우리 같이 따뜻한 차를 마셔요!'}}}],
  ending:{title:'태오의 취향을 기억했어요.',text:'따뜻한 차 두 잔을 받아 친구와 함께 앉았어요.',orders:[order('tea',2,'따뜻한 차 두 잔','친구와 함께')],lines:[{speaker:'taeo',text:'제가 좋아하는 차를 기억했네요. 다음에도 같이 와요.'},{speaker:'seoha',text:'다음에는 제가 좋아하는 것도 같이 골라요!'},{speaker:'jiho',text:'따뜻한 차 두 잔, 잘 받았어요. 천천히 마셔요.'}]}},
 {id:'cafe-visit-soldout',number:3,title:'주스가 없는 날',caption:'세 번째 방문 · 작은 품절 안내',description:'주스가 다 나간 날. 가능한 음료를 찾아 공원에 가져가요.',
  steps:[
   {name:'오늘의 메뉴',staff:'오늘 주스는 품절이에요. 따뜻한 차는 주문하실 수 있어요.',speaker:'seoha',friend:'어? 주스가 없어요! 다른 음료를 볼까요?',hint:'품절은 주문할 수 없다는 뜻이에요. 오늘 가능한 것은 따뜻한 차예요.',next:'수량 다시 확인하기',menu:true,notice:'오늘 주스 품절 · 따뜻한 차 주문 가능',before:order(null,0,'가능한 음료를 골라 주세요','공원으로 가져갈 주문'),options:{
    a:{...order('tea',1,'따뜻한 차 한 잔'),response:'네, 따뜻한 차 한 잔으로 준비할게요.',friend:'차는 있어요! 이걸로 해요!'},
    b:{...order(null,0,'차가운 주스 · 품절','준비되지 않은 음료'),previewDrink:'cold',response:'차가운 주스도 오늘은 품절이에요. 따뜻한 차는 준비할 수 있어요.',friend:'주스는 오늘 없어요. 다른 걸 봐요!'},
    c:{...order(null,0,'따뜻한 주스 · 품절','준비되지 않은 음료'),previewDrink:'warm',response:'따뜻한 주스도 품절이에요. 주스 대신 따뜻한 차로 드릴까요?',friend:'따뜻한 주스도 없어요. 차를 봐요!'}}},
   {name:'직원의 수량 확인',staff:'따뜻한 차, 두 잔, 맞나요?',speaker:'jiho',friend:'한 잔만 필요해요. 직원에게 다시 말해요.',hint:'두 잔이 아니라 한 잔이에요. 아니요, 한 잔 주세요.',next:'공원에 가져갈 컵 부탁하기',menu:true,before:order('tea',1,'따뜻한 차 한 잔','수량 확인 중'),options:{
    a:{...order('tea',3,'따뜻한 차 세 잔'),response:'세 잔으로 바꿀까요? 혼자 드실 한 잔이면 수량을 다시 알려 주세요.',friend:'세 잔은 많아요. 한 잔이에요.'},
    b:{...order('tea',2,'따뜻한 차 두 잔'),response:'두 잔으로 확인했어요. 한 잔만 필요하면 바꿔 드릴게요.',friend:'두 잔이 아니에요. 한 잔이에요.'},
    c:{...order('tea',1,'따뜻한 차 한 잔'),response:'아, 한 잔이군요. 한 잔으로 확인했어요. 여기서 드시나요?',friend:'네, 한 잔이 맞아요.'}}},
   {name:'공원으로 가져가기',staff:'차가 준비됐어요. 매장에서 드시나요?',speaker:'taeo',friend:'공원에 좋은 벤치가 있어요. 차를 가지고 가요.',hint:'공원으로 가져가려면 포장해 주세요.',next:'포장한 차 받아 공원으로',before:order('tea',1,'따뜻한 차 한 잔','마실 곳 확인 중'),options:{
    a:{...order('tea',1,'따뜻한 차 한 잔'),response:'매장 컵으로 드릴게요. 공원으로 가져가시면 포장 컵이 필요해요.',friend:'벤치는 밖에 있어요. 가지고 갈 컵이 필요해요.'},
    b:{...order('takeout',1,'따뜻한 차 한 잔','포장 · 공원으로'),response:'네, 뚜껑을 닫아 포장했어요. 컵을 받아 가세요.',friend:'좋아요! 따뜻할 때 가요.'},
    c:{...order(null,0,'취소 확인 중','아직 수령하지 않음'),response:'취소하시겠어요? 공원에 가져갈 차는 포장해 드릴 수 있어요.',friend:'차는 가지고 갈 거예요. 포장해 달라고 하면 돼요.'}}}],
  ending:{title:'주스 대신, 새로운 한 잔.',text:'품절 안내를 읽고 따뜻한 차 한 잔을 포장해 받았어요.',orders:[order('takeout',1,'따뜻한 차 한 잔','공원으로 가져가기')],lines:[{speaker:'seoha',text:'오늘은 차를 들고 같이 공원에 가요!'},{speaker:'taeo',text:'제가 본 벤치예요. 여기 앉아요.'},{speaker:'jiho',text:'주스 대신 차를 받았어요. 다음에는 주스도 있을 거예요.'}]}},
 {id:'cafe-visit-change',number:4,title:'태오의 마음이 바뀌었어요',caption:'네 번째 방문 · 주문 바꾸기',description:'음료를 만들기 전이에요. 차로 바꾸고 한 잔 더 챙겨 세 사람이 공원에 가요.',
  steps:[
   {name:'음료 바꾸기',staff:'따뜻한 주스 두 잔, 아직 만들기 전이에요. 주문을 바꾸시겠어요?',speaker:'taeo',friend:'저는 따뜻한 차가 더 좋아요. 지금 바꿀 수 있어요?',hint:'주스 대신 따뜻한 차로 바꿔 주세요. 바꿀 음료를 함께 말해요.',next:'지호의 컵 더하기',before:order('warm',2,'따뜻한 주스 두 잔','변경 전 주문'),options:{
    a:{...order('tea',2,'따뜻한 차 두 잔'),response:'네, 주스 대신 따뜻한 차 두 잔으로 바꿨어요.',friend:'네, 이거예요. 따뜻한 차!'},
    b:{...order('warm',2,'따뜻한 주스 두 잔'),response:'따뜻한 주스 두 잔을 유지할게요. 차로 바꾸려면 다시 알려 주세요.',friend:'저는 오늘 차로 바꾸고 싶어요.'},
    c:{...order('cold',2,'차가운 주스 두 잔'),response:'차가운 주스로 바꿀게요. 따뜻한 차를 원하시면 종류도 함께 알려 주세요.',friend:'주스 말고 따뜻한 차가 좋아요.'}}},
   {name:'한 잔 더',staff:'따뜻한 차 두 잔으로 바꿨어요. 더 필요한 것이 있나요?',speaker:'seoha',friend:'지호도 같이 마셔요! 두 잔에 한 잔 더하면 세 잔이에요!',hint:'두 잔에 한 잔을 추가해요. 한 잔 더 주세요.',next:'가져갈 곳 바꾸기',menu:true,before:order('tea',2,'따뜻한 차 두 잔','추가 전 주문'),options:{
    a:{...order('tea',1,'따뜻한 차 한 잔'),response:'한 잔을 빼면 한 잔만 남아요. 세 잔이 필요하시면 두 잔 더 추가할까요?',friend:'어? 컵이 줄었어요! 우리는 세 사람이에요!'},
    b:{...order('tea',3,'따뜻한 차 세 잔'),response:'한 잔 추가해서 따뜻한 차 세 잔으로 준비할게요.',friend:'좋아요! 지호 컵도 생겼어요!'},
    c:{...order('tea',2,'따뜻한 차 두 잔'),response:'두 잔을 유지할게요. 세 분이 드시면 한 잔 더 추가할 수 있어요.',friend:'지호 컵도 필요해요! 한 잔이 더 필요해요!'}}},
   {name:'포장으로 변경',staff:'세 잔 모두 매장에서 드실 건가요?',speaker:'jiho',friend:'우리는 공원으로 가요. 포장 컵이 세 개 필요해요.',hint:'주문은 유지하고 마실 곳을 바꿔요. 포장으로 바꿔 주세요.',next:'세 사람의 컵 받아 출발하기',before:order('tea',3,'따뜻한 차 세 잔','매장 이용'),options:{
    a:{...order('tea',3,'따뜻한 차 세 잔'),response:'매장 컵 세 잔으로 드릴게요. 공원에 가져가실 거면 포장으로 바꿀 수 있어요.',friend:'우리는 공원에서 마셔요. 가지고 갈 컵이 필요해요.'},
    b:{...order(null,0,'취소 확인 중','아직 수령하지 않음'),response:'세 잔 모두 취소하시겠어요? 음료는 유지하고 포장만 바꿀 수 있어요.',friend:'음료는 그대로예요. 마실 곳만 바꿔요.'},
    c:{...order('takeout',3,'따뜻한 차 세 잔','포장 · 공원으로'),response:'네, 세 잔 모두 포장으로 바꿨어요. 컵을 받아 가세요.',friend:'좋아요. 세 잔 모두 가지고 가요.'}}}],
  ending:{title:'셋의 컵을 모두 챙겼어요.',text:'주스를 따뜻한 차로 바꾸고, 한 잔을 더해 세 잔을 포장해 받았어요.',orders:[order('takeout',3,'따뜻한 차 세 잔','세 사람 · 공원으로')],lines:[{speaker:'taeo',text:'제 주문을 같이 바꿔 줘서 고마워요.'},{speaker:'seoha',text:'우리 컵이 다 있어요! 같이 가요!'},{speaker:'jiho',text:'세 잔 모두 받았어요. 이번에는 제 컵도 있어요.'}]}}
 ,{id:CAFE_COMPOSE_ID,number:5,title:'내 말로 주문해요',caption:'다섯 번째 방문 · 직접 만드는 주문',description:'음료·온도·잔 수를 골라 나의 주문 문장을 만들고 친구와 쉬어요.',seatStep:2,
  steps:[
   {name:'내 주문 만들기',staff:'어서 오세요. 어떤 음료를 몇 잔 준비할까요?',speaker:'seoha',friend:'태오와 한 잔씩, 따뜻한 차 두 잔을 주문해 봐요!',hint:'차를 고르고, 따뜻하게, 두 잔을 골라요. 세 정보를 합쳐 주문해요.',next:'직원과 수량 확인하기',compose:true,options:{}},
   {name:'수량 확인',staff:'따뜻한 차, 두 잔, 맞나요?',speaker:'jiho',friend:'따뜻한 차, 두 잔. 맞아요.',hint:'원하는 수량도 두 잔, 직원의 확인도 두 잔이에요. 네, 두 잔 주세요.',next:'마실 곳 알려 주기',menu:true,before:order('tea',2,'따뜻한 차 두 잔','수량 확인 중'),options:{
    a:{...order('tea',1,'따뜻한 차 한 잔'),response:'한 잔으로 바꿀까요? 두 분이 한 잔씩 드시면 두 잔이 필요해요.',friend:'두 사람이 마셔요. 두 잔이 필요해요.'},
    b:{...order('tea',2,'따뜻한 차 두 잔'),response:'네, 따뜻한 차 두 잔 확인했어요.',friend:'네, 두 잔이 맞아요.'},
    c:{...order('tea',3,'따뜻한 차 세 잔'),response:'세 잔으로 바꿀까요? 두 분의 컵만 필요하면 두 잔을 유지할 수 있어요.',friend:'두 사람이에요. 두 잔이면 돼요.'}}},
   {name:'우리 자리',staff:'가져가실 건가요, 여기서 드실 건가요?',speaker:'taeo',friend:'여기서 같이 쉬어요. 따뜻할 때 마셔요.',hint:'카페 안에서 함께 마시려면 네, 여기서 마실게요.',next:'내가 주문한 차 받아 앉기',before:order('tea',2,'따뜻한 차 두 잔','마실 곳 확인 중'),options:{
    a:{...order('tea',2,'따뜻한 차 두 잔'),response:'네, 두 잔 모두 매장 컵에 준비했어요. 자리를 골라 받아 가세요.',friend:'좋아요. 같이 앉아요.'},
    b:{...order('takeout',2,'따뜻한 차 두 잔','포장 요청'),response:'포장으로 준비할게요. 카페 안에서 쉬실 거면 매장 이용으로 바꿀까요?',friend:'저는 여기서 쉬려고 했어요. 매장 컵이 좋아요.'},
    c:{...order(null,0,'취소 확인 중','아직 수령하지 않음'),response:'취소하시겠어요? 음료를 함께 마시려면 주문을 유지하실 수 있어요.',friend:'저는 차를 마시고 싶어요. 주문은 그대로 해요.'}}}],
  ending:{title:'단어가 나의 주문이 됐어요.',text:'음료·온도·수량을 직접 골라 따뜻한 차 두 잔을 주문하고 친구와 앉았어요.',orders:[order('tea',2,'따뜻한 차 두 잔','나의 주문')],lines:[{speaker:'seoha',text:'직접 만든 문장으로 차가 나왔어요! 같이 마셔요!'},{speaker:'taeo',text:'제 차도 잘 챙겼네요. 다음 주문도 부탁해요.'},{speaker:'jiho',text:'주문을 직접 만들었어요. 잘했어요.'}]}}
];
export const CAFE_LESSON_IDS=CAFE_VISITS.map(visit=>visit.id);
export const cafeVisitById=id=>CAFE_VISITS.find(visit=>visit.id===id)||null;
export const isCafeLesson=id=>CAFE_LESSON_IDS.includes(id);
export function isCafeOrder(value,{complete=false}={}){
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===3&&Object.keys(value).every(k=>['drink','temperature','count'].includes(k))&&(complete?['juice','tea']:[null,'juice','tea']).includes(value.drink)&&(complete?['cold','warm']:[null,'cold','warm']).includes(value.temperature)&&(complete?[1,2,3]:[null,1,2,3]).includes(value.count);
}
export const isCafeListen=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===3&&Object.keys(value).every(k=>['mode','heard','textShown'].includes(k))&&['listen','read'].includes(value.mode)&&typeof value.heard==='boolean'&&typeof value.textShown==='boolean';
export function cafeOrderText(value){return isCafeOrder(value,{complete:true})?`${value.temperature==='warm'?'따뜻한':'차가운'} ${value.drink==='tea'?'차':'주스'} ${['','한','두','세'][value.count]} 잔 주세요.`:'음료 · 온도 · 잔 수를 골라 주세요.';}
const orderChoice=value=>value.drink!=='tea'||value.temperature!=='warm'?'c':value.count!==2?'b':'a';
export function updateCafeOrder(state,field,value){
 check(state,CAFE_COMPOSE_ID);if(state.step!==0||!['choose','repair'].includes(state.phase))throw TypeError('주문을 만드는 단계에서 골라 주세요.');
 const order={...state.order,[field]:value};if(!isCafeOrder(order))throw TypeError('음료, 온도, 잔 수를 확인해 주세요.');
 return {...state,order,phase:'choose',choiceId:null};
}
export function submitCafeOrder(state){
 check(state,CAFE_COMPOSE_ID);if(state.step!==0||!['choose','repair'].includes(state.phase)||!isCafeOrder(state.order,{complete:true}))throw TypeError('음료·온도·잔 수를 모두 골라 주세요.');
 const choiceId=orderChoice(state.order);return {...state,choiceId,phase:choiceId==='a'?'response':'repair'};
}

export function isCafeCheckpoint(value,lessonId=CAFE_LESSON_ID){
 const visit=cafeVisitById(lessonId);if(!visit)return false;
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==(lessonId===CAFE_COMPOSE_ID?2:1)||!Number.isInteger(value.step)||value.step<0||value.step>3||!phases.includes(value.phase)||!Object.hasOwn(CAFE_SEATS,value.seat)||![null,'a','b','c'].includes(value.choiceId))return false;
 if(Object.keys(value).some(key=>!['version','step','phase','seat','choiceId','listen',...(lessonId===CAFE_COMPOSE_ID?['order']:[])].includes(key)))return false;
 if(value.listen!==undefined&&!isCafeListen(value.listen))return false;
 if(lessonId===CAFE_COMPOSE_ID&&(!isCafeOrder(value.order)||value.step>0&&!isCafeOrder(value.order,{complete:true})))return false;
 if(value.phase==='welcome')return value.step===0&&value.choiceId===null;
 if(value.phase==='break')return value.step===visit.breakStep&&value.choiceId===null;
 if(value.phase==='complete')return value.step===3&&value.choiceId===null;
 if(value.step>2)return false;
 if(value.phase==='choose')return value.choiceId===null;
 if(lessonId===CAFE_COMPOSE_ID&&value.step===0&&(!isCafeOrder(value.order,{complete:true})||value.choiceId!==orderChoice(value.order)))return false;
 const answer=cafeQuestion(value.step,lessonId)?.answerId;
 return !!answer&&value.choiceId!==null&&(value.phase==='response'?value.choiceId===answer:value.choiceId!==answer);
}
const check=(state,id)=>{if(!isCafeCheckpoint(state,id))throw TypeError('Invalid cafe checkpoint');};
export function cafeQuestion(step,lessonId=CAFE_LESSON_ID){return lessonById(lessonId)?.questions[step]||null;}
export function resumeCafe(state,lessonId=state.id||CAFE_LESSON_ID){
 if(!isCafeLesson(lessonId))throw TypeError('Unknown cafe visit');
 if(isCafeCheckpoint(state.stage?.cafe,lessonId))return clone(state.stage.cafe);
 const result={version:lessonId===CAFE_COMPOSE_ID?2:1,step:0,phase:'welcome',choiceId:null,seat:'window',...(lessonId===CAFE_COMPOSE_ID?{order:{drink:null,temperature:null,count:null}}:{})};
 // Older reading-only attempts have no physical scene checkpoint. Retain their
 // first responses, then reopen the last response for an explicit next action.
 const questions=lessonById(lessonId).questions;
 const firstWrong=questions.findIndex(q=>state.answers[q.id]&&!state.answers[q.id].correct);
 const lastAnswered=questions.reduce((last,q,index)=>state.answers[q.id]?index:last,-1);
 const index=firstWrong<0?lastAnswered:firstWrong;
 if(index<0)return result;
 const q=questions[index],answer=state.answers[q.id],known=q.choices.some(c=>c.id===answer.choiceId);
 if(lessonId===CAFE_COMPOSE_ID){
  // A compose scene may only reuse the order sent with the first answer: it must
  // match that answer's choice, and a later step needs the order that passed step 0.
  // Otherwise reopen the welcome to compose again; an unknown later choice is asked again.
  const first=state.answers[questions[0].id],sent=first?.order;
  if(!isCafeOrder(sent,{complete:true})||first.choiceId!==orderChoice(sent)||index>0&&first.choiceId!==questions[0].answerId)return result;
  result.order=clone(sent);
  if(!known)return {...result,step:index,phase:'choose'};
 }
 result.step=index;result.choiceId=known?answer.choiceId:q.answerId;result.phase=result.choiceId===q.answerId?'response':'repair';
 return result;
}
export function chooseCafe(state,choiceId,lessonId=CAFE_LESSON_ID){
 if(lessonId===CAFE_COMPOSE_ID&&state.step===0)throw TypeError('단어를 골라 주문 문장을 만들어 주세요.');
 check(state,lessonId);if(!['choose','repair'].includes(state.phase)||!Object.hasOwn(cafeVisitById(lessonId).steps[state.step].options,choiceId))throw TypeError('Cafe is not accepting an order');
 return {...state,choiceId,phase:choiceId===cafeQuestion(state.step,lessonId).answerId?'response':'repair'};
}
export function advanceCafe(state,lessonId=CAFE_LESSON_ID){
 check(state,lessonId);
 const listen=state.listen?{listen:{...state.listen,heard:false,textShown:false}}:{};
 if(state.phase==='welcome'||state.phase==='break')return {...state,...listen,phase:'choose',choiceId:null};
 if(state.phase!=='response')throw TypeError('Confirm the cafe request first');
 const step=state.step+1;return {...state,...listen,step,phase:step===cafeVisitById(lessonId).breakStep?'break':step===3?'complete':'choose',choiceId:null};
}
export function chooseCafeSeat(state,seat,lessonId=CAFE_LESSON_ID){
 check(state,lessonId);if(!Object.hasOwn(CAFE_SEATS,seat)||!(state.step===cafeVisitById(lessonId).seatStep&&state.phase==='response'||state.phase==='break'))throw TypeError('Choose a seat after ordering');
 return {...state,seat};
}
export function cafeReceipt(state,lessonId=CAFE_LESSON_ID){
 check(state,lessonId);
 if(lessonId!==CAFE_LESSON_ID){
  const visit=cafeVisitById(lessonId);
  if(state.phase==='complete')return {...visit.ending.orders[0],place:visit.seatStep===2?CAFE_SEATS[state.seat]:visit.ending.orders[0].place,received:true};
  if(lessonId===CAFE_COMPOSE_ID&&state.step===0){const selected=isCafeOrder(state.order,{complete:true});return {drink:selected?state.order.drink==='tea'?state.order.temperature==='cold'?'coldtea':'tea':state.order.temperature==='cold'?'cold':'warm':null,count:selected?state.order.count:0,label:cafeOrderText(state.order),place:state.choiceId?'직원과 주문 확인 중':'아직 보내지 않은 주문',received:false};}
  const step=visit.steps[state.step],selection=state.choiceId?step.options[state.choiceId]:null;
  const result={...(selection||step.before),received:false};
  if(state.phase==='response'&&state.step===visit.seatStep)result.place=CAFE_SEATS[state.seat];
  return {drink:result.drink,count:result.count,label:result.label,place:result.place,received:false};
 }
 if(state.phase==='complete')return {drink:'takeout',count:1,label:'따뜻한 차 한 잔',place:'포장 · 학교로',received:true};
 if(state.phase==='break')return {drink:'cold',count:2,label:'차가운 주스 두 잔',place:CAFE_SEATS[state.seat],received:true};
 const selection=state.choiceId?CAFE_STEPS[state.step].options[state.choiceId]:null;
 if(state.step===0)return {drink:selection?.drink||null,count:selection?.count||0,label:selection?.label||'음료를 골라 주세요',place:'마실 곳은 아직',received:false};
 if(state.step===1)return {drink:'cold',count:2,label:'차가운 주스 두 잔',place:state.choiceId==='a'?'포장 요청':state.choiceId==='c'?CAFE_SEATS[state.seat]:'마실 곳 확인 중',received:false};
 return {drink:selection?selection.drink:'tea',count:selection?selection.count:1,label:state.choiceId==='c'?'취소 확인 중':'따뜻한 차 한 잔',place:state.choiceId==='a'?'포장 · 학교로':state.choiceId==='b'?'매장 이용':'포장 여부 확인 중',received:false};
}
