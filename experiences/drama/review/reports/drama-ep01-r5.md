# 검수 묶음 drama-ep01-r5

- 대사 4(장면 0 · 처음 보는 4) · 기준 drama-spec-r3 4a96e44dcdfdb140
- 판정: 통과 0 · 고침 0 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 4
- Claude 일괄 추정 $0.4359 + 판정 $0.0000 = $0.4359 → 1,000문항 어림 $108.97
- 토큰 합계: 입력 72915 · 캐시 쓰기 0 · 캐시 읽기 0 · 출력 29006
- 아르곤 호출 0회 · 0분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | s1e01-t1 | incomplete | pass | - | 조교에게 수강 신청 용건을 말하는 처음 보는 대사다. 높임 · 핵심 말 · 허용 표현 · 최소 음절이 모두 알맞고, 판정 시험과 블라인드 시험 말에서 오노트도 너그러움도 없다. 「수업 신청」 같은 흔한 바꿔 말하기는 선택 고침으로 적는다. / 시험 말 |
| u002 | s1e01-t2 | incomplete | pass | - | Unseen line where the learner asks the library staff when a book is due. Ending, keys and length catch the polite question accurately. Corre |
| u003 | s1e01-t5 | incomplete | fix | - | 여럿 앞 자기소개 처음 보는 대사로 높임 · 핵심 말 · 능력은 맞다. 다만 minSyllables 11이 「새로 왔어요. 잘 부탁해요.」(10음절) 같은 맞는 짧은 대답에 길이 노트(incorrect)를 줘서 9로 낮춰야 한다. 또 아주 흔한 「처음 |
| u004 | s1e01-t7 | incomplete | pass | - | 조교에게 고마움을 전하는 처음 보는 대사로, 명세가 잘 맞다. 받는 끝맺음은 polite·formal이고, 핵심 말은 도움 인정(덕분에)과 고마움(감사합니다) 둘이며, alts는 흔한 맞는 말을 넉넉히 받는다. 판정 시험과 블라인드 시험 말에서 오노트 |

## s1e01-t1 · 처음 보는 · incomplete

- 대사: 수강 신청에 대해 여쭤볼 게 있어서 왔어요.
- Claude(pass): 조교에게 수강 신청 용건을 말하는 처음 보는 대사다. 높임 · 핵심 말 · 허용 표현 · 최소 음절이 모두 알맞고, 판정 시험과 블라인드 시험 말에서 오노트도 너그러움도 없다. 「수업 신청」 같은 흔한 바꿔 말하기는 선택 고침으로 적는다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(-): 결과 없음
- 고칠 점:
  - 선택: keys[0].alts에 「수업 신청」 더함 — 학습자가 흔히 쓰는 같은 뜻 말이 확신 없음으로 빠지지 않게.
  - 선택: keys[1].alts에 「알고 싶은 게 있어서」 · 「질문하려고」 더함 — 흔한 말이 확신 없음으로 빠지는 것을 줄임.

## s1e01-t2 · 처음 보는 · incomplete

- 대사: 이 책 반납 기한이 언제까지인지 궁금해서요.
- Claude(pass): Unseen line where the learner asks the library staff when a book is due. Ending, keys and length catch the polite question accurately. Correct paraphrases become sure passes, and wrong-intent or casual lines are uncertain or get a note, so there is no false note and no leniency. The only limit is that tense cannot be distinguished, which comes from the judging rules. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 아르곤(-): 결과 없음
- 고칠 점:
  - Optional: add '이 책 언제까지 반납해야 돼요?' to variants, the most common phrasing (it is already a sure pass through the keys, so this is just to make it explicit).
  - Optional: add '기한 알려' and '내야' to the key alts (so particle-less or 내다-type phrasings do not fall to uncertain).

## s1e01-t5 · 처음 보는 · incomplete

- 대사: 이번 학기에 새로 온 유학생이에요. 잘 부탁드립니다.
- Claude(fix): 여럿 앞 자기소개 처음 보는 대사로 높임 · 핵심 말 · 능력은 맞다. 다만 minSyllables 11이 「새로 왔어요. 잘 부탁해요.」(10음절) 같은 맞는 짧은 대답에 길이 노트(incorrect)를 줘서 9로 낮춰야 한다. 또 아주 흔한 「처음 왔어요」가 alts에 없어 확신 없음으로 빠지므로 「처음 왔」을 더하는 것이 좋다. 너그러움은 보이지 않는다. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 2 · 노트 없음 3 · 다른 노트 0
- 아르곤(-): 결과 없음
- 고칠 점:
  - minSyllables 9 (「새로 왔어요. 잘 부탁해요.」 같은 10음절 맞는 대답에 길이 노트가 나지 않게)
  - keys[0].alts에 「처음 왔」 더함 (「이번 학기에 처음 왔어요」가 확실한 통과로 세어지게)
  - keys[0].alts에 「새로 들어왔」 더함
  - 선택: keys[0].alts에 「새로 왔습니다」 계열이 「새로 왔」으로 잡히는지 확인. 「몽골에서 온 유학생」처럼 「새로」 없이 유학생임을 밝히는 소개를 받을지는 기획 판단(지금은 확신 없음으로 둠)

## s1e01-t7 · 처음 보는 · incomplete

- 대사: 선생님 덕분에 살았어요. 정말 감사합니다.
- Claude(pass): 조교에게 고마움을 전하는 처음 보는 대사로, 명세가 잘 맞다. 받는 끝맺음은 polite·formal이고, 핵심 말은 도움 인정(덕분에)과 고마움(감사합니다) 둘이며, alts는 흔한 맞는 말을 넉넉히 받는다. 판정 시험과 블라인드 시험 말에서 오노트도 너그러움도 없고, 반말은 끝맺음 노트, 한두 낱말 대답은 길이 노트로 바르게 걸린다. 「도와줘서」·「감사드려요」 더하기와 「도움이」 좁히기는 선택 다듬기다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 아르곤(-): 결과 없음
- 고칠 점:
  - 선택: keys[0].alts에 『도와줘서』 더함(학습자가 흔히 쓰는 「도와줘서 감사합니다」를 확실한 통과로 세려고)
  - 선택: keys[1].alts에 『감사드려요』 더함
  - 선택: keys[0].alts의 『도움이』를 『도움 덕분에』·『큰 도움이』로 좁힘(「도움이 필요해요」류를 덜 받게)
