# WORLD 마스코트 사진 굽기

WORLD 앱의 튜터·친구 그림은 정본 누끼를 얹지 않고, 화면(자리)마다 그 장면과 한 장으로 구운 사진을 쓴다(10-14 유호님 「무조건 정본 쓰지 말고 필요할 때마다 GPT 2.5로 상황에 맞게」). 이 폴더는 그 사진을 굽고 나누고 앱에 넣는 도구의 원본이다.

## 흐름

1. `make_refs.py` — 정본 4K에서 친구마다 본체 사진·표정표를 만든다(`ref/`). 생김새 참고로만 쓴다.
2. `make_prompts.py`(튜터 표정 판) · `make_scenes.py`(프로필·환영·카페·이야기·한글 무대) — 지시문 `p_*.txt`와 `jobs_*.json`을 쓴다. 쓴 지시문은 `prompts/`에 옮겨 두었다.
3. `run_jobs.py jobs_tutor.json [이름 앞부분] --par=3` — `bake.py`가 ChatGPT 구독 Codex CLI(GPT 이미지 2.5)로 판을 굽고 `split.py`가 칸을 나눈다. 표정 판은 첫 칸과 다른 칸의 정렬을 맞추고 얼굴 둘레만 바꿔 몸·배경을 같은 화소로 둔다(`cut/<판>/_check.jpg`에 바뀐 자리 표시).
4. `install.py <작업본 루트>` — 나눈 사진을 WebP로 줄여 `experiences/brand-opening/assets/tutor-photos/`에 넣고 `tutor-photos-data.mjs`를 다시 쓴다. 앱은 `tutor-photos.mjs`로 고른다.

스크립트는 자기 폴더에 `boards/ cut/ log/ ref/`를 만든다. 저장소 밖 작업 폴더(10-14은 `C:/Users/q1212/Documents/synk-vendor/world-mascots-20261014/`)에 복사해 돌린다.

## 자리

| 자리 | 판 | 쓰는 곳 |
|---|---|---|
| onb | 친구마다 3×2 표정 | 튜터 고르기 큰 사진 카드 |
| home · life | 3×2 | 우리 방 말풍선 · 배우기 튜터 |
| runner · rhythm · hangul · first | 3×2 | 놀이 위 튜터 띠 · 조작 연습 · 다시 풀기 |
| profile | 2×2 | 왼쪽 위 계정 캡슐 · 내 계정 · 튜터 고르기 탭 |
| welcome | 한 장 | 계정 만들기 전 환영 |
| cafe_counter · cafe_window · cafe_garden | 한 장(3:2) | 카페 장면(세 친구 + 빈 카운터에 쟁반) |
| story_* | 2×2(해설·몽글·까몽·마린 차례) | 이야기 읽기 무대 |
| teach_mongle | 2×1 | 한글 무대 「몽글에게 가르쳐 주기」 |

## 10-14 상태

- 구움: 튜터 표정 판 21장(7자리 × 3), profile, welcome, cafe_counter.
- 못 구움(구독 주간 한도, 10-21 15:40 풀림): cafe_window, cafe_garden, story_ 6편, teach_mongle. 그 자리는 굽는 대로 바뀌게 되어 있고, 그 전까지는 이전 그림을 쓴다(카페 자리 `hasCafePhoto`, 이야기 `hasStoryPhoto`, 한글 무대는 코드 그대로).
- 한도 뒤: `python run_jobs.py jobs_scene.json cafe_ --par=3`, `story_`, `teach_` → `python install.py <작업본>` → 한글 무대 `app.mjs`의 가르치기 그림을 `assets/brand/teach-curious.webp`·`teach-smile.webp`로 바꾸고 `style.css` `.teach .mongle`을 사진 카드로.
