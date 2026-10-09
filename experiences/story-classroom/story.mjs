/**
 * Reading supplies the rules; the picture supplies a place to try them.
 * These are authored practice items, not calibrated TOPIK test items.
 */
export const STORY_VERSION = 'classroom-birthday-2';
export const ACTOR_IDS = Object.freeze(['marin', 'kkamong']);
export const PROP_IDS = Object.freeze(['snacks', 'paper', 'cake', 'ribbon', 'flowers', 'letter']);
export const DESTINATION_IDS = Object.freeze(['box', 'drawer', 'table', 'bin', 'shelf', 'board']);
export const INITIAL_SCENE = Object.freeze({
  snacks: 'table', paper: 'floor', cake: 'box',
  ribbon: 'floor', flowers: 'shelf', letter: 'drawer',
});

export const EPISODE = {
  id: 'classroom-birthday',
  version: STORY_VERSION,
  title: '선생님이 돌아왔다',
  subtitle: '선생님의 부탁을 읽고 친구들을 움직여요. 엉망인 교실에 비밀이 숨어 있어요.',
  opening: [
    { speaker: 'narrator', text: '쉬는 시간이 끝났어요. 그런데 교실이 엉망이에요. 과자와 종이가 여기저기 있어요.' },
    { speaker: 'mongle', text: '어? 복도에서 발소리가 들려! 누가 오는 걸까?' },
    { speaker: 'kkamong', text: '이 몸이 금방 치울 수 있어. …그런데 발소리가 점점 가까워지는데?' },
    { speaker: 'teacher', text: '어머나, 교실이 왜 이렇게 됐어?' },
    { speaker: 'marin', text: '상황 보고. 선생님 도착. 교실 상태, 엉망. …정리를 시작한다.' },
  ],
  acts: [
    {
      id: 'cleanup', title: '01 · 엉망인 교실',
      subtitle: '누가, 무엇을, 어디에 놓을까요? 부탁을 잘 읽어 봐요.',
      intro: [
        { speaker: 'teacher', text: '마린, 까몽! 수업 전에 교실부터 정리하자.' },
        { speaker: 'mongle', text: '어? 이 종이에 뭐가 쓰여 있어! 이것도 버려야 해?' },
        { speaker: 'teacher', text: '아니, 그 종이는 버리면 안 돼. 오늘 쓸 장식이거든.' },
      ],
      missions: [
        {
          id: 'cleanup-snacks', actor: 'marin', object: 'snacks', destination: 'box',
          text: '마린은 과자를 상자 안에 넣어 줘.',
          skill: '문장의 대상·위치 이해',
          explanation: '누가 옮겨요? 마린이에요. 과자를 어디에 넣어요? 상자 안이에요.',
        },
        {
          id: 'cleanup-paper', actor: 'kkamong', object: 'paper', destination: 'drawer',
          text: '까몽은 종이를 버리지 말고 서랍 안에 넣어 줘.',
          skill: '부정 표현과 지시 이해',
          explanation: '“버리지 말고”는 쓰레기통에 넣지 말라는 말이에요. 까몽이 종이를 서랍 안에 넣어요.',
        },
      ],
      outro: [
        { speaker: 'kkamong', text: '봤지? 이 몸이 치우니까 금방이잖아. …종이도 하나도 안 구겼어.' },
        { speaker: 'marin', text: '정리 완료. 종이 보관. …종이에서 하트 모양 발견.' },
        { speaker: 'mongle', text: '우와! 하트랑 별이야! 누가 이걸 만들었을까?' },
      ],
    },
    {
      id: 'clue', title: '02 · 누가 쓴 편지일까',
      subtitle: '무엇을 먼저 하는지 잘 봐요.',
      intro: [
        { speaker: 'teacher', text: '어머, 꽃도 있네? 이 꽃은 어디에 둘까?' },
        { speaker: 'marin', text: '꽃 확인. 세 송이. 상태 양호. …예쁘다.' },
        { speaker: 'mongle', text: '어? 서랍에 편지가 있어! 누가 쓴 걸까?' },
      ],
      missions: [
        {
          id: 'clue-flowers', actor: 'marin', object: 'flowers', destination: 'table',
          text: '마린은 꽃을 책상 위에 놓아 줘.',
          skill: '문장의 대상·위치 이해',
          explanation: '꽃은 마린이 옮겨요. 놓을 곳은 “책상 위”예요.',
        },
        {
          id: 'clue-letter', actor: 'kkamong', object: 'letter', destination: 'board',
          text: '꽃을 놓은 뒤, 까몽은 편지를 칠판에 붙여 줘.',
          skill: '짧은 글의 행동 순서 이해',
          requires: ['clue-flowers'],
          explanation: '“꽃을 놓은 뒤”라고 했어요. 꽃이 먼저, 편지는 그다음이에요. 편지는 까몽이 칠판에 붙여요.',
        },
      ],
      outro: [
        { speaker: 'narrator', text: '편지를 펼쳤어요. “선생님, 생일 축하해요!” 하고 쓰여 있어요.' },
        { speaker: 'teacher', text: '어머… 오늘이 내 생일인 걸 어떻게 알았어?' },
        { speaker: 'kkamong', text: '내가 다 준비했지. …사실 편지는 세 번이나 다시 썼어.' },
      ],
    },
    {
      id: 'surprise', title: '03 · 깜짝 생일 파티',
      subtitle: '파티 준비, 이제 마지막이에요.',
      intro: [
        { speaker: 'mongle', text: '우와! 깜짝 생일 파티였구나! 우리 같이 준비하자!' },
        { speaker: 'teacher', text: '그런데 케이크는 어디 있니?' },
        { speaker: 'kkamong', text: '케이크는 내가 숨겨 뒀지. …한 입만 먹으려다가, 아니, 잘 지켰어.' },
      ],
      missions: [
        {
          id: 'surprise-cake', actor: 'kkamong', object: 'cake', destination: 'table',
          text: '까몽은 케이크를 책상 위에 놓아 줘.',
          skill: '문장의 대상·위치 이해',
          explanation: '이번에는 까몽이 옮겨요. 케이크는 책상 위에 놓아요.',
        },
        {
          id: 'surprise-ribbon', actor: 'marin', object: 'ribbon', destination: 'board',
          text: '케이크를 놓은 다음, 마린은 리본을 칠판에 붙여 줘.',
          skill: '짧은 글의 행동 순서 이해',
          requires: ['surprise-cake'],
          explanation: '“케이크를 놓은 다음”이니까 케이크가 먼저예요. 그다음 마린이 리본을 칠판에 붙여요.',
        },
      ],
      outro: [
        { speaker: 'marin', text: '파티 준비 완료. 전원 확인. …선생님, 생일 축하합니다.' },
        { speaker: 'mongle', text: '우와! 우리 교실이 파티장이 됐어!' },
      ],
    },
  ],
  ending: [
    { speaker: 'teacher', text: '교실이 엉망인 줄 알았는데… 다 나를 위한 거였구나. 정말 고마워.' },
    { speaker: 'kkamong', text: '훗, 이 몸의 작전이니까. …그래도 네가 도와줘서 다행이야.' },
    { speaker: 'mongle', text: '같이 하니까 더 신나! 다음 파티도 같이 준비할까?' },
    { speaker: 'teacher', text: '파티가 끝나면 다시 치워야겠지? 이번에는 부탁이 조금 달라. 잘 읽어 봐.' },
  ],
  review: [
    {
      id: 'review-snacks', actor: 'kkamong', object: 'snacks', destination: 'shelf',
      text: '이번에는 까몽이 과자를 선반 위에 놓아요.',
      skill: '새 문장의 대상·위치 이해',
      explanation: '이번에는 까몽이 옮겨요. 아까는 상자였지만, 이번에는 선반 위예요.',
    },
    {
      id: 'review-paper', actor: 'marin', object: 'paper', destination: 'box',
      text: '마린은 종이를 서랍이 아니라 상자 안에 넣어요.',
      skill: '새 문장의 부정·변경 이해',
      explanation: '“서랍이 아니라 상자”라고 했어요. 마린이 종이를 상자 안에 넣어요.',
    },
    {
      id: 'review-cake', actor: 'marin', object: 'cake', destination: 'shelf',
      text: '과자를 옮긴 뒤, 마린은 케이크를 선반 위에 놓아요.',
      skill: '새 문장의 행동 순서 이해',
      requires: ['review-snacks'],
      explanation: '“과자를 옮긴 뒤”예요. 까몽이 과자를 먼저 옮기고, 그다음 마린이 케이크를 선반 위에 놓아요.',
    },
  ],
};
