/* 시안마다 본 참고와 잰 값. 참고 그림은 남의 화면이라 보관함에만 둔다(저장소에 넣지 않는다). */
export const REFS = {
  a: {
    title: '가 흰 입력창 — 참고: ChatGPT · Perplexity · Claude',
    lead: '2026-11-26 밤에 열린 모습을 직접 찍고 입력칸과 제목을 쟀습니다. 잘 만든 AI 제품은 제목을 굵게 하지 않고 크게, 가늘게 씁니다. 지난 판은 600~700 굵기였습니다.',
    figs: [
      { src: 'r/chatgpt-1440-0.jpg', name: 'ChatGPT 첫 화면', took: '가운데 제목 한 줄, 그 아래 입력창 하나, 예시 하나. 나머지는 비웁니다.' },
      { src: 'r/perplexity-1440-2typed.jpg', name: 'Perplexity 입력 판', took: '판 안 아래 줄에 갈래 단추를 둡니다(Search · Computer). 가는 「한국 유학 · AI 강의 · 광고 · 회사」로 옮겼습니다.' },
      { src: 'r/claude-1440-0.jpg', name: 'Claude 첫 화면', took: '제목 56px · 굵기 330. 크고 가는 제목 하나가 화면의 결을 정합니다.' },
    ],
    nums: [['제목', 'Claude 56px/330 · Gemini 36px/320 → 가 48px/300'], ['입력 판', 'Perplexity 640×120 · 모서리 20 · 옅은 테 → 720폭 · 모서리 22'], ['입력 글', 'Perplexity 16px · Gemini 17px → 17px/400'], ['바탕', 'ChatGPT #fcfcfc · v0 #fafafa → 흰색(SYNK 바탕은 흰색과 검정만)'], ['답', '첫 문장을 22px로 크게, 나머지는 16.5px. 이어 물을 것은 Perplexity처럼 줄과 +']],
  },
  b: {
    title: '나 유리 검색 — 참고: apple.com 검색',
    lead: 'apple.com/kr에서 검색을 열고 한국어로 적은 모습을 찍었습니다. 홈이 흐려지고 위에서 판이 내려옵니다. 상자 없이 큰 글자 하나가 입력칸입니다.',
    figs: [
      { src: 'r/apple-kr-1440-1open.jpg', name: 'apple.com 검색을 연 모습', took: '판 #fafafc, 뒤 화면 흐림, 「빠른 링크」 12px 이름표 아래 화살표 줄 다섯.' },
      { src: 'r/apple-kr-1440-2typed.jpg', name: '한국어를 적은 모습', took: '입력 글자 24px · 굵기 600. 돋보기와 글자만 있고 테두리가 없습니다.' },
    ],
    nums: [['판', '#fafafc · 높이 196px → 같은 바탕, 높이는 내용만큼 늘어남'], ['입력', '24px/600 → 30px/600(한글은 같은 크기에서 작아 보여 키움)'], ['줄', '빠른 링크 12px/600 → 15px/600, 왼쪽 가는 화살표'], ['답', 'Apple 지원 글처럼 큰 제목 · 첫 문단 · 오른쪽 단에 할 일']],
  },
  c: {
    title: '다 검정 무대 — 참고: Fin · Linear · Raycast, PULSE 캐스팅 복도',
    lead: 'Fin은 세리프 제목 100px · 굵기 300이고, 입력은 화면 아래에 떠 있는 알약 안에 예시 질문으로 둡니다. 검정 바탕은 Linear · Raycast의 #08090a 결이고, 명조 300은 유호님이 고르신 PULSE 캐스팅 복도의 글자입니다.',
    figs: [
      { src: 'r/fin-1440-0.jpg', name: 'fin.ai 첫 화면', took: '세리프 100px/300 · 자간 −0.046em. 아래 떠 있는 알약에 「What would Fin cost for my team?」.' },
      { src: 'r/linear-1440-0.jpg', name: 'Linear 첫 화면', took: '#08090a 바탕, 회색 둘째 줄, 가는 테의 판.' },
    ],
    nums: [['질문 줄', 'Fin 제목 100px/300 → 명조 300 · 44px(질문이 여섯 줄이라 줄임)'], ['답 첫 문장', '명조 300 · 52px, 나머지 본문은 SUIT 17px'], ['입력', 'Fin 아래 알약 → 폭 680 · 높이 60 · 알약 안 예시가 바뀜'], ['바탕', '검정 #000(SYNK 바탕 규칙), 판은 #121212']],
  },
};
