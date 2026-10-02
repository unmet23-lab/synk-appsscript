/*
 * Atlas constellation — curated architecture and designed experience examples.
 * These links express documented responsibilities, not live telemetry or a claim
 * that all eight engines are deployed together. Decorative particles are not data.
 *
 * Canonical sources, checked 2026-09-21:
 * docs/아틀라스_설계.md:61-66        — one understanding, one decision bundle, one loop
 * docs/아틀라스_설계.md:163-169      — each engine's adjustable experience and boundaries
 * docs/아틀라스_설계.md:263-278      — outcomes, individual adjustment, aggregate prerequisites
 * docs/아틀라스_설계.md:343-350      — declared upcoming goal and relevant practice
 * docs/아틀라스_설계.md:383-387      — chosen interests and optional help
 * docs/아틀라스_설계.md:419-455      — eight roles and Strata's six documented consumers
 * docs/아틀라스_설계.md:477-483      — independent verification; Atlas as the public name
 * docs/엔진8종_상향설계_v3.md:19-30 — canonical eight-engine role table
 * docs/아틀라스_첫지속기억_20260921.md:65-80 — scoped two-experience help preferences,
 *   local integration and rehearsal SQL verification; production API is not deployed.
 * atlas/experiences.js:21-29,118-134 — letter levers and submitted-document review
 * atlas/preferences.js:13-14       — separate letter/documents preference scopes
 *
 * The three scenarios below are design examples. They do not expand the scope of
 * currently implemented adapters. No personal records or user identifiers occur here.
 * Thread colors come from docs/디자인_토큰.json (색.스티치 + Coral).
 * This is the palette for this visualization, not permanent engine brand colors.
 * Feature labels checked against implementation on 2026-09-22:
 * see feature-sources-20260922.md for the 40 source mappings and scope limits.
 * Strata labels describe existing source materials; its integrated engine is planned.
 */
window.ATLAS_DATA = {
  engines: [
    {
      id: 'core', name: 'Core', role: '이해와 선택', color: '#F96859', threadHighlight: '#FBB7A3', threadShadow: '#AE322A',
      description: '확인된 이해와 지금의 상황을 읽고, 다음 연습과 도움의 방식을 고릅니다.',
      concepts: ['관측과 선언 분리', '틀린 이해 바로잡기', '도움 반응 학습', '근거의 유효기간', '선택의 근거 기록']
    },
    {
      id: 'strata', name: 'Strata', role: '배움의 지도', color: '#7DB45A', threadHighlight: '#D3E8BE', threadShadow: '#3F6B2E',
      description: '기존 어휘·문법·차시 자료를 하나의 학습 지도로 연결하는 설계입니다.',
      concepts: ['도입·복습 급수', '오류·기술 연결', '문법·기술 연결', '차시별 문법 배치', '상황별 과업 구조']
    },
    {
      id: 'loom', name: 'Loom', role: '장면과 움직임', color: '#F5C445', threadHighlight: '#FFEBB0', threadShadow: '#7E5A10',
      description: '정해진 경험을 재질과 빛, 배치와 움직임이 있는 장면으로 표현합니다.',
      concepts: ['실 한 가닥의 음영', '유리 속 굴절', '윤곽을 지키는 바람', '눈깜빡임과 시선', '남아 있는 관성']
    },
    {
      id: 'vellum', name: 'Vellum', role: '말과 행동', color: '#E05C97', threadHighlight: '#F8C7DE', threadShadow: '#99295D',
      description: '도움의 이유와 질문, 확인된 사실을 사람에게 닿는 말과 행동으로 전합니다.',
      concepts: ['성격을 따른 반응', '시간·계절의 혼잣말', '다시 만난 날의 표정', '함께한 날의 거리', '도움의 단계 조절']
    },
    {
      id: 'trail', name: 'Trail', role: '경험과 시간', color: '#3D6BC9', threadHighlight: '#C5D6F5', threadShadow: '#24448C',
      description: '경험과 목표, 판단과 정정을 시간에 따라 연결해 나의 변화를 되짚습니다.',
      concepts: ['시점별 목표 연결', '교정 후 재발화', '어제의 나와 비교', '회고 근거 보존', '목표·결과 대조']
    },
    {
      id: 'prism', name: 'Prism', role: '분포와 발견', color: '#C5D6F5', threadHighlight: '#C5D6F5', threadShadow: '#3D6BC9',
      description: '오류 패턴 사전을 만들고, 집계의 출처와 표본 조건을 점검합니다.',
      concepts: ['오류 패턴 사전', '분모·출처 검증', '표본 인원 점검', '기여 편중 점검', '집단 비교 점검']
    },
    {
      id: 'temper', name: 'Temper', role: '확인과 조정', color: '#D3E8BE', threadHighlight: '#D3E8BE', threadShadow: '#7DB45A',
      description: '어떤 도움을 실제로 받았고 그 뒤 무엇이 달라졌는지, 잴 수 있는 근거로 확인합니다.',
      concepts: ['도움이 닿은 경로', '후속 교정의 연결', '개입 전의 기준선', '1·7·30일 결과 회수', '측정 공백의 구분']
    },
    {
      id: 'reed', name: 'Reed', role: '소리와 감상', color: '#F8C7DE', threadHighlight: '#F8C7DE', threadShadow: '#E05C97',
      description: '경험에 필요한 목소리와 소리를 다루고, 조용히 머물고 싶은 선택을 존중합니다.',
      concepts: ['캐릭터마다 다른 음색', '직전 소리 반복 회피', '목소리의 미세 변주', '녹음 순간의 정숙', '장르를 잇는 곡 편성']
    }
  ],
  relations: [
    { from: 'strata', to: 'core', reason: '배울 내용과 선행 관계로 다음 연습을 고릅니다.' },
    { from: 'strata', to: 'vellum', reason: '배움의 맥락을 도움의 이유로 풀어냅니다.' },
    { from: 'strata', to: 'loom', reason: '배움의 지도를 눈에 보이는 장면으로 표현합니다.' },
    { from: 'strata', to: 'trail', reason: '지나온 배움을 같은 지도 위에 연결합니다.' },
    { from: 'strata', to: 'prism', reason: '같은 학습 항목을 기준으로 분포를 살핍니다.' },
    { from: 'strata', to: 'temper', reason: '도움과 후행 결과가 어떤 배움에 닿았는지 확인합니다.' },
    { from: 'core', to: 'vellum', reason: '선택한 도움과 그 이유를 사람에게 전합니다.' },
    { from: 'trail', to: 'core', reason: '경험과 정정의 시간 관계를 다음 이해에 연결합니다.' },
    { from: 'core', to: 'temper', reason: '선택한 도움과 이후 결과를 이어 확인합니다.' },
    { from: 'prism', to: 'core', reason: '허용된 집계에서 얻은 출발점을 제안합니다.' },
    { from: 'prism', to: 'temper', reason: '제안과 확인의 역할을 나눠 개선 근거를 대조합니다.' },
    { from: 'trail', to: 'vellum', reason: '확인된 경험을 근거 있는 말과 반응으로 전합니다.' },
    { from: 'vellum', to: 'loom', reason: '선택한 말과 행동을 실제 장면에서 표현합니다.' },
    { from: 'vellum', to: 'reed', reason: '안내와 반응에 필요한 목소리와 소리를 연결합니다.' },
    { from: 'loom', to: 'reed', reason: '같은 경험의 장면과 소리가 함께 반응합니다.' }
  ],
  scenarios: [
    {
      id: 'goal-to-learning',
      title: '목표가 배움이 되는 순간',
      subtitle: '설계 예시 · 면접을 앞둔 학습자',
      engines: ['trail', 'strata', 'core', 'vellum', 'loom'],
      steps: [
        { engine: 'trail', label: '내가 말한 목표', description: '학습자가 직접 알려 준 면접 목표와 그 시점을 기록합니다.' },
        { engine: 'strata', label: '필요한 표현 연결', description: '면접이라는 상황을 필요한 표현과 선행 학습에 연결합니다.' },
        { engine: 'core', label: '오늘의 연습 선택', description: '목표와 현재 조건을 함께 읽고 지금 가능한 연습을 고릅니다.' },
        { engine: 'vellum', label: '준비한 이유 전달', description: '이 연습이 목표와 어떻게 이어지는지 짧고 분명하게 알려 줍니다.' },
        { engine: 'loom', label: '경험으로 구현', description: '선택된 연습과 안내가 실제로 보이고 사용할 수 있는 장면이 됩니다.' }
      ],
      result: '하나의 목표가 배울 내용, 도움의 이유, 실제 경험으로 이어집니다.'
    },
    {
      id: 'preference-to-experience',
      title: '나에게 맞는 도움의 방식',
      subtitle: '설계 예시 · 하나씩 살펴보고 싶은 날',
      engines: ['core', 'vellum', 'loom', 'reed'],
      steps: [
        { engine: 'core', label: '내 선택을 먼저', description: '하나씩 도와 달라는 본인의 선택을 도움 구성에 우선 반영합니다.' },
        { engine: 'vellum', label: '한 항목부터 안내', description: '지금 살펴볼 한 항목을 안내하고 나머지는 원할 때 열 수 있게 합니다.' },
        { engine: 'loom', label: '화면의 밀도 조절', description: '선택한 도움 방식이 화면에 실제로 펼쳐지는 정보의 양을 바꿉니다.' },
        { engine: 'reed', label: '조용한 선택 존중', description: '소리를 꺼 두었다면 시각 안내를 유지하면서 그 선택을 그대로 지킵니다.' }
      ],
      result: '같은 배움도 내가 고른 방식과 지금의 상황에 맞게 전달됩니다.'
    },
    {
      id: 'outcome-to-next-help',
      title: '경험이 다음 도움으로',
      subtitle: '설계 예시 · 도움 뒤의 변화를 살피기',
      engines: ['trail', 'temper', 'core', 'strata', 'vellum'],
      steps: [
        { engine: 'trail', label: '전후 경험 연결', description: '어떤 도움을 받았는지와 그 뒤의 경험을 시간에 따라 연결합니다.' },
        { engine: 'temper', label: '결과의 근거 확인', description: '혼자 해낸 결과와 도움받은 결과를 구분하고 아직 잴 수 없는 것은 남겨 둡니다.' },
        { engine: 'core', label: '다음 선택 조정', description: '확인된 결과와 본인의 응답을 다음 도움을 고르는 근거로 사용합니다.' },
        { engine: 'strata', label: '이어갈 배움 찾기', description: '다음 선택이 같은 학습 지도와 선행 관계 안에서 이어지도록 합니다.' },
        { engine: 'vellum', label: '변화의 이유 전달', description: '무엇을 근거로 다음 도움을 준비했는지 이해할 수 있는 말로 전합니다.' }
      ],
      result: '제공한 도움과 확인된 결과가 다음 경험을 준비하는 근거가 됩니다.'
    }
  ]
};
