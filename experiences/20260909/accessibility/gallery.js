(function () {
  'use strict';
  const scenes = {
    tram: { number: '01', title: '다음 트램을 기다리는 자리', paragraphs: [
      '비가 그친 해안 도시입니다. 젖은 선로가 화면 아래에서 휘어져 중앙 오른쪽의 파란 트램으로 이어집니다. 트램 창과 앞등에는 따뜻한 빛이 켜져 있습니다.',
      '트램 지붕 위의 작은 코랄빛 신호가 눈에 들어옵니다. 청금석빛 밤하늘 아래, 창과 가로등의 버터빛이 물웅덩이에 길게 비칩니다.'
    ] },
    square: { number: '02', title: '방송국 앞에 잠시 머무르기', paragraphs: [
      '화면 오른쪽의 방송국 건물에는 둥근 윗창과 길게 이어진 지붕이 있습니다. 지붕 위에는 철탑과 둥근 접시 모양 안테나가 올라가 있습니다.',
      '건물 앞 지붕 아래로 가로등과 벤치가 이어집니다. 울퉁불퉁한 벽과 지붕, 나무에는 부드러운 펠트 섬유 같은 결이 보입니다.'
    ] },
    window: { number: '03', title: '멀리 남은 불빛', paragraphs: [
      '왼쪽 항구에는 배들이 머물고, 먼 바위 위 등대는 바다로 한 줄기 빛을 보냅니다. 화면 가까이에는 붉은 우체통과 벤치, 난간에 걸린 구명환이 있습니다.',
      '작품의 제목은 「마지막 불빛」입니다. 항구의 등대와 건물의 창 가운데 어디에 더 머무를지는 감상하는 사람에게 남겨 둡니다.'
    ] }
  };
  const byId = id => document.getElementById(id);
  let selected = 'tram';
  let paused = false;
  let speechBusy = false;
  const speechState = byId('speech-state');
  const readButton = byId('read-scene');
  const stopButton = byId('stop-reading');
  function showSpeechState(state) {
    speechBusy = state === 'pending' || state === 'speaking';
    stopButton.disabled = !speechBusy;
    readButton.textContent = speechBusy ? '처음부터 다시 읽기' : '장면 설명 읽어주기';
    if (state === 'pending') speechState.textContent = '선택한 브라우저 음성으로 읽기를 시작합니다.';
    else if (state === 'speaking') speechState.textContent = '장면 설명을 읽고 있습니다. 읽기 중지 버튼으로 멈출 수 있습니다.';
    else if (state === 'error') speechState.textContent = '이 브라우저에서 읽기를 시작하지 못했습니다. 위 장면 설명은 글로 읽을 수 있습니다.';
    else speechState.textContent = '읽기가 멈췄습니다. 다시 읽으려면 읽어주기 버튼을 누르세요.';
  }
  const accessibility = SynkA11y.install({
    motionSelect: byId('motion-choice'),
    onMotionChange(state) {
      byId('motion-state').textContent = state.reduced ? '움직임을 줄여 작은 빛을 정지했습니다.'
        : paused ? '작은 빛의 움직임을 정지했습니다.' : '작은 빛만 천천히 변합니다. 그림과 장면은 자동으로 바뀌지 않습니다.';
    },
    onSpeechState: showSpeechState
  });
  // Exposed solely for integration diagnostics; stores no visitor or story record.
  window.synkGallery = { accessibility, scenes, getSelected: () => selected };
  function updateSpeechSupport() {
    const supported = accessibility.speechAvailable();
    readButton.disabled = !supported;
    if (speechBusy) return;
    const voices = supported && speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
    const korean = voices.some(voice => voice.lang.toLowerCase().startsWith('ko'));
    speechState.textContent = !supported ? '이 브라우저는 읽어주기를 지원하지 않습니다. 장면 설명을 글로 읽어 주세요.'
      : korean ? '버튼을 누르면 브라우저의 한국어 음성이 위 글을 읽습니다. 전문 음성해설 초안을 시험하는 기능입니다.'
        : '현재 한국어 음성이 확인되지 않았습니다. 기기에 한국어 음성을 추가하거나 장면 설명을 글로 읽어 주세요.';
  }
  updateSpeechSupport();
  if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', updateSpeechSupport);
  function selectScene(key) {
    if (!scenes[key] || key === selected) return;
    const wasBusy = speechBusy;
    accessibility.cancelSpeech();
    selected = key;
    const scene = scenes[key];
    byId('scene-number').textContent = '장면 ' + scene.number;
    byId('scene-title').textContent = scene.title;
    byId('scene-description').replaceChildren(...scene.paragraphs.map(text => {
      const paragraph = document.createElement('p'); paragraph.textContent = text; return paragraph;
    }));
    updateSpeechSupport();
    accessibility.announce('장면 ' + scene.number + ', ' + scene.title + '을 선택했습니다.' + (wasBusy ? ' 이전 장면 읽기를 중지했습니다.' : ''));
  }
  document.querySelectorAll('input[name="scene"]').forEach(radio => radio.addEventListener('change', event => selectScene(event.target.value)));
  byId('pause-motion').addEventListener('click', event => {
    paused = !paused;
    document.body.dataset.galleryPaused = String(paused);
    event.currentTarget.setAttribute('aria-pressed', String(paused));
    event.currentTarget.textContent = paused ? '빛의 움직임 이어보기' : '빛의 움직임 정지';
    const reduced = accessibility.getMotion().reduced;
    const message = reduced ? '움직임 줄이기가 적용되어 작은 빛은 계속 정지해 있습니다.'
      : paused ? '작은 빛의 움직임을 정지했습니다.' : '작은 빛의 움직임을 다시 시작했습니다.';
    byId('motion-state').textContent = message;
    accessibility.announce(message);
  });
  readButton.addEventListener('click', () => {
    const scene = scenes[selected];
    const result = accessibility.speak('장면 설명 초안. ' + scene.title + '. ' + scene.paragraphs.join(' '), { lang: 'ko-KR' });
    if (!result.ok) {
      const message = result.reason === 'voice-unavailable' ? '현재 이 브라우저에 한국어 읽어주기 음성이 없습니다. 위 장면 설명을 글로 읽을 수 있습니다.'
        : '읽어주기를 사용할 수 없습니다. 위 장면 설명을 글로 읽을 수 있습니다.';
      speechState.textContent = message;
      accessibility.announce(message);
    }
  });
  stopButton.addEventListener('click', () => {
    accessibility.cancelSpeech();
    readButton.focus();
    accessibility.announce('장면 읽기를 중지했습니다.');
  });
  const picture = byId('city-image');
  function imageReady() {
    if (!picture.naturalWidth) return imageMissing();
    picture.hidden = false;
    byId('asset-fallback').hidden = true;
    byId('image-state').textContent = 'AI 제작 시안 · 정적인 그림';
  }
  function imageMissing() {
    picture.hidden = true;
    byId('asset-fallback').hidden = false;
    byId('image-state').textContent = '그림 연결 전 · 텍스트 감상 가능';
  }
  picture.addEventListener('load', imageReady);
  picture.addEventListener('error', imageMissing);
  if (picture.complete) picture.naturalWidth ? imageReady() : imageMissing();
  const evidence = window.SYNK_ACCESSIBILITY_EVIDENCE || { automated: { status: 'not_run' }, keyboard: { status: 'not_run' } };
  if (evidence.automated.summary) byId('automated-evidence').textContent = evidence.automated.summary;
  if (evidence.keyboard.summary) byId('keyboard-evidence').textContent = evidence.keyboard.summary;
  byId('download-evidence').addEventListener('click', () => {
    const report = Object.assign({}, evidence, {
      downloadedAt: new Date().toISOString(),
      currentBrowser: { motion: accessibility.getMotion(), speechAPIAvailable: accessibility.speechAvailable() },
      note: '브라우저 기능 표시와 제작 검수 기록입니다. 이용자 행동·개인정보·음성을 수집하지 않습니다.'
    });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'SYNK-접근성-감상실-검수.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    accessibility.announce('검수 기록 파일의 내려받기를 요청했습니다.');
  });
})();
