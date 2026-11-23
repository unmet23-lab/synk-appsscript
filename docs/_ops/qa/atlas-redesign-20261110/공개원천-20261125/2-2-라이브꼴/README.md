# WORLD 선택 공개 (2-2) — 라이브 꼴 원천

이 폴더의 여섯 파일은 (2-2) 생성물 명세의 되돌림 대본(`revert-2-2.cjs` ㄹ 단계)이 내보낸 사본에 덮는 원천 꼴 파일이다.

- 설계 주인 11-24 잣대: 모듈 파일은 「라이브 모듈 + ③」, 묶음에 실리는 입력은 「라이브 묶음 + ③」이다. 묶음 입력은 라이브 묶음에 지금 있는 줄을 빼지 않는다.
- 판정: 되돌림 앞 단계(ㄷ · ㄴ · ㄱ) 뒤의 원천 판과 라이브 모듈 판을 덩이마다 견줘, 원천 쪽 줄이 라이브 묶음(생활 묶음 11-20 판 · 계정 묶음 11-17 판)에 있으면 남기고 없으면 덮었다. 라이브 묶음은 직접 풀어 줄 단위로 봤고, 10-31에 손으로 얹은 `__atlas*` 이름의 막은 같은 줄로 셌다.
- 다섯 파일(play-unlocks · hangul-stage/learning · garage-core · world-learning-profile-core · world-missed-spot)은 라이브 synk-policy main(7412185 · world/는 44ae5f986과 같음)의 그 파일을 원천 꼴로 옮긴 것이다. 원천 쪽 줄이 두 라이브 묶음에 없다. play-unlocks는 두 라이브 묶음에 모듈째 없고, world-missed-spot은 주석만 다르다.
- world-learning-ui.mjs는 원천 판에서 라이브 생활 묶음에 없는 1f6d6bb42d 한글 진도 계정 읽기(readHangulProgress) 세 자리만 라이브 묶음 꼴로 덮은 판이다. 막(목표 저장 뒤 처리 · 내 위치 열기 · 연습 열기), TOPIK 53 practiceNeed, 말하기 선택 저장 실패 전달, exam: map.exam은 라이브 생활 묶음에 있어 남는다.
- cafe-activity.mjs · life-story.mjs는 덮지 않는다. eca1f95a75의 주문 응답 글(「두 잔 더」) · 「내 말로 주문하기」 이어 하기 · 표현 도움 role=button이 라이브 생활 묶음에 있다.
- 옮기는 법(다섯 파일): git merge-file(원천 판, 공개 빌드 결과, 라이브 판) — 공개 빌드가 바꾸는 import 경로는 원천 꼴로 남고 내용 줄만 라이브를 따른다. 겹침 0.
- 확인: 이 파일로 덮은 사본의 공개 빌드 결과에서, 라이브 사본이 있는 묶음 입력 가운데 셋(cafe-activity · life-story · world-learning-ui)을 뺀 마흔여섯이 라이브(③ 파일은 ③ 후보)와 바이트가 같다. 셋은 라이브 묶음에 있는 줄만큼 다르다.
