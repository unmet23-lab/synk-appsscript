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
  subtitle: '글을 읽고, 친구를 움직여, 교실의 비밀을 찾아요.',
  opening: [
    { speaker: 'narrator', text: '쉬는 시간이 끝났어요. 교실에는 과자와 종이가 가득해요.' },
    { speaker: 'mongle', text: '어? 문밖에서 발소리가 나! 누구지?' },
    { speaker: 'kkamong', text: '이 몸이 다 정리할 수 있지. 선생님만 안 오시면…' },
    { speaker: 'teacher', text: '이게 다 뭐야!' },
    { speaker: 'marin', text: '상황 보고. 선생님 도착. 정리 필요.' },
  ],
  acts: [
    {
      id: 'cleanup', title: '01 · 버리면 안 돼!',
      subtitle: '누가 무엇을 어디로 옮겨야 할까요?',
      intro: [
        { speaker: 'teacher', text: '마린, 까몽. 먼저 교실을 정리하자.' },
        { speaker: 'mongle', text: '어? 이 종이에 글자가 있어! 버려도 되는 걸까?' },
        { speaker: 'teacher', text: '그 종이는 오늘 쓸 장식이야. 버리면 안 돼.' },
      ],
      missions: [
        {
          id: 'cleanup-snacks', actor: 'marin', object: 'snacks', destination: 'box',
          text: '마린은 과자를 상자 안에 넣어 줘.',
          skill: '문장의 대상·위치 이해',
          explanation: '과자를 옮기는 친구는 마린이에요. 과자가 갈 곳은 상자 안이에요.',
        },
        {
          id: 'cleanup-paper', actor: 'kkamong', object: 'paper', destination: 'drawer',
          text: '까몽은 종이를 버리지 말고 서랍 안에 넣어 줘.',
          skill: '부정 표현과 지시 이해',
          explanation: '“버리지 말고”는 버리면 안 된다는 뜻이에요. 까몽이 종이를 서랍에 넣어요.',
        },
      ],
      outro: [
        { speaker: 'kkamong', text: '이 몸의 정리 실력, 봤지? …종이도 안 구겼어.' },
        { speaker: 'marin', text: '정리 완료. 종이 보관. …하트 모양 발견.' },
        { speaker: 'mongle', text: '오! 하트도 별도 있어! 누가 만들었을까?' },
      ],
    },
    {
      id: 'clue', title: '02 · 수상한 편지',
      subtitle: '앞의 일을 마친 다음, 다음 일을 해요.',
      intro: [
        { speaker: 'teacher', text: '꽃도 있네? 이건 어디에 둘까?' },
        { speaker: 'marin', text: '꽃 확인. 세 송이. …예쁘다.' },
        { speaker: 'mongle', text: '어? 편지도 있어! 누가 썼을까?' },
      ],
      missions: [
        {
          id: 'clue-flowers', actor: 'marin', object: 'flowers', destination: 'table',
          text: '마린은 꽃을 책상 위에 놓아 줘.',
          skill: '문장의 대상·위치 이해',
          explanation: '마린이 꽃을 옮겨요. “책상 위”는 꽃을 놓을 곳이에요.',
        },
        {
          id: 'clue-letter', actor: 'kkamong', object: 'letter', destination: 'board',
          text: '꽃을 놓은 뒤, 까몽은 편지를 칠판에 붙여 줘.',
          skill: '짧은 글의 행동 순서 이해',
          requires: ['clue-flowers'],
          explanation: '“꽃을 놓은 뒤”이므로 꽃을 먼저 놓아요. 그다음 까몽이 편지를 칠판에 붙여요.',
        },
      ],
      outro: [
        { speaker: 'narrator', text: '편지를 펼쳤어요. “선생님, 생일 축하해요!”라고 쓰여 있어요.' },
        { speaker: 'teacher', text: '오늘 내 생일인 걸 어떻게 알았니?' },
        { speaker: 'kkamong', text: '내가 준비했지. …편지는 세 번 고쳐 썼어.' },
      ],
    },
    {
      id: 'surprise', title: '03 · 사실은 생일 파티',
      subtitle: '마지막 준비를 마치면, 이야기가 완성돼요.',
      intro: [
        { speaker: 'mongle', text: '우와! 깜짝 파티였구나! 같이 준비하자!' },
        { speaker: 'teacher', text: '아직 케이크를 못 봤는데?' },
        { speaker: 'kkamong', text: '내가 숨겨 뒀지. …조금 먹으려 했어, 아니, 잘 지켰어!' },
      ],
      missions: [
        {
          id: 'surprise-cake', actor: 'kkamong', object: 'cake', destination: 'table',
          text: '까몽은 케이크를 책상 위에 놓아 줘.',
          skill: '문장의 대상·위치 이해',
          explanation: '이번에는 까몽이 케이크를 옮겨요. 케이크는 책상 위에 놓아요.',
        },
        {
          id: 'surprise-ribbon', actor: 'marin', object: 'ribbon', destination: 'board',
          text: '케이크를 놓은 다음, 마린은 리본을 칠판에 붙여 줘.',
          skill: '짧은 글의 행동 순서 이해',
          requires: ['surprise-cake'],
          explanation: '케이크가 먼저예요. 그다음 마린이 리본을 칠판에 붙여요.',
        },
      ],
      outro: [
        { speaker: 'marin', text: '파티 준비 완료. …선생님, 생일 축하합니다.' },
        { speaker: 'mongle', text: '우와! 교실이 파티 장소가 됐어!' },
      ],
    },
  ],
  ending: [
    { speaker: 'teacher', text: '교실이 엉망인 줄 알았는데, 나를 위해 준비한 거였구나.' },
    { speaker: 'kkamong', text: '내 작전은 완벽했지. …네가 도와줘서 다행이야.' },
    { speaker: 'mongle', text: '같이 하니까 더 재밌어! 다음 파티도 같이 할까?' },
    { speaker: 'teacher', text: '이제 새 글을 읽고 마지막 정리를 해 보자. 이번에는 친구와 장소가 달라.' },
  ],
  review: [
    {
      id: 'review-snacks', actor: 'kkamong', object: 'snacks', destination: 'shelf',
      text: '이번에는 까몽이 과자를 선반 위에 놓아요.',
      skill: '새 문장의 대상·위치 이해',
      explanation: '이번 글에서는 까몽이 과자를 옮겨요. 아까의 상자가 아니라 선반 위에 놓아요.',
    },
    {
      id: 'review-paper', actor: 'marin', object: 'paper', destination: 'box',
      text: '마린은 종이를 서랍이 아니라 상자 안에 넣어요.',
      skill: '새 문장의 부정·변경 이해',
      explanation: '“서랍이 아니라 상자”예요. 마린이 종이를 상자 안에 넣어요.',
    },
    {
      id: 'review-cake', actor: 'marin', object: 'cake', destination: 'shelf',
      text: '과자를 옮긴 뒤, 마린은 케이크를 선반 위에 놓아요.',
      skill: '새 문장의 행동 순서 이해',
      requires: ['review-snacks'],
      explanation: '까몽이 과자를 먼저 옮겨요. 그다음 마린이 케이크를 선반 위에 놓아요.',
    },
  ],
};
