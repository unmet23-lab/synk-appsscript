import { CAMPAIGN, CHAPTERS } from './campaign.js';

// Original transfer practice: familiar expressions appear in new situations.
// Game levels describe practice difficulty, not an official TOPIK grade.
// [mode, passage, question, correct answer, distractor, distractor, explanation]
const packs = [
  [
    ['listen','언니는 주방에서 저녁을 만들어요.','언니는 무엇을 해요?','저녁을 만들어요','옷을 입어요','잠을 자요','언니는 주방에서 저녁을 만들어요. 저녁밥을 하는 거예요.'],
    ['listen','저는 고양이 사진을 찍어요.','무엇의 사진을 찍어요?','고양이','강아지','꽃','고양이 사진을 찍는다고 했어요.'],
    ['read','이 신발은 작아요. 큰 신발을 주세요.','어떤 신발을 원해요?','큰 신발','작은 신발','검은 신발','신발이 작아서 큰 신발을 달라고 했어요.'],
    ['listen','엄마는 빨간 모자를 써요.','모자는 무슨 색이에요?','빨간색','파란색','노란색','엄마는 빨간 모자를 써요. 모자는 빨간색이에요.'],
    ['read','지수는 아침에 달리고 밤에 자요.','지수는 밤에 무엇을 해요?','자요','달려요','노래해요','아침에는 달리고, 밤에는 자요.']
  ],
  [
    ['read','누나는 부엌(　) 요리해요.','빈칸에 알맞은 말을 골라요.','에서','에게','까지','요리하는 곳이 부엌이에요. 무엇을 하는 곳 뒤에는 ‘에서’를 써요.'],
    ['read','저는 친구(　) 함께 여행해요.','빈칸에 알맞은 말을 골라요.','와','를','에서','같이 여행하는 사람이 친구예요. ‘친구와 함께’처럼 ‘와’를 써요.'],
    ['listen','저는 피곤해요. 그래서 일찍 잘 거예요.','왜 일찍 자려고 해요?','피곤해서','배가 고파서','날씨가 추워서','피곤해요. 그래서 일찍 자요. ‘그래서’ 앞이 이유예요.'],
    ['read','이 식당은 멀어요. (　) 음식이 맛있어서 자주 가요.','빈칸에 알맞은 말을 골라요.','하지만','그래서','또는','식당이 먼 건 아쉽지만, 맛있어서 자주 가요. 서로 반대되는 말을 이을 때 ‘하지만’을 써요.'],
    ['listen','오늘 우체국에 가요. 그리고 꽃집에도 가요.','오늘 어디에 가요?','우체국과 꽃집','우체국만','꽃집만','우체국에 가고, 꽃집에도 가요. 두 곳 다 가요.']
  ],
  [
    ['listen','한국어 시험은 금요일 오전 열한 시에 있어요.','시험은 언제예요?','금요일 오전 11시','금요일 오후 11시','목요일 오전 11시','금요일 오전 열한 시라고 했어요. 요일과 시간을 둘 다 봐요.'],
    ['listen','미용실은 건물 삼 층에 있어요. 이 층에는 치과가 있어요.','미용실은 몇 층에 있어요?','3층','2층','1층','미용실은 삼 층이에요. 이 층에 있는 건 치과예요.'],
    ['read','일정표\n수요일: 청소 / 목요일: 장보기 / 금요일: 요리','장을 보는 날은 언제예요?','목요일','수요일','금요일','일정표를 보면 목요일이 장보기예요.'],
    ['listen','빵집은 꽃집 뒤에 있어요. 꽃집 앞에는 주차장이 있어요.','빵집은 어디에 있어요?','꽃집 뒤','꽃집 앞','주차장 안','빵집은 꽃집 뒤에 있어요. 꽃집 앞에 있는 건 주차장이에요.'],
    ['read','공연 시작: 오후 7시 30분\n입장 시작: 오후 7시','언제부터 들어갈 수 있어요?','오후 7시','오후 7시 30분','오후 8시','들어가는 건 일곱 시부터예요. 공연은 일곱 시 삼십 분에 시작해요.']
  ],
  [
    ['listen','가: 사과를 몇 개 드릴까요? 나: 세 개 주세요.','나는 무엇을 사고 있어요?','사과 세 개','사과 두 개','귤 세 개','사과를 세 개 달라고 했어요.'],
    ['listen','가: 오늘 함께 저녁 먹을까요? 나: 오늘은 바빠요. 내일은 어때요?','나는 언제 저녁을 먹자고 해요?','내일','오늘','어제','오늘은 바빠서, 내일 같이 먹자고 했어요.'],
    ['listen','가: 이 책을 빌리고 싶어요. 나: 학생증을 보여 주세요.','어디에서 하는 대화예요?','도서관','옷 가게','식당','책을 빌리려고 학생증을 보여 줘요. 여기는 도서관이에요.'],
    ['listen','가: 방이 좀 춥네요. 나: 제가 창문을 닫을게요.','나는 무엇을 할 거예요?','창문을 닫아요','창문을 열어요','밖으로 나가요','방이 춥다고 하니까, 창문을 닫겠다고 했어요.'],
    ['listen','가: 제주도에 비행기로 갔어요? 나: 아니요. 배를 타고 갔어요.','나는 제주도에 어떻게 갔어요?','배로 갔어요','비행기로 갔어요','버스로 갔어요','비행기가 아니라 배를 타고 갔어요.']
  ],
  [
    ['read','서점 안내\n매일 오전 10시에 엽니다. 수요일에는 오후 5시에 닫고, 다른 날에는 오후 8시에 닫습니다.','수요일 오후 6시에 책을 살 수 있어요?','살 수 없어요','오후 8시까지 살 수 있어요','오후 6시에 문을 열어요','수요일에는 오후 다섯 시에 문을 닫아요. 여섯 시에는 이미 닫혀 있어요.'],
    ['read','수진 씨, 냉장고에 주스가 있어요. 과일은 식탁 위에 있어요. 점심 전에 과일을 드세요. — 엄마','과일은 어디에 있어요?','식탁 위','냉장고 안','책상 아래','주스는 냉장고에 있고, 과일은 식탁 위에 있어요.'],
    ['read','박물관 안내\n사진을 찍을 수 있습니다. 그러나 카메라의 플래시는 사용하지 마세요.','할 수 있는 것은 무엇이에요?','플래시 없이 사진 찍기','플래시 켜고 사진 찍기','그림 만지기','사진은 찍어도 돼요. 하지만 플래시는 쓰면 안 돼요.'],
    ['read','택배 안내\n오늘 받는 사람이 집에 없어 택배를 경비실에 맡겼습니다. 경비실에서 찾아가 주세요.','택배는 어디에서 찾아요?','경비실','집 안','우체국','택배를 경비실에 맡겼어요. 경비실에 가서 찾으면 돼요.'],
    ['read','동아리 공지\n이번 주 모임만 토요일 오전 11시에 합니다. 다음 주부터는 다시 금요일 오후 6시에 합니다.','이번 주에는 언제 만나요?','토요일 오전 11시','금요일 오후 6시','토요일 오후 6시','이번 주만 토요일 오전 열한 시예요. 다음 주부터는 다시 금요일이에요.']
  ],
  [
    ['listen','아침에는 눈이 왔어요. 점심에는 눈이 그쳤지만 길이 미끄러웠어요. 그래서 자전거 대신 지하철을 탔어요.','왜 지하철을 탔어요?','길이 미끄러워서','지하철이 무료라서','자전거를 잃어버려서','눈은 그쳤지만 길이 미끄러웠어요. 그래서 지하철을 탔어요.'],
    ['read','체험 수업 안내\n금요일까지 신청하면 참가비는 무료입니다. 토요일부터 신청하면 5,000원입니다.\n민수는 목요일에 신청했습니다.','민수는 참가비를 얼마나 내요?','무료예요','5,000원','10,000원','금요일까지 신청하면 무료예요. 민수는 목요일에 신청했어요.'],
    ['listen','저는 처음에 검은 운동화를 사려고 했어요. 그런데 그 크기는 없었어요. 파란 운동화는 크기가 맞아서 샀어요.','결국 무엇을 샀어요?','파란 운동화','검은 운동화','흰 운동화','검은 운동화는 맞는 크기가 없어서, 크기가 맞는 파란 운동화를 샀어요.'],
    ['read','도서관 행사\n오후 1시: 영화 보기 / 오후 3시: 작가와의 만남\n작가와의 만남은 미리 신청한 사람만 참가할 수 있습니다.\n지수는 신청하지 않았고 오후 2시에 도착했습니다.','지수에 대한 설명으로 맞는 것은 무엇이에요?','작가와의 만남에 참가할 수 없어요','오후 1시 영화를 처음부터 볼 수 있어요','작가와의 만남을 신청했어요','작가와의 만남은 신청한 사람만 갈 수 있는데, 지수는 신청하지 않았어요. 한 시 영화도 이미 시작했어요.'],
    ['listen','점심을 먹고 동생을 만나기로 했어요. 그런데 동생이 늦게 온다고 했어요. 그래서 먼저 은행에 갔다가 동생을 만났어요.','점심을 먹은 후 가장 먼저 무엇을 했어요?','은행에 갔어요','동생을 만났어요','집에 갔어요','동생이 늦게 온다고 해서, 먼저 은행에 갔다가 동생을 만났어요.']
  ]
];

const rewards = [
  {id:'paint-aurora',title:'오로라 도색',kind:'paint'},
  {id:'wheel-blossom',title:'블라썸 휠',kind:'wheel'},
  {id:'trail-starlight',title:'별빛 부스터',kind:'trail'},
  {id:'badge-coast',title:'해안 챔피언 배지',kind:'badge'},
  {id:'paint-sunset',title:'노을 도색',kind:'paint'},
  {id:'vehicle-finale',title:'챔피언 차량',kind:'vehicle'}
];

export const FINALES = packs.map((rows,i)=>{
  const chapter=i+1,theme=CHAPTERS[i];
  return {
    id:`finale-${chapter}`,number:0,campaign:true,finale:true,chapter,level:chapter,
    title:`${theme.title} 결승전`,mode:rows.every(r=>r[0]==='listen')?'listen':'mixed',
    scene:theme.scene,skill:`${theme.skill} · 종합 연습`,words:[],reward:rewards[i],
    items:rows.map(([mode,passage,prompt,answer,b,c,explanation],j)=>{
      const id=`f${String(chapter).padStart(2,'0')}q${j+1}`;
      return {
        id,mode:mode==='read'?'reading':'sentence',passage,prompt,
        spoken:`${passage.replace(/\(　\)/g,'빈칸').replace(/\n/g,'. ')} ${prompt}`,
        explanation,answer:`${id}o0`,word:answer,audio:[`${id}q`],answerAudio:[`${id}a`],
        choices:[answer,b,c].map((word,k)=>({id:`${id}o${k}`,word})),
        options:[0,1,2].map(k=>`${id}o${k}`)
      };
    })
  };
});

export const FINALE_BY_ID = Object.fromEntries(FINALES.map(s=>[s.id,s]));
export const FINALE_QUESTION_BY_ID = Object.fromEntries(FINALES.flatMap(s=>s.items).map(q=>[q.id,q]));
export const FINALE_CHOICE_BY_ID = Object.fromEntries(FINALES.flatMap(s=>s.items.flatMap(q=>q.choices)).map(c=>[c.id,c]));

export function finaleUnlocked(progress,stage) {
  const finale=FINALE_BY_ID[stage?.id];
  if(!finale)return !stage?.finale;
  const courses=CAMPAIGN.filter(s=>s.chapter===finale.chapter);
  return courses.length===2&&courses.every(s=>progress?.stages?.[s.id]?.cleared===true);
}

export function finaleReward(stage) {
  return FINALE_BY_ID[typeof stage==='string'?stage:stage?.id]?.reward||null;
}
