# PULSE 〈마지막 불빛〉 오디오 인수

2026-09-10 · 기준 커밋 `a1d64fb04f8766dbef1cd3607c99577062f30f18`에서 제작. 최신 운영 원칙·DESIGN.md·사운드킷 정본·명품 기준과 기존 PULSE app.js/scene.js를 직접 읽었습니다.

## 만든 소리

- **〈밤이 건네는 불빛〉**: 72 BPM, 4/4, 32마디 약 107초의 원작 악곡. D장조와 B단조를 중심으로 넓게 벌린 7·9화음, 응답하는 선율, 쉬는 마디, 중간 전개와 마무리를 구성했습니다. 펠트 피아노를 연상시키는 둥근 어택과 감쇠, 부드러운 패드, 저음은 Web Audio로 합성합니다.
- 탐색·대기·합의 단계에 따라 편성 밀도를 바꾸고, 세 결말에는 각각 다른 화성 순서와 선율을 사용합니다. 단계가 바뀌면 이전 음악을 부드럽게 줄이고 새 음악으로 이어갑니다.
- 바다와 바람의 서로 다른 주기, 항구의 먼 부표 울림, 전차 금속 잔향, 방송기 근처의 작고 짧은 정전 잡음으로 장소를 구분합니다. 발자국·종이·스위치·확인·단서 공유도 합성했습니다.
- **실제 현장 녹음·피아노 녹음·성우 녹음이 아닙니다.** 기존 곡이나 음원 샘플을 가져오지 않았고, 외부 서비스 호출·음원 구매·신규 구독은 없습니다.

기존 SYNK UI 획득·성취·알림 3종과 승인된 캐릭터 목소리는 변경하지 않았습니다. 이 파일들은 새 게임 작품의 음악·환경·사물 소리입니다. 실패 버저나 선택의 옳고 그름을 평가하는 소리는 없습니다. 방송 잡음은 캐릭터 목소리가 아니라 장소의 사물 효과이며 작은 음량으로 제한했습니다.

## 앱 연결

```js
import { createPulseAudio } from './audio.js';
const audio = createPulseAudio({ onState: state => updateAudioControls(state) });
// 실제 시작 버튼의 click 안에서 호출합니다. 생성만으로는 소리가 나지 않습니다.
await audio.start();
audio.setMix({ music: 0.68, effects: 0.74 });
audio.mute(false);
audio.updateScene({ zone: 'tram', phase: 'explore', moving: true });
audio.play('switch');
audio.updateScene({ phase: 'ended', ending: 'lighthouse', moving: false });
```

- `start()` → Promise<State>. `createPulseAudio()`를 반복해도 같은 페이지에서는 엔진 하나만 사용합니다.
- `mute(boolean)` / `setMix({music, effects})` → State. 음량은 0~1. 환경음은 effects에 포함됩니다. 설정은 `synk.pulse.audio.mix.v1`에 저장합니다. 저장을 막은 브라우저에서도 현재 페이지는 동작합니다.
- `play(name, {pan, intensity}?)` → boolean. 이름은 `step`, `paper`, `switch`, `inspect`, `share`, `vote`, `confirm`, `tram`, `radio`. pan은 -1~1. 너무 짧은 동일 이벤트 중복은 누릅니다.
- `updateScene({zone, phase, ending, moving})`. zone은 `square`, `harbor`, `tram`, `radio`, `postbox`. 기존 사물 이름 `street`, `buoy`와 역할 이름도 대응합니다. moving=true일 때 0.57초 간격으로 발자국이 나므로 장면 전환·이동 종료 때 false로 바꿉니다.
- `getState()` / `subscribe(callback)` / `destroy()`. State는 `available`, `started`, `muted`, `music`, `effects`, `suspended`, `reason`, `zone`, `phase`, `contextState`를 포함합니다.

사용자 클릭 후에만 오디오 컨텍스트를 만듭니다. 탭을 벗어나면 음량을 줄인 뒤 멈추고, 돌아오면 이어갑니다. 같은 브라우저의 같은 주소에서 다른 PULSE 탭을 켜면 기존 탭은 잠시 멈춥니다. 먼저 켠 탭의 소리 켜기를 다시 누르면 그 탭이 이어받습니다. 다른 브라우저나 별도 기기까지 소리를 동기화하는 기능은 아닙니다.

소리로만 단서·목표·상태를 전달하지 않습니다. 앱 담당은 동일 정보를 화면에 유지해야 합니다. 소리 지원이 없으면 `reason`을 안내하고 이야기 진행은 계속할 수 있습니다.

## 들어보기와 검증

[42초 원작 오디오 샘플](audio-sample.wav)은 실제 브라우저 OfflineAudioContext에서 같은 작곡·합성 코드로 만든 44.1kHz 스테레오 PCM WAV입니다. 앞부분은 탐색 음악과 사물 효과, 27초부터 등대 결말 음악입니다. 런타임은 이 WAV를 재생하지 않고 같은 코드로 실시간 합성합니다.

`node experiences/20260909/pulse/qa/audio-verify.cjs`로 실제 Chrome의 클릭 시작·오디오 출력·음소거·분리 음량·지속 설정·같은 페이지와 탭의 중복 방지·복귀·모든 효과와 결말 변화·샘플 렌더를 확인합니다. 별도 임시 로컬 서버를 쓰며 4399 서버는 건드리지 않습니다. Playwright 설치 경로는 첫 번째 인자로 바꿀 수 있습니다.

[실측 기록](audio-evidence.json)에 파형 피크·RMS·클리핑·스테레오 차이를 남깁니다. 실제 Chrome 오디오 그래프가 출력한 신호와 자동 검사는 확인했지만, 사용자 헤드폰·스피커의 실제 청취 품질은 확인하지 않았습니다. 숨김 탭 분기는 테스트에서 visibility 이벤트와 hidden 속성을 사용해 확인했으며 운영체제가 탭을 중단하는 모든 경우를 재현한 것은 아닙니다.

사용자 지적의 ‘무음·BGM 없음’에 직접 대응해 실제 소리를 넣었습니다. 소리의 만족도와 장시간 피로도는 수치만으로 확정하지 않습니다.
