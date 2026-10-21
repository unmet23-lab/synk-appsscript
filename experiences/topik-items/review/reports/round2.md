# 검수 묶음 round2

- 문항 47(새 47 · 기존 0) · 기준 topik-review-r1 612d69674d6139bf
- 판정: 통과 43 · 고침 4 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 0
- Claude 일괄 추정 $3.0278 + 판정 $0.1306 = $3.1584 → 1,000문항 어림 $67.20
- 토큰 합계: 입력 94656 · 캐시 쓰기 494754 · 캐시 읽기 320132 · 출력 82746
- 아르곤 호출 12회 · 19분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | ti-l-b-007 | pass | pass | pass | 정답이 유일하고 오답이 대화와 분명히 어긋나요. 1급 낱말로 된 자연스러운 가게 대화이고, 세 언어 해설도 정확해요. 그대로 통과예요. |
| u002 | ti-l-c-013 | pass | pass | pass | 제안에 맞는 응답을 고르는 1급 문항이다. 정답이 하나뿐이고 오답이 고르며, 세 언어 해설도 바르다. 고칠 곳 없이 통과한다. |
| u003 | ti-l-c-022 | pass | pass | pass | 정답이 하나뿐이고 오답이 조건·때·부정을 바꿔 그럴듯하며, 급·자리·해설이 모두 기준에 맞아 통과한다. |
| u004 | ti-l-c-025 | pass | pass | pass | 조건(-(으)면)을 겨눈 1급 듣기 문항으로 정답이 하나뿐이고, 꼴·난도·해설이 모두 맞습니다. ①의 「만듭니다」를 「만들 수 있습니다」로 바꾸면 조금 더 정확해지지만 꼭 고칠 필요는 없습니다. 통과입니다. |
| u005 | ti-l-c-032 | fix | fix | pass | Answer ③ (index 2) is unique, and the sequence skill and difficulty 1 fit. A is right about one thing: the woman describes only her own plan |
| u006 | ti-l-d-008 | pass | pass | pass | 대화 전체의 화제가 「이웃」으로 분명하고, 오답 셋이 대화 낱말을 쓴 그럴듯한 함정입니다. 난도·꼴·해설 세 언어가 모두 기준에 맞아 통과입니다. |
| u007 | ti-l-d-011 | pass | pass | pass | 정답이 하나뿐이고 오답이 대화의 말을 바꿔 그럴듯하게 짜였어요. 2급 수준과 세부 능력에 맞고 세 언어 해설도 정확해서 그대로 통과예요. |
| u008 | ti-l-e-017 | pass | pass | pass | 정답이 유일하고 오답이 그럴듯하며, 세 언어 해설과 난도가 기준에 맞아 그대로 통과한다. |
| u009 | ti-l-e-022 | pass | pass | pass | 정답이 하나뿐이고 오답이 대본의 말을 바꿔 그럴듯하다. 해설 세 언어도 일치해 그대로 쓸 수 있다. |
| u010 | ti-r-b-016 | pass | pass | pass | 정답이 하나뿐이고 오답이 그럴듯하며, 이유를 읽는 능력과 2급 난도에 맞는 문항입니다. 해설 세 언어가 모두 정확하여 통과로 판정합니다. |
| u011 | ti-r-e-001 | fix | fix | pass | I solved it myself and got choice 1. The key is correct and unique: the passage line 「비가 오면 3층 교실에서 봅니다」 directly contradicts choice 1. The  |
| u012 | ti-r-e-002 | pass | pass | pass | 조건(-으면)으로 층이 갈리는 점을 겨눈 1급 안내문 문항이다. 정답이 유일하고, 해설 세 언어가 일치하며, 꼴과 난도도 맞아 통과한다. |
| u013 | ti-r-e-003 | pass | pass | pass | 정답이 하나뿐이고 조건(-(으)면) 읽기를 바르게 겨눈 1급 안내문 문항입니다. 해설 세 언어도 정확합니다. 보기 말투(먹습니다→먹을 수 있습니다)는 사소한 점이라 통과로 봅니다. |
| u014 | ti-r-e-004 | pass | pass | pass | 조건(-(으)면)과 오늘의 사실을 이어 정답을 고르는 깔끔한 1급 내용 일치 문항이에요. 정답이 하나뿐이고 오답도 고르게 짜였어요. 한국어 해설이 조금 긴 것 말고는 고칠 곳이 없어 통과예요. |
| u015 | ti-r-e-005 | pass | pass | pass | 조건(-면)과 오늘의 사실을 맞춰 추론하게 하는 1급 문항입니다. 정답이 하나뿐이고, 오답은 조건·사실·함께하는 사람을 각각 바꿔 고르게 설계되었으며, 세 언어 해설도 정확해 통과합니다. |
| u016 | ti-r-e-006 | pass | pass | pass | 조건 규칙을 인물에게 적용하는 깔끔한 1급 내용 일치 문항이에요. 정답은 추론에 기대지만 다툴 여지가 작고, 오답·해설·난도 모두 기준에 맞아 통과합니다. |
| u017 | ti-r-e-007 | pass | pass | pass | 조건(-(으)면)을 어제 상황에 적용해 푸는 1급 내용 일치 문항입니다. 정답이 하나뿐이고 오답이 고르게 짜였으며, 해설 세 언어도 바르게 써져 그대로 써도 됩니다. |
| u018 | ti-r-e-008 | pass | pass | pass | 조건(-(으)면)을 오늘의 사실에 적용해 푸는 1급 내용 일치 문항이에요. 정답이 하나뿐이고, 오답 셋은 모두 글과 어긋나요. 한국어 해설 첫 문장이 조금 어색한 것 말고는 그대로 써도 돼요. |
| u019 | ti-r-e-009 | pass | pass | pass | 부정(못 먹어요)을 겨눈 문자형 TI-R-40 문항으로 정답이 유일하다. 낱말·문형이 1급에 맞고 세 언어 해설도 정확해 통과. |
| u020 | ti-r-e-010 | pass | pass | pass | 정답이 하나뿐이고, 4번 보기가 적당한 함정이 된다. 해설 세 언어도 정확하다. 그대로 써도 된다. |
| u021 | ti-r-e-011 | pass | pass | pass | 정답 유일·오답 설계·급 적합 모두 양호합니다. 해설 문장이 조금 어색한 점은 사소해 통과입니다. |
| u022 | ti-r-e-012 | pass | pass | pass | 정답이 하나로 분명하고, 오답이 글의 말을 바꿔 그럴듯하게 짜여 있어요. 1급 수준과 부정 이해 능력에도 맞고, 세 언어 해설도 정확해서 통과예요. |
| u023 | ti-r-e-013 | pass | pass | pass | 정답이 유일하고 오답이 글과 분명히 어긋난다. 1급 수준에 맞고 해설 세 언어가 같은 근거를 짚는다. 그대로 써도 된다. |
| u024 | ti-r-e-014 | pass | pass | pass | 세 문장 글에서 지각한 이유를 고르는 1급 문항이다. 정답이 유일하고 오답이 글과 분명히 어긋나며, 해설 세 언어도 바르다. 그대로 통과한다. |
| u025 | ti-r-e-015 | pass | pass | pass | 정답이 하나로 분명하고, 오답이 글의 낱말로 이유·대상·부정을 바꿔 그럴듯해요. 1급 앞쪽 낱말·문형과 세 언어 해설이 모두 맞아서 통과예요. |
| u026 | ti-r-e-016 | pass | pass | pass | The answer is unique, and the distractors are plausible because they reverse facts from the passage. The item targets reason comprehension a |
| u027 | ti-r-e-017 | fix | fix | pass | Directly solved, the answer is choice index 1, which matches the answer key. The passage, the level (TOPIK I, difficulty 1) and the target s |
| u028 | ti-r-e-018 | pass | pass | pass | 순서 표지가 분명한 1급 내용 일치 문항이에요. 정답이 하나뿐이고, 오답은 순서만 바꿔 그럴듯하며, 세 언어 해설도 정확해요. 그대로 써도 돼요. |
| u029 | ti-r-e-019 | pass | pass | pass | 순서 정보로 정답 하나가 분명히 갈리고, 오답은 순서만 바꿔 그럴듯하며, 1급 낱말·문형과 세 언어 해설이 모두 바릅니다. 그대로 통과합니다. |
| u030 | ti-r-e-020 | pass | pass | pass | 순서 단서가 분명하고 오답이 모두 순서를 뒤집은 그럴듯한 보기라 정답이 하나뿐입니다. 급·난도·해설 세 언어 모두 기준에 맞아 그대로 통과입니다. |
| u031 | ti-r-e-021 | pass | pass | pass | 순서를 묻는 1급 내용 일치 문항이에요. 정답이 하나뿐이고 오답은 순서만 바꿔 그럴듯하며, 해설 세 언어가 모두 정확해요. 통과예요. |
| u032 | ti-r-e-022 | pass | pass | pass | 정답이 하나뿐이고 오답 셋이 각각 글의 말과 어긋나도록 짜였다. 1급 수준과 중심 생각 자리에 맞고, 해설 세 언어도 같은 근거를 말한다. 해설 한국어 첫 문장의 인용 꼴은 사소한 문제라 통과로 본다. |
| u033 | ti-r-e-023 | pass | pass | pass | 정답이 하나뿐이다. 오답은 글의 말을 바꾼 그럴듯한 꼴이고, 급·난도·해설이 모두 기준에 맞아 통과한다. |
| u034 | ti-r-e-024 | pass | pass | pass | 정답이 유일하고 오답이 그럴듯하며, 급과 꼴에 맞는 중심 생각 문항입니다. 한국어 해설 첫 문장의 어색함은 사소하므로 통과입니다. |
| u035 | ti-r-e-025 | pass | pass | pass | 부탁문 앞 -(으)니까와 -아서의 차이를 묻는 깔끔한 문법 빈칸 문항이에요. 정답이 하나뿐이고 오답이 그럴듯하며, 세 언어 해설이 일치해 그대로 써도 돼요. |
| u036 | ti-r-e-026 | pass | pass | pass | The single correct answer is clear, and each distractor is directly contradicted by the passage. The item fits the reason skill and difficul |
| u037 | tii-l-a-004 | pass | pass | pass | 정답이 유일하고 오답이 그럴듯하며 해설 세 언어가 정확합니다. 그대로 써도 됩니다. |
| u038 | tii-l-a-005 | pass | pass | pass | 정답이 하나뿐이고 오답도 그럴듯하다. 급·꼴·해설 모두 기준에 맞아 통과로 본다. 업무 자료 지연은 흔한 장면이라 기출 유사도만 확인이 필요하다. |
| u039 | tii-l-a-006 | pass | pass | pass | 정답이 유일하고, 오답은 기간·변경·시점을 바꿔 그럴듯하게 만들었어요. 해설 세 언어도 일치해서 그대로 통과예요. |
| u040 | tii-l-a-007 | pass | pass | pass | 정답이 하나로 분명하고 오답 설계·해설·대본이 모두 기준에 맞아 통과다. |
| u041 | tii-l-a-009 | pass | pass | pass | 정답이 유일하고 오답 설계가 좋으며, 해설 세 언어가 일치한다. 그대로 통과한다. |
| u042 | tii-l-a-010 | pass | pass | pass | 정답이 하나로 분명하고, 오답이 계획 변경·부탁·완료된 일로 잘 짜인 9~12번형 문항입니다. 세 언어 해설도 일치해 그대로 써도 됩니다. |
| u043 | tii-l-a-015 | fix | fix | pass | I solved it myself and got choice 3, which matches the answer key and is the only answer. The man says 「쓰는 시간을 아이와 같이 정해 보세요」, so his centra |
| u044 | tii-l-a-023 | pass | pass | pass | 정답이 유일하고 오답이 대본에서 그럴듯하게 갈린다. 꼴·난도·해설 세 언어 모두 기준에 맞아 통과로 판정한다. |
| u045 | tii-l-a-024 | pass | pass | pass | 정답이 유일하고 오답이 그럴듯하며, 해설 세 언어가 같은 근거를 말한다. 그대로 통과해도 된다. |
| u046 | tii-r-a-003 | pass | pass | pass | 정답이 유일하고 보기 꼴이 고르며, 3급 문법 빈칸 문항으로 알맞습니다. 그대로 통과입니다. |
| u047 | tii-r-a-024 | pass | pass | pass | 정답이 유일하고 오답은 글과 분명히 어긋난다. 수필 세트 24번 꼴과 3급 수준에 맞고, 세 언어 해설도 정확하다. 통과. |
