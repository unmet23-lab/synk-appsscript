# 검수 묶음 drama-ep01-r10

- 대사 17(장면 9 · 처음 보는 8) · 기준 drama-spec-r4 378ef281da59fdfa
- 판정: 통과 16 · 고침 0 · 뺌 0 · 엇갈림(판정 전) 1 · 미완 0
- Claude 일괄 추정 $1.6729 + 판정 $0.1613 = $1.8342 → 1,000문항 어림 $107.89
- 토큰 합계: 입력 309748 · 캐시 쓰기 0 · 캐시 읽기 0 · 출력 105340
- 아르곤 호출 5회 · 47분(구독, 추가 비용 없음)

| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |
|---|---|---|---|---|---|
| u001 | s1e01-1 | pass | pass | pass | This is a scene line where the student greets the professor and introduces themselves as a new international student. The listener fit, keys |
| u002 | s1e01-2 | pass | pass | pass | 교수에게 한국 생활 형편을 말하는 장면 대사다. 받는 끝맺음 · 핵심 말 · 허용 표현 · 최소 음절이 모두 맞다. 판정 시험과 블라인드 시험 말에서 오노트가 없다. 대본 낱말을 alts로 바꾼 말이 지나가는 것은 장면 대사라 막지 않는다. 통과다.  |
| u003 | s1e01-3 | pass | pass | pass | The spec for a student telling the professor why they came fits well: the endings are limited to polite/formal, the keys are 과제 and 여쭤볼 게 있어 |
| u004 | s1e01-4 | pass | pass | pass | The professor-directed polite and formal endings are right. The keys (제출 기한 · 언제까지인지) hold the essential information and target expression,  |
| u005 | s1e01-5 | pass | pass | pass | 교수에게 마감 안내를 받고 대화를 맺는 장면 대사다. 받는 끝맺음(polite·formal), 핵심 말 두 개(알겠습니다·감사합니다)와 높임말 alts, 최소 7음절이 모두 맞다. 판정 시험과 블라인드 시험 말에서 오노트는 없다. 핵심 말 하나를 빼거 |
| u006 | s1e01-6 | pass | pass | pass | 선배에게 길을 잃은 경험과 까닭을 말하는 장면 대사다. 높임 · 핵심 말 · 허용 표현 · 최소 음절이 모두 알맞다. 판정 시험과 블라인드 시험 말에 오노트가 없다. 노트를 못 준 것(까닭을 뺀 말이 확신 없는 통과로 남음, 앞 문장만 반말인 말)은  |
| u007 | s1e01-7 | pass | pass | pass | The keys (도서관 + asking the location) and the polite-level alts are accurate. No false notes appeared for correct utterances in script words, |
| u008 | s1e01-8 | pass | pass | pass | Accepting polite and formal endings for a senior is correct. The keys 「덕분에」 and 「살았어요」 capture the thanks and relief, and minSyllables 7 let |
| u009 | s1e01-9 | pass | pass | pass | A short promise line to a senior. The spec's key, alts, ending and minimum syllables all fit the line's purpose. The judge test and blind te |
| u010 | s1e01-t1 | pass | pass | fix | 조교(staff)에게 polite · formal만 받는 것은 맞고, 핵심 말 두 개(수강 신청 · 찾아온 까닭)도 용건 말하기의 필요한 정보를 잘 잡는다. 판정 시험과 두 검수자의 맞는 시험 말에서 오노트는 없다. B가 너그러움으로 든 「수강 신청  |
| u011 | s1e01-t2 | pass | pass | pass | 도서관 직원에게 반납 기한을 묻는 처음 보는 대사로, 명세가 잘 맞는다. 직원에게 해요체·합쇼체만 받고, 핵심 말 두 개(반납·때를 묻기)가 모두 들려야 확실한 통과라서 다른 요청은 확신 없음으로 빠진다. minSyllables 6은 한두 낱말 대답만 |
| u012 | s1e01-t3 | pass | pass | pass | 사감에게 처음의 어려움과 지금의 적응을 말하는 처음 보는 대사다. 끝맺음(polite·formal), 두 핵심 말, 최소 9음절 모두 맞고, 판정_시험과 블라인드 시험 말에서 오노트·너그러움이 없다. 흔한 대답 「괜찮아요」와 「불편했지만/불편했는데」를 |
| u013 | s1e01-t4 | pass | pass | pass | Unseen line asking staff where the copy room is. The accepted endings (polite · formal) and the keys (복사실 + location question) are right, an |
| u014 | s1e01-t5 | pass | pass | pass | 여럿 앞 자기소개를 보는 처음 보는 대사다. 받는 끝맺음(polite·formal), 두 핵심 말, 최소 음절 9가 모두 맞다. 판정 시험과 블라인드 시험 말에서 오노트도 너그러움도 없어 pass로 둔다. 앞 문장만 반말인 섞인 말은 판정의 한계로 적 |
| u015 | s1e01-t6 | split | fix | pass | 핵심 말·허용 표현·끝맺음은 낯선 어른에게 길을 묻는 과제에 잘 맞고, 너그러움도 없다. 다만 minSyllables 7 때문에 맞는 짧은 질문 「정문 어디예요?」(6음절)가 길이 노트로 incorrect가 되어 fix다. minSyllables를 6 |
| u016 | s1e01-t7 | pass | pass | pass | 조교에게 고마움을 전하는 처음 보는 대사다. 받는 끝맺음(polite·formal), 두 칸 핵심 말(도움 알아주기 + 감사), minSyllables 6이 모두 맞고, 판정 시험과 시험 말에서 오노트와 너그러움이 없다. 흔한 「알려 주셔서」, 「설명 |
| u017 | s1e01-t8 | pass | pass | pass | 교수에게 과제 낼 곳을 묻는 처음 보는 대사다. 명세가 높임(polite · formal) · 핵심 정보(과제 · 어디) · 길이(7)를 알맞게 잡았다. 판정_시험과 블라인드 시험 말에서 오노트도 너그러움도 없어 pass로 둔다. 다음은 막지 않는 다 |

## s1e01-1 · 장면 · pass

- 대사: 안녕하세요, 교수님. 이번 학기에 새로 온 유학생이에요.
- Claude(pass): This is a scene line where the student greets the professor and introduces themselves as a new international student. The listener fit, keys, alts, and length are all appropriate, and neither the judge test nor the blind test utterances produce a wrong note. The 「학생」 alt can let 「교환학생」 through, and the 「-이야」 반말 is not caught, but both are only missed notes on a scene line or judge-rule limitations. Verdict: pass. / 시험 말 9 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 아르곤(pass): 지도교수 첫인사·자기소개 장면 대사로 핵심 말·허용 표현·최소 음절·높임 설정이 모두 적절하여 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 고칠 점:
  - 선택: keys[1].alts에서 「새로 온 학생」의 「학생」이 「교환학생」 속 「학생」과도 맞아 다른 사실이 확실한 통과로 지나갈 수 있다 — 장면 대사라 막지 않지만, 같은 alt를 처음 보는 대사로 옮길 때는 빼거나 「새로 온 외국 학생」 같은 꼴로 좁힐 것.
  - 선택: 「…유학생이야」(이에요→이야) 같은 반말에 끝맺음 노트가 나지 않는 것은 판정 규칙(「요」만 뺀 꼴만 확신) 한계로 기록 — 명세로 고칠 칸 없음.

## s1e01-2 · 장면 · pass

- 대사: 아직 낯설지만 조금씩 익숙해지고 있어요.
- Claude(pass): 교수에게 한국 생활 형편을 말하는 장면 대사다. 받는 끝맺음 · 핵심 말 · 허용 표현 · 최소 음절이 모두 맞다. 판정 시험과 블라인드 시험 말에서 오노트가 없다. 대본 낱말을 alts로 바꾼 말이 지나가는 것은 장면 대사라 막지 않는다. 통과다. / 시험 말 9 — 오노트 0 · 너그러움 2 · 확신 아님 0 · 노트 없음 0 · 다른 노트 0
- 아르곤(pass): 한국 생활 적응 형편과 변화를 말하는 장면 대사로 핵심 말과 허용 표현 범위, 최소 음절이 잘 잡혀 있어 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 0 · 다른 노트 0
- 고칠 점:
  - 선택: keys[1].alts에 「적응하는 중이에요」 더함

## s1e01-3 · 장면 · pass

- 대사: 과제에 대해 여쭤볼 게 있어서 왔어요.
- Claude(pass): The spec for a student telling the professor why they came fits well: the endings are limited to polite/formal, the keys are 과제 and 여쭤볼 게 있어서, the alts are reasonable, and minSyllables is 8. Neither the judge test nor the blind test produced a false note. Lines that slip through without a note (plain-word alts, 숙제 substitution) do not block a scene line. Pass, with two optional refinements. / 시험 말 9 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 방문 용건을 공손하게 말하는 장면 대사로 높임·핵심 말·허용 표현·길이가 모두 적절하여 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 고칠 점:
  - 선택: rename the -(으)ㄹ 게 있다 tag id from 「ko.speaking.grammar.have-to-do」 to something like 「ko.speaking.grammar.thing-to-do」, to avoid confusion with obligation
  - 선택: add 「여쭤볼 일이 있어서」 and 「여쭤보고 싶은 것이 있어서」 to keys[1].alts

## s1e01-4 · 장면 · pass

- 대사: 제출 기한이 언제까지인지 궁금해서요.
- Claude(pass): The professor-directed polite and formal endings are right. The keys (제출 기한 · 언제까지인지) hold the essential information and target expression, and the alts are synonyms at the right politeness level. Neither the judge test nor the blind test lines produced a false note. Bare 반말 such as 「궁금해」 or 「언제까지야」 passes uncertain with no note, but scene lines are not assessed, so this does not block. Pass, with optional touch-ups only. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 제출 기한을 공손하게 묻는 장면 대사로 핵심 말·허용 변형·최소 음절 6 설정이 모두 적절하여 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 고칠 점:
  - Optional: add 「제출 기한이 언제까지인지 궁금해요.」 to variants. 「궁금해」 then becomes 「요」 removed from an accepted ending, so the judge can confidently give an ending note for 「…궁금해.」.
  - Optional: add 「제출일」 to keys[0].alts.
  - Optional: add 「언제까지」 to keys[1].alts, so short questions like 「언제까지죠?」 are a sure pass.
  - 선택: keys[1].alts에 『언제예요』, 『언제인가요』 더함

## s1e01-5 · 장면 · pass

- 대사: 네, 알겠습니다. 감사합니다, 교수님.
- Claude(pass): 교수에게 마감 안내를 받고 대화를 맺는 장면 대사다. 받는 끝맺음(polite·formal), 핵심 말 두 개(알겠습니다·감사합니다)와 높임말 alts, 최소 7음절이 모두 맞다. 판정 시험과 블라인드 시험 말에서 오노트는 없다. 핵심 말 하나를 빼거나 「죄송합니다」로 바꾼 말은 자모 닮음 때문에 확신 없는 통과가 되지만, 장면 대사라 막지 않는다. pass로 둔다. / 시험 말 9 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 아르곤(pass): 연구실 상담 마무리 감사 인사 장면 대사로 최소 음절과 높임·허용 표현이 잘 짜여 있어 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - 선택: keys[1].alts의 「고마워요」는 지도교수에게 다소 가벼우므로, 코치 노트 문구에서 「감사합니다」가 더 정중함을 짚어 주기를 생각해 본다(판정 막지 않음).

## s1e01-6 · 장면 · pass

- 대사: 네, 맞아요. 길을 잃어서 한참 헤맸어요.
- Claude(pass): 선배에게 길을 잃은 경험과 까닭을 말하는 장면 대사다. 높임 · 핵심 말 · 허용 표현 · 최소 음절이 모두 알맞다. 판정 시험과 블라인드 시험 말에 오노트가 없다. 노트를 못 준 것(까닭을 뺀 말이 확신 없는 통과로 남음, 앞 문장만 반말인 말)은 장면 대사라 막지 않는다. 그대로 통과이며, 「길을 잃고」를 더하는 것은 선택이다. / 시험 말 9 — 오노트 0 · 너그러움 2 · 확신 아님 0 · 노트 없음 0 · 다른 노트 0
- 아르곤(pass): 선배에게 길 잃고 헤맨 까닭을 설명하는 장면 대사로 핵심 말·높임·최소 음절이 모두 적절하여 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 고칠 점:
  - 선택: keys[0].alts에 「길을 잃고」 더함(「길을 잃고 한참 헤맸어요」도 흔한 말이다).
  - 선택: keys[0].alts에 『길 잃어서』(목적격 조사 생략 구어) 더함

## s1e01-7 · 장면 · pass

- 대사: 네, 선배님! 그런데 혹시 도서관이 어디에 있는지 아세요?
- Claude(pass): The keys (도서관 + asking the location) and the polite-level alts are accurate. No false notes appeared for correct utterances in script words, and place swaps and one-word answers get notes. The 「…알아?」 반말 attempt is not caught, but that is a judging-rule limitation and not blocking for a scene line. Pass, with one optional variant addition. / 시험 말 9 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 아르곤(pass): 선배에게 도서관 위치를 공손히 묻는 장면 대사로, 핵심 말·최소 음절·높임 설정이 모두 적절하고 오노트가 없어 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 고칠 점:
  - Optional: add 「선배님, 도서관이 어디에 있는지 알아요?」 to variants. This accepts the common 해요체 「알아요」 and makes the judge confident that 「…알아?」 is 반말, so a 반말 attempt toward a senior gets an ending note.
  - 선택: keys[1].alts에 『어디인지』(『어딘지』의 본말 표기) 더함

## s1e01-8 · 장면 · pass

- 대사: 정말요? 선배님 덕분에 살았어요.
- Claude(pass): Accepting polite and formal endings for a senior is correct. The keys 「덕분에」 and 「살았어요」 capture the thanks and relief, and minSyllables 7 lets the shortest correct answer through. Neither the judging tests nor the blind test utterances produced a wrong note, so the verdict is pass. Adding 「덕에」 and other short forms is optional polishing. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 0 · 다른 노트 0
- 아르곤(pass): 선배에게 「덕분에 살았어요」로 고마움을 전하는 장면 대사로, 핵심 말과 쉬운 대체 표현·최소 음절이 잘 잡혀 있어 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 0 · 다른 노트 0
- 고칠 점:
  - Optional: add 「덕에」 to keys[0].alts (a common short form of 「덕분에」; currently it only goes to the not-sure path).
  - Optional: consider adding 「고마워요」 or 「감사해요」 to keys[1].alts, or check whether 「도움이 됐어요」 sounds awkward combined with 「덕분에」 (does not block).
  - 선택: keys[1].alts에 합쇼체 짝인 『도움이 됐습니다』 더함

## s1e01-9 · 장면 · pass

- 대사: 네, 꼭 살게요!
- Claude(pass): A short promise line to a senior. The spec's key, alts, ending and minimum syllables all fit the line's purpose. The judge test and blind test utterances produced no false notes. 「갈게요」 being accepted is a limit of jamo similarity, not a spec fault. Pass, with one optional alt to add. / 시험 말 9 — 오노트 0 · 너그러움 2 · 확신 아님 0 · 노트 없음 0 · 다른 노트 0
- 아르곤(pass): 선배에게 커피를 사겠다고 약속하는 장면 마무리 대사로, 핵심 말·허용 표현·최소 음절이 모두 알맞고 오노트가 없어 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 1 · 다른 노트 0
- 고칠 점:
  - Optional: add 『낼게요』 to keys[0].alts (common phrasing for promising to pay for coffee; same meaning and politeness level)

## s1e01-t1 · 처음 보는 · pass

- 대사: 수강 신청에 대해 여쭤볼 게 있어서 왔어요.
- Claude(pass): 조교에게 수강 신청 용건을 말하는 처음 보는 대사로, 명세는 학습 근거로 쓸 만하다. 받는 끝맺음(polite · formal)과 핵심 말 두 개(무엇을 · 왜)가 알맞다. 판정 시험과 블라인드 시험 말에서 오노트도 너그러움도 없다. 「하고 싶어서」가 alts 「알고 싶어서」에 닮음으로 걸리는 것은 판정 규칙의 한계로 적는다. 흔한 「질문 있어요」 등을 alts에 더하는 것은 선택 다듬기다. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(fix): 학과 사무실에서 수강 신청 질문 용건을 말하는 과제로 상황·능력·수준이 잘 맞으나, keys[1].alts에 질문 뜻이 없는 '때문에 왔어요·일로 왔어요·문제로 왔어요·관련해서 왔어요'가 들어 있어 다른 용건('수강 신청 취소 때문에 왔어요')까지 확실한 통과가 되므로 이를 빼고 '질문하려고·질문드리러' 등 누락된 질문 표현을 더해야 한다. / 시험 말 9 — 오노트 0 · 너그러움 1 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0 / 너그러움 「수강 신청 취소 때문에 왔어요.」 → 통과 · 확실
- 판정(pass): 조교(staff)에게 polite · formal만 받는 것은 맞고, 핵심 말 두 개(수강 신청 · 찾아온 까닭)도 용건 말하기의 필요한 정보를 잘 잡는다. 판정 시험과 두 검수자의 맞는 시험 말에서 오노트는 없다. B가 너그러움으로 든 「수강 신청 취소 때문에 왔어요.」는 잘못 쓴 시험 말로 보고 뺀다. 이 과제의 능력은 ko.speaking.purpose(찾아온 까닭 말하기)이고, 이 말은 필요한 정보(수강 신청)를 담아 높임을 맞춰 용건을 밝힌다. 「취소」는 수강 신청 안의 더 구체적인 용건일 뿐 다른 사실로 바꾼 것이 아니어서, 교사가 빠진 말 노트를 줄 말이 아니다. 같은 까닭으로 「때문에 왔어요 · 일로 왔어요 · 문제로 왔어요 · 관련해서 왔어요」는 학과 사무실에서 용건을 밝히는 아주 흔하고 자연스러운 말이라 alts에서 빼면 오히려 맞는 말이 확신 없음으로 빠진다(A의 「수강 신청 때문에 왔습니다」가 확실한 통과인 것이 맞다). 「장학금…」 · 「여쭤볼 게 있어서 왔어요」(정보 빠짐)는 확신 없음으로 남아 너그러움이 아니다. B의 「수강 신청 좀 물어보려고.」도 확신 없음 통과라 기록되지 않아 괜찮다. 「수강 신청을 하고 싶어서 왔어요」가 「알고 싶어서」와 닮아 확실한 통과가 되는 것은 자모 닮음 규칙의 한계다. 게다가 이 말도 용건 말하기로는 통한다. 흔한 「질문 있어요」 · 「질문하려고」 등이 확신 없음으로 빠지는 것은 「혼자 해 봄」을 덜 셀 뿐이므로 선택 다듬기로 적는다.
- 막은 시험 말: 아르곤 「수강 신청 취소 때문에 왔어요.」(노트 줄 말 · missing) → 통과 · 확실
- 고칠 점:
  - 선택: keys[1].alts에 「질문 있어요」 · 「질문 있어서」 더함(조사 빠진 흔한 말)
  - 선택: keys[1].alts에 「질문하려고」 · 「질문하고 싶어서」 · 「질문드리러」 · 「질문드리려고」 · 「질문드릴 게 있어서」 · 「문의하려고」 더함
  - 선택: keys[1].alts에 「때문에요」 더함(「수강 신청 때문에요」 같은 짧은 용건 말을 확실한 통과로 세려면)
  - 선택: keys[1].alts에 「물어보려고요」 · 「여쭤보려고요」 · 「궁금해서요」 더해, 「요」만 뺀 반말 끝(「…물어보려고.」)도 끝맺음 노트로 확신하게 함
  - 선택: keys[1].alts에 「질문 있어요」 · 「질문이 있어요」 더함(조사 빠진 흔한 말이 확신 없음으로 빠짐)
  - 선택: keys[1].alts에 「문의하려고」 더함
  - keys[1].alts에서 질문·문의 뜻이 없는 『때문에 왔어요』 · 『때문에 왔습니다』 · 『때문에 왔는데요』 · 『일로 왔어요』 · 『일로 왔습니다』 · 『문제로 왔어요』 · 『관련해서 왔어요』 뺌
  - keys[1].alts에 『질문하려고』 · 『질문하고 싶어서』 · 『질문드리러』 · 『질문드리려고』 · 『질문드릴 게 있어서』 더함
  - 선택: keys[1].alts에 『여쭤보려고요』 · 『물어보려고요』 · 『궁금해서요』 · 『여쭤볼 게 있는데요』 · 『질문이 있는데요』를 더해 요 탈락 반말 끝맺음도 확신하게 다듬음

## s1e01-t2 · 처음 보는 · pass

- 대사: 이 책 반납 기한이 언제까지인지 궁금해서요.
- Claude(pass): 도서관 직원에게 반납 기한을 묻는 처음 보는 대사로, 명세가 잘 맞는다. 직원에게 해요체·합쇼체만 받고, 핵심 말 두 개(반납·때를 묻기)가 모두 들려야 확실한 통과라서 다른 요청은 확신 없음으로 빠진다. minSyllables 6은 한두 낱말 대답만 거른다. 판정 시험과 시험 말에서 오노트·너그러움이 없어 pass다. 「며칠 빌릴」·「대출 기간」을 alts에 더하는 것은 선택이다. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 아르곤(pass): 도서관 안내 데스크에서 책 반납 기한을 묻는 과제로, 장면 대사 s1e01-4와의 전이 구성이 자연스럽고 핵심 말·허용 표현·최소 음절이 모두 탄탄하여 오노트와 너그러움 없이 그대로 쓸 수 있다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 고칠 점:
  - 선택: keys[0].alts에 『며칠 빌릴』 더함(「이 책 며칠 빌릴 수 있어요?」가 확실한 통과가 되도록)
  - 선택: keys[0].alts에 『대출 기간』 더함(「이 책 대출 기간이 어떻게 돼요?」가 확실한 통과가 되도록)
  - 선택: keys[1].alts에 『날짜가 궁금』 더함 (『기한이 궁금』 · 『반납일이 궁금』 · 『날짜가 어떻게 되』와 짝 맞춤)
  - 선택: keys[0].alts에 『돌려주면』 · 『돌려드리면』 더함

## s1e01-t3 · 처음 보는 · pass

- 대사: 처음엔 힘들었지만 조금씩 익숙해지고 있어요.
- Claude(pass): 사감에게 처음의 어려움과 지금의 적응을 말하는 처음 보는 대사다. 끝맺음(polite·formal), 두 핵심 말, 최소 9음절 모두 맞고, 판정_시험과 블라인드 시험 말에서 오노트·너그러움이 없다. 흔한 대답 「괜찮아요」와 「불편했지만/불편했는데」를 alts에 더하면 혼자 해 봄을 더 잘 센다(선택). / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 기숙사 사감 선생님께 처음의 어려움과 적응해 가는 변화를 말하는 과제로, 과거 형편과 현재 호전 두 핵심 축·허용 표현·최소 음절이 모두 잘 설계되어 있고 drama-judge-5의 반말 끝맺음 판정과도 잘 맞물려 그대로 쓸 수 있다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - 선택: keys[1].alts에 「괜찮아요」 더함 (「지금은·이제·요즘은 괜찮아요」 같은 흔한 대답을 확실한 통과로 세려고)
  - 선택: keys[0].alts에 「불편했지만」 「불편했는데」 더함 (기숙사 생활에서 흔한 말)
  - 선택: keys[1].alts에 『좋아지고 있어요』 · 『편해지고 있어요』 더함
  - 선택: keys[0].alts에 『불편했지만』 · 『불편했는데』 더함

## s1e01-t4 · 처음 보는 · pass

- 대사: 선생님, 혹시 복사실이 어디에 있는지 아세요?
- Claude(pass): Unseen line asking staff where the copy room is. The accepted endings (polite · formal) and the keys (복사실 + location question) are right, and the alts are all expressions asking for a location. The judging test and the blind test lines show no false notes and no leniency. Optional only: add alts for 복사실 (복사하는 곳 · 복사기) and 어디 있나요. / 시험 말 10 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 아르곤(pass): 처음 본 교직원께 복사실 위치를 묻는 처음 보는 대사로, 핵심 말·최소 음절·반말 검출(drama-judge-5) 모두 빈틈없이 작동하여 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - 선택: 없음 → keys[0].alts에 『복사하는 곳』 · 『복사기』 더함 (흔한 바꿔 말하기를 확실한 통과로 셈)
  - 선택: keys[1].alts에 『어디에 있나요』 · 『어디 있나요』 더함 (아주 흔한 공손한 물음 끝)
  - 선택: keys[1].alts에 『어떻게 가는지』, 『어떻게 가면』, 『어딘가요』 더함

## s1e01-t5 · 처음 보는 · pass

- 대사: 이번 학기에 새로 온 유학생이에요. 잘 부탁드립니다.
- Claude(pass): 여럿 앞 자기소개를 보는 처음 보는 대사다. 받는 끝맺음(polite·formal), 두 핵심 말, 최소 음절 9가 모두 맞다. 판정 시험과 블라인드 시험 말에서 오노트도 너그러움도 없어 pass로 둔다. 앞 문장만 반말인 섞인 말은 판정의 한계로 적었다. 흔한 말(입학했어요 등)을 더하는 다듬기는 선택으로 남긴다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 오리엔테이션 여럿 앞 자기소개 대사로, 두 핵심 축과 최소 음절(9음절), 반말 끝맺음 검출이 모두 잘 맞물려 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 1 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - 선택: keys[0].alts에 「입학했」·「이번 학기에 온 유학생」 더함 — 흔한 맞는 소개를 확실한 통과로 더 셈
  - 선택: keys[0].alts의 줄기 「새로 왔」·「새로 들어왔」·「처음 왔」 옆에 「새로 왔어요」·「새로 들어왔어요」·「처음 왔어요」를 더함 — 「요」를 뺀 「왔어」·「들어왔어」가 반말로 확신돼, 앞 문장만 반말인 「새로 왔어. 잘 부탁해요.」를 잡을 수 있게(판정이 문장마다 끝을 볼 때)
  - 선택: keys[0].alts에 『새로 입학한 유학생』, 『입학한 유학생』, 『새로 온 외국인 유학생』 더함

## s1e01-t6 · 처음 보는 · split

- 대사: 길을 잃었어요. 새솔대 정문이 어디에 있는지 아세요?
- Claude(fix): 핵심 말·허용 표현·끝맺음은 낯선 어른에게 길을 묻는 과제에 잘 맞고, 너그러움도 없다. 다만 minSyllables 7 때문에 맞는 짧은 질문 「정문 어디예요?」(6음절)가 길이 노트로 incorrect가 되어 fix다. minSyllables를 6으로 낮추고, 흔한 「어디인가요」를 alts에 더하기를 권한다. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 아르곤(pass): 학교 앞 정류장에서 낯선 어른께 정문 길을 묻는 대사로, 가상 교명 STT 한계까지 고려해 핵심 말과 최소 음절(7음절)이 정교하게 설계되어 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - minSyllables 6 (맞는 짧은 질문 「정문 어디예요?」를 막지 않게)
  - keys[1].alts에 「어디인가요」 더함
  - 선택: keys[1].alts에 『위치』, 『어디로 가는지』, 『어딘가요』 더함

## s1e01-t7 · 처음 보는 · pass

- 대사: 선생님 덕분에 살았어요. 정말 감사합니다.
- Claude(pass): 조교에게 고마움을 전하는 처음 보는 대사다. 받는 끝맺음(polite·formal), 두 칸 핵심 말(도움 알아주기 + 감사), minSyllables 6이 모두 맞고, 판정 시험과 시험 말에서 오노트와 너그러움이 없다. 흔한 「알려 주셔서」, 「설명해 주셔서」를 alts에 더하면 혼자 해 봄을 더 세게 된다(선택). / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 아르곤(pass): 도와준 조교 선생님께 고마움을 전하는 대사로, 앞선 두 장면 대사를 자연스럽게 묶어 전이시켰으며 판정 명세도 촘촘해 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - 선택: keys[0].alts에 「알려 주셔서」, 「알려주셔서」, 「설명해 주셔서」, 「안내해 주셔서」, 「도와 주셔서」 더함 — 조교에게 흔한 감사 문형이 확신 없음으로 빠지지 않게
  - 선택: keys[1].alts에 「감사했습니다」, 「감사했어요」, 「고마웠습니다」 더함
  - 선택: keys[0].alts에 『큰일 날 뻔했』 더함

## s1e01-t8 · 처음 보는 · pass

- 대사: 교수님, 과제를 어디에 내야 하는지 여쭤봐도 될까요?
- Claude(pass): 교수에게 과제 낼 곳을 묻는 처음 보는 대사다. 명세가 높임(polite · formal) · 핵심 정보(과제 · 어디) · 길이(7)를 알맞게 잡았다. 판정_시험과 블라인드 시험 말에서 오노트도 너그러움도 없어 pass로 둔다. 다음은 막지 않는 다듬기로 선택 고침에 적었다. 「리포트/레포트」와 명사형 물음(「제출은 어디에」 · 「내는 곳」)을 alts에 더해 「혼자 해 봄」을 더 세게 하는 것. 「돼요/해요」 끝 alts를 더해 교수에게 한 다른 꼴의 반말에도 끝맺음 노트를 주게 하는 것. / 시험 말 9 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 3 · 다른 노트 0
- 아르곤(pass): 교수님께 과제 제출 장소를 공손히 묻는 대사로, 핵심 정보(과제 · 어디에 내야)와 최소 음절(7음절), 높임 설정이 모두 적절해 통과(pass)다. / 시험 말 8 — 오노트 0 · 너그러움 0 · 확신 아님 0 · 노트 없음 2 · 다른 노트 0
- 고칠 점:
  - 선택: keys[0].alts에 「리포트」 · 「레포트」 더함(한국 대학에서 흔한 말 — 지금은 확신 없음으로 빠짐)
  - 선택: keys[1].alts에 「어디에 제출」 · 「내는 곳」 더함(「과제 제출은 어디에 해요?」 · 「과제 내는 곳이 어디예요?」 같은 명사형 물음을 확실한 통과로 셈)
  - 선택: keys[1].alts에 「어디에 내야 돼요」 · 「어디에 내야 해요」 더함(끝 어절 「돼요 · 해요」에서 「요」를 뺀 「돼 · 해」를 반말로 확신해, 교수에게 「과제 어디에 내야 돼?」라고 한 말에 끝맺음 노트를 줄 수 있음)
  - 선택: keys[1].alts에 『제출 장소』, 『내는 곳』, 『제출하는 곳』 더함
