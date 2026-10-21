# 새 원단 의상 6종 서버 연결

서버 catalog에 몸 4종·목 2종을 더해 전체 14종, 무료 첫 컬렉션 13종으로 연결했다. 첫 산책 목도리의 참여 보상 조건은 그대로다.

| ID | 부위 | 이름 |
|---|---|---|
| mongle-linen-overshirt | body | 오트밀 린넨 셔츠 |
| mongle-corduroy-overall | body | 밤색 코듀로이 멜빵 |
| mongle-quilted-vest | body | 청금석 퀼팅 베스트 |
| mongle-velvet-capelet | body | 장밋빛 벨벳 케이프 |
| mongle-silk-neckerchief | neck | 살구빛 실크 타이 |
| mongle-wool-muffler | neck | 메도우 울 머플러 |

새 계정은 기존 계약처럼 `source:starter`, `acquiredAt:null`로 무료 옷을 받는다. 기존 계정의 다음 bootstrap은 없는 무료 옷만 기존 account transaction 안에서 한 번 추가하며, 추가된 옷의 획득시각은 서버 ISO 시각이다. 새 SQL/grant endpoint는 만들지 않았다. 처음 배포한 C18·도메인·서버·DB store·로컬 adapter 원문은 바꾸지 않았으며, catalog를 포함하는 Edge runtime만 로컬 재생성·검사했다.

[Node 20개](backend-node-result.json)는 신규 4개·기존 룩북 8개·염색 8개를 통과했다. 실제 JSONB의 초기 7개 컬렉션 상태를 합성해 신규 6개만 한 번 추가됨, 원래 차림·염색·룩북·기존 inventory 획득시각·active play·receipt 보존을 대조했다. 새 의상 미소유 상태의 거부는 canonical domain으로, 참여 목도리의 미획득 거부·다른 부위/잘못된 색·revision 충돌은 실제 service로 확인했다.

[실제 HTTP 18조건](backend-http-result.json)은 전용 새 임시 DB와 합성 A/B 계정에서 통과했다. 모든 새 ID의 body/neck 두 색 왕복, 6개 코디 저장, 복제·이름·순서·로그인 복원, 룩북 응답 유실 후 byte 동일 재시도와 한 revision, 저장 코디 바로 착용, 계정별 룩/색 분리, 잘못된 입력·미획득 보상·409, 기존 bare slots의 같은 ID 색 보존/바뀐 ID 초기화를 확인했다. 카탈로그 포함 7개 backend source는 시작·끝 SHA가 같으며, C18 파일은 이전 22개 완료 검사 archive와 byte 동일하다. 자체 PID44872·53971 포트를 해제하고 합성 임시 DB를 정리했다.

최초 [검사 설정 오류](backend-http-attempt1-result.json)는 migration ledger checksum과 실제 파일 SHA를 혼동한 마지막 조건만 실패했으며 그 전 HTTP 17조건은 통과했다. [DB 준비 상한 실패](backend-http-attempt2-result.json)는 15초 상한에서 기능 검사 전에 끝났고, 실제 stdout 준비 조건을 유지한 채 상한을 60초로 조정한 최종 실행이 정상 종료했다. 두 기록을 제품 기능 실패나 최종 성공 조건으로 합산하지 않는다.

이 기록은 저장·소유권·grant 계약을 검증한다. 그래픽·서로 다른 실제 재질 표현은 root와 렌더 담당자의 별도 자료를 따른다. 기존 2026-10-09의 22개 증거는 덮지 않았다. 기존 4296 요청/계정 쓰기·원격 DB·공개 배포·유료 API는 0이며, 기존 서비스의 같은 db-v1 재시작은 root가 따로 맡는다.

재현: SYNK-talk에서 `node --test tests/world-v1-materials.test.js tests/world-v1-wardrobe.test.js tests/world-v1-dyes.test.js`, `node tools/world-v1-materials-rehearsal.cjs`, `node tools/world-v1-build.js --check`.
