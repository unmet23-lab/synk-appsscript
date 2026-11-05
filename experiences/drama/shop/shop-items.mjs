/**
 * 옷 가게 1차 8벌 (2026-11-05) — 시안이 읽는 모의 자료. 그림은 qa/옷굽기조립.mjs → qa/옷오리기.py.
 *
 * id는 제2의 나 옷장 목록(`../qa/제2의나-20261102/사진시험/룩목록.mjs`)과 같은 이름을 쓴다 — 앱에 넣을 때 그대로 잇는다.
 * 값은 아직 정하지 않았다(옷 가게 재화는 09-20 보류, 끌어넘기기 구현 준비 3절) — 시안은 「값 자리」만 둔다.
 * tint: 색을 따라오는 바탕(B판)에서 이 옷이 가운데 올 때의 위 · 아래 색. 옷 사진에서 고른 색을 아주 옅게.
 */
export const ITEMS = [
  { id: 'outfit-trench', name: '짧은 트렌치코트', note: '면 개버딘 · 허리끈 · 허벅지 중간 길이', tint: ['#F1E7D6', '#E4E9DA'] },
  { id: 'outfit-cardigan', name: '버터색 카디건', note: '도톰한 면 니트 · 단추 하나만 잠근 · 흰 티와 함께', tint: ['#F6EDBF', '#F2E3D4'] },
  { id: 'outfit-varsity', name: '빨간 야구 점퍼', note: '울 몸판 · 크림색 가죽 소매 · 줄무늬 밑단', tint: ['#F4D9D6', '#F1E5D9'] },
  { id: 'outfit-bomber', name: '카키 항공 점퍼', note: '나일론 MA-1 · 회색 티와 함께', tint: ['#E1E5D3', '#E9E6DC'] },
  { id: 'outfit-rugby', name: '남색 줄무늬 럭비 셔츠', note: '굵은 줄무늬 · 흰 깃', tint: ['#DCE1EC', '#EEE9DE'] },
  { id: 'outfit-leather', name: '검정 가죽 재킷', note: '부드러운 가죽 · 은색 지퍼 · 흰 티와 함께', tint: ['#E2E1E4', '#EFEDEA'] },
  { id: 'outfit-denim', name: '연청 데님 재킷', note: '오버핏 · 흰 티와 함께', tint: ['#DCE6EF', '#EEF0EC'] },
  { id: 'outfit-vest', name: '니트 조끼와 셔츠', note: '크림 V넥 조끼 · 하늘색 면 셔츠', tint: ['#EEEAD9', '#DFE7F1'] },
];

/** 시안에서 보이는 상태 — 하나는 배송 중, 하나는 이미 내 옷. */
export const MOCK_STATE = { 'outfit-cardigan': 'arrived', 'outfit-bomber': 'shipping' };

/** 시안 전용 — 도착한 옷의 입은 사진 손글씨(날짜 · 곳). 앱에서는 도착 때와 장면 이름에서 만든다. */
export const MOCK_NOTE = { 'outfit-cardigan': '3월 12일, 창가 자리에서' };

export const art = (id, side) => new URL(`./assets/${id.replace('outfit-', '')}-${side}.webp`, import.meta.url).href;
