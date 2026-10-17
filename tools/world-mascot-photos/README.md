# WORLD 마스코트 사진 굽기

WORLD 앱의 튜터·친구 그림은 정본 누끼를 얹지 않고, 화면(자리)마다 그 장면과 한 장으로 구운 사진을 쓴다(10-14 유호님 「무조건 정본 쓰지 말고 필요할 때마다 GPT 2.5로 상황에 맞게」). 이 폴더는 그 사진을 굽고 나누고 앱에 넣는 도구의 원본이다.

## 흐름

1. `make_refs.py` — 정본 4K에서 친구마다 본체 사진·표정표를 만든다(`ref/`). 생김새 참고로만 쓴다.
2. `make_prompts.py`(튜터 표정 판) · `make_scenes.py`(프로필·환영·카페·이야기·한글 무대) — 지시문 `p_*.txt`와 `jobs_*.json`을 쓴다. 쓴 지시문은 `prompts/`에 옮겨 두었다.
3. `run_jobs.py jobs_tutor.json [이름 앞부분] --par=3` — `bake.py`가 ChatGPT 구독 Codex CLI(GPT 이미지 2.5)로 판을 굽고(10-17부터 `tools/codex계정.js`를 거쳐 굽기용 보조 계정으로 부르고, 한도에 막히면 다음 보조 계정으로 바꾼다) `split.py`가 칸을 나눈다. 표정 판은 첫 칸과 다른 칸의 정렬을 맞추고 얼굴 둘레만 바꿔 몸·배경을 같은 화소로 둔다(`cut/<판>/_check.jpg`에 바뀐 자리 표시).
4. `install.py <작업본 루트>` — 나눈 사진을 WebP로 줄여 `experiences/brand-opening/assets/tutor-photos/`에 넣고 `tutor-photos-data.mjs`를 다시 쓴다. 앱은 `tutor-photos.mjs`로 고른다.

스크립트는 자기 폴더에 `boards/ cut/ log/ ref/`를 만든다. 저장소 밖 작업 폴더(10-14은 `C:/Users/q1212/Documents/synk-vendor/world-mascots-20261014/`)에 복사해 돌린다.

## 자리

| 자리 | 판 | 쓰는 곳 |
|---|---|---|
| onb | 친구마다 3×2 표정(복숭아색 무지 배경지, 첫 화면 #F8C6B3) | 튜터 고르기 큰 사진 카드 |
| home · life | 3×2 | 우리 방 말풍선 · 배우기 튜터 |
| runner · rhythm · hangul · first | 3×2 | 놀이 위 튜터 띠 · 조작 연습 · 다시 풀기 |
| profile | 2×2 | 왼쪽 위 계정 캡슐 · 내 계정 · 튜터 고르기 탭 |
| welcome | 한 장 | 계정 만들기 전 환영 |
| cafe_counter · cafe_window · cafe_garden | 한 장(3:2) | 카페 장면(세 친구 + 빈 카운터에 쟁반) |
| story_* | 2×2(해설·몽글·까몽·마린 차례) | 이야기 읽기 무대 |
| teach_mongle | 2×1 | 한글 무대 「몽글에게 가르쳐 주기」 |

## 10-14 제작 기록

아래는 당시 실제 제작 경로를 보존한 기록이다. 새 생성과 계정 선택은 [현재 비용·이미지 기준](../../docs/AI_운영원칙.md#비용과-권한)과 위 흐름을 따른다. 10-17에 승인된 굽기용 GPT 보조 계정 전환과 과거 Higgsfield 과금 사용은 서로 다른 범위다. 당시 제작 이력을 새 유료 경로의 자동 사용 허가로 확대하지 않는다. 사용자 지정값은 GPT Image 2.5 Sunburst · max이며 도구가 그 설정을 제공하는지도 구분한다.

- 구움: 튜터 표정 판 21장(7자리 × 3), profile, welcome, cafe_counter·window·garden, story_ 6편, teach_mongle — 전부.
- 10-14 오후 구독 주간 한도에 막혔던 9장(카페 창가·정원, 이야기 6편, 한글 무대 가르치기)은 GPT 계정을 바꾼 뒤 같은 날 구웠다.
- 튜터 고르기(onb)는 유호님 「튜터 고르기 배경은 복숭아색 배경지로 다시 구워줘」로 `make_onb_peach.py` 지시문(`prompts/p_onbpeach_*.txt`)을 힉스필드 GPT Image 2.5(3:2 · 2k · high, 판당 2.75크레딧)로 다시 구웠다(그때 구독 한도). 참고 그림은 `ref/본체_*`·`ref/표정표_*`를 올려 image_references로.
- 몽글 계정 사진은 3D 방과 같은 구슬 눈 칸(profile 판의 `mongle-기본`)을 쓴다(유호님 「계정 사진 몽글은 구슬 눈으로」).
- 까몽 표정 판은 어두운 털 위 가는 자수 눈이라 차이 검출이 한쪽 눈만 잡는다 → `split.py … --face=0.47,0.34,0.15,0.08`로 얼굴 타원을 늘 바꾼다. 옛 판(방 구석 배경)의 life·rhythm·hangul·first 까몽 `놀람`과 life 몽글 `놀람`은 기본과 같은 화소로 나왔다(바람길 장애물 반응에만 쓰여 그대로 둠).
- 이야기 판은 말하는 친구가 고개·팔까지 움직여 얼굴만 합치면 섞이므로 `--free`(칸 그대로)로 나눈다.
