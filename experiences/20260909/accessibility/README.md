# 접근성을 제작의 기본 기능으로

`index.html`은 PULSE의 「마지막 불빛」 제작 시안을 그림·텍스트로 감상하는 실물이다. 원본 그림을 직접 보고 세 장면 설명을 작성했다. 배경음·효과음·대사·가사는 없다. 브라우저 읽어주기는 설명 초안을 기기의 한국어 음성으로 읽는 선택 기능이며 전문 음성해설 납품이나 실제 음원의 전사가 아니다.

## 콘텐츠마다 적용할 것

| 콘텐츠 | 제작에 포함 | 사람에게 확인할 것 |
|---|---|---|
| 이미지·캐러셀 | 목적에 맞는 대체글, 본문으로 읽는 핵심 정보, 글과 배경 대비 | 이미지와 설명의 의미 일치, 빠진 핵심, 자연스러운 읽힘 |
| 음악·영상 | 실제 원천에 대응하는 소리 정보·자막, 필요한 시각정보 설명, 정지·재생·음량 조작 | 전곡/전체 영상 청취, 자막의 의미·타이밍, 전문 음성해설·당사자 이용 |
| 수업·과제 | 키보드 입력, 읽을 수 있는 지시, 색 외의 상태 표시, 오류 복구·완료 안내 | 과제 이해와 대체 방식의 동등성, 실제 학생의 수행 |
| 웹·앱·서식 | 제목·영역 구조, 명확한 이름, 보이는 초점, 건너뛰기, 움직임 선택, 상태 알림 | 화면낭독기 순서·실청취, 키보드 전체 동선, 확대·실제 기기 사용 |

일반 자동 검사만으로 WCAG 전체 준수, 법규 준수, 학습효과를 인증하지 않는다. 원천이 없는 소리를 만들어 ‘전사’로 표시하지 않는다. AI 초안은 전문 검수·실제 이용자 확인과 구분한다. 이번 결과의 정확한 범위는 `evidence.json`과 `checks/browser.json`에 남는다. 사용자용 기준 화면은 `guide.html`이며, 서버가 Markdown을 제공하지 않아도 감상실에서 열 수 있다.

## 다른 페이지에 붙이기

```html
<link rel="stylesheet" href="../accessibility/a11y.css">
<a class="synk-skip-link" href="#main">본문으로 건너뛰기</a>
<main id="main" tabindex="-1">…</main>
<div class="synk-sr-only" data-synk-live></div>
<script src="../accessibility/a11y.js"></script>
<script>
  const a11y = SynkA11y.install({
    motionSelect: document.querySelector('#motion-choice'), // 선택 사항
    onMotionChange: state => console.log(state.choice, state.reduced),
    onSpeechState: state => console.log(state)
  });
  // 사용자 동작 처리 안에서만 읽기를 요청한다.
  document.querySelector('#read').addEventListener('click', () => {
    const result = a11y.speak('실제로 화면에 제공한 설명', {lang:'ko-KR'});
    if (!result.ok) a11y.announce('읽어주기를 사용할 수 없습니다. 설명을 글로 읽어 주세요.');
  });
  document.querySelector('#stop').addEventListener('click', () => a11y.cancelSpeech());
</script>
```

- `install()`은 `announce(text)`, `setMotion('system'|'reduce'|'allow')`, `getMotion()`, `speak(text,{lang})`, `cancelSpeech()`, `speechAvailable()`, `destroy()`를 반환한다. 설치만으로 소리를 재생하지 않는다.
- 기본값은 `prefers-reduced-motion`을 따른다. 사용자의 명시적 선택은 기기에 저장되며, 명시적으로 ‘허용’을 고르면 기기 설정보다 우선한다. 저장이 차단되어도 작동한다. 방문·장면 선택·음성 기록은 수집하지 않는다.
- 움직이는 요소에 `data-synk-motion-effect`를 붙인다. CSS는 표시한 요소와 그 가상 요소의 장식 움직임을 멈춘다. 동영상·캔버스·JavaScript 타이머는 해당 앱이 `onMotionChange`에서 직접 제어해야 한다.
- `speechAvailable()`은 API 존재 여부만 뜻한다. `speak()`는 언어에 맞는 음성이 없으면 `voice-unavailable`을 반환한다. 실제 발음·음량은 사람 청취로 확인한다. 같은 페이지의 음성 재생은 하나의 모듈 인스턴스가 맡는다.
- 초점 색은 `--synk-focus`, 초점 바탕은 `--synk-focus-surface`로 화면에 맞게 지정한다. 상태 알림은 짧고 선택의 결과만 전하며 장문 설명 전체를 강제로 읽히지 않는다.

## 재생성과 확인

저장소 루트에서 `node experiences/20260909/accessibility/build.cjs`로 현재 Loom의 `부품만` CSS·브랜드 토큰·정본 폰트를 생성한다. 별도 사본에 관련 도구가 없다면 환경변수 `SYNK_SOURCE_REPO`로 현재 정본 저장소를 지정한다. 생성된 `theme.css`를 손으로 편집하지 않는다. `gallery.css`는 이 감상실의 배치, `a11y.css`는 재사용 가능한 접근성 동작만 맡는다.

`node --test experiences/20260909/accessibility/a11y.test.cjs`는 움직임 선택·무자동재생·읽기 중지·늦게 도착한 이전 음성 이벤트·음성 미지원 처리를 확인한다. `node experiences/20260909/accessibility/browser-check.cjs`는 기존 Chrome 통로로 실제 키 입력·그림 누락·모바일·axe를 확인한다. 새로운 강제 훅이나 자동 차단 절차를 설치하지 않는다.

공유 그림의 소유 경로는 `../pulse/assets/felt-city.png`다. 이 그림이 빠져도 대체 화면과 장면 설명이 남는다. 그림이 바뀌면 설명을 다시 대조하고, 접근성 모듈을 수정하면 실제 사용하는 페이지를 다시 확인한다.
