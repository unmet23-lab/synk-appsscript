// LAB 몽골 M27 「벗어요」 화면 글 정본. 몽골어는 세 겹 검수(../검문/화면글.txt)를 거친 글만 둔다.
// 키릴 읽는 법은 우리 몽골 편 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · 받침 ㅇ=н), 된소리 ㄲ · ㅆ은 гг · сс.
export const TEXT = {
  hook1: 'Монголоор ганцхан үг байдаг ч…',
  hook2: '«Өмсөх» гэдгийг солонгосоор?',
  wrong: 'Гутлыг ч бас «입어요» гэх үү?',
  wrongMark: 'Буруу!',
  out: 'Гадаа гарлаа',
  home: 'Орой гэртээ ирлээ',
  question: 'Тайлахдаа юу гэх вэ?',
  end: 'Өмсөхөд дөрөв, тайлахад ганцхан',
};

export type Tag = { obj: string; verb: string; read: string; mn: string; at: number };
import { T } from './timeline';
export const TAGS: Tag[] = [
  { obj: '코트를', verb: '입어요', read: 'котырыл ибөё', mn: 'Пальтогоо өмсөнө', at: T.coat },
  { obj: '신발을', verb: '신어요', read: 'шинбарыл шинөё', mn: 'Гутлаа өмсөнө', at: T.shoes },
  { obj: '모자를', verb: '써요', read: 'можарыл ссөё', mn: 'Малгайгаа өмсөнө', at: T.hat },
  { obj: '장갑을', verb: '껴요', read: 'жангабыл ггёё', mn: 'Бээлийгээ өмсөнө', at: T.mitt },
];
export const OFF = { ko: '벗어요', read: 'бөсөё', mn: 'Бүгдийг нь тайлна' };
