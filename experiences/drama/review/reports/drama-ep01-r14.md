# 검수 묶음 drama-ep01-r14

- 대사 18(장면 9 · 처음 보는 9) · 기준 drama-spec-r5 cca057c685af9308
- 판정: 통과 13 · 고침 5 · 뺌 0 · 엇갈림(판정 전) 0 · 미완 0
- Claude 일괄 추정 $1.5937 + 판정 $0.3991 = $1.9928 → 1,000문항 어림 $110.71
- 토큰 합계: 입력 335254 · 캐시 쓰기 0 · 캐시 읽기 0 · 출력 92320
- 아르곤 호출 5회 · 45분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | s1e01-1 | pass | pass | pass | 지도교수에게 하는 첫 인사 · 자기소개 장면 대사다. 높임, 핵심 말, 최소 음절이 맞고, 판정 시험과 블라인드 시험 말에서 오노트가 없다. 「새로 온 학생」 alt 때문에 핵심 말을 뺀 말이나 「교환학생」으로 바꾼 말에 노트를 못 주지만, 연습 대사 |
| u002 | s1e01-2 | pass | pass | pass | 교수에게 한국 생활을 답하는 장면 대사다. 높임(해요체 · 합쇼체), 두 핵심 말과 허용 표현, 최소 9음절이 모두 알맞다. 판정 시험과 블라인드 시험 말에서 오노트가 없어 그대로 쓴다. / 시험 말 9 — 오노트 0 · 너그러움 2 · 확신 아님 0 |
| u003 | s1e01-3 | pass | pass | pass | 교수에게 찾아온 용건을 말하는 장면 대사다. 높임 · 핵심 말 · 허용 표현 · 최소 음절이 모두 맞고, 판정 시험과 블라인드 시험 말에서 오노트가 없다. 두 음절 「과제」가 바뀌어도 걸리지 않는 것과 「물어보다」 alt가 지나가는 것은 평가로 세지  |
| u004 | s1e01-4 | pass | pass | pass | The polite level for a professor is right, and the keys (제출 기한 · 언제까지인지) capture the purpose of the question. In both the judging test and t |
| u005 | s1e01-5 | pass | pass | pass | 교수에게 마감 안내를 듣고 합쇼체로 맺는 장면 대사다. 받는 끝맺음, 핵심 말 두 개, 최소 음절 7이 알맞다. 판정 시험과 시험 말에서 오노트가 없다. 핵심 말 하나를 뺀 말이 확신 없음으로 지나가는 것은 두 핵심 말의 자모가 닮은 데서 오는 규칙  |
| u006 | s1e01-6 | pass | pass | pass | Senior and 해요체 · 합쇼체 fit. The keys cover the reason and what happened, and all alts have the same meaning and an appropriate politeness leve |
| u007 | s1e01-7 | pass | pass | pass | 선배에게 도서관 위치를 공손하게 묻는 장면 대사다. 받는 끝맺음(해요체 · 합쇼체), 핵심 말(도서관 · 어디에 있는지), alts · variants, minSyllables 9 모두 알맞다. 판정 시험과 블라인드 시험 말에서 오노트가 없다. 「알아 |
| u008 | s1e01-8 | pass | pass | pass | 선배에게 고마움을 전하는 장면 대사다. 높임, 핵심 말(덕분에 · 살았어요), 길이 7이 모두 알맞다. 판정 시험과 시험 말에서 오노트가 없다. 허용 표현 「도움이 됐어요」의 어색함은 선택 다듬기로만 적는다. / 시험 말 9 — 오노트 0 · 너그러움 |
| u009 | s1e01-9 | pass | pass | pass | This is a short promise line. The single key 「살게요」 captures the promise, and the alts all express the same promise politely. The ending, len |
| u010 | s1e01-t1 | fix | fix | fix | 조교에게 용건을 말하는 처음 보는 대사다. 높임, 핵심 말(수강 신청 + 용건 표현), 허용 표현은 맞다. 다만 minSyllables 8 때문에 맞는 짧은 대답 「수강 신청 궁금해요」(7음절)가 길이 노트로 incorrect가 된다. 7로 낮추고,  |
| u011 | s1e01-t2 | pass | pass | pass | The spec for this unseen line (library staff, asking a return deadline) has right politeness, keys, alts and length. Neither the judge test  |
| u012 | s1e01-t3 | pass | pass | pass | 처음 보는 대사 s1e01-t3은 듣는 사람(사감)에 맞는 polite · formal 끝맺음과 두 핵심 정보(처음의 어려움 · 지금의 적응)를 잘 잡았다. 판정 시험과 블라인드 시험 말에서 오노트도 너그러움도 없어 pass다. 흔한 답 「이제 괜찮아 |
| u013 | s1e01-t4 | fix | pass | fix | There are no false notes and no leniency. The essential information (복사실 plus asking where it is) is held in the keys, and wrong-fact answer |
| u014 | s1e01-t5 | fix | pass | fix | This is an unseen line, so a wrong answer must not count as a sure pass. Reviewer B's probe 「이번 학기에 교환학생으로 새로 왔어요. 잘 부탁드립니다.」 got a sure pas |
| u015 | s1e01-t6 | pass | pass | pass | An unseen line asking a stranger for directions. The key words (정문 · the location question) and the alts are well chosen, and minSyllables 6 |
| u016 | s1e01-t7 | fix | pass | fix | The rule framework fits the line. The TA is staff, so only polite and formal endings are accepted. The two keys (crediting the helper with 덕 |
| u017 | s1e01-t8 | pass | pass | fix | No wrong notes and no leniency appear in the judge test or in either reviewer's test lines. A's pass is right. B's main claim does not hold. |
| u018 | s1e01-t9 | fix | pass | fix | This is an unseen line, so a wrong answer counted as a sure pass blocks it. Reviewer B's probe 「선배님, 혹시 지금 편의점 열어요?」 asks whether the store  |

## s1e01-1 · 장면 · pass

- 대사: 안녕하세요, 교수님. 이번 학기에 새로 온 유학생이에요.
- Claude(pass): 지도교수에게 하는 첫 인사 · 자기소개 장면 대사다. 높임, 핵심 말, 최소 음절이 맞고, 판정 시험과 블라인드 시험 말에서 오노트가 없다. 「새로 온 학생」 alt 때문에 핵심 말을 뺀 말이나 「교환학생」으로 바꾼 말에 노트를 못 주지만, 연습 대사라 막지 않고 선택 고침으로 적었다. / 시험 말 10 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 지도교수 연구실 첫인사·자기소개 장면 대사로 핵심 말·허용 표현·최소 음절이 모두 적절하며 대본 낱말 변형에 오노트가 없어 통과한다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 고칠 점:
  - 선택: keys[1].alts의 「새로 온 학생」을 빼거나 「이번 학기에 새로 온 학생」처럼 길게 바꿈 — 「유학생」 정보를 지키고, 핵심 말을 뺀 말 · 「교환학생」으로 바꾼 말에 빠진 말 노트가 나게 한다(장면 대사라 막지는 않음).
  - 선택: variants에 「안녕하십니까, 교수님. 이번 학기에 새로 온 유학생입니다.」 더함 — 처음 뵙는 지도교수에게 흔한 합쇼체 소개다(지금도 통과하지만 통째 닮음으로도 받게).

## s1e01-2 · 장면 · pass

- 대사: 아직 낯설지만 조금씩 익숙해지고 있어요.
- Claude(pass): 교수에게 한국 생활을 답하는 장면 대사다. 높임(해요체 · 합쇼체), 두 핵심 말과 허용 표현, 최소 9음절이 모두 알맞다. 판정 시험과 블라인드 시험 말에서 오노트가 없어 그대로 쓴다. / 시험 말 9 — 오노트 0 · 너그러움 2 · 확신 아님 0 · 노트 없음 0 · 다른 노트 1
- 아르곤(pass): 한국 생활 근황과 적응 과정을 말하는 장면 대사로 핵심 말·허용 표현·최소 음절이 모두 탄탄하여 통과한다. / 시험 말 8 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 0 · 다른 노트 0
- 고칠 점:
  - 선택: keys[1].alts에 「적응 중이에요」 · 「익숙해져 가고 있어요」 더함

## s1e01-3 · 장면 · pass

- 대사: 과제에 대해 여쭤볼 게 있어서 왔어요.
- Claude(pass): 교수에게 찾아온 용건을 말하는 장면 대사다. 높임 · 핵심 말 · 허용 표현 · 최소 음절이 모두 맞고, 판정 시험과 블라인드 시험 말에서 오노트가 없다. 두 음절 「과제」가 바뀌어도 걸리지 않는 것과 「물어보다」 alt가 지나가는 것은 평가로 세지 않는 장면 대사라 막지 않는다. 꼬리표 id 이름만 선택으로 다듬는다. / 시험 말 10 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 지도교수께 찾아온 용건을 높임말로 밝히는 장면 대사로 핵심 말과 쉬운 허용 표현의 범위, 최소 음절이 모두 적절해 통과한다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - 선택: 문법 「-(으)ㄹ 게 있다」의 id를 「ko.speaking.grammar.have-to-do」에서 뜻이 맞는 이름(예: 「ko.speaking.grammar.something-to-do」)으로 바꿈
  - 선택: 문법 꼬리표에 「-에 대해(서)」 더함(용건의 주제를 말하는 문형, TOPIK II 읽기 문법에 이음)

## s1e01-4 · 장면 · pass

- 대사: 제출 기한이 언제까지인지 궁금해서요.
- Claude(pass): The polite level for a professor is right, and the keys (제출 기한 · 언제까지인지) capture the purpose of the question. In both the judging test and the blind test utterances, no correct line gets a false note. 「…궁금해.」 passes not-sure without an ending note, but for a scene line this is only a missed note and is not blocking. Pass; adding a few easy alts is optional. / 시험 말 9 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 아르곤(pass): 과제 제출 기한을 완곡하게 묻는 장면 대사로 핵심 말·허용 변형·최소 음절(6음절) 설계가 정교하여 오노트 없이 통과한다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 고칠 점:
  - Optional: add 「언제까지 내면 되는지」 to keys[1].alts (a common easy rephrasing).
  - Optional: add 「마감 날짜」 to keys[0].alts.
  - 선택: keys[1].alts에 『언제 내야 하는지』, 『언제예요』, 『언제인가요』, 『언제입니까』 더함

## s1e01-5 · 장면 · pass

- 대사: 네, 알겠습니다. 감사합니다, 교수님.
- Claude(pass): 교수에게 마감 안내를 듣고 합쇼체로 맺는 장면 대사다. 받는 끝맺음, 핵심 말 두 개, 최소 음절 7이 알맞다. 판정 시험과 시험 말에서 오노트가 없다. 핵심 말 하나를 뺀 말이 확신 없음으로 지나가는 것은 두 핵심 말의 자모가 닮은 데서 오는 규칙 한계이며, 장면 대사라 막지 않는다. 「알았어요」를 alts에서 빼는 다듬기만 선택으로 남긴다. / 시험 말 10 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 아르곤(pass): 지도교수에게 마감 안내를 듣고 대화를 마무리하는 장면 대사로, 높임·핵심 말·허용 표현·최소 음절(7)이 모두 알맞고 오노트가 없다. 『-습니다』 종결어미는 TOPIK I 초급 문형임을 grammarLevels에 기록했다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 고칠 점:
  - 선택: keys[0].alts에서 「알았어요」를 빼는 것을 고려한다. 교수에게는 「알겠어요 · 알겠습니다」가 더 공손하고, 회차 말투 카드의 정중함 안내와도 맞는다.

## s1e01-6 · 장면 · pass

- 대사: 네, 맞아요. 길을 잃어서 한참 헤맸어요.
- Claude(pass): Senior and 해요체 · 합쇼체 fit. The keys cover the reason and what happened, and all alts have the same meaning and an appropriate politeness level. There are no false notes in the judge tests or the test lines. A reworded reason or verb may be an unsure pass, but for a scene line that is only a missed note. Verdict: pass; trimming 「길을 잃었는데」 is optional. / 시험 말 10 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 처음 만난 선배에게 길을 잃어 헤맨 까닭을 설명하는 장면 대사로, 핵심 말과 허용 표현 구성이 탄탄하고 최소 음절(8)도 적절하다. 조사 생략형 『길 잃어서』 추가만 선택 다듬기로 남겼다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - Optional: remove 「길을 잃었는데」 from keys[0].alts — it changes the connective from reason to background and weakens the -아/어서 (reason) grammar target.
  - Optional: add 「길을 헤매서」 to keys[0].alts (common easy wording).
  - 선택: keys[0].alts에 조사 생략형 『길 잃어서』 더함

## s1e01-7 · 장면 · pass

- 대사: 네, 선배님! 그런데 혹시 도서관이 어디에 있는지 아세요?
- Claude(pass): 선배에게 도서관 위치를 공손하게 묻는 장면 대사다. 받는 끝맺음(해요체 · 합쇼체), 핵심 말(도서관 · 어디에 있는지), alts · variants, minSyllables 9 모두 알맞다. 판정 시험과 블라인드 시험 말에서 오노트가 없다. 「알아?」 같은 반말과 한 음절 바꿈이 확신 없음으로 지나가는 것은 판정 규칙의 한계이고 장면 대사라 막지 않는다. pass. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 선배에게 화제를 돌려 도서관 위치를 공손히 묻는 장면 대사로, minSyllables(9) 조정과 허용 표현·변형이 세심하게 짜여 있어 오노트 없이 잘 작동한다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 고칠 점:
  - 선택: keys[1].alts에 합쇼체 『어디입니까』 · 『어디에 있습니까』 더함

## s1e01-8 · 장면 · pass

- 대사: 정말요? 선배님 덕분에 살았어요.
- Claude(pass): 선배에게 고마움을 전하는 장면 대사다. 높임, 핵심 말(덕분에 · 살았어요), 길이 7이 모두 알맞다. 판정 시험과 시험 말에서 오노트가 없다. 허용 표현 「도움이 됐어요」의 어색함은 선택 다듬기로만 적는다. / 시험 말 9 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 0 · 다른 노트 0
- 아르곤(pass): 데려다주겠다는 선배에게 『덕분에 살았어요』로 고마움을 전하는 장면 대사로, 높임·핵심 말·허용 표현·최소 음절(7)이 모두 빈틈없이 맞는다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 0 · 다른 노트 0
- 고칠 점:
  - 선택: keys[1].alts에서 「도움이 됐어요」 뺌 — 「선배님 덕분에 도움이 됐어요」는 겹말처럼 어색하다. 장면 대사라 막지는 않는다.
  - 선택: keys[0].alts에 「덕분이에요」 더함 — 「선배님 덕분이에요」 꼴도 받기 위해서다. 다만 「살았어요」가 빠지면 여전히 빠진 말 노트가 난다.
  - 선택: keys[1].alts에 합쇼체 『도움이 됐습니다』 더함

## s1e01-9 · 장면 · pass

- 대사: 네, 꼭 살게요!
- Claude(pass): This is a short promise line. The single key 「살게요」 captures the promise, and the alts all express the same promise politely. The ending, length and missing-word checks all behave correctly in the judge tests and my blind test utterances, with no false notes. The only weakness is the judge rule's jamo similarity, which cannot tell one-sound differences like 「갈게요」 from 「살게요」. The verdict is pass. / 시험 말 9 — 오노트 0 · 너그러움 2 · 확신 아님 0 · 노트 없음 0 · 다른 노트 0
- 아르곤(pass): 처음 만난 선배에게 커피를 사겠다고 약속하는 장면 대사로, 핵심 말·허용 표현·최소 음절·높임 설정이 모두 적절하여 그대로 쓸 수 있다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0

## s1e01-t1 · 처음 보는 · fix

- 대사: 수강 신청에 대해 여쭤볼 게 있어서 왔어요.
- Claude(fix): 조교에게 용건을 말하는 처음 보는 대사다. 높임, 핵심 말(수강 신청 + 용건 표현), 허용 표현은 맞다. 다만 minSyllables 8 때문에 맞는 짧은 대답 「수강 신청 궁금해요」(7음절)가 길이 노트로 incorrect가 된다. 7로 낮추고, 흔한 말(궁금해요 · 문의드립니다 · 수강신청 · 수업 신청)을 alts에 더해 확실한 통과를 늘리면 쓸 수 있다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 아르곤(fix): keys[1].alts에 질문 뜻이 없는 「때문에 왔어요 · 일로 왔어요 · 문제로 왔어요 · 관련해서 왔어요」가 포함돼 있어, 「수강 신청 취소 때문에 왔어요」 같은 다른 용건까지 확실한 통과로 세어지므로 이를 빼고 쉬운 화제 표현(「수업 신청」 등)을 보강해야 한다. / 시험 말 10 — 오노트 0 · 너그러움 1 · 확신 아님 1 · 노트 없음 2 · 다른 노트 0 / 너그러움 「수강 신청 취소 때문에 왔어요.」 → 통과 · 확실
- 막은 시험 말: 아르곤 「수강 신청 취소 때문에 왔어요.」(노트 줄 말 · missing) → 통과 · 확실
- 고칠 점:
  - minSyllables 7
  - keys[1].alts에 「궁금해요」 · 「궁금한 게 있어요」 · 「문의드립니다」 · 「문의드리고 싶어요」 · 「여쭤보고 싶어요」 더함
  - keys[0].alts에 「수강신청」 · 「수업 신청」 더함
  - 선택: keys[1].alts에 「때문에요」 · 「관련해서 여쭤볼 게 있어서」 더함
  - keys[1].alts에서 『때문에 왔어요』 · 『때문에 왔습니다』 · 『때문에 왔는데요』 · 『일로 왔어요』 · 『일로 왔습니다』 · 『문제로 왔어요』 · 『관련해서 왔어요』 뺌
  - keys[1].alts에서 『여쭤봐도 될까요』 · 『여쭤봐도 돼요』 · 『물어봐도 될까요』 · 『물어봐도 돼요』 뺌
  - keys[0].alts에 『수업 신청』 · 『강의 신청』 더함
  - keys[1].alts에 『알아보러』 · 『알아보려고』 더함

## s1e01-t2 · 처음 보는 · pass

- 대사: 이 책 반납 기한이 언제까지인지 궁금해서요.
- Claude(pass): The spec for this unseen line (library staff, asking a return deadline) has right politeness, keys, alts and length. Neither the judge test nor the blind test utterances gave a false note or leniency, so it passes. Optionally, adding 「대출 기간」 to key 1 would count more correct answers as 'tried it alone'. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 아르곤(pass): 도서관 직원에게 책 반납 기한을 묻는 처음 보는 대사로, 반납 표현과 기한 질문 표현 두 축이 탄탄하게 잡혀 있어 오노트와 너그러움 없이 잘 작동한다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - 선택: keys[0].alts에 『대출 기간』 · 『대출 기한』 더함(「이 책 대출 기간이 언제까지예요?」를 확실한 통과로)
  - 선택: keys[0].alts에 『돌려주면』 · 『갖다줘야』 · 『가져오면』 더함

## s1e01-t3 · 처음 보는 · pass

- 대사: 처음엔 힘들었지만 조금씩 익숙해지고 있어요.
- Claude(pass): 처음 보는 대사 s1e01-t3은 듣는 사람(사감)에 맞는 polite · formal 끝맺음과 두 핵심 정보(처음의 어려움 · 지금의 적응)를 잘 잡았다. 판정 시험과 블라인드 시험 말에서 오노트도 너그러움도 없어 pass다. 흔한 답 「이제 괜찮아요」 · 「불편했는데」를 alts에 더하면 혼자 해 봄을 더 많이 셀 수 있다(선택). / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 기숙사 사감 선생님께 처음의 어려움과 점진적 적응을 말하는 처음 보는 대사로, 두 핵심 축과 문장 분리형·변화 표현이 고루 갖춰져 있어 그대로 쓸 수 있다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 고칠 점:
  - 선택: keys[1].alts에 「이제 괜찮아요」 · 「지금은 괜찮아요」 · 「괜찮아요」 더함 (흔한 맞는 답이 확신 없음으로 빠지지 않게)
  - 선택: keys[0].alts에 「불편했지만」 · 「불편했는데」 · 「힘들었고」 더함
  - 선택: keys[1].alts에 『편해지고 있어요』 · 『편해지고 있습니다』 더함

## s1e01-t4 · 처음 보는 · fix

- 대사: 선생님, 혹시 복사실이 어디에 있는지 아세요?
- Claude(pass): Unseen line where the learner asks a staff member where the copy room is. The keys (복사실 + asking where) catch the essential information, the alts are broad and all mean a location or the way there, and only polite and formal endings are accepted. In the judge tests and blind tests there was no wrong note and no leniency, so this passes. Adding 「어디 있나요」 and 「어딨어요」 to the alts is optional. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 2 · 다른 노트 0
- 아르곤(fix): 핵심 말 구조와 최소 음절, 높임 설정은 좋으나, 같은 회차 u015에는 있는 『어디인가요 · 어떻게 가는지 · 어떻게 가면』과 흔한 공손 의문형 『어디에 있나요 · 어디 있나요』가 keys[1].alts에서 빠져 있어 보강이 필요하다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 1 · 다른 노트 0
- 판정(fix): There are no false notes and no leniency. The essential information (복사실 plus asking where it is) is held in the keys, and wrong-fact answers such as 「도서관」 only reach an unsure pass. Endings accept 해요체 and 합쇼체 only, which suits a staff member met for the first time. Dropped 「요」 and 반말 such as 「어디에 있어?」 or 「어떻게 가?」 correctly get an ending note. One gap remains. In B's probe, 「저기요, 혹시 복사실이 어디인가요?」 is a very common polite question for level 3–4 learners. Its ending is a confident 해요체, yet the location key is not matched, so it falls to unsure. That under-counts 「혼자 해 봄」, and for an unseen line, missing very common correct expressions should be added to the alts. Learners also often use the polite 「-나요」 question form, and it is safer to accept that explicitly than to rely on jamo similarity. A's 「복사하는 곳」 is an acceptable unsure paraphrase and can be added optionally.
- 고칠 점:
  - keys[1].alts에 『어디인가요』 · 『어딘가요』 더함
  - keys[1].alts에 『어디에 있나요』 · 『어디 있나요』 더함
  - 선택: keys[1].alts에 『어딨어요』(받아 적기 꼴) · 『어떻게 가는지』 · 『어떻게 가면』 더함
  - 선택: keys[0].alts에 『복사하는 곳』 더함
  - 선택: keys[1].alts에 「어디 있나요」 · 「어디에 있나요」 더함
  - 선택: keys[1].alts에 「어딨어요」 더함(받아 적기 꼴)
  - 선택: keys[0].alts에 「복사하는 곳」 더함
  - keys[1].alts에 『어디인가요』, 『어디에 있나요』, 『어디 있나요』, 『어떻게 가는지』, 『어떻게 가면』 더함

## s1e01-t5 · 처음 보는 · fix

- 대사: 이번 학기에 새로 온 유학생이에요. 잘 부탁드립니다.
- Claude(pass): The spec is a good fit. The keys hold the essential information (new student plus the request), the endings suit a group, and minSyllables 9 is appropriate. Blind test utterances produced no false notes and no leniency. Adding common phrasings such as 「새로 입학한」 as alts would let more correct answers count as sure passes (optional). / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 2 · 다른 노트 0
- 아르곤(fix): keys[0]이 『새로 온 유학생』 한 덩어리로 묶여 『새로 온 외국인 유학생 · 입학한 유학생』을 놓치는 반면, alts의 『새로 왔』 등 때문에 『유학생』이 빠지거나 『교환학생으로 새로 왔어요』처럼 다른 사실로 말해도 확실한 통과가 되므로 핵심 말을 『새로 온』과 『유학생』으로 나누어 잡아야 한다. / 시험 말 8 — 오노트 0 · 너그러움 1 · 확신 아님 2 · 노트 없음 1 · 다른 노트 0 / 너그러움 「이번 학기에 교환학생으로 새로 왔어요. 잘 부탁드립니다.」 → 통과 · 확실
- 판정(fix): This is an unseen line, so a wrong answer must not count as a sure pass. Reviewer B's probe 「이번 학기에 교환학생으로 새로 왔어요. 잘 부탁드립니다.」 got a sure pass, which is leniency. The 유학생 → 교환학생 swap is exactly the 'different fact' case the criteria name. The cause is the stems 「새로 왔 · 새로 들어왔 · 처음 왔」 in keys[0].alts, which satisfy the key with no student-status noun at all. 「새로 온 학생 · 신입생」 also drop the 유학생 information. The key is also too rigid: 「새로 온 외국인 유학생」 and 「입학한 유학생」 fall to uncertain. Splitting keys[0] into two axes, 「새로 온」 and 「유학생」, fixes both problems. With the split, 「교환학생」 matches 「유학생」 only about 0.67 by jamo, so it stays uncertain rather than a sure pass. Reviewer A's 「교환학생」 probe is the swap 「새로 온 교환학생」, which still contains the 「새로 온」 string. It came out uncertain, so A saw no leniency, but B's rephrased 「…으로 새로 왔어요」 gets through, so A's pass does not hold. Listener fit (polite and formal accepted for a group), minSyllables 9, the ability tag, level, naturalness and unseen fit are all fine. The keys and alts need fixing.
- 막은 시험 말: 아르곤 「이번 학기에 교환학생으로 새로 왔어요. 잘 부탁드립니다.」(노트 줄 말 · missing) → 통과 · 확실
- 고칠 점:
  - keys[0]을 { word: 「새로 온」, alts: [「새로 들어온」, 「처음 온」, 「새로 입학한」, 「입학한」, 「신입」, 「새로 왔」, 「새로 들어왔」, 「처음 왔」, 「새로 입학했」, 「입학했」] }으로 바꿈(「새로 온 학생」 · 「신입생」 · 「새 유학생」은 뺌)
  - keys에 { word: 「유학생」, alts: [「외국인 학생」, 「유학 온」, 「유학 왔」] }을 따로 더함(「교환학생」 · 유학생을 빼고 말한 것이 확실한 통과가 되지 않게 하고, 「새로 온 외국인 유학생」 · 「몽골에서 온 유학생」을 확실한 통과로 받음)
  - 선택: keys[1].alts에 「앞으로 잘 부탁드립니다」는 이미 부분 일치로 받으므로 두고, 「잘 부탁드리겠어요」를 더함
  - 선택: keys[0].alts에 「새로 입학한 유학생」 · 「새로 입학했」 더함
  - 선택: keys[0].alts에 「새로 온 외국인 학생」 더함
  - keys[0]을 { word: 『새로 온』, alts: [『새로 들어온』, 『처음 온』, 『새로 입학한』, 『입학한』, 『신입』, 『새 유학생』, 『새로 왔』, 『새로 들어왔』, 『처음 왔』, 『입학했』] }으로 바꿈
  - keys에 { word: 『유학생』 }을 별도 핵심 말로 더함(『유학생』 누락 발화 및 『교환학생』 오답의 확실한 통과를 막고 『새로 온 외국인 유학생 · 몽골 유학생』을 확실한 통과로 받음)

## s1e01-t6 · 처음 보는 · pass

- 대사: 길을 잃었어요. 새솔대 정문이 어디에 있는지 아세요?
- Claude(pass): An unseen line asking a stranger for directions. The key words (정문 · the location question) and the alts are well chosen, and minSyllables 6 lets short correct questions through. In the judge test and the blind test utterances there were no false notes and no leniency, and plain speech gets the ending note correctly. Adding 「어디죠 · 가고 싶은데」 is optional polishing. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 사정 설명과 가상 고유명사를 핵심 말에서 빼고 『정문』과 다양한 길·위치 질문 표현을 잘 잡았으며, 오노트와 너그러움 없이 모든 기준을 충족한다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 고칠 점:
  - 선택: add 「어디죠」 to keys[1].alts (「정문이 어디죠?」 is common but currently left unsure)
  - 선택: add 「가고 싶은데」 to keys[1].alts (「정문에 가고 싶은데요」 is a common way of asking directions)
  - 선택: keys[1].alts에 『어디에 있나요』, 『어디 있나요』, 『위치』 더함

## s1e01-t7 · 처음 보는 · fix

- 대사: 선생님 덕분에 살았어요. 정말 감사합니다.
- Claude(pass): Thanking a TA (staff). The ending settings, the two keys (덕분에 credit + thanks), and the length of 6 are all appropriate. Blind tests found no wrong notes and no case where a wrong line counts as a sure pass. As an optional refinement, add past-tense thanks to the alts. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 1 · 다른 노트 0
- 아르곤(fix): keys[0].alts에 들어 있는 『아니었으면 · 없었으면』이 drama-judge-6(r5)의 『아니- · 없-』 부정 어긋남 차단을 무력화하여 부정·반대 발화를 확실한 통과로 세게 만들므로 빼야 하며, 『도움이 많이 되었 · 이제 살았 · 정말 살았』을 더하면 좋다. / 시험 말 8 — 오노트 0 · 너그러움 1 · 확신 아님 1 · 노트 없음 1 · 다른 노트 0 / 너그러움 「선생님 덕분이 아니에요. 감사합니다.」 → 통과 · 확실
- 판정(fix): The rule framework fits the line. The TA is staff, so only polite and formal endings are accepted. The two keys (crediting the helper with 덕분에, and the thanks) are right, and the 6-syllable minimum catches one-word answers. The ability tag and transfer from the scene lines s1e01-5 and s1e01-8 also fit, and A's probes show no false notes. However, B's leniency case is real. In 「선생님 덕분이 아니에요. 감사합니다.」, 「덕분이」 scores about 0.89 jamo similarity to 「덕분에」, so the key counts as heard. Drama-judge-6 would normally hold back a mismatched negation (아니- · 없-), but 「아니었으면」 is in keys[0].alts. That lets the negation through, and the line, which denies the credit, becomes a sure pass. 「없었으면」 likewise disables the 없- guard. In an unseen line, a wrong line counted as a sure pass is blocked, so these two alts must be removed. After removal, correct lines such as 「선생님 아니었으면 큰일 날 뻔했어요」 only drop to unsure (no record), with no false note, so that is acceptable. 「때문에 힘들었어요/늦었어요. 죄송합니다」 coming out unsure is fine for free speech under the rules. B's 「정말 살았어요」 coming out unsure is also acceptable, so it is not a blocking issue.
- 막은 시험 말: 아르곤 「선생님 덕분이 아니에요. 감사합니다.」(노트 줄 말 · missing) → 통과 · 확실
- 고칠 점:
  - Remove 「아니었으면」 and 「없었으면」 from keys[0].alts (they disable the drama-judge-6 negation mismatch guard, so 「선생님 덕분이 아니에요. 감사합니다.」 counts as a sure pass)
  - Optional: add 「감사했습니다」 · 「감사했어요」 · 「고마웠습니다」 · 「고마웠어요」 to keys[1].alts (common past-tense thanks after the help is over)
  - Optional: consider adding 「도움이 많이 되었」 to keys[0].alts
  - 선택: keys[1].alts에 「감사했습니다」 · 「고마웠습니다」 · 「고마웠어요」 더함 (도움이 끝난 뒤의 흔한 과거형 감사를 확실한 통과로 세기 위해)
  - keys[0].alts에서 drama-judge-6의 부정 어긋남 차단을 무력화하고 반대 뜻 발화를 통과시키는 『아니었으면』, 『없었으면』 뺌
  - keys[0].alts에 『도움이 많이 되었』, 『이제 살았』, 『정말 살았』 더함(단독 『살았어요』는 『알았어요』와 자모 닮음이 0.8을 넘으므로 부사 결합형으로 추가)

## s1e01-t8 · 처음 보는 · pass

- 대사: 교수님, 과제를 어디에 내야 하는지 여쭤봐도 될까요?
- Claude(pass): Unseen line asking a professor where to submit an assignment. The two keys capture the essential information (object and submission place). The alts carry the same information at the same respect level. Endings are limited to polite and formal. Neither the judge test nor the blind test lines produced wrong notes or leniency. Optionally add 리포트/레포트 to the alts. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 1
- 아르곤(fix): 핵심 정보 구성과 최소 음절(7)은 적절하나, 처음 보는 대사에서 3~4급 학습자가 매우 흔히 쓰는 직접 의문형(「낼까요 · 내나요 · 냅니까 · 제출할까요 · 제출하나요 · 제출합니까」)과 「-(으)ㄹ지」 간접의문형이 keys[1].alts에 빠져 '혼자 해 봄'이 누락되고 variants 부재로 반말 끝맺음 감지 폭도 좁아 보강이 필요하다(fix). / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 판정(pass): No wrong notes and no leniency appear in the judge test or in either reviewer's test lines. A's pass is right. B's main claim does not hold. B says direct-question forms such as 「낼까요」 are missing from the alts, but B's own test line 「교수님, 과제는 어디에 낼까요?」 is already a sure pass. Jamo similarity catches it through 「어디에 내」. 「냅니까」 and 「제출합니까」 should also clear 0.8 against the existing alts (「어디에 내야」, 「어디에 제출하면」), and 「낼지」 and 「제출할지」 should match the same way. So there is no missing coverage serious enough to block. Casual forms to a professor (「…내야 해?」, 「…돼?」) get no note but are left unsure, so they never become a sure pass. The criteria accept this. Adding variants such as 「…해요?」 would widen casual-ending detection, but that is an optional refinement. Wrong-information lines, such as asking about the deadline (언제까지) or the office location, lose 「어디에 내야」 and stay unsure, so they are not counted as 혼자 해 봄 (correct). The keys catch the two essentials: the object (과제) and the submission place. The accepted endings are polite and formal only. minSyllables 7 filters one-phrase answers without blocking a correct short question (「과제 어디에 내요?」). The model line is natural for a TOPIK II level 3–4 learner. It applies the skill of scene lines 4 and 7 (ko.speaking.ask) to a different person (a professor) and different information (where to submit).
- 고칠 점:
  - Optional: add 「리포트」 and 「레포트」 to keys[0].alts (common learner words for 과제; otherwise they fall into unsure).
  - Optional: add 「교수님, 과제는 어디에 내야 해요?」 and 「교수님, 과제는 어디에 내면 돼요?」 to variants. This makes casual endings with only 「요」 dropped (「…내야 해?」, 「…내면 돼?」) confidently detected, so they get an ending note.
  - Optional: add 「어디에 낼지」 and 「어디에 제출할지」 to keys[1].alts for safety (they likely match already through jamo similarity).
  - Optional: add 「리포트」 and 「레포트」 to keys[0].alts (common words learners use for 과제; otherwise they fall into unsure).
  - keys[1].alts에 『어디에 낼지』 · 『어디에 제출할지』 · 『어디에 낼까요』 · 『어디에 제출할까요』 · 『어디에 내나요』 · 『어디에 제출하나요』 · 『어디에 냅니까』 · 『어디에 제출합니까』 더함
  - variants에 『교수님, 과제는 어디에 내야 해요?』 · 『교수님, 과제는 어디에 내면 돼요?』 · 『교수님, 과제는 어디에 제출하면 될까요?』 · 『교수님, 과제는 어디에 내요?』 더함

## s1e01-t9 · 처음 보는 · fix

- 대사: 선배님, 혹시 편의점이 어디에 있는지 아세요?
- Claude(pass): This unseen line moves the s1e01-7 where-question to a convenience store and a different senior. The keys (place + where-question), the polite endings, and minSyllables 6 all fit. Blind tests showed no false notes and no leniency. Adding ASR contraction alts and narrowing the 「편의점 있어요」 alts are optional polish. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 아르곤(fix): keys[1].alts에 「편의점 있어요 · 편의점 있나요」가 들어 있어 「편의점」(8자모) 중복 점수 때문에 「지금 편의점 열어요?」 · 「편의점 멀어요?」 · 「저 편의점에 있어요」 같은 엉뚱한 발화까지 자모 닮음 0.8 이상으로 확실한 통과(너그러움)가 되므로 장소어를 포함한 표현으로 고쳐야 한다(fix). / 시험 말 8 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0 / 너그러움 「선배님, 혹시 지금 편의점 열어요?」 → 통과 · 확실
- 판정(fix): This is an unseen line, so a wrong answer counted as a sure pass blocks it. Reviewer B's probe 「선배님, 혹시 지금 편의점 열어요?」 asks whether the store is open, not where it is. That is a genuinely wrong answer, yet it got a sure pass. The cause is that keys[1].alts contains 「편의점 있어요 · 편의점 있나요」. These repeat the place word that keys[0] already holds, so with jamo matching, sentences that never ask for the location (열어요 · 멀어요 · 갔어요 · 「저 편의점에 있어요」) still score 0.8 or more and fill the where-question key. Reviewer A also flagged this risk (a statement like 「저기 편의점 있어요」 getting a sure pass) but left it as optional. On an unseen line it is leniency, so it has to be fixed. Wrong-place answers like 도서관 · 식당 stay unsure, which is acceptable under the rules. The rest of the spec fits: the polite · formal endings for a senior met today, the two keys (place + where-question), minSyllables 6, the skill link to s1e01-7, and the level. Neither reviewer's probes produced a false note.
- 막은 시험 말: 아르곤 「선배님, 혹시 지금 편의점 열어요?」(노트 줄 말 · missing) → 통과 · 확실
- 고칠 점:
  - keys[1].alts에서 『편의점 있어요』 · 『편의점 있나요』 뺌
  - keys[1].alts에 『근처에 편의점 있어요』 · 『근처에 편의점 있나요』 · 『근처에 있어요』 · 『근처에 있나요』 · 『근처에 있는지』 더함 (variant 「선배님, 이 근처에 편의점 있어요?」가 계속 확실한 통과인지 다시 판정 시험)
  - 고친 뒤 「선배님, 혹시 지금 편의점 열어요?」 · 「선배님, 편의점 멀어요?」 · 「저 편의점에 있어요」가 확실한 통과로 세어지지 않는지 다시 판정 시험 (특히 alts 『어디 있어요』가 「편의점에 있어요」와 0.8 이상 닮지 않는지 확인)
  - 선택: keys[1].alts에 『어딨어요』 · 『어딨는지』 더함 (받아 적기 줄임꼴 대비)
  - 선택: keys[1].alts의 『편의점 있어요』 · 『편의점 있나요』는 평서 「저기 편의점 있어요」도 확실한 통과로 받으므로, 『근처에 편의점』 같은 묻는 꼴 쪽으로 좁히는 것을 검토
  - keys[1].alts에 『근처에 편의점 있어요』 · 『근처에 편의점 있나요』 · 『근처에 있는지』 · 『근처에 있어요』 · 『근처에 있나요』 더함
