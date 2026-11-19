# 첫날 끝 · 맞춤 앞면 틀 — 앱과 주고받는 약속 (2026-11-19)

이 폴더는 WORLD 앱의 전체 화면 틀(같은 출처 iframe)에서 도는 첫날 끝 · 맞춤 앞면이다. 화면은 시안 10z6(뼈대 판, 사진 결)을 옮긴 것이고, 구현 계획은 [docs/WORLD_첫날끝_1차_구현계획_20261119.md](../../docs/WORLD_첫날끝_1차_구현계획_20261119.md)다. 앱 쪽 다리는 `experiences/synk-world-app/world-front-entry.mjs`다. 틀은 기록을 직접 읽거나 쓰지 않고, 아래 약속으로만 앱과 말한다.

## 1. 찾기와 시작

- 틀은 `window.parent.SYNKFrontHost`(같은 출처일 때만)를 쓴다. 틀 안인데 아직 없으면 1.5초까지 기다린다. 혼자 열린 판은 `dev-host.mjs`의 가짜 host로 돈다(주소 값은 시안 10z6과 같다 — `v · who · lines · hangul · lang · mom · after · goal · step · pc · dream`. 더한 값은 `consent=1` 동의 줄, `pos=none` 위치 지도 없음, `still=1` 움직임 줄이기).
- 틀이 뜨면 `host.ready(api)`를 한 번 부른다. host는 그 뒤 `api.show(state)`로 화면을 정한다.
- 그림 · 소리 · 글꼴: 자리 사진과 밤 · 아침 사진은 이 폴더 `assets/`에 있다. 방 소리 · 새벽 소리 · 엄마 쪽지는 `../seoul-arrival/assets/`, 글꼴은 `../brand-opening/assets/`의 같은 파일을 쓴다. 공개본에 두 형제 폴더가 같이 실려야 한다.

## 2. 틀이 내놓는 api

| 이름 | 하는 일 |
|---|---|
| `show(state)` | 아래 state로 화면을 그린다. view가 바뀌면 시안의 넘김(흐려졌다 떠오름)으로, 같은 view면 바로 다시 그린다 |
| `setLang(lang)` | 화면 언어를 바꿔 다시 그린다(`ko` · `en` · `mn`) |
| `setSound(on)` | 효과음 · 배경음을 켜고 끈다 |
| `wake()` | 소리 문맥을 깨운다(사용자가 누른 직후 host가 부른다) |

틀이 스스로 하는 넘김:

- `end`에서 「오늘은 여기까지」를 누르면 틀이 바로 불을 끄고(`off`) `host.bye()`를 부른다. 그 뒤 host가 `view:'off'`를 보내도 다시 그리지 않는다.
- `more`에서 `after:false`였다가 `after:true`인 state가 오면 문 두 짝 넘김 사이에 다음 화면을 그린다(첫 연습을 마치고 돌아옴). 문에는 마지막으로 시작한 할 일의 사진이 뜬다.
- 둘째 날 아침 → 한글 질문 → 목표 질문, 목표의 「바꾸기」 · 「그대로 둘게요」, 한글 「나중에 할게요」는 틀 안에서만 넘긴다. host에는 답 · 고른 목표만 간다.

## 3. state

```js
{
  view: 'end' | 'off' | 'more' | 'day2' | 'front',  // 시안 v와 같다. 'front' = 둘째 날부터의 맞춤 화면(시안의 P.goal이 있는 homeView, 꼬리표는 「둘째 날」)
  lang: 'ko' | 'en' | 'mn',
  who: 'login' | 'guest' | 'pc',                    // pc = PC 앱 창(서울행 없음 — record는 비어 있는 것으로 본다)
  dream: 'idol' | 'actor',
  student: { name, nameEn, nameCy, call, from, face, faceCrop, card },
  record: { spoke, n, t2, tr, mom, wrap, momAnswer },  // 시안 R()과 같은 뜻. 있는 사실만
  hangul: 'reads' | 'new' | 'ask' | 'skip',         // ask = 아직 답이 없음
  after: false,                                     // 첫날 첫 연습을 마쳤나(둘째 날 view에서는 보지 않는다)
  goal: '' | 'travel' | 'people' | 'life' | 'work' | 'culture' | 'exam' | 'later_',
  step: '' | 'hangul' | 'goal',                     // 둘째 날 종이 질문으로 바로
  plan: Item | null,                                // 오늘 할 일(엔진 plan.selected를 다리가 바꾼 것)
  alts: [Item, Item],                               // 다른 걸로(엔진 alternatives, 0~2개)
  preview: { hangul: { reads: Item, new: Item }, goals: { travel: Item, … } },  // 고르기 전 미리보기(없어도 된다)
  today: [{ key, label }],                          // 「오늘 한 것」 줄
  position: Position | null,                        // 내 위치(엔진 위치 지도에서 다리가 줄인 것)
  consent: { needed, label, note },                 // 둘째 날 목표 저장 동의
  reduced: false                                    // 움직임 줄이기
}
```

- `student.face` = 서울행 전신 그림 주소(예: `../seoul-arrival/assets/img/look-mn-f.webp`, 941×1672). `student.faceCrop = { fx, fy, fw }`는 `seoul-arrival/data.mjs`의 `LOOK_FACES`와 같은 값이다(fx · fw는 그림 폭, fy는 그림 높이에 대한 비율). 틀은 동그란 얼굴 칸을 얼굴 폭이 원의 1/1.3이 되게 잘라 보인다. 그림 크기가 941×1672가 아니면 `faceCrop.w` · `faceCrop.h`를 같이 준다.
- `student.card` = 학생증 사진 주소. 없으면(null) 학생증의 사진 칸을 그리지 않는다. `nameCy`가 비면 몽골어 화면은 `nameEn`을 쓴다.
- `record.momAnswer` = 서울행 `arrival.momAnswer`(`'fix'` · `'ok'`). 엄마 쪽지 판의 내 답(「있어. ㅅ 두 개!」 · 「맞아.」)을 고른다. 없으면 `'fix'`로 본다.
- `preview.hangul`: 한글 질문의 두 답 카드 아래 「그 답이면 무엇부터」 한 줄. 없거나 두 Item의 title이 같으면 줄을 뺀다. `preview.goals`: 목표 질문의 「고르면 오늘은 ‘…’부터」 한 줄. 없으면 그 줄을 뺀다.
- `today`의 `key`: `card`(학생증) · `lines`(1화에서 말한 줄) · `heard`(말한 줄 없이 1화를 끝까지 들음) · `mom`(엄마에게 답장) · `practice`(맞춤에서 마친 연습). 앞의 넷은 틀이 자기 글(세 언어)로 쓰고, `practice`와 모르는 key는 `label`을 그대로 쓴다. `practice`는 첫날 화면에만 보인다.
- `consent.needed`가 참이면 목표 줄 아래, 「이걸로 할게요」 바로 위에 체크 상자 한 줄(`label` 굵게 + `note` 작게)을 둔다. 거짓이면 그리지 않는다.

```js
// Item
{ token, title, titleUi, kind, min, reason, line, lineTomorrow, photo, topic, says }
// token = host.open에 돌려줄 열쇠. title = 한국어 이름(시안처럼 화면에 한국어로 보인다), titleUi = 화면 언어 이름(화면 읽기 이름에만 쓴다)
// kind · topic = 꼬리표 열쇠(한국어, '{m}' 자리에 분). topic에 '{m}'이 있으면 topic을, 없으면 kind를 꼬리표로 쓴다
// reason = 까닭 한 줄(한국어 열쇠). '아직 안 해 본 것부터 해요.'는 보이지 않는다(시안 10v)
// line · lineTomorrow = 서하 말을 바꿀 때만. line이 '한글부터 해요'인 Item을 「한글 먼저」 판으로 안다
// photo = 자리 사진 열쇠(assets/ph/<photo>.webp). 이 폴더에 없는 열쇠는 r-union으로 보인다. says = 그 레슨의 표현 셋(없으면 null → topic)

// Position
{ total: 16, done: 0, practicing: 0,
  rows: [{ label: '듣기', cells: ['', '', …] }, { label: '읽기', cells: ['t', 't', '', …] }],  // 칸: '' · 't'(오늘 연습할 칸) · 'p'(연습 중)
  names: ['낱말 뜻 읽기', '조사·문형 읽기'] }   // 't' · 'p' 칸의 이름(한국어 열쇠)
// practicing이 1 이상이거나 'p' 칸이 있으면 「연습 중」 판, 아니면 't' 칸이 있을 때 「오늘 연습」 판. 꼬리표는 「TOPIK I 16칸」
// null이면 칸 줄 · 꼬리표 · 칸 이름 없이 「내 위치」와 「전체 보기」만 둔다(「오늘 한 것」은 그대로)
```

## 4. 틀이 부르는 host

모두 Promise를 돌려준다. 끝나면 host가 `api.show(새 state)`를 부르거나, 돌려준 state(`view`가 있는 객체)로 틀이 다시 그린다. 틀이 기다리는 동안 온 `show`는 넘김이 끝난 뒤 그린다.

| 이름 | 언제 |
|---|---|
| `answerHangul('reads' \| 'new')` | 한글 질문에 답했을 때(「나중에」는 부르지 않는다) |
| `chooseGoal(goal, { consent })` | 둘째 날 목표를 골랐을 때. `consent` = 동의 상자를 켰나. 「나중에 할게요」는 `'later_'`(동의 없이). 동의가 없어 저장하지 못하면 `{ error: 'needConsent' }`를 돌려준다 — 틀은 고르기를 멈추고 동의 줄 아래에 「먼저 <label>을 켜 주세요」를 보인 뒤 체크 상자로 초점을 옮긴다 |
| `bye()` | 「오늘은 여기까지」 — 첫날 끝을 적는다(불 끔은 틀이 이미 했다) |
| `more()` | 「지금 더 연습하기」 · 불 끈 뒤 「지금 더 하기」 |
| `open(token)` | 오늘 할 일 · 다른 걸로를 시작할 때(누름 움직임 뒤) |
| `openStory()` | 탐색의 「이야기」 |
| `openTab('learn' \| 'play')` | 탐색의 「배우기」 · 「놀이」 |
| `openAll()` | 내 위치 줄 · 「전체 보기」 |
| `openMe()` | 「나」 단추(내 계정 · 설정 · 로그아웃). 맞춤 화면 머리 오른쪽 끝의 머리글자 원, PC는 이름표 |
| `signIn()` | 손님 「로그인하고 1화 보기」 |
| `seen(key)` | 한 번만 보일 것을 보였다. `'day2'` = 둘째 날 아침에서 「오늘 시작하기」를 눌렀다, `'goal'` = 목표 질문을 보였다 |
