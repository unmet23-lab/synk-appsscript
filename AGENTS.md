# SYNK — 저장소 안내

한국어로 대화한다. GPT와 Claude는 이 문서를 공동 입구로 쓰며 `CLAUDE.md`는 `@AGENTS.md`만 가져온다.

작업 시작·재개 때 [AI 운영 원칙](docs/AI_운영원칙.md)을 읽는다. 역할·벤치마킹·이어받기·비용 기준은 그 문서 한 곳에서 관리하며, 이번 요청에 필요한 원문만 [문서 지도](docs/문서_지도.md)에서 찾는다.

## 파일별 확인

- Apps Script 배포 대상은 `Code.js`·`엔진_synkbrief.js`다. 전역 이름공간을 공유하므로 함수·전역 충돌을 확인한다. 익명 웹앱의 `doGet`은 HtmlService를 반환하지 않는다. `엔진_콘텐츠AI.js`는 Strata의 저장소 원천이다.
- Apps Script 라이브 배포를 요청받았을 때만 `deploy`를 쓴다. `clasp pull`로 작업본을 덮어쓰지 않는다. 관련 시험은 `node --test tests/<파일>`로 실행한다.
- Atlas 작업은 [8개 담당 엔진의 원문·코드](docs/엔진8종_상향설계_v3.md#engine-owner-sources)에서 시작한다. [Atlas 정의](docs/아틀라스_설계.md#atlas-engine-ownership)를 따르며 별도 LLM 하네스·선택기를 만들지 않는다.
- AI 영상·이미지(얼굴·장면·톤·전환)는 [만족 사례 장부](docs/마케팅/제작양식/만족사례_장부.md)에서 가장 가까운 사례의 방법으로 시작하고, 유호님이 분명하게 만족을 말한 순간만 그 자리에서 장부에 올린다.
- 디자인·자산·생성기는 [DESIGN](DESIGN.md), SNS 제작은 [제작 방식](docs/마케팅/콘텐츠_제작방식_v2_20261002.md)과 [SNS 키트](docs/디자인/SNS키트/README.md)에서 찾는다. 자산 경로는 `tools/lib/마스코트자산.js`, 자립형 HTML 폰트는 `tools/lib/브랜드폰트.js`를 재사용한다. 발표물은 `_src_*.html`이 원고이고 `tools/발표물빌드.js`가 출력을 만든다.
- 유호님이 텔레그램으로 공유한 디자인 사이트·AI 팁은 [참고 카드](docs/참고카드/README.md)에 대상 화면·작업별 적용안으로 쌓인다. 그 화면·작업을 시작할 때 해당 대상의 카드를 먼저 보고, 「팁 장부 N행 적용해줘」는 그 카드의 적용 요청문대로 진행한다.
- 마스코트(까몽·몽글·마린)는 정본 그림을 화면·영상에 그대로 얹지 않는다. 앱 화면·광고·홍보 영상·온라인 콘텐츠 어디든 그 장면에 맞게 GPT 이미지 2.5(ChatGPT 구독 · Codex CLI)로 장면과 한 장으로 새로 굽고, `tools/lib/마스코트자산.js`의 정본은 생김새 참고로만 넣는다(2026-10-14 확정, [결정 표](docs/_ops/결정.md)).
- `docs/_ops/결정.md`에는 확정과 근거, `docs/_ops/트랙.md`에는 결과 위치·남은 일을 해당 항목에만 짧게 남긴다.
- 셸·git·시험·그림 굽기·오리기·Higgsfield·영상·배포 도구를 쓰기 전에 [현장 노트](docs/현장노트/README.md)에서 그 도구 파일을 먼저 보고, 새 함정과 막다른 길은 끝나거나 막힌 그 자리에서 같은 파일에 증상 → 원인 → 고침 → 다시 확인으로 남긴다.
- `index.lock`이 생기면 잠시 뒤 재시도한다. 10초 넘게 남으면 `node tools/git잠금.js`로 확인하고 `--정리`는 주인 없는 잠금에만 쓴다.

- 커밋 전 `npm run check:storage`, 푸시 전 `node tools/git-storage-check.cjs --base origin/master --head HEAD`로 새 Git 파일의 용량·산출물 범위를 확인한다. 별도 인덱스에서는 같은 `GIT_INDEX_FILE`과 기준 커밋을 쓴다. 원본 보존·복원은 [Git 자산 보관](docs/_ops/github-storage/README.md)을 따른다.

## Code Review Rules

실제 문제만 파일·줄·깨지는 동작·재현 근거와 함께 적는다. P0는 데이터·인증·라이브 손상, P1은 기능 오류, P2는 품질 문제, P3는 추가 확인이 필요한 의심이다. 읽지 못한 범위는 밝히고 지적을 만들지 않는다.
