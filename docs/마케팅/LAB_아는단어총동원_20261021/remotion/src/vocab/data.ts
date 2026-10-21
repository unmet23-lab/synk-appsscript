// LAB 「아는 단어 총동원」(10-21) 화면 글. 참고 카드 2026-10-19_아는단어_총동원(팁 장부 11행) — 한국 사람이 「한국어 할 줄 알아요?」라고 묻자
// 아는 단어를 갈래마다 한 박자씩 쏟아내다(인사 → 숫자 → 도시 → 음식 → 엇나감) 「천천히 말해 주세요」 한마디로 이긴다.
// 소리는 모든 판이 같은 한국어(나레이션_계획.json), 화면 글만 판마다 바꾼다. 몽골어 읽는 법은 퀴즈 #4처럼 ㅓ=ө·ㅐㅔ=э·ㅡ=ы.
export type Lang = 'en' | 'mn';

export type Word = {
  id: string; // 나레이션 줄 id
  ko: string;
  art: string; // public/img/vocab/<art>.webp
  cat: number; // CATS 번호
  read: Record<Lang, string>; // 읽는 법 · 뜻(한 줄)
};

export const WORDS: Word[] = [
  { id: 'w01', ko: '안녕하세요', art: 'hello', cat: 0, read: { en: 'annyeonghaseyo · hello', mn: 'аннёнхасэё · сайн байна уу' } },
  { id: 'w02', ko: '감사합니다', art: 'thanks', cat: 0, read: { en: 'gamsahamnida · thank you', mn: 'гамсахамнида · баярлалаа' } },
  { id: 'w03', ko: '사랑해요', art: 'love', cat: 0, read: { en: 'saranghaeyo · I love you', mn: 'саранхэё · хайртай' } },
  { id: 'w04', ko: '하나', art: 'one', cat: 1, read: { en: 'hana · one', mn: 'хана · нэг' } },
  { id: 'w05', ko: '둘', art: 'two', cat: 1, read: { en: 'dul · two', mn: 'дул · хоёр' } },
  { id: 'w06', ko: '셋', art: 'three', cat: 1, read: { en: 'set · three', mn: 'сэт · гурав' } },
  { id: 'w07', ko: '서울', art: 'seoul', cat: 2, read: { en: 'Seoul', mn: 'Сөүл' } },
  { id: 'w08', ko: '부산', art: 'busan', cat: 2, read: { en: 'Busan', mn: 'Пусан' } },
  { id: 'w09', ko: '제주', art: 'jeju', cat: 2, read: { en: 'Jeju Island', mn: 'Жэжү арал' } },
  { id: 'w10', ko: '김치', art: 'kimchi', cat: 3, read: { en: 'kimchi', mn: 'кимчи' } },
  { id: 'w11', ko: '비빔밥', art: 'bibimbap', cat: 3, read: { en: 'bibimbap · mixed rice', mn: 'бибимбап · холимог будаа' } },
  { id: 'w12', ko: '떡볶이', art: 'tteokbokki', cat: 3, read: { en: 'tteokbokki · spicy rice cakes', mn: 'токбокки' } }, // 몽골에서 흔히 쓰는 표기(김치·비빔밥도 같음). 「халуун ногоотой будааны бялуу」는 아르곤이 직역투(бялуу=서양 케이크)로 짚어 풀이를 뺐다
  { id: 'w13', ko: '대박', art: 'daebak', cat: 4, read: { en: 'daebak · awesome', mn: 'дэбак · гайхалтай' } },
  { id: 'w14', ko: '화이팅…?', art: 'fighting', cat: 4, read: { en: 'hwaiting · you got this', mn: 'хуайтин · чи чадна' } },
];

/** 끝에 주는 한마디(SAY IT). */
export const PHRASE = {
  ko: '천천히 말해 주세요',
  art: 'snail',
  wordAt: [0.05, 0.67, 1.0], // 낱말 시작(초) — public/vo/vocab/slow.json의 Typecast 낱말 시각(천천히 0.05 · 말해 0.674 · 주세요 0.996)
  read: { en: 'cheoncheonhi malhae juseyo', mn: 'чөнчөнхи малхэ жусэё' } as Record<Lang, string>,
  mean: { en: 'Please speak slowly', mn: 'Удаан ярьж өгнө үү' } as Record<Lang, string>,
};

export type Ui = {
  band: [string, string]; // 위 흰 띠 두 줄(밈의 머리글 자리) — 영상 내내
  promise: string; // 0~3.6초: 이 편이 주는 것(제작 방식 v2 §2-1, 10-20)
  askSub: string; // 「한국어 할 줄 알아요?」 풀이
  laughSub: string;
  okSub: string;
  cats: string[];
  used: string; // 「쓴 단어 n」
  works: string; // 천천히 말해 주세요 위 도장
  yourTurn: string;
  end: [string, string]; // 끝: 댓글 질문
  handle: string;
};

export const UI: Record<Lang, Ui> = {
  en: {
    band: ['POV: a Korean asks if you speak Korean', 'Me: uses my WHOLE vocabulary'],
    promise: 'STAY FOR THE 1 PHRASE THAT SAVES YOU',
    askSub: 'Do you speak Korean?',
    laughSub: '(trying not to laugh)',
    okSub: "Sure, I'll speak slowly",
    cats: ['GREETINGS', 'NUMBERS', 'CITIES', 'FOOD', 'PANIC MODE'],
    used: 'WORDS USED',
    works: 'THIS ONE WORKS!',
    yourTurn: 'YOUR TURN',
    end: ['How many did you know?', 'Comment every Korean word you know'],
    handle: '@synkkorean',
  },
  mn: {
    band: ['Солонгос хүн «Солонгосоор ярьдаг уу?» гэвэл', 'Би: мэддэг бүх үгээ хэлчихлээ'],
    promise: 'ЧАМАЙГ АВРАХ ГАНЦ ХЭЛЛЭГ ТӨГСГӨЛД БИЙ',
    askSub: 'Солонгосоор ярьдаг уу?',
    laughSub: '(инээдээ барьж байна)',
    okSub: 'За, би удаан ярья',
    cats: ['МЭНДЧИЛГЭЭ', 'ТОО', 'ХОТ', 'ХООЛ', 'САНДАРЛАА'],
    used: 'ҮГИЙН ТОО',
    works: 'ЭНЭ Л ХЭРЭГТЭЙ!',
    yourTurn: 'ЧИНИЙ ЭЭЛЖ',
    end: ['Хэдийг нь мэдэж байсан бэ?', 'Мэддэг солонгос үгээ сэтгэгдэлд бичээрэй'],
    handle: '@synk.mn',
  },
};
