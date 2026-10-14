# 사용 자산

모든 파일은 기존 승인 원본을 변형 없이 복사했다. 웹 외부 요청 없이 제공한다.

- `logo.svg`: `docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink-정밀.svg`
- `logo-felt.png`: 같은 브랜드킷 `배치용/SYNK-Ink.png` (09-10 무실땀 SYNK)
- `synk-ko.svg`: `C:/Users/q1212/Documents/SYNK-website/compose-sites.mjs`의 `.hangul-wordmark` 인라인 SVG. 2026-09-27 사용자 요청으로 메신저에 적용한 ‘싱ㅋ’ 워드마크. 원본 4개 path·viewBox 560×328·색 #090a09 유지. 이전 두 영문 로고 파일은 보존하되 새 화면은 이 파일을 쓴다.
- `SUIT-Variable.woff2`: `docs/브랜드_폰트/SUIT/` · 한글, 함께 둔 SUIT-OFL.txt
- `InterTight-Medium.ttf`, `InterTight-Bold.ttf`: `docs/브랜드_폰트/InterTight/` · 라틴, 함께 둔 InterTight-OFL.txt
- `DMMono-Medium.ttf`: `docs/브랜드_폰트/DM_Mono/` · 숫자/시스템 라벨, 함께 둔 DMMono-OFL.txt

비율과 원본 색을 유지한다. 읽는 면은 흰색으로 두고, 머리 면과 메뉴·조작부에 승인 펠트 재질과 브랜드 색을 쓴다. 디자인 참고와 적용 범위는 `../../DESIGN.md`에 기록한다.

## 2026-10-02 · 전체 워크스페이스의 펠트 브랜드 강화

아래 사진 자산은 `docs/마케팅/맞춤도구/assets/` 승인 파일을 바이트 변경 없이 복사했다. 원본과 복사본의 SHA-256을 대조했다.

- `thread-shift.webp`: 투명 청금석 실땀. 원본 복사본을 보존하며, 최종 화면의 작은 구분선에는 표시하지 않는다.
- `felt-paper.webp`: 흰 펠트 결. 메뉴·대화 머리·빈 대화의 작은 마스코트 받침·목차에 옅게 사용한다. 메시지와 긴 본문은 흰 바탕이다.
- `sticker-check.webp`, `sticker-time.webp`, `sticker-person.webp`, `sticker-search.webp`: 개인 도구·크루·검색의 승인 사진형 스티커.
- 기존 `sticker-book.webp`, `sticker-envelope.webp`: 같은 승인 자산 원본. 대화 목록·첨부 버튼에 재사용한다.
- 기존 `marin-smile.webp`: 승인 마린 표정 자산. 빈 대화에서 작은 그림으로 표시하며 얼굴·비율·알파·원본 색을 바꾸지 않는다.

루트 워크스페이스와 메신저가 함께 쓰는 다음 파일도 승인 원본을 변형하지 않고 복사했다.

- `felt-ui/slab-coral-long.webp`, `felt-ui/slab-blush-long.webp`, `felt-ui/slab-blush.webp`, `felt-ui/chip-blush-long.webp`, `felt-ui/badge-check.webp`, `felt-ui/badge-cream.webp`, `felt-ui/badge-coral.webp`, `felt-ui/tex-coral.webp`, `felt-ui/tex-blush.webp`: `docs/디자인/펠트부품/assets/ui/`의 같은 파일명. 누르는 주 행동·선택·배지와 국소 재질에 쓴다.
- `felt-ui/lapis-fabric.png`: `docs/캐릭터/펠트패치_0815/LapisDeep.png`.
- `laptop-felt.webp`, `sticker-adapt.webp`: `docs/마케팅/맞춤도구/assets/`의 같은 파일명.
- `signal-laptop.webp`: 플랫폼 런처 `desktop/assets/launcher/laptop.webp`(= `docs/디자인/SNS키트/assets/felt-laptop.webp`)와 같은 바이트. 워크스페이스 로그인 3판의 Workspace 포스터에 쓴다(2026-10-13).

최신 부품 규칙은 `docs/디자인/펠트부품/README.md`를 따른다. 작은 조작부는 실제 `felt-ui/` 판·칩·배지 사진을 쓰며, 오래 읽는 메시지와 입력 면은 흰 바탕으로 둔다. CSS 점선·납작한 테이프·흩어진 색점은 추가하지 않는다.

- 2026-10-02 작업실 AI 업무 연습: `felt-ui/slab-cream-long.webp`는 `docs/디자인/펠트부품/assets/ui/slab-cream-long.webp` 원본 복사본이다. 선택 전 업무 타일에 쓴다.

- 2026-10-14 SNS·마케팅 12판 포스터: `sns-felt-{overview,compose,calendar,queue,bulk,accounts,results,inbox,settings}.webp` 9장. 화면마다 그 일을 설명하는 펠트 물건(폰과 하트 · 연필과 메모 카드 · 탁상 달력 · 자명종 · 펼친 사진 카드 · 사원증 · 오르는 막대 · 하트와 답장 화살표 · 플러그와 콘센트)을 GPT 이미지 2.5(ChatGPT 구독 Codex CLI)로 흰 바탕 한 판에 굽고 `Documents/synk-vendor/sns-felt/custom_cut.py`로 오렸다(원판·지시문·스크립트는 같은 폴더). `company/public/social-workspace.js`의 포스터가 `/messenger/assets/sns-felt-<화면>.webp`로 읽는다. [설계](../../../../docs/디자인/워크스페이스_시그널/README.md#signal-v12-sns-20261013)
