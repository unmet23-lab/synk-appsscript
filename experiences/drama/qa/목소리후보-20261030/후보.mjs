// 1화 두 역 목소리 후보(2026-10-30) — 줄만들기.mjs · 굽기.mjs가 같이 쓴다(이 파일은 부르기만 해도 아무것도 쓰지 않는다).
// 일레븐 v4는 힉스필드 프리셋: 교수는 나이 칸 middle_aged인 Nora · Elena와 미리듣기 음높이가 가장 낮은 Vesper(158Hz),
// 선배는 미리듣기 음높이 128~135Hz(20대 남자 결)의 Kevin · Julian · Cillian. Inworld는 힉스필드의 한국어 원어민 넷 전부.
// OpenAI는 Realtime 2.1(gpt-4o-mini-tts는 2027-01-06 종료 예정이라 시즌 목소리로 못 씀).
export const 후보 = {
 교수: { eleven: { Nora: 'd081b915-6623-4a44-bacf-80d0f1c90a03', Elena: 'ca83ca7f-c186-493d-bd69-0d765fa861b2', Vesper: 'c3204739-4084-41a3-9dc5-c805b307ec18' }, inworld: ['Yoona (ko)', 'Minji (ko)'], openai: ['marin'] },
 선배: { eleven: { Kevin: 'f1373f24-3b96-433f-9a68-e595810ef608', Julian: '95429266-c0ac-4137-a209-63b8812b0f23', Cillian: 'd8ba9f14-8a24-44db-932b-99e16c45bd32' }, inworld: ['Hyunwoo (ko)', 'Seojun (ko)'], openai: ['cedar'] },
};
