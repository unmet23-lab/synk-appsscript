# 검수 묶음 drama-ep01-r13

- 대사 1(장면 0 · 처음 보는 1) · 기준 drama-spec-r4 378ef281da59fdfa
- 판정: 통과 1 · 고침 0 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 0
- Claude 일괄 추정 $0.0942 + 판정 $0.0000 = $0.0942 → 1,000문항 어림 $94.17
- 토큰 합계: 입력 19111 · 캐시 쓰기 0 · 캐시 읽기 0 · 출력 5595
- 아르곤 호출 1회 · 6분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | s1e01-t9 | pass | pass | pass | This is an unseen line asking a senior about a location. The keys (편의점 · 어디에 있는지), the alts, the polite/formal ending and minSyllables 6 all |

## s1e01-t9 · 처음 보는 · pass

- 대사: 선배님, 혹시 편의점이 어디에 있는지 아세요?
- Claude(pass): This is an unseen line asking a senior about a location. The keys (편의점 · 어디에 있는지), the alts, the polite/formal ending and minSyllables 6 all fit. In the blind tests, correct polite questions are sure passes, banmal and one-word answers get notes, and changing the place stays unsure. No false notes or leniency, so it passes. Adding a few common alts is optional. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 처음 인사한 선배에게 편의점 위치를 공손하게 묻는 처음 보는 대사(s1e01-t9)로, 장면 대사 s1e01-7의 능력을 다른 상황·다른 인물에게 잘 옮겼다. 핵심 말('편의점', '어디에 있는지')과 24개 허용 표현·최소 6음절 설정이 균형 잡혀 있어 오노트와 너그러움 없이 학습 근거로 쓸 수 있다(pass). / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 고칠 점:
  - 선택: add 「어디서」 and 「찾고 있」 to keys[1].alts, so common phrasings such as 「편의점 어디서 찾을 수 있어요?」 and 「편의점을 찾고 있는데요」 also count as sure passes.
  - 선택: consider removing the alt 「편의점 있어요」 and leaving it only in variants (「이 근처에 편의점 있어요?」), to keep the statement 「편의점에 있어요」 from becoming a sure pass. It is unlikely in this situation, so this is not required.
  - 선택: keys[1].alts에 『어디에 있을까요』, 『어디 있을까요』 더함
