// 1화 목소리 후보(2026-10-30) — 줄만들기.mjs · 굽기.mjs · 판만들기.mjs가 같이 쓴다(이 파일은 부르기만 해도 아무것도 쓰지 않는다).
// 일레븐 v4는 힉스필드 프리셋: 교수는 나이 칸 middle_aged인 Nora · Elena와 미리듣기 음높이가 가장 낮은 Vesper(158Hz),
// 선배는 미리듣기 음높이 128~135Hz(20대 남자 결)의 Kevin · Julian · Cillian. Inworld는 힉스필드의 한국어 원어민 넷 전부.
// OpenAI는 Realtime 2.1(gpt-4o-mini-tts는 2027-01-06 종료 예정이라 시즌 목소리로 못 씀).
// 10-30 유호님이 고름: 교수 = Elena, 선배 = Julian(결정 표). 그 뒤 감독 · 학생 모범 읽기 후보 — 고른 두 목소리는 빼고,
// 감독은 성별을 정하지 않아 남자 셋(Mark 115Hz · Harrison 125Hz · Inworld Hyunwoo) · 여자 둘(Nora · Inworld Yoona) · OpenAI ash,
// 모범 읽기는 젊고 또박또박한 결(Hana young · Zoe · Kevin · Inworld Minji · Seojun) · OpenAI coral.
export const 후보 = {
 교수: { eleven: { Nora: 'd081b915-6623-4a44-bacf-80d0f1c90a03', Elena: 'ca83ca7f-c186-493d-bd69-0d765fa861b2', Vesper: 'c3204739-4084-41a3-9dc5-c805b307ec18' }, inworld: ['Yoona (ko)', 'Minji (ko)'], openai: ['marin'] },
 선배: { eleven: { Kevin: 'f1373f24-3b96-433f-9a68-e595810ef608', Julian: '95429266-c0ac-4137-a209-63b8812b0f23', Cillian: 'd8ba9f14-8a24-44db-932b-99e16c45bd32' }, inworld: ['Hyunwoo (ko)', 'Seojun (ko)'], openai: ['cedar'] },
 감독: { eleven: { Mark: '27c04473-84a9-4b60-a41f-c8e8458bd4f1', Harrison: '573e5163-59b3-4926-aab1-951ef2985f81', Nora: 'd081b915-6623-4a44-bacf-80d0f1c90a03' }, inworld: ['Hyunwoo (ko)', 'Yoona (ko)'], openai: ['ash'] },
 모범: { eleven: { Hana: 'c25f78a0-714e-42af-8da3-a399cef94968', Zoe: 'd0374db1-44b9-4f05-939e-0a9ae9dbbe6a', Kevin: 'f1373f24-3b96-433f-9a68-e595810ef608' }, inworld: ['Minji (ko)', 'Seojun (ko)'], openai: ['coral'] },
};
// OpenAI Realtime에 주는 배역 설명.
export const 인물말 = {
 교수: '국제학부 50대 여성 교수. 처음 온 유학생에게 따뜻하지만 마감 앞에서는 단호하다. 학생에게 해요체.',
 선배: '같은 과 3학년 20대 남학생. 길 잃은 신입생을 챙기는 친근한 선배, 장난기가 조금 있다. 처음 만난 후배에게 해요체.',
 감독: '배우 출신의 드라마 감독. 신인 배우에게 짧고 분명하게, 따뜻하게 말한다. 테이크에 대해서만 말하고 사람을 평가하지 않는다.',
 모범: '한국어 말하기 수업의 모범 읽기 성우. 외국인 학습자가 따라 할 수 있게 또박또박, 자연스러운 서울말 속도로 그 상황에 맞는 말투로 읽는다.',
};
