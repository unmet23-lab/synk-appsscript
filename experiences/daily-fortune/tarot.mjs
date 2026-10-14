// 오늘의 카드 한 장. 메이저 아르카나 22장을 정방향으로만 읽는다.
// 뽑는 규칙: 날짜를 22일 묶음으로 나누고, 묶음마다 사람 seed로 22장을 섞는다(묶음 안에서는 겹치지 않음).
// 묶음이 바뀌는 자리에서 새 묶음의 첫 두 장이 앞 묶음의 마지막 두 장과 겹치면 가운데 카드와 바꾼다.
// 마지막 두 자리는 바꾸지 않으므로 어느 연속 3일도 같은 카드가 나오지 않는다.
import { seoulDateKey } from './core.mjs';
import { deepFreeze, mod, dayNumber, shuffledOrder, assertSupportedDate } from './fortune-base.mjs';

const CARDS = [
  ['fool', '바보', 'The Fool', ['시작', '자유', '호기심'],
    '새로운 길 앞에서 가볍게 첫발을 떼는 카드예요. 오늘은 계산보다 호기심을 따라가 보면 뜻밖의 재미를 만날 수 있어요.',
    '평소 안 가 본 길로 한 번 걸어 보세요.'],
  ['magician', '마법사', 'The Magician', ['재능', '실행', '집중'],
    '이미 가진 도구로 충분히 해낼 수 있다는 카드예요. 오늘은 미뤄 둔 일 하나를 직접 손에 잡아 보세요.',
    '오늘 할 일 하나를 정해 바로 시작해 보세요.'],
  ['high-priestess', '여사제', 'The High Priestess', ['직감', '고요', '배움'],
    '조용히 마음의 소리를 듣는 카드예요. 바로 답을 내기보다 한 번 더 살피면 필요한 것이 보여요.',
    '잠깐 휴대폰을 내려놓고 5분 동안 조용히 있어 보세요.'],
  ['empress', '여황제', 'The Empress', ['풍요', '돌봄', '감각'],
    '넉넉한 마음과 돌봄이 피어나는 카드예요. 나와 주변을 아끼는 작은 손길이 하루를 풍성하게 해요.',
    '나를 위한 맛있는 간식 하나를 챙겨 보세요.'],
  ['emperor', '황제', 'The Emperor', ['질서', '책임', '계획'],
    '단단한 기준과 계획이 힘이 되는 카드예요. 오늘은 우선순위를 정하면 일이 깔끔하게 흘러가요.',
    '오늘 할 일의 순서를 세 줄로 적어 보세요.'],
  ['hierophant', '교황', 'The Hierophant', ['배움', '전통', '조언'],
    '믿을 만한 사람의 지혜를 빌리기 좋은 카드예요. 익숙한 방법 안에 오늘의 힌트가 숨어 있어요.',
    '존경하는 사람에게 짧게 조언을 구해 보세요.'],
  ['lovers', '연인', 'The Lovers', ['마음', '선택', '조화'],
    '마음이 가는 쪽을 솔직하게 바라보는 카드예요. 소중한 사람과 생각을 맞춰 보면 선택이 쉬워져요.',
    '고마운 사람에게 마음을 담은 한마디를 보내 보세요.'],
  ['chariot', '전차', 'The Chariot', ['추진력', '의지', '방향'],
    '목표를 향해 힘 있게 나아가는 카드예요. 방향만 분명하면 속도는 저절로 따라와요.',
    '이번 주 목표 하나를 정해 눈에 띄는 곳에 적어 두세요.'],
  ['strength', '힘', 'Strength', ['부드러운 용기', '인내', '다정함'],
    '밀어붙이기보다 부드럽게 다독이는 힘을 뜻하는 카드예요. 오늘은 다정한 태도가 가장 큰 힘이 돼요.',
    '애쓴 나에게 수고했다고 말해 주세요.'],
  ['hermit', '은둔자', 'The Hermit', ['성찰', '혼자만의 시간', '지혜'],
    '잠시 물러나 나만의 등불을 켜는 카드예요. 혼자 있는 시간이 생각을 또렷하게 정리해 줘요.',
    '오늘 하루를 돌아보며 한 줄 일기를 써 보세요.'],
  ['wheel-of-fortune', '운명의 수레바퀴', 'Wheel of Fortune', ['흐름', '변화', '기회'],
    '돌고 도는 흐름 속에서 새로운 기회가 다가오는 카드예요. 작은 변화를 반갑게 맞이해 보세요.',
    '늘 하던 순서 하나를 바꿔 보세요.'],
  ['justice', '정의', 'Justice', ['균형', '공정', '솔직함'],
    '균형과 솔직함이 빛나는 카드예요. 나에게도 남에게도 공정한 선택이 마음을 편하게 해요.',
    '미뤄 둔 답장이나 약속 하나를 정리해 보세요.'],
  ['hanged-man', '매달린 사람', 'The Hanged Man', ['새로운 시선', '기다림', '내려놓기'],
    '거꾸로 보면 다른 풍경이 보인다는 카드예요. 서두르지 않고 기다리는 동안 새 아이디어가 찾아와요.',
    '고민 하나를 상대 입장에서 다시 생각해 보세요.'],
  ['transformation', '변화', 'Transformation', ['마무리', '새 출발', '변화'],
    '한 장을 넘기고 새 장을 여는 카드예요. 끝난 일을 잘 정리하면 그 자리에 새로운 시작이 들어와요.',
    '이제 쓰지 않는 물건 하나를 정리해 보세요.'],
  ['temperance', '절제', 'Temperance', ['균형', '조율', '회복'],
    '서로 다른 것을 알맞게 섞어 조화를 만드는 카드예요. 일과 쉼의 비율을 조금만 맞춰도 하루가 편안해져요.',
    '일하는 중간에 10분 쉬는 시간을 넣어 보세요.'],
  ['devil', '악마', 'The Devil', ['습관', '알아차림', '자유'],
    '나를 붙잡는 습관을 알아차리게 해 주는 카드예요. 알아차리는 순간 이미 한 걸음 자유로워져요.',
    '오늘 하루 줄여 보고 싶은 습관 하나를 정해 보세요.'],
  ['tower', '탑', 'The Tower', ['깨달음', '전환', '새로 짓기'],
    '익숙한 틀이 흔들리며 새로운 시야가 열리는 카드예요. 예상과 다른 일도 더 나은 방법을 찾는 계기가 될 수 있어요.',
    '계획이 바뀌면 다른 방법 하나를 적어 보세요.'],
  ['star', '별', 'The Star', ['희망', '회복', '영감'],
    '어두운 밤에도 반짝이는 희망을 뜻하는 카드예요. 마음속 작은 바람을 다시 꺼내 보기 좋은 날이에요.',
    '이루고 싶은 작은 소망 하나를 적어 보세요.'],
  ['moon', '달', 'The Moon', ['상상', '직감', '꿈'],
    '은은한 달빛 아래 상상력이 깨어나는 카드예요. 확실하지 않은 일은 천천히 살피고, 떠오르는 영감은 기록해 두세요.',
    '잠들기 전 떠오른 생각을 메모해 두세요.'],
  ['sun', '태양', 'The Sun', ['기쁨', '활력', '성취'],
    '환한 햇살처럼 기쁨이 가득한 카드예요. 오늘은 웃음을 나눌수록 좋은 일이 더 커져요.',
    '햇볕을 쬐며 잠깐 걸어 보세요.'],
  ['judgement', '심판', 'Judgement', ['깨어남', '새 결심', '응답'],
    '오래 기다린 부름에 응답하는 카드예요. 지난 경험을 돌아보면 다음에 갈 길이 또렷해져요.',
    '예전에 미뤄 둔 계획 하나를 다시 꺼내 보세요.'],
  ['world', '세계', 'The World', ['완성', '성취', '축하'],
    '한 바퀴를 무사히 마치고 완성에 이르는 카드예요. 오늘은 그동안 해낸 것을 스스로 축하해 주세요.',
    '최근 끝낸 일 하나를 떠올리며 나에게 작은 선물을 해 주세요.'],
];

export const MAJOR_ARCANA = deepFreeze(CARDS.map(([id, name, english, keywords, meaning, practice], number) => ({
  id, number, name, english, keywords, meaning, practice, upright: true,
})));

const SIZE = MAJOR_ARCANA.length;
const BLOCK = SIZE;

function rawBlock(seed, block) {
  return shuffledOrder(SIZE, `tarot/${seed}/${block}`);
}

function blockOrder(seed, block) {
  const order = rawBlock(seed, block);
  const previousTail = new Set(rawBlock(seed, block - 1).slice(-2));
  for (const position of [0, 1]) {
    if (!previousTail.has(order[position])) continue;
    for (let other = 2; other < SIZE - 2; other++) {
      if (!previousTail.has(order[other])) { [order[position], order[other]] = [order[other], order[position]]; break; }
    }
  }
  return order;
}

/**
 * @param {{ seed: string, date?: string }} options seed는 사람을 구분하는 문자열(1~200자).
 * @returns {{ date, id, number, name, english, keywords, meaning, practice, upright, note }} 하루 동안 같은 카드.
 */
export function drawCard({ seed, date = seoulDateKey() } = {}) {
  if (typeof seed !== 'string' || !seed.trim() || [...seed].length > 200) throw new TypeError('카드를 뽑을 사람 정보를 확인해 주세요.');
  assertSupportedDate(date);
  const day = dayNumber(date), block = Math.floor(day / BLOCK);
  const card = MAJOR_ARCANA[blockOrder(seed, block)[mod(day, BLOCK)]];
  return deepFreeze({ date, ...card, keywords: [...card.keywords],
    note: '하루 한 장, 정방향으로만 읽는 카드예요. 오늘을 돌아볼 질문으로 가볍게 써 주세요.' });
}
