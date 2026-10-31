# 검수 묶음 drama-ep01-r11

- 대사 1(장면 0 · 처음 보는 1) · 기준 drama-spec-r4 378ef281da59fdfa
- 판정: 통과 1 · 고침 0 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 0
- Claude 일괄 추정 $0.1152 + 판정 $0.0816 = $0.1967 → 1,000문항 어림 $196.75
- 토큰 합계: 입력 18206 · 캐시 쓰기 0 · 캐시 읽기 0 · 출력 7874
- 아르곤 호출 1회 · 7분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | s1e01-t6 | pass | pass | fix | The spec is usable as learning evidence. Toward a stranger, the judge accepts only polite and formal endings. Banmal formed by dropping 「요」  |

## s1e01-t6 · 처음 보는 · pass

- 대사: 길을 잃었어요. 새솔대 정문이 어디에 있는지 아세요?
- Claude(pass): The spec for this unseen line is sound. The judge accepts only polite and formal endings toward a stranger. The keys are just 「정문」 and the question expression, so different information (후문, 도서관) does not become a sure pass. The alts broadly cover common ways of asking directions with suitable politeness. In both the judge test and the blind test utterances there are no false notes and no leniency, and minSyllables 6 filters only one- or two-word replies. Adding 「어디 있나요」 and 「가는 방법」 to the alts would let more correct replies count toward 'tried it without help', but this is optional. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 아르곤(fix): 높임·최소 음절(6)·핵심 말 구성과 전이 설계가 모두 탄탄하고 오노트·너그러움도 없으나, 처음 보는 대사에서 3~4급 학습자가 흔히 쓰는 『어디인지』(『어딘지』·『어디 있는지』와 자모 닮음 0.8 미만), 『어디로 가는지』, 『위치』가 keys[1].alts에 빠져 확실한 통과가 누락되므로 alts 보강(fix)을 권한다. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 3 · 다른 노트 0
- 판정(pass): The spec is usable as learning evidence. Toward a stranger, the judge accepts only polite and formal endings. Banmal formed by dropping 「요」 (「…어디에 있어?」) gets a sure ending note. Other banmal (「어디야?」, 「알아?」) is held as unsure and is not recorded, so it never counts as a sure pass. The keys are just 「정문」 and the question expression. Different information (후문, 도서관) and a missing question stay unsure, so in neither reviewer's test utterances does a wrong reply count as 'tried it without help'. There are no false notes: every correct utterance in the judge test and in both reviewers' test utterances is a sure pass or unsure. minSyllables 6 catches one-word replies like 「정문이요?」 and lets 「정문 어디예요?」 (6 syllables) through. Reviewer B's main ground for fix was that 「어디인지」 does not match. That is contradicted by B's own test utterance (「…정문이 어디인지 아세요?」 → 통과 · 확실), so it is excluded. The remaining forms are 「위치」, 「어디로 가는지」, 「가는 방법」 and 「어디 있나요」, which sits at the 0.8 boundary. Missing them only drops a correct reply to unsure, with no note and no record. The alts already cover common direction-asking forms broadly, so these are refinements rather than blockers. Skill (ko.speaking.ask), level, naturalness, transfer from s1e01-7 and culture_bias are all fine.
- 고칠 점:
  - Optional: add 「위치」 to keys[1].alts (so that 「정문 위치 좀 알려 주세요 / 정문 위치 아세요?」 counts as a sure pass)
  - Optional: add 「가는 방법」 to keys[1].alts
  - Optional: add 「어디 있나요」 to keys[1].alts (currently at the 0.8 boundary)
  - Optional: add 「어디로 가는지」 to keys[1].alts
  - Optional: add 「어디 있나요」 to keys[1].alts (currently borderline at 0.8 against 「어디 있어요」).
  - Optional: add 「가는 방법」 to keys[1].alts (so that the common reply 「정문 가는 방법 알려 주세요」 also counts toward 'tried it without help').
  - keys[1].alts에 『어디인지』 더함
  - keys[1].alts에 『어디로 가는지』 더함
  - keys[1].alts에 『위치』 더함
