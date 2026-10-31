# 검수 묶음 drama-ep01-r6

- 대사 5(장면 0 · 처음 보는 5) · 기준 drama-spec-r3 4a96e44dcdfdb140
- 판정: 통과 3 · 고침 1 · 뺌 0 · 엇갈림(판정 전) 1 · 미완 0
- Claude 일괄 추정 $0.5835 + 판정 $0.1366 = $0.7200 → 1,000문항 어림 $144.01
- 토큰 합계: 입력 92659 · 캐시 쓰기 0 · 캐시 읽기 0 · 출력 39815
- 아르곤 호출 1회 · 12분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | s1e01-t1 | pass | pass | fix | 명세는 조교(staff)에게 해요체·합쇼체만 받고, 끝 「요」를 뺀 반말에는 끝맺음 노트를, 「수강 신청요」 같은 단답에는 길이 노트(최소 8음절)를 준다. 「수강 신청 때문에요」(8음절)처럼 맞는 짧은 대답은 막지 않는다. 판정 시험과 두 검수자의  |
| u002 | s1e01-t2 | pass | pass | pass | The unseen line in the library asking for the return date has keys that capture both 'returning this book' and 'when', so wrong-information  |
| u003 | s1e01-t3 | pass | pass | pass | Unseen line for the dorm supervisor (staff). Politeness, keys, alts and minimum length (9 syllables) are all appropriate. Neither the judgin |
| u004 | s1e01-t5 | fix | fix | fix | For a group self-introduction, the accepted endings, the length and the keys all fit. Neither the judgment run nor the blind tests showed a  |
| u005 | s1e01-t7 | split | fix | pass | 처음 보는 대사 t7(조교에게 고마움)이다. 끝맺음 · 핵심 말 · 허용 표현은 맞게 잡혀 있고, 너그러움도 없다. 다만 minSyllables 8은 7음절인 「정말 감사합니다.」 · 「덕분에 살았어요.」에 길이 노트를 주어 맞는 짧은 대답을 inco |

## s1e01-t1 · 처음 보는 · pass

- 대사: 수강 신청에 대해 여쭤볼 게 있어서 왔어요.
- Claude(pass): 조교에게 수강 신청 용건을 말하는 처음 보는 대사다. 판정 시험과 블라인드 시험 말 모두에서 오노트가 없고, 다른 정보(졸업 신청 · 수강 취소)를 말하면 보류로 남아 너그러움도 없다. 끝 「요」 빠짐은 끝맺음 노트로, 한 낱말 대답은 길이 노트로 거른다. 흔한 「물어볼 게 있는데」류를 alts에 더하면 「혼자 해 봄」을 더 셀 수 있다(선택). / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 1
- 아르곤(fix): 높임과 최소 음절은 적절하나, keys[1].alts에 '묻다' 뜻이 없는 『때문에 왔어요』 계열이 들어 있어 다른 용건 발화까지 확실한 통과가 되고 합쇼체 『여쭤보고 싶습니다』 계열이 빠져 있어 고쳐야 한다. / 시험 말 8 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0 / 너그러움 「수강 신청 서류 때문에 왔어요.」 → 통과 · 확실
- 판정(pass): 명세는 조교(staff)에게 해요체·합쇼체만 받고, 끝 「요」를 뺀 반말에는 끝맺음 노트를, 「수강 신청요」 같은 단답에는 길이 노트(최소 8음절)를 준다. 「수강 신청 때문에요」(8음절)처럼 맞는 짧은 대답은 막지 않는다. 판정 시험과 두 검수자의 시험 말에서 오노트는 없다. 「장학금」 같은 다른 화제나 화제가 빠진 말은 확신 없음으로 남아 확실한 통과가 되지 않는다. B가 너그러움으로 든 「수강 신청 서류 때문에 왔어요.」는 잘못 쓴 note 시험 말로 보고 뺐다. 화제(수강 신청)가 맞고, 「N 때문에 왔어요」는 학과 사무실에서 찾아온 까닭을 말하는 자연스럽고 흔한 용건 말하기다. 「서류」는 다른 사실이 아니라 같은 화제의 덧붙인 정보다. 이 능력(ko.speaking.purpose)의 목적은 찾아온 까닭 말하기이고, 뜻이 통하는 쉬운 말을 alts로 받는 것은 이 앱의 선이므로 「때문에 왔어요」 계열을 빼야 할 까닭이 없다. B가 지적한 합쇼체 「여쭤보고 싶습니다」는 B의 시험 말에서도 이미 확실한 통과로 나와 막는 문제가 아니다. 판정 시험의 「…때문에 왔어요 왔어요」 같은 줄은 도구가 낱말을 기계적으로 갈아 끼워 생긴 비문이고 명세 문제는 아니다. 높임, 길이, 능력, 수준, 처음 보는 대사로서의 옮김 모두 맞다.
- 막은 시험 말: 아르곤 「수강 신청 서류 때문에 왔어요.」(노트 줄 말 · missing) → 통과 · 확실
- 고칠 점:
  - 선택: keys[1].alts에 「물어볼 게 있는데」 더함
  - 선택: keys[1].alts에 「여쭤보고 싶은 게 있는데」 더함
  - 선택: keys[1].alts에 「문의할 게 있는데」 더함
  - 선택: keys[1].alts에 「질문 있어서」 더함
  - 선택: keys[1].alts에 「질문드릴 게 있어서」 · 「질문드리러」 더함
  - keys[1].alts에서 '묻다·여쭙다' 뜻이 없는 『때문에 왔어요』 · 『때문에 왔습니다』 · 『때문에 왔는데요』 · 『일로 왔어요』 · 『일로 왔습니다』 · 『문제로 왔어요』 · 『관련해서 왔어요』 뺌
  - keys[1].alts에 합쇼체 발화를 받도록 『여쭤보고 싶습니다』 · 『물어보고 싶습니다』 · 『알고 싶습니다』 · 『문의드리고 싶습니다』 · 『질문드리러』 · 『질문드릴 게 있어서』 더함

## s1e01-t2 · 처음 보는 · pass

- 대사: 이 책 반납 기한이 언제까지인지 궁금해서요.
- Claude(pass): The unseen line in the library asking for the return date has keys that capture both 'returning this book' and 'when', so wrong-information lines do not become sure passes. Ending and length notes go only to the right lines. Neither the judge test nor the blind test lines showed false notes or leniency, so the verdict is pass. Optionally, adding 「대출 기간」 and 「내야」 to the alts would count more common phrasings as 'tried alone'. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 아르곤(pass): 듣는 사람에 맞는 높임, 최소 음절(6), 핵심 말과 허용 표현 구성이 모두 촘촘하여 오노트와 너그러움 없이 학습 근거로 쓸 수 있다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - Optional: add 「대출 기간」 and 「내야」 to keys[0].alts. These are common library phrasings such as 「이 책 대출 기간이 언제까지예요?」 and 「이 책 언제까지 내야 돼요?」, and adding them reduces uncertain results.
  - Optional: add 「갖다 줘야」 to keys[0].alts.

## s1e01-t3 · 처음 보는 · pass

- 대사: 처음엔 힘들었지만 조금씩 익숙해지고 있어요.
- Claude(pass): Unseen line for the dorm supervisor (staff). Politeness, keys, alts and minimum length (9 syllables) are all appropriate. Neither the judging tests nor my blind test utterances produced a false note or leniency. Adding the very common answer 「이제/지금은 괜찮아요」 to keys[1].alts is optional: it would let that answer pass as sure. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 1 · 다른 노트 1
- 아르곤(pass): 과거 형편과 현재 변화 두 핵심 축, 허용 표현, 최소 음절(9)이 모두 적절하여 오노트와 너그러움 없이 안정적으로 작동한다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - 선택: keys[1].alts에 「이제 괜찮아요」 · 「지금은 괜찮아요」 더함 (아주 흔한 대답인데 지금은 확신 없음으로 빠져 혼자 해 봄을 덜 셈)
  - 선택: keys[1].alts에 「많이 익숙해요」 · 「적응이 돼요」 더함
  - 선택: keys[1].alts에 합쇼체 『이제 익숙합니다』 · 『지금은 익숙합니다』 · 『괜찮아졌습니다』 · 『편해졌습니다』 더함

## s1e01-t5 · 처음 보는 · fix

- 대사: 이번 학기에 새로 온 유학생이에요. 잘 부탁드립니다.
- Claude(fix): For a group self-introduction, the accepted endings, the length and the keys all fit. Neither the judgment run nor the blind tests showed a mis-note or leniency. However, the most direct rendering of the meaning, '이번 학기에 온 유학생' / '새 유학생', is not in the alts, so correct answers fall to uncertain. Adding those alts will count 'tried alone' more reliably. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 1 · 다른 노트 0
- 아르곤(fix): 『새로 온 유학생』이 한 덩어리로 묶여 『새로 온 몽골 유학생』 같은 맞는 말이 매칭되지 않고, alts의 『새로 왔』 · 『신입생』 때문에 유학생 정보가 빠지거나 교환학생으로 바꾼 말까지 확실한 통과가 되므로 핵심 말을 분리해야 한다. / 시험 말 8 — 오노트 0 · 너그러움 2 · 확신 아님 2 · 노트 없음 0 · 다른 노트 0 / 너그러움 「이번 학기에 새로 왔어요. 잘 부탁드립니다.」 → 통과 · 확실 · 너그러움 「이번 학기에 새로 들어왔어요. 교환학생이에요. 잘 부탁드립니다.」 → 통과 · 확실
- 막은 시험 말: 아르곤 「이번 학기에 새로 왔어요. 잘 부탁드립니다.」(노트 줄 말 · missing) → 통과 · 확실 · 아르곤 「이번 학기에 새로 들어왔어요. 교환학생이에요. 잘 부탁드립니다.」(노트 줄 말 · missing) → 통과 · 확실
- 고칠 점:
  - keys[0].alts: add '이번 학기에 온 유학생' ('this semester' kept, '새로' dropped; a direct rendering of the meaning).
  - keys[0].alts: add '새 유학생'.
  - keys[0].alts: add '이번 학기에 왔'.
  - Optional: keys[0].alts: add '에서 온 유학생', to make sure the very common self-introduction for this learner group, '몽골에서 온 유학생입니다', is not left uncertain because of borderline similarity. Wrong facts such as '작년에 온' still do not match.
  - keys[0]을 『새로 온』과 『유학생』으로 분리 — keys[0]을 { word: '새로 온', alts: ['새로 들어온', '처음 온', '신입', '새로 왔', '새로 들어왔', '처음 왔', '입학한', '입학했', '이번 학기에 온', '이번에 온'] }으로 고침
  - keys에 { word: '유학생', alts: ['외국인 학생'] }을 별도 핵심 말로 더하고 기존 keys[0].alts의 『신입생』 · 『새로 온 학생』처럼 유학생 정보가 빠진 말만으로 확실한 통과가 되지 않게 함

## s1e01-t7 · 처음 보는 · split

- 대사: 선생님 덕분에 살았어요. 정말 감사합니다.
- Claude(fix): 처음 보는 대사 t7(조교에게 고마움)이다. 끝맺음 · 핵심 말 · 허용 표현은 맞게 잡혀 있고, 너그러움도 없다. 다만 minSyllables 8은 7음절인 「정말 감사합니다.」 · 「덕분에 살았어요.」에 길이 노트를 주어 맞는 짧은 대답을 incorrect로 남긴다. 「감사합니다, 선생님」(8)은 통과하니 앞뒤도 맞지 않는다. minSyllables를 6으로 낮추면 한 낱말 대답만 거르게 된다. 「도움 됐어요」 등을 alts에 더하는 것은 선택이다. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 높임, 최소 음절(8), 도움·덕분 언급과 감사 인사로 이루어진 핵심 말 구성이 모두 적절하여 학습 근거로 쓸 수 있다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - minSyllables 6 (8 → 6: 「정말 감사합니다」 · 「덕분에 살았어요」 · 「정말 고마워요」에 길이 노트가 나지 않게 하고, 「감사합니다」 · 「고마워요」 같은 한 낱말 대답은 계속 거른다)
  - 선택: keys[0].alts에 『도움 됐어요』 더함
  - 선택: keys[1].alts에 『감사드려요』 · 『고마웠어요』 더함
  - 선택: keys[0].alts의 『도움이』를 『도움이 됐』 · 『도움이 많이』 · 『도움 받』으로 좁혀 『도움이 필요해요. 감사합니다.』 같은 다른 용건 발화와 겹칠 여지를 줄임
