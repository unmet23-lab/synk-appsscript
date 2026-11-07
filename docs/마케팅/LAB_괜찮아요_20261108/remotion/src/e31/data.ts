// LAB 영어 E31 「괜찮아요」 화면 글 정본 — 영어 · 간체 · 버마어를 같은 정본에서 렌더한다(판끼리 따로 고치지 않는다).
// 간체 · 버마어는 세 겹 검수(../../../게시/검문/)를 거친 글만 둔다. 읽는 법 줄은 영어 로마자(두 나라 공통, LAB 장부 「두 채널 판」).
export type Lang = 'en' | 'cn' | 'mm';
const NL = String.fromCharCode(10);
export const ROMAN = { gw: 'gwaen-cha-na-yo', ne: 'ne, jo-a-yo' };
export const FONT: Record<Lang, string> = {
  en: "'Inter Tight', 'SUIT', sans-serif",
  cn: "'Microsoft YaHei', 'Inter Tight', 'SUIT', sans-serif",
  mm: "'Inter Tight', 'SUIT', 'Myanmar Text', sans-serif",
};
type Pack = {
  hook: string; // 0초 머리 글 — 손해를 먼저
  bite: string; // 한 입 먹을래?
  think: string; // 몽글 생각 — okay = yes
  means: string; // 펠트 「괜찮아요!」 아래 — 몽글이 뜻한 것
  back: string; // 아, 괜찮아? 알았어!
  huh: string; // 어? 어어?
  heard: string; // 친구는 사양으로 들었다
  ate: string; // 그래서 다 먹었다
  offers: string; // 누가 권하면
  no: string; // = 사양
  want: string; // 받고 싶으면
  yes: string; // = 네, 주세요
  ask: string; // 나도 한 입만…
  endHead: string; // 끝 머리 — 누가 권할 때
  endNo: string; // 끝 두 줄
  endYes: string;
  size: number;
  subSize: number;
};
export const TEXT: Record<Lang, Pack> = {
  en: {
    hook: `I said 괜찮아요…${NL}and lost my snack.`,
    bite: 'Want a bite?',
    think: `A bite?! Yes!${NL}I want it!`,
    means: '(I mean: YES!)',
    back: 'Oh, no thanks? Okay!',
    huh: 'Huh? Wait…!',
    heard: 'He heard: "No, thanks."',
    ate: '…so he ate it all.',
    offers: 'When someone offers you something,',
    no: 'No, thanks.',
    want: 'Want it? Say:',
    yes: 'Yes, please!',
    ask: 'Can I have one bite…?',
    endHead: 'When someone offers:',
    endNo: 'No, thanks.',
    endYes: 'Yes, please!',
    size: 64,
    subSize: 44,
  },
  cn: {
    hook: `我说了“괜찮아요”…${NL}结果小吃没了。`,
    bite: '要尝一口吗？',
    think: `尝一口？！要要要！${NL}我想吃！`,
    means: '（我的意思是：要！）',
    back: '哦，不吃啊？好嘞！',
    huh: '诶？等等…！',
    heard: '他听到的是：“不用了，谢谢。”',
    ate: '…于是他全吃光了。',
    offers: '别人请你吃东西时，',
    no: '不用了，谢谢。',
    want: '想要的话，就说：',
    yes: '好呀，我要！',
    ask: '也给我尝一口…？',
    endHead: '别人请你吃东西时：',
    endNo: '不用了，谢谢。',
    endYes: '好呀，我要！',
    size: 60,
    subSize: 42,
  },
  mm: {
    hook: `"괜찮아요" လို့ ပြောမိလို့…${NL}မုန့် လွတ်သွားတယ်။`,
    bite: 'တစ်ကိုက် စားမလား?',
    think: `တစ်ကိုက်?! စားမယ်!${NL}စားချင်တယ်!`,
    means: '(ဆိုလိုတာက: စားမယ်!)',
    back: 'အော်၊ မစားဘူးလား? ရပါပြီ!',
    huh: 'ဟင်? နေဦး…!',
    heard: 'သူကြားလိုက်တာက "ရပါတယ်၊ မယူတော့ပါဘူး"။',
    ate: '…ဒါနဲ့ သူ အကုန်စားလိုက်တယ်။',
    offers: 'တစ်ယောက်ယောက်က တစ်ခုခု ကမ်းပေးရင်',
    no: 'ရပါတယ်၊ မယူတော့ပါဘူး။',
    want: 'လိုချင်ရင် ဒီလို ပြောပါ:',
    yes: 'ဟုတ်ကဲ့၊ ယူပါမယ်!',
    ask: 'ငါ့ကိုလည်း တစ်ကိုက်လောက်…?',
    endHead: 'တစ်ယောက်ယောက်က ကမ်းပေးရင်:',
    endNo: 'ရပါတယ်၊ မယူတော့ပါဘူး။',
    endYes: 'ဟုတ်ကဲ့၊ ယူပါမယ်!',
    size: 48,
    subSize: 36,
  },
};
