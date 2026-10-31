# 검수 묶음 drama-ep01-r4

- 대사 4(장면 0 · 처음 보는 4) · 기준 drama-spec-r3 4a96e44dcdfdb140
- 판정: 통과 0 · 고침 0 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 4
- Claude 일괄 추정 $0.4693 + 판정 $0.0000 = $0.4693 → 1,000문항 어림 $117.34
- 토큰 합계: 입력 71388 · 캐시 쓰기 0 · 캐시 읽기 0 · 출력 32657
- 아르곤 호출 0회 · 0분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | s1e01-t1 | incomplete | fix | - | The listener, keys, and skill fit, and the 판정_시험 results are acceptable. There is no leniency: wrong-information lines stay unsure on keys[0 |
| u002 | s1e01-t2 | incomplete | fix | - | 직원에게 해요체 · 합쇼체만 받는 끝맺음, 핵심 말 두 개, 최소 음절 6 모두 알맞다. 판정 시험에도 오노트가 없다. 다만 처음 보는 대사에서 key[0].alts의 「빌릴 수 있」이 「언제」와 함께 들리면 「이 책 언제 빌릴 수 있어요?」(다른 질 |
| u003 | s1e01-t5 | incomplete | fix | - | 여럿 앞 자기소개의 처음 보는 대사다. 끝맺음 · 핵심 말 · 길이 설정은 대체로 맞다. 다만 alts 「이번 학기에 온 유학생」 · 「이번에 온 유학생」 때문에 「지난 학기에/지난번에 온 유학생」(새로 온 게 아님)이 확실한 통과로 세어진다. 이것은 |
| u004 | s1e01-t7 | incomplete | pass | - | 조교에게 고마움을 전하는 처음 보는 대사다. 높임(polite·formal), 핵심 말(덕분에 · 감사합니다)과 허용 표현, 최소 8음절이 모두 알맞다. 판정 시험과 블라인드 시험 말에서 오노트와 너그러움이 없다. 「감사드려요」 같은 흔한 말을 alt |

## s1e01-t1 · 처음 보는 · incomplete

- 대사: 수강 신청에 대해 여쭤볼 게 있어서 왔어요.
- Claude(fix): The listener, keys, and skill fit, and the 판정_시험 results are acceptable. There is no leniency: wrong-information lines stay unsure on keys[0]. However, minSyllables 9 gives a length note to the short polite answer 「수강 신청 궁금해요」 (8), a wrong note. Also, alts lack the very common 「-는데요」 opener and the 「여쭤봐도 될까요」 permission question, so the app counts fewer sure solo attempts. Change to minSyllables 8 and add those patterns to keys[1].alts. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 1
- 아르곤(-): 결과 없음
- 고칠 점:
  - Add to keys[1].alts: 『여쭤볼 게 있는데』 · 『여쭤보고 싶은데』 · 『물어보고 싶은데』 · 『궁금한 게 있는데』 · 『질문이 있는데』 · 『문의드리고 싶은데』 · 『때문에 왔는데요』
  - Add to keys[1].alts: 『여쭤봐도 될까요』 · 『여쭤봐도 돼요』 · 『물어봐도 될까요』 · 『물어봐도 돼요』
  - minSyllables 8 (so the short polite answer 「수강 신청 궁금해요」 does not get a length note)
  - Optional: add 『수강신청』 · 『수업 신청』 to keys[0].alts
  - Optional: reduce the 「때문에 왔어요 · 일로 왔어요 · 문제로 왔어요 · 관련해서 왔어요」 family in keys[1].alts to forms without the ending, such as 『때문에 왔』 · 『일로 왔』, to remove the duplicated ending in the substitution test (no effect on judging)

## s1e01-t2 · 처음 보는 · incomplete

- 대사: 이 책 반납 기한이 언제까지인지 궁금해서요.
- Claude(fix): 직원에게 해요체 · 합쇼체만 받는 끝맺음, 핵심 말 두 개, 최소 음절 6 모두 알맞다. 판정 시험에도 오노트가 없다. 다만 처음 보는 대사에서 key[0].alts의 「빌릴 수 있」이 「언제」와 함께 들리면 「이 책 언제 빌릴 수 있어요?」(다른 질문)를 확실한 통과로 세는 너그러움이 있다. 그래서 그 alt를 「까지 빌릴」로 바꾸도록 fix로 둔다. 「반납 기한 좀 알려 주세요」 같은 흔한 요청형도 key[1].alts에 더하기를 권한다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(-): 결과 없음
- 고칠 점:
  - keys[0].alts에서 「빌릴 수 있」을 빼고 「까지 빌릴」을 더함. 「언제까지 빌릴 수 있어요?」는 받고 「언제 빌릴 수 있어요?」는 확실한 통과로 세지 않게 한다.
  - keys[0].alts에 「대출 기한」 더함
  - keys[1].alts에 「기한 좀 알려」 · 「기한을 알려」 · 「반납일을 알려」 · 「날짜 좀 알려」 더함(「반납 기한 좀 알려 주세요」 같은 흔한 요청형을 확실한 통과로)

## s1e01-t5 · 처음 보는 · incomplete

- 대사: 이번 학기에 새로 온 유학생이에요. 잘 부탁드립니다.
- Claude(fix): 여럿 앞 자기소개의 처음 보는 대사다. 끝맺음 · 핵심 말 · 길이 설정은 대체로 맞다. 다만 alts 「이번 학기에 온 유학생」 · 「이번에 온 유학생」 때문에 「지난 학기에/지난번에 온 유학생」(새로 온 게 아님)이 확실한 통과로 세어진다. 이것은 처음 보는 대사의 너그러움이므로 두 alts를 빼야 쓸 수 있다. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 2 · 노트 없음 3 · 다른 노트 0
- 아르곤(-): 결과 없음
- 고칠 점:
  - keys[0].alts에서 「이번 학기에 온 유학생」을 뺌 — 「지난 학기에 온 유학생」이 확실한 통과가 되는 것을 막는다(이 말은 확신 없음으로 남아도 된다)
  - keys[0].alts에서 「이번에 온 유학생」을 뺌 — 「지난번에 온 유학생」이 부분 일치로 확실한 통과가 되는 것을 막는다
  - 선택: keys[0].alts에 「한국에 온 유학생」 · 「새로 왔」 더함 — 흔한 맞는 소개를 확실한 통과로 더 세려는 것이다(「다시 왔」 같은 말과 닮는지 판정 시험으로 확인)

## s1e01-t7 · 처음 보는 · incomplete

- 대사: 선생님 덕분에 살았어요. 정말 감사합니다.
- Claude(pass): 조교에게 고마움을 전하는 처음 보는 대사다. 높임(polite·formal), 핵심 말(덕분에 · 감사합니다)과 허용 표현, 최소 8음절이 모두 알맞다. 판정 시험과 블라인드 시험 말에서 오노트와 너그러움이 없다. 「감사드려요」 같은 흔한 말을 alts에 더하는 것은 선택 다듬기로 남기고 pass로 둔다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 아르곤(-): 결과 없음
- 고칠 점:
  - 선택: keys[1].alts에 「감사드려요」 더함
  - 선택: keys[0].alts에 「덕택에」 · 「도와주셔서요」 더함
  - 선택: keys[0].alts의 「도움이」를 「도움이 많이」 · 「도움이 됐어요」 같은 더 분명한 덩어리로 좁히는 것을 검토
