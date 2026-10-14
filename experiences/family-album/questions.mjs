// 가족 이야기 앨범 질문 은행.
// 질문은 말로 답하기 쉬운 열린 질문이고, 같은 뜻의 질문은 group으로 묶어 한 번만 묻는다.
// 앨범에는 질문 id만 남긴다(page.questionId, album.skippedQuestions). 은행에서 질문을
// 빼더라도 옛 앨범은 그대로 읽히며, 모르는 id는 선택·집계에서 조용히 무시한다.
import { emptyAlbum, newId, validateAlbum, upsertPage } from './model.mjs';

export const SKIP_HINT = '건너뛰어도 괜찮아요';

export const TOPICS = Object.freeze([
  { id: 'hometown', label: '고향과 어린 시절' },
  { id: 'roots', label: '부모님과 집안 어른' },
  { id: 'school', label: '학교와 친구' },
  { id: 'war', label: '6·25와 피난' },
  { id: 'military', label: '군대와 첫 사회생활' },
  { id: 'work', label: '첫 직장과 첫 월급' },
  { id: 'marriage', label: '중매·연애·결혼' },
  { id: 'parenting', label: '자녀를 키우며' },
  { id: 'home', label: '이사와 집' },
  { id: 'hard-times', label: '어려웠던 시절' },
  { id: 'holidays', label: '명절·김장·제사' },
  { id: 'kitchen', label: '집밥과 손맛', recipe: true },
  { id: 'legacy', label: '남기고 싶은 말' },
].map(Object.freeze));

// 사진에서 시작할 때 먼저 묻는 세 가지. field는 답을 넣을 페이지 칸이다
// (date·person은 페이지 칸, place는 기존 세부 질문 details.place).
export const PHOTO_STARTERS = Object.freeze([
  { id: 'when', field: 'date', text: '이 사진은 언제쯤 찍은 거예요? 계절이나 그날 있었던 일이 기억나세요?' },
  { id: 'who', field: 'person', text: '사진 속 사람들은 누구누구예요? 한 분씩 짚어 볼까요?' },
  { id: 'where', field: 'place', text: '여기는 어디예요? 무슨 일로 그곳에 가셨어요?' },
].map(Object.freeze));

// 군대 생활을 직접 묻지 않을 관계. 어머니·할머니께는 「군대 보내던 날」만 묻는다.
const WOMEN = ['mother', 'grandmother', 'maternal-grandmother'];
// 6·25를 직접 기억할 수 있는 나이: 1945년생까지(전쟁이 난 1950년에 다섯 살 이상).
const WAR_MEMORY = 1946;

const RAW = {
  hometown: [
    { id: 'hometown-village', title: '태어난 동네', text: '{호칭}, 태어나신 동네는 어떤 곳이었어요? 눈 감으면 제일 먼저 떠오르는 풍경이 있으세요?', followups: ['동네 사람들은 주로 무슨 일을 하며 살았어요?', '동네에서 제일 크게 보이던 건 뭐였어요? 산이나 강, 큰 나무 같은 거요.'], photoPrompt: '이 사진 속 동네가 고향인가요? 언제쯤 찍은 사진인지 기억나세요?' },
    { id: 'hometown-house', title: '어릴 적 살던 집', text: '어릴 때 살던 집은 어떻게 생겼었어요? 방은 몇 칸이었고, 마당에는 뭐가 있었어요?', followups: ['식구들은 어느 방에서 어떻게 나눠 잤어요?', '부엌이나 우물가는 어떤 모습이었어요?'], photoPrompt: '사진 속 이 집에서 사셨어요? 집 안 어디가 제일 기억나세요?' },
    { id: 'hometown-play', title: '해 지는 줄 모르던 놀이', text: '어릴 때 동네 아이들이랑 뭐 하고 노셨어요? 해 지는 줄 모르고 하던 놀이가 있었어요?', followups: ['그 놀이 규칙을 손주들한테 알려 주실 수 있으세요?', '같이 놀던 친구들 이름이 기억나세요?'] },
    { id: 'hometown-chores', title: '어릴 때 맡은 집안일', text: '어릴 때 집에서 맡으셨던 일이 있었어요? 물 긷기나 동생 돌보기, 소 먹이기 같은 일이요.', followups: ['그 일을 하기 싫은 날은 어떻게 하셨어요?'] },
    { id: 'hometown-snack', title: '어릴 적 군것질', text: '어릴 때 군것질거리는 뭐였어요? 그중에 제일 귀하게 먹었던 건요?', followups: ['그건 어디서 어떻게 구하셨어요?'] },
    { id: 'hometown-seasons', title: '계절마다 기다리던 것', text: '고향에서 계절마다 기다리던 게 있었어요? 여름 냇가 물놀이나 겨울 썰매 같은 거요.', followups: ['그 계절이 오면 집에서 꼭 하던 일도 있었어요?'] },
    { id: 'hometown-scolded', title: '크게 혼난 날', text: '어릴 때 크게 혼났던 일 기억나세요? 무슨 일로, 누구한테 혼나셨어요?', followups: ['그때 편들어 준 사람은 없었어요?'] },
    { id: 'hometown-elders', title: '생각나는 동네 어른', text: '고향 동네에 지금도 생각나는 어른이나 이웃이 있으세요? 어떤 분이셨어요?', followups: ['그분이 해 주신 말이나 일 중에 남아 있는 게 있으세요?'] },
    { id: 'hometown-nickname', title: '어릴 적 별명', text: '어릴 때 불리던 별명이나 집에서 부르던 이름이 있었어요? 왜 그렇게 불렸어요?', followups: ['그 별명을 지금도 부르는 사람이 있어요?'] },
    { id: 'hometown-longing', title: '지금도 그리운 고향', text: '{고향}에서 지금도 그리운 게 있다면 뭐예요? 소리나 냄새라도 좋아요.', followups: ['그걸 다시 느껴 본 적이 있으세요?'] },
  ],
  roots: [
    { id: 'roots-parents-work', title: '부모님이 하신 일', text: '부모님은 무슨 일을 하셨어요? 일하시던 모습 중에 기억나는 장면이 있으세요?', followups: ['그 일을 거들어 드린 적도 있으세요?'] },
    { id: 'roots-mother', title: '어머님 이야기', text: '어머님은 어떤 분이셨어요? 자주 하시던 말씀이나 버릇이 기억나세요?', followups: ['어머님 얼굴을 떠올리면 어떤 표정이 먼저 생각나세요?'], photoPrompt: '사진 속 이분이 어머님이세요? 이 사진은 언제쯤 찍은 거예요?' },
    { id: 'roots-father', title: '아버님 이야기', text: '아버님은 어떤 분이셨어요? 아버님한테 칭찬받았던 일이 있으세요?', followups: ['아버님이 화내시던 때는 어떤 때였어요?'], photoPrompt: '사진 속 이분이 아버님이세요? 어디서 찍은 사진이에요?' },
    { id: 'roots-grandparents', title: '할아버지 할머니', text: '할아버지, 할머니를 기억하세요? 같이 사셨어요, 따로 사셨어요?', followups: ['그분들께 들은 옛날이야기가 있으세요?'] },
    { id: 'roots-siblings', title: '형제들', text: '형제는 몇이셨어요? 몇째셨고, 그중에 누구랑 제일 가까우셨어요?', followups: ['형제들이랑 크게 다퉜던 일도 있었어요?', '지금 형제들은 어디서 어떻게 지내세요?'], photoPrompt: '사진 속에 형제분들이 다 있어요? 누가 누구인지 짚어 주실래요?' },
    { id: 'roots-own-name', title: '내 이름에 담긴 뜻', text: '{호칭} 이름은 누가 지어 주셨어요? 이름에 담긴 뜻을 들으신 적 있으세요?', followups: ['이름 때문에 생긴 재미있는 일은 없었어요?'] },
    { id: 'roots-family-lore', title: '집안에 전해 오는 이야기', text: '집안에 대대로 전해 오는 이야기가 있으세요? 조상 이야기나 집안 내력 같은 거요.', followups: ['그 이야기는 누구한테서 들으셨어요?'] },
    { id: 'roots-parents-words', title: '부모님께 들은 말', text: '부모님께 들은 말씀 중에 지금까지 마음에 남은 게 있으세요?', followups: ['그 말씀을 언제 처음 실감하셨어요?'] },
    { id: 'roots-farewell', title: '부모님을 보내던 때', text: '부모님을 떠나보내시던 때가 기억나세요? 마지막으로 나누신 이야기가 있으셨어요?', followups: ['지금 부모님께 한마디 할 수 있다면 뭐라고 하시겠어요?'], sensitive: true },
  ],
  school: [
    { id: 'school-first-day', title: '처음 학교 가던 날', text: '{호칭}, 처음 학교 가던 날 기억나세요? 뭘 입고, 누구 손을 잡고 가셨어요?', followups: ['그날 제일 떨렸던 순간은 언제였어요?'] },
    { id: 'school-road', title: '학교 가는 길', text: '학교까지는 어떻게 다니셨어요? 오가는 길에 있었던 일 중에 생각나는 게 있으세요?', followups: ['비 오거나 눈 오는 날에는 어떻게 다니셨어요?'] },
    { id: 'school-lunchbox', title: '도시락', text: '학교에 도시락은 뭘 싸 가셨어요? 친구 반찬 중에 부러웠던 게 있었어요?', followups: ['도시락을 못 싸 간 날은 어떻게 하셨어요?'] },
    { id: 'school-teacher', title: '기억에 남는 선생님', text: '기억에 남는 선생님이 계세요? 그 선생님은 어떤 분이셨어요?', followups: ['그 선생님께 들은 말 중에 남아 있는 게 있으세요?'] },
    { id: 'school-friend', title: '단짝 친구', text: '학교 다닐 때 제일 친했던 친구는 누구였어요? 둘이 뭘 하고 다니셨어요?', followups: ['그 친구 소식은 지금도 들으세요?'], photoPrompt: '사진 속에 같이 있는 친구는 누구예요? 그날 어디서 찍으셨어요?' },
    { id: 'school-good-at', title: '잘하던 것', text: '좋아하던 과목이나 남보다 잘하던 게 있으셨어요? 상을 받아 본 적도 있으세요?', followups: ['그 재주를 지금도 쓰세요?'] },
    { id: 'school-trip', title: '소풍과 수학여행', text: '소풍이나 수학여행 가서 있었던 일 기억나세요? 어디로 가셨어요?', followups: ['그날 싸 간 음식은 뭐였어요?'], photoPrompt: '이 사진은 소풍 때예요, 수학여행 때예요? 어디로 갔던 날이에요?' },
    { id: 'school-dream', title: '어릴 적 꿈', text: '학생 때는 커서 뭐가 되고 싶으셨어요? 그 꿈은 어떻게 됐어요?', followups: ['그 꿈을 누구한테 말해 본 적 있으세요?'] },
    { id: 'school-unfinished', title: '더 하고 싶던 공부', text: '공부를 더 하고 싶었는데 못 하셨던 적이 있으세요? 그때 사정이 어땠어요?', followups: ['지금이라도 배워 보고 싶은 게 있으세요?'], sensitive: true },
  ],
  war: [
    { id: 'war-outbreak', title: '전쟁이 났다는 소식', text: '6·25가 났다는 걸 처음 아셨을 때 어디 계셨어요? 그때 몇 살이셨어요?', followups: ['그 소식은 누구한테서 들으셨어요?'], needsBornBefore: WAR_MEMORY, sensitive: true },
    { id: 'war-refuge', title: '피난길', text: '피난을 가셨어요? 어디로, 누구랑, 어떻게 가셨는지 기억나세요?', followups: ['가는 길에는 어디서 묵으셨어요?', '피난 가서는 어디서 지내셨어요?'], needsBornBefore: WAR_MEMORY, sensitive: true },
    { id: 'war-belongings', title: '챙겨 간 것, 두고 온 것', text: '피난 갈 때 뭘 챙겨 가셨어요? 두고 와서 내내 아쉬웠던 게 있으세요?', needsBornBefore: WAR_MEMORY, sensitive: true },
    { id: 'war-meals', group: 'hungry-times', title: '전쟁 통의 끼니', text: '전쟁 중에는 끼니를 어떻게 이으셨어요? 그때 먹던 것 중에 생각나는 게 있으세요?', needsBornBefore: WAR_MEMORY, sensitive: true },
    { id: 'war-separated', title: '헤어진 사람들', text: '전쟁 때 헤어졌거나 소식이 끊긴 가족이나 이웃이 있으세요?', followups: ['나중에 다시 만나셨어요?', '그분에 대해 남겨 두고 싶은 이야기가 있으세요?'], needsBornBefore: WAR_MEMORY, sensitive: true },
    { id: 'war-helpers', group: 'helped-in-hard-times', title: '전쟁 때 고마웠던 사람', text: '그 난리 통에 도와준 사람이나 고마웠던 일이 있으세요?', needsBornBefore: WAR_MEMORY, sensitive: true },
    { id: 'war-homecoming', title: '돌아온 동네', text: '전쟁이 끝나고 돌아가 보니 동네는 어떻게 변해 있었어요?', followups: ['살던 집은 남아 있었어요?'], needsBornBefore: WAR_MEMORY, sensitive: true },
    { id: 'war-aftermath', title: '전쟁 뒤의 살림', text: '전쟁 끝나고 몇 해 동안 살림은 어떻게 꾸리셨어요? 구호물자 받던 기억도 있으세요?', needsBornBefore: 1951, sensitive: true },
    { id: 'war-heard', title: '부모님께 들은 6·25', text: '부모님께 6·25 때 이야기를 들으신 적 있으세요? 어떤 이야기가 기억나세요?', followups: ['그 이야기를 몇 번이나 들으셨어요?'], needsBornBefore: 1966, sensitive: true },
  ],
  military: [
    { id: 'military-enlist', title: '입대하던 날', text: '군대 가시던 날 기억나세요? 누가 배웅해 주셨어요?', followups: ['머리 깎던 날 기분이 어떠셨어요?'], skipRelations: WOMEN },
    { id: 'military-service', title: '군대 생활', text: '군대는 어디서, 무슨 일을 하며 지내셨어요? 제일 고됐던 때는 언제였어요?', followups: ['군대에서 배운 것 중에 지금도 쓰는 게 있으세요?'], skipRelations: WOMEN, photoPrompt: '이 군복 입은 사진은 언제 찍으셨어요? 같이 찍힌 분은 누구예요?' },
    { id: 'military-letters', title: '편지와 면회', text: '군대에 있을 때 받은 편지나 면회 온 사람이 있었어요? 그때 마음이 어떠셨어요?', skipRelations: WOMEN },
    { id: 'military-comrade', title: '군대에서 만난 사람', text: '군대에서 만난 사람 중에 지금도 생각나는 분이 있으세요? 어떤 사이셨어요?', skipRelations: WOMEN },
    { id: 'military-sendoff', title: '군대 보내던 날', text: '가족이나 가까운 사람을 군대에 보내 보셨어요? 보내던 날 어떠셨어요?', followups: ['그동안 편지나 소식은 어떻게 주고받으셨어요?'] },
    { id: 'away-leaving-home', title: '처음 집을 떠나던 날', text: '처음 집을 떠나 객지에서 지내 보신 건 언제였어요? 어디로, 무슨 일로 가셨어요?', followups: ['떠나던 날 집에서 누가 뭐라고 하셨어요?'] },
    { id: 'away-new-city', title: '처음 가 본 도시', text: '처음 가 본 큰 도시에서 놀라셨던 게 있으세요? 그게 어디였어요?', followups: ['그때 본 것 중에 지금은 없어진 게 있어요?'] },
    { id: 'away-first-room', title: '객지의 첫 방', text: '객지에서 처음 얻은 방이나 기숙사는 어땠어요? 같이 지낸 사람이 있었어요?', followups: ['방값은 얼마였는지 기억나세요?'] },
    { id: 'away-homesick', title: '집 생각 나던 밤', text: '타지에서 집 생각이 날 때는 어떻게 견디셨어요?', followups: ['그럴 때 부르던 노래나 찾던 음식이 있었어요?'] },
    { id: 'away-street-smarts', title: '처음 배운 세상 물정', text: '사회에 나와서 처음 배운 세상 물정은 뭐였어요? 누구한테 배우셨어요?', followups: ['그걸 몰라서 손해 본 적도 있으세요?'] },
  ],
  work: [
    { id: 'work-first-earning', title: '처음 해 본 돈벌이', text: '처음으로 돈을 벌어 보신 일은 뭐였어요? 어떻게 그 일을 하게 되셨어요?', followups: ['그 일을 하면서 제일 힘들었던 건 뭐였어요?'], photoPrompt: '사진 속 이곳이 일하시던 곳인가요? 같이 찍힌 분들은 누구예요?' },
    { id: 'work-first-pay', title: '첫 월급', text: '첫 월급은 얼마였어요? 받아서 제일 먼저 뭐 하셨어요?', followups: ['부모님께 드린 게 있으셨어요?', '그 돈이면 그때 뭘 살 수 있었어요?'] },
    { id: 'work-first-day', title: '첫 출근', text: '첫 출근하던 날 기억나세요? 뭘 입고 가셨고, 처음 맡은 일은 뭐였어요?' },
    { id: 'work-mentor', title: '고마웠던 일터 사람', text: '일하면서 만난 윗사람이나 동료 중에 고마운 분이 있으세요? 어떤 도움을 받으셨어요?' },
    { id: 'work-craft', title: '손이 기억하는 일', text: '일하면서 몸에 익힌 기술이나 요령이 있으세요? 지금도 손이 기억하는 거요.', followups: ['그 요령을 누구한테 가르쳐 준 적 있으세요?'] },
    { id: 'work-proud-day', title: '일하며 뿌듯했던 날', text: '일하면서 제일 뿌듯했던 날은 언제였어요? 무슨 일이 있었어요?' },
    { id: 'work-daily', title: '한창때의 하루', text: '한창 일하실 때 하루가 어떻게 흘러갔어요? 몇 시에 나가서 몇 시에 들어오셨어요?', followups: ['쉬는 날에는 뭘 하셨어요?'] },
    { id: 'work-change', title: '일을 바꾸던 때', text: '하던 일을 그만두거나 바꾸셨던 때가 있으세요? 어떤 사정이 있었어요?' },
    { id: 'work-lifework', title: '평생 해 온 일', text: '평생 해 오신 일을 돌아보면 어떤 마음이 드세요? 그 일 덕분에 얻은 게 있다면요?' },
  ],
  marriage: [
    { id: 'marriage-meeting', title: '처음 만난 날', text: '{배우자}하고는 처음에 어떻게 만나셨어요? 중매였어요, 연애였어요?', followups: ['처음 만난 곳이 어디였어요?', '그날 뭘 입고 나가셨어요?'] },
    { id: 'marriage-first-impression', title: '첫인상', text: '처음 봤을 때 첫인상은 어땠어요? 이 사람이다 싶었던 건 언제였어요?' },
    { id: 'marriage-courtship', title: '결혼 전의 만남', text: '결혼 전에 둘이 따로 만난 적이 있으셨어요? 만나면 어디 가서 뭘 하셨어요?' },
    { id: 'marriage-proposal', title: '결혼하자는 말', text: '결혼하자는 말은 누가, 어떻게 꺼냈어요?', followups: ['그 말을 들었을 때 바로 대답하셨어요?'] },
    { id: 'marriage-families', title: '양가 어른들', text: '양가 어른들은 결혼을 어떻게 받아들이셨어요? 반대는 없었어요?' },
    { id: 'marriage-wedding', title: '결혼식 날', text: '결혼식은 어디서, 어떻게 올리셨어요? 그날 날씨나 입은 옷이 기억나세요?', followups: ['결혼식에서 생긴 웃지 못할 일은 없었어요?'], photoPrompt: '이 결혼사진은 어디서 찍으셨어요? 사진 속 사람들은 누구누구예요?' },
    { id: 'marriage-honeymoon', title: '신혼여행', text: '신혼여행은 다녀오셨어요? 어디로 가서 뭘 하셨어요?', photoPrompt: '이 사진은 신혼여행 때 찍으신 거예요? 여기가 어디예요?' },
    { id: 'marriage-newlywed-home', title: '신혼살림', text: '신혼살림은 어디서 시작하셨어요? 처음 장만한 살림살이는 뭐였어요?' },
    { id: 'marriage-long-together', title: '오래 함께 사는 비결', text: '오래 같이 살아 보니 서로 맞춰 가는 비결이 뭐였어요?', followups: ['크게 다퉜다가 화해한 날도 기억나세요?'] },
    { id: 'marriage-in-laws', title: '시집살이와 처가살이', text: '시집살이나 처가살이를 해 보셨어요? 그때 어떤 일들이 있었어요?', sensitive: true },
  ],
  parenting: [
    { id: 'parenting-first-news', title: '첫아이 소식', text: '{호칭}, 첫아이가 생겼다는 걸 아셨을 때 어떤 마음이셨어요? 누구한테 제일 먼저 알리셨어요?' },
    { id: 'parenting-birth-day', title: '첫아이가 태어난 날', text: '첫아이가 태어나던 날은 어땠어요? 어디서 태어났고, 누가 곁에 있었어요?', photoPrompt: '사진 속 아기는 누구예요? 몇 살 때 찍은 사진이에요?' },
    { id: 'parenting-names', title: '아이들 이름을 지은 이유', text: '아이들 이름은 누가, 어떻게 지으셨어요? 이름마다 담긴 뜻이 있어요?', followups: ['다른 후보 이름도 있었어요?', '작명소나 집안 어른께 받은 이름이에요?'] },
    { id: 'parenting-little-ones', title: '아이들 어릴 적', text: '아이들은 어릴 때 각각 어떤 아이였어요? 지금 생각해도 웃음 나는 일이 있으세요?', photoPrompt: '사진 속 아이들이 몇 살 때예요? 이날 무슨 일이 있었어요?' },
    { id: 'parenting-hardest', title: '아이 키우며 힘들던 때', text: '아이 키우면서 제일 힘들었던 때는 언제였어요? 그때 누가 도와줬어요?' },
    { id: 'parenting-house-rules', title: '우리 집 규칙', text: '아이들한테 꼭 지키게 한 집안 규칙이나 자주 하신 잔소리가 있었어요?', followups: ['그 규칙을 아이들이 잘 지켰어요?'] },
    { id: 'parenting-joy', title: '키우며 제일 기뻤던 순간', text: '아이들 키우면서 제일 기뻤던 순간은 언제였어요?' },
    { id: 'parenting-grandchild', title: '처음 안아 본 손주', text: '손주를 처음 안아 보셨을 때 어떠셨어요?', followups: ['손주를 보고 제일 먼저 누구를 닮았다고 생각하셨어요?'] },
    { id: 'parenting-sick-night', title: '애태우던 밤', text: '아이가 아파서 애태우셨던 날이 있으세요? 그때 어떻게 하셨어요?', sensitive: true },
    { id: 'parenting-regret', title: '더 해 주고 싶던 것', text: '아이들 키울 때 더 해 주고 싶었는데 못 해 준 게 있으세요?', sensitive: true },
  ],
  home: [
    { id: 'home-all-houses', title: '살아온 집들', text: '지금까지 몇 번이나 이사하셨어요? 기억나는 집들을 순서대로 짚어 볼까요?', followups: ['그중에 제일 오래 산 집은 어디였어요?'] },
    { id: 'home-own-house', title: '처음 마련한 내 집', text: '처음으로 내 집을 마련하셨던 때가 기억나세요? 그 집에 처음 들어가던 날 어떠셨어요?', followups: ['그 집을 마련하려고 어떻게 돈을 모으셨어요?'] },
    { id: 'home-favorite', title: '제일 정든 집', text: '살았던 집 중에 제일 정이 갔던 집은 어디였어요? 왜 그 집이 좋으셨어요?', photoPrompt: '사진 속 이 집은 언제 살던 집이에요? 집 안 어디서 찍은 사진이에요?' },
    { id: 'home-moving-day', title: '이삿날', text: '이삿날 있었던 일 중에 생각나는 게 있으세요? 짐은 어떻게 옮기셨어요?' },
    { id: 'home-neighbors', title: '정 나누던 이웃', text: '반찬도 나눠 먹고 가깝게 지내던 이웃이 있었어요? 어떤 분들이셨어요?' },
    { id: 'home-corner', title: '집에서 좋아하던 자리', text: '집에서 제일 좋아하던 자리는 어디였어요? 거기서 주로 뭘 하셨어요?' },
    { id: 'home-keepsake', title: '이사 다니며 챙긴 물건', text: '이사를 다니면서도 버리지 않고 챙겨 온 물건이 있으세요? 어떤 사연이 있어요?', photoPrompt: '사진 속 이 물건은 언제부터 갖고 계셨어요? 어떻게 얻게 되셨어요?' },
    { id: 'home-old-street', title: '다시 가 본 옛 동네', text: '예전에 살던 동네에 다시 가 보신 적 있으세요? 얼마나 변해 있었어요?' },
    { id: 'home-reluctant-move', title: '떠나기 싫던 집', text: '떠나기 싫었는데 이사해야 했던 적이 있으세요? 무슨 사정이었어요?', sensitive: true },
  ],
  'hard-times': [
    { id: 'hard-small-joys', title: '어려울 때의 작은 기쁨', text: '형편이 어려울 때도 소소하게 즐거웠던 일이 있었어요?' },
    { id: 'hard-vanished-scenes', title: '지금은 사라진 풍경', text: '통행금지나 배급처럼 지금은 없어진 그 시절 풍경 중에 기억나는 게 있으세요?', needsBornBefore: 1970 },
    { id: 'hard-lessons', title: '힘든 시절이 남긴 것', text: '힘든 시절을 지나고 나서 깨달으신 게 있다면 뭐예요?' },
    { id: 'hard-helper', group: 'helped-in-hard-times', title: '손 내밀어 준 사람', text: '어려울 때 손 내밀어 준 사람이 있으세요? 그 고마움은 어떻게 갚으셨어요?' },
    { id: 'hard-hungry', group: 'hungry-times', title: '먹을 게 귀하던 때', text: '먹을 게 귀하던 때를 겪어 보셨어요? 그때는 끼니를 어떻게 해결하셨어요?', followups: ['그때 먹던 음식 중에 지금도 가끔 생각나는 게 있으세요?'], sensitive: true },
    { id: 'hard-imf', title: 'IMF 때', text: '1997년 IMF 때 집안 사정은 어땠어요? 그 시기를 어떻게 버티셨어요?', needsBornBefore: 1980, sensitive: true },
    { id: 'hard-money', title: '돈 때문에 애태우던 때', text: '돈 때문에 마음고생하셨던 때가 있으세요? 어떻게 넘기셨어요?', sensitive: true },
    { id: 'hard-illness', title: '크게 아팠던 때', text: '크게 아프셨거나 다치셨던 적이 있으세요? 그때 곁을 지켜 준 사람은 누구였어요?', sensitive: true },
    { id: 'hard-darkest', title: '제일 막막했던 때', text: '살면서 제일 막막했던 때는 언제였어요? 그때 뭐가 버팀목이 됐어요?', sensitive: true },
  ],
  holidays: [
    { id: 'holiday-childhood', title: '어릴 적 명절', text: '어릴 때 명절은 어떻게 보내셨어요? 명절 전날 집 안 풍경이 어땠어요?', photoPrompt: '이 사진은 어느 명절에 찍으셨어요? 그날 모인 사람은 누구누구예요?' },
    { id: 'holiday-new-clothes', title: '명절 새 옷', text: '설빔이나 추석빔을 받아 보셨어요? 제일 기억에 남는 옷은 뭐였어요?' },
    { id: 'holiday-games', title: '명절 놀이', text: '명절에 하던 놀이가 있었어요? 윷놀이나 연날리기 같은 거요.' },
    { id: 'holiday-gathering', title: '친척들이 모이던 날', text: '명절에 친척들이 다 모이면 어떤 풍경이었어요? 해마다 꼭 나오던 이야기가 있었어요?' },
    { id: 'holiday-gimjang', title: '김장하는 날', text: '김장은 언제, 누구랑, 몇 포기나 하셨어요? 김장하는 날 꼭 먹던 게 있었어요?', followups: ['김장 끝나고 이웃이랑 나눠 먹기도 하셨어요?'] },
    { id: 'holiday-feast-work', title: '손이 많이 가던 명절 음식', text: '명절 준비 중에 제일 손이 많이 가던 음식은 뭐였어요? 누가 맡아서 하셨어요?', recipe: true },
    { id: 'holiday-ancestral-rites', title: '제사와 차례', text: '제사나 차례는 어떻게 모셨어요? 상차림에서 꼭 지키던 게 있었어요?', followups: ['제삿날이면 집안 분위기가 어땠어요?'] },
    { id: 'holiday-rites-changed', title: '달라진 제사', text: '제사나 차례 지내는 방식이 예전과 달라진 게 있으세요? 어떻게 바뀌었어요?' },
    { id: 'holiday-birthdays', title: '생일 챙기던 법', text: '식구들 생일은 어떻게 챙기셨어요? 미역국 말고도 꼭 하던 게 있었어요?' },
  ],
  kitchen: [
    { id: 'kitchen-signature', title: '식구들이 제일 찾는 음식', text: '식구들이 제일 찾는 음식은 뭐예요? 그건 어떻게 만드세요?', followups: ['그 음식을 처음 만들어 본 건 언제였어요?'], recipe: true },
    { id: 'kitchen-teacher', title: '음식을 배운 사람', text: '음식 솜씨는 누구한테 배우셨어요? 처음 배울 때 기억나는 일이 있으세요?' },
    { id: 'kitchen-measure', title: '“적당히”의 실제 양', text: '“대충”, “적당히” 넣는다는 양념은 실제로 얼마쯤이에요? 숟가락으로 치면요?', recipe: true },
    { id: 'kitchen-mothers-taste', title: '그리운 어머님 손맛', text: '어머님이 해 주시던 음식 중에 지금도 그리운 맛이 있으세요?', followups: ['그 맛을 직접 내 보려고 해 보셨어요?'], recipe: true },
    { id: 'kitchen-sick-day', title: '아플 때 해 주던 음식', text: '식구가 아프면 꼭 해 주시던 음식이 있었어요?', recipe: true },
    { id: 'kitchen-kimchi-jang', title: '우리 집 김치와 장', text: '김치나 장은 직접 담그셨어요? 우리 집 맛을 내는 비결이 뭐예요?', recipe: true },
    { id: 'kitchen-guests', title: '손님상 음식', text: '손님이 오시면 내놓던 음식이 따로 있었어요? 그 상에는 뭐가 올라갔어요?', recipe: true },
    { id: 'kitchen-utensils', title: '오래 쓴 부엌살림', text: '부엌에서 오래 써 온 그릇이나 도구가 있으세요? 그걸로 주로 뭘 만드셨어요?', photoPrompt: '사진 속 이 그릇은 언제부터 쓰셨어요? 여기에 주로 뭘 담으셨어요?' },
    { id: 'kitchen-mishap', title: '음식을 망친 날', text: '음식 하다가 크게 망쳤던 날 기억나세요? 그날 어떻게 수습하셨어요?' },
    { id: 'kitchen-heirloom', title: '물려주고 싶은 음식', text: '자식들한테 꼭 물려주고 싶은 음식이 있다면 뭐예요? 그 음식에 얽힌 이야기도 있으세요?', recipe: true },
  ],
  legacy: [
    { id: 'legacy-best-deed', title: '제일 잘한 일', text: '살면서 이건 참 잘했다 싶은 일은 뭐예요?' },
    { id: 'legacy-happiest', title: '제일 행복했던 때', text: '{호칭}, 지금까지 살면서 제일 행복했던 때를 하나만 꼽으면 언제예요?' },
    { id: 'legacy-motto', title: '마음에 품고 산 말', text: '살면서 늘 마음에 품고 사신 말이 있으세요?', followups: ['그 말이 힘이 됐던 때가 언제였어요?'] },
    { id: 'legacy-do-over', title: '다시 해 보고 싶은 것', text: '그때로 돌아간다면 다르게 해 보고 싶은 게 있으세요?' },
    { id: 'legacy-future', title: '앞으로 해 보고 싶은 것', text: '앞으로 꼭 해 보고 싶은 일이나 가 보고 싶은 곳이 있으세요?' },
    { id: 'legacy-remembered', title: '이렇게 기억되고 싶어요', text: '가족들이 어떤 사람으로 기억해 주면 좋겠어요?' },
    { id: 'legacy-grandchildren', title: '손주들에게', text: '손주들이 어른이 되면 꼭 해 주고 싶은 말이 있으세요?' },
    { id: 'legacy-spouse', title: '평생의 짝에게', text: '{배우자}한테 고맙다고, 또 미안하다고 하고 싶은 말이 있으세요?', sensitive: true },
    { id: 'legacy-children', title: '자식들에게', text: '자식들한테 미처 못 한 말이 있다면 지금 해 주시겠어요?', sensitive: true },
  ],
};

const deepFreeze = value => { for (const item of Object.values(value)) if (item && typeof item === 'object') deepFreeze(item); return Object.freeze(value); };

export const QUESTION_BANK = deepFreeze(TOPICS.flatMap(topic => RAW[topic.id].map(q => ({
  id: q.id, topic: topic.id, group: q.group ?? q.id, title: q.title, text: q.text,
  ...(q.followups ? { followups: q.followups } : {}),
  ...(q.needsBornBefore ? { needsBornBefore: q.needsBornBefore } : {}),
  ...(q.skipRelations ? { skipRelations: q.skipRelations } : {}),
  ...(q.photoPrompt ? { photoPrompt: q.photoPrompt } : {}),
  ...(q.sensitive ? { sensitive: true } : {}),
  ...(q.recipe || topic.recipe ? { recipe: true } : {}),
}))));

const BY_ID = new Map(QUESTION_BANK.map(q => [q.id, q]));
const TOPIC_BY_ID = new Map(TOPICS.map(t => [t.id, t]));
const TOPIC_ORDER = new Map(TOPICS.map((t, i) => [t.id, i]));
const BANK_ORDER = new Map(QUESTION_BANK.map((q, i) => [q.id, i]));

export const questionById = id => BY_ID.get(id) ?? null;
export const topicById = id => TOPIC_BY_ID.get(id) ?? null;

// 이야기 주인이 어머니면 질문 속 짝은 「아버지」처럼 묻는 사람 쪽에서 부르는 말로 쓴다.
const SPOUSE_WORD = Object.freeze({ mother: '아버지', father: '어머니', grandmother: '할아버지', grandfather: '할머니', 'maternal-grandmother': '외할아버지', 'maternal-grandfather': '외할머니' });
const DEFAULT_CALL_NAME = Object.freeze({ mother: '어머니', father: '아버지', grandmother: '할머니', grandfather: '할아버지', 'maternal-grandmother': '외할머니', 'maternal-grandfather': '외할아버지' });
const clean = value => typeof value === 'string' ? value.trim() : '';

function callNameOf(storyteller) {
  if (!storyteller || storyteller.relation === 'self') return '';
  return clean(storyteller.callName) || DEFAULT_CALL_NAME[storyteller.relation] || '';
}

/**
 * 질문 글의 자리를 이야기 주인에 맞게 채운다.
 * - {호칭}: 호칭('어머니'). 호칭이 없거나 내 이야기(self)면 뒤의 쉼표·띄어쓰기와 함께 빠진다.
 * - {고향}: 고향 이름, 없으면 '고향'.
 * - {배우자}: 이야기 주인의 짝을 묻는 사람 쪽에서 부르는 말('아버지'), 모르면 '배우자분'.
 * 자리 뒤에는 조사를 붙이지 않고 '하고'·'에서'처럼 받침과 상관없는 말만 붙인다.
 */
export function fillQuestion(text, storyteller) {
  if (typeof text !== 'string') return '';
  const callName = callNameOf(storyteller);
  const hometown = clean(storyteller?.hometown);
  const spouse = (storyteller && SPOUSE_WORD[storyteller.relation]) || '배우자분';
  return text
    .replace(/\{호칭\}(,\s*|\s+)?/gu, (_, gap = '') => callName ? callName + gap : '')
    .replace(/\{고향\}/gu, () => hometown || '고향')
    .replace(/\{배우자\}/gu, () => spouse)
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

function eligible(question, storyteller) {
  if (question.needsBornBefore) {
    const year = storyteller?.birthYear;
    if (!Number.isInteger(year) || year >= question.needsBornBefore) return false;
  }
  if (question.skipRelations && storyteller && question.skipRelations.includes(storyteller.relation)) return false;
  return true;
}

const tellerOf = (album, storyteller) => storyteller === undefined ? album?.storyteller ?? null : storyteller;

function ledger(album) {
  const answeredIds = new Set(), skippedIds = new Set();
  for (const page of album?.pages ?? []) if (BY_ID.has(page?.questionId)) answeredIds.add(page.questionId);
  for (const id of album?.skippedQuestions ?? []) if (BY_ID.has(id)) skippedIds.add(id);
  const answeredGroups = new Set([...answeredIds].map(id => BY_ID.get(id).group));
  const skippedGroups = new Set([...skippedIds].map(id => BY_ID.get(id).group));
  return { answeredIds, skippedIds, answeredGroups, skippedGroups, closed: new Set([...answeredGroups, ...skippedGroups]) };
}

function present(question, storyteller, extra = {}) {
  const topic = TOPIC_BY_ID.get(question.topic);
  return {
    id: question.id, topic: question.topic, topicLabel: topic.label, group: question.group, title: question.title,
    text: fillQuestion(question.text, storyteller),
    followups: (question.followups ?? []).map(item => fillQuestion(item, storyteller)),
    photoPrompt: question.photoPrompt ? fillQuestion(question.photoPrompt, storyteller) : null,
    sensitive: Boolean(question.sensitive), skipHint: question.sensitive ? SKIP_HINT : null,
    recipe: Boolean(question.recipe), ...extra,
  };
}

const gentleFirst = (a, b) => Number(Boolean(a.sensitive)) - Number(Boolean(b.sensitive)) || BANK_ORDER.get(a.id) - BANK_ORDER.get(b.id);

/**
 * 다음에 물을 질문 하나. 같은 입력이면 늘 같은 질문을 낸다.
 * - 이미 답한 질문(페이지 questionId)·건너뛴 질문(album.skippedQuestions)과 같은 group은 다시 내지 않는다.
 * - exclude: 「다른 질문」으로 넘긴 질문 id들. 그 group도 이번에는 빼고, 주제를 고르지 않았으면
 *   넘긴 주제는 뒤로 미룬다.
 * - topic을 고르지 않으면 가장 덜 채운 주제에서, 같으면 마음이 무거운 질문이 먼저 나오지 않는 주제,
 *   그다음 주제 순서. 주제 안에서는 무거운 질문을 뒤로 둔다.
 * - withPhoto: 사진에서 시작할 때 photoPrompt가 있는 질문만.
 * 남은 질문이 없으면 null.
 */
export function nextQuestion({ album, storyteller, topic, exclude = [], withPhoto = false } = {}) {
  if (topic !== undefined && topic !== null && !TOPIC_BY_ID.has(topic)) throw new Error('알 수 없는 이야기 주제예요.');
  const teller = tellerOf(album, storyteller), { closed } = ledger(album);
  const excludedIds = Array.from(exclude ?? []).filter(id => BY_ID.has(id));
  const excludedGroups = new Set(excludedIds.map(id => BY_ID.get(id).group));
  const open = QUESTION_BANK.filter(q => eligible(q, teller) && !closed.has(q.group) && !excludedGroups.has(q.group) && (!withPhoto || q.photoPrompt) && (!topic || q.topic === topic));
  if (!open.length) return null;
  const byTopic = new Map();
  for (const q of open) { if (!byTopic.has(q.topic)) byTopic.set(q.topic, []); byTopic.get(q.topic).push(q); }
  for (const list of byTopic.values()) list.sort(gentleFirst);
  let chosen = topic;
  if (!chosen) {
    const filled = new Map(TOPICS.map(t => [t.id, 0]));
    for (const page of album?.pages ?? []) { const q = BY_ID.get(page?.questionId); if (q) filled.set(q.topic, filled.get(q.topic) + 1); }
    for (const id of excludedIds) { const q = BY_ID.get(id); filled.set(q.topic, filled.get(q.topic) + 1); }
    chosen = [...byTopic.keys()].sort((a, b) => filled.get(a) - filled.get(b)
      || Number(Boolean(byTopic.get(a)[0].sensitive)) - Number(Boolean(byTopic.get(b)[0].sensitive))
      || TOPIC_ORDER.get(a) - TOPIC_ORDER.get(b))[0];
  }
  const list = byTopic.get(chosen);
  return present(list[0], teller, { remaining: list.length });
}

/** 한 주제의 질문 목록(자녀가 직접 고를 때). status: 'answered' | 'skipped' | 'covered'(같은 뜻의 다른 질문에 답함) | 'open'. */
export function topicQuestions({ album, storyteller, topic } = {}) {
  if (!TOPIC_BY_ID.has(topic)) throw new Error('알 수 없는 이야기 주제예요.');
  const teller = tellerOf(album, storyteller), book = ledger(album);
  return QUESTION_BANK.filter(q => q.topic === topic && (eligible(q, teller) || book.answeredIds.has(q.id))).map(q => present(q, teller, {
    status: book.answeredIds.has(q.id) ? 'answered' : book.skippedIds.has(q.id) ? 'skipped' : book.answeredGroups.has(q.group) ? 'covered' : book.skippedGroups.has(q.group) ? 'skipped' : 'open',
  }));
}

/**
 * 들은 이야기 장부. 주제마다 같은 뜻 묶음(group) 단위로 센다.
 * total: 이 이야기 주인에게 물을 수 있는 묶음 수(이미 답한 묶음 포함), answered: 이 주제 질문으로 답한 묶음,
 * skipped: 건너뛴 묶음, covered: 답했거나(다른 주제 포함) 건너뛰어 닫힌 묶음, remaining = total - covered.
 * empty: 물을 질문이 있는데 아직 한 편도 답하지 않은 주제 id.
 * 전체 answered·total·covered·remaining은 주제를 건너 묶인 질문을 한 번만 센다.
 */
export function topicMap(album, storyteller) {
  const teller = tellerOf(album, storyteller), book = ledger(album);
  const allGroups = new Set(QUESTION_BANK.filter(q => eligible(q, teller) || book.answeredIds.has(q.id)).map(q => q.group));
  const allCovered = [...allGroups].filter(g => book.closed.has(g)).length;
  const topics = TOPICS.map(topic => {
    const questions = QUESTION_BANK.filter(q => q.topic === topic.id);
    const groups = new Set(questions.filter(q => eligible(q, teller) || book.answeredIds.has(q.id)).map(q => q.group));
    const answered = new Set(questions.filter(q => book.answeredIds.has(q.id)).map(q => q.group));
    const covered = [...groups].filter(g => book.closed.has(g)).length;
    const skipped = [...groups].filter(g => book.skippedGroups.has(g) && !book.answeredGroups.has(g)).length;
    return { id: topic.id, label: topic.label, recipe: Boolean(topic.recipe), total: groups.size, answered: answered.size, skipped, covered, remaining: groups.size - covered, available: groups.size > 0, complete: groups.size > 0 && covered === groups.size };
  });
  return {
    topics,
    empty: topics.filter(t => t.available && t.answered === 0).map(t => t.id),
    answered: book.answeredGroups.size,
    total: allGroups.size,
    covered: allCovered,
    remaining: allGroups.size - allCovered,
  };
}

/** 목소리로만 답한 페이지의 본문. 화면은 이 글과 같으면 「받아 적기」를 권할 수 있다. */
export const voiceOnlyStory = (question, storyteller) => `「${fillQuestion((BY_ID.get(typeof question === 'string' ? question : question?.id) ?? question).text, storyteller)}」에 목소리로 답한 이야기예요.`;

/**
 * 질문의 답을 앨범 페이지로 만든다(검증된 페이지 반환, 앨범에는 넣지 않음).
 * 글이 없고 목소리만 있으면 본문에 「질문」과 목소리 안내 한 줄을 넣는다(본문은 필수 칸).
 * author를 주지 않으면 이야기 주인 이름을 쓴다. 제목은 질문의 짧은 제목이 기본이다.
 */
export function pageFromAnswer({ question, storyteller = null, text = '', audio = null, photo = null, date = '', title, person = '', author, id, at } = {}) {
  const source = BY_ID.get(typeof question === 'string' ? question : question?.id);
  if (!source) throw new Error('질문을 다시 골라 주세요.');
  const story = typeof text === 'string' ? text.trim() : '';
  if (!story && !audio) throw new Error('답을 목소리로 녹음하거나 글로 남겨 주세요.');
  const writer = typeof author === 'string' && author.trim() ? author : clean(storyteller?.name);
  if (!writer) throw new Error('이야기한 분의 이름을 적어 주세요.');
  const stamp = at ?? new Date().toISOString();
  const page = {
    id: id ?? newId(), title: title ?? source.title, date, person, author: writer,
    story: story || voiceOnlyStory(source, storyteller),
    photo, audio, details: {}, skipped: [], contributions: [], createdAt: stamp, updatedAt: stamp, questionId: source.id,
  };
  return validateAlbum({ ...emptyAlbum(), pages: [page] }).pages[0];
}

/** pageFromAnswer로 만든 페이지를 앨범 맨 앞에 넣는다. storyteller를 주지 않으면 앨범의 이야기 주인을 쓴다. */
export function answerQuestion(album, input = {}) {
  return upsertPage(album, pageFromAnswer({ ...input, storyteller: input.storyteller === undefined ? album?.storyteller ?? null : input.storyteller }));
}
