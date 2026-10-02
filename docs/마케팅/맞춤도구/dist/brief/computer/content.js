/* synkbrief 기초 · AI 컴퓨터 맞춤 추천 — 질문·선택지·팁·출처.
 * 원본: SYNK-appsscript/docs/마케팅/맞춤도구/computer/content.js
 * 화면에 보이는 문장은 이 파일이 쥔다. 계산은 rules.js, 그림과 결과 화면은 view.js가 맡는다.
 * 제작 절차(../제작절차.md): 질문마다 왜 묻는지, 선택지마다 고른 뒤 한 줄, 추천에 들어간 부품마다
 * 무엇인지·왜 필요한지·왜 비싼지·필요 없는 경우·함정·확인법을 TIPS에 둔다. core/content-check.js가 빠진 칸을 잡는다.
 * 숫자는 SOURCES의 확인 날짜 기준이다. 바뀌면 탐색노트.md → 이 파일 → rules.js 순서로 고친다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkComputerContent = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CHECKED = '2026-09-27';

  const SOURCES = {
    'ms-win11': { kind: 'official', label: 'Microsoft · Windows 11 사양(최소 램 4GB, 저장공간 64GB)과 Copilot+ PC 조건(램 16GB, SSD 256GB, NPU 40 TOPS 이상, 칩 목록)', url: 'https://www.microsoft.com/en-us/windows/windows-11-specifications' },
    'ms-win10': { kind: 'official', label: 'Microsoft · PC 상태 검사 앱과 Windows 10 지원 종료(2025-10-14)', url: 'https://support.microsoft.com/en-us/windows/experience/compatibility/how-to-use-the-pc-health-check-app' },
    'ms-copilot-features': { kind: 'official', label: 'Microsoft · Copilot+ PC 기능: Windows Studio Effects, 실시간 번역 자막(40개+ 언어→영어, 25개+→중국어 간체), Recall, Click to Do', url: 'https://www.microsoft.com/en-us/windows/business/devices/copilot-plus-pcs' },
    'ms-live-captions': { kind: 'official', label: 'Microsoft 지원 · 실시간 자막은 윈도우 11 22H2부터 모든 PC, 번역은 코파일럿+ PC(24H2 이상)에서만 40개+ 언어→영어, 27개 언어→중국어 간체', url: 'https://support.microsoft.com/en-us/accessibility/windows/use-live-captions-to-better-understand-audio' },
    'apple-mba': { kind: 'official', label: 'Apple · MacBook Air(13형, M5, 2026) 기술 사양: 통합 메모리 16GB 기본(24·32GB), 초당 153GB, SSD 512GB, 미디어 엔진, 1.23kg', url: 'https://support.apple.com/en-us/126320' },
    'apple-mac-desktop': { kind: 'official', label: 'Apple · 새 Mac mini·Mac Studio(2026-09): Mac mini M6 16GB~32GB, M5 Pro 24·48·64GB(초당 307GB), Mac Studio M5 Max 최대 128GB', url: 'https://www.apple.com/newsroom/2026/09/the-new-mac-mini-and-mac-studio-are-available-today/' },
    'apple-fcp': { kind: 'official', label: 'Apple · Final Cut Pro 사양: macOS 15.6 이상, 램 8GB(16GB 권장)', url: 'https://www.apple.com/final-cut-pro/specs/' },
    'apple-tahoe': { kind: 'official', label: 'Apple WWDC25 발표: macOS 26 Tahoe가 인텔 맥의 마지막 macOS(PetaPixel 2025-06-10 보도)', url: 'https://petapixel.com/2025/06/10/macos-26-tahoe-is-the-end-of-the-road-for-intel-macs/' },
    'apple-xcode': { kind: 'official', label: 'Apple · Xcode(맥 전용 개발 도구)', url: 'https://developer.apple.com/xcode/' },
    'adobe-pr': { kind: 'official', label: 'Adobe · Premiere 프로세서·메모리·GPU 권장(2026-01-07 갱신): 윈도우 램 32GB 이상, 애플 실리콘 영상 편집 최소 16GB, 그래픽 메모리 4GB 이상', url: 'https://helpx.adobe.com/premiere/desktop/get-started/technical-requirements/processor-memory-and-gpu-recommendations.html' },
    'adobe-ps': { kind: 'official', label: 'Adobe · Photoshop 기술 요구 사양: 램 8GB(16GB 이상 권장), 4K 이상 화면은 그래픽 메모리 4GB', url: 'https://helpx.adobe.com/photoshop/desktop/get-started/technical-requirements-installation/adobe-photoshop-on-desktop-technical-requirements.html' },
    'bmd-resolve': { kind: 'official', label: 'Blackmagic Design · DaVinci Resolve 20 최소 사양(윈도우 램 16GB, 퓨전 사용 시 32GB, 그래픽 메모리 4GB 이상). 20.2.1 안내문을 인용한 SAMDB 기사로 확인', url: 'https://www.samdb.co.za/blogs/blog/2025/09/23/davinci-resolve-20-2-1-update-released-by-blackmagic-design/' },
    'capcut': { kind: 'official', label: 'CapCut · 윈도우용 최소 사양(윈도우 10 이상, 인텔 코어 i3 이상, 램 4GB 이상, 인텔 HD 그래픽 4000 이상), 2026-08-20 게시', url: 'https://www.capcut.com/resource/capcut-for-windows' },
    'blender': { kind: 'official', label: 'Blender · 요구 사양: 램 8GB(권장 32GB), 그래픽 메모리 2GB(권장 8GB). Blender 5부터 맥은 애플 실리콘 필요', url: 'https://www.blender.org/download/requirements/' },
    'ollama-qwen3': { kind: 'official', label: 'Ollama 라이브러리 · Qwen3 파일 크기: 4B 2.5GB, 8B 5.2GB, 14B 9.3GB, 32B 20GB', url: 'https://ollama.com/library/qwen3' },
    'ollama-llama33': { kind: 'official', label: 'Ollama 라이브러리 · Llama 3.3 70B 파일 크기 43GB', url: 'https://ollama.com/library/llama3.3' },
    'comfy-community': { kind: 'community', label: 'ComfyUI Wiki · 그래픽카드 고르기(SDXL 8GB, FLUX는 12~16GB 이상이 편함). 공식 사양이 아닌 커뮤니티 기준', url: 'https://comfyui-wiki.com/en/install/install-comfyui/gpu-buying-guide' },
    'pcworld-5070': { kind: 'community', label: 'PCWorld · RTX 5070 노트북용과 데스크톱용 비교(노트북용 코어 4,608개·8GB·128비트, 데스크톱용 코어 6,144개·12GB·192비트·250W)', url: 'https://www.pcworld.com/article/2573325/nvidia-rtx-5070-laptops-give-me-little-hope-for-desktop-rtx-5060.html' },
    'techspot-5070': { kind: 'community', label: 'TechSpot · RTX 5070 리뷰(GDDR7 28Gbps·192비트, 메모리 대역폭 초당 672GB)', url: 'https://www.techspot.com/review/2960-nvidia-geforce-rtx-5070/' },
    'msrp-5060ti': { kind: 'community', label: 'TechPowerUp · RTX 5060 Ti 출시 가격(16GB 429달러, 8GB 379달러), Tom’s Hardware · RTX 5060 299달러', url: 'https://www.techpowerup.com/335513/nvidia-confirms-geforce-rtx-5060-ti-starting-msrps-usd-429-for-16-gb-usd-379-for-8-gb' },
    'wccftech-gpu': { kind: 'community', label: 'wccftech 2026-08-11(Tom’s Hardware 집계) · 2026년 8월 미국 중간 가격: RTX 5060 약 470달러, 5060 Ti 16GB 약 805달러, 5070 약 900달러, 5090 약 4,700달러', url: 'https://wccftech.com/nvidias-rtx-5060-ti-16gb-median-price-surges-to-805-now-88-above-its-launch-msrp/' },
    'tpu-gddr7': { kind: 'community', label: 'TechPowerUp 2026-07-23 · 엔비디아가 그래픽카드 제조사에 파는 칩·메모리 묶음 가격 인상(GDDR7·GDDR6), 그래픽카드 값 20~30% 상승', url: 'https://www.techpowerup.com/351018/nvidia-reportedly-raises-gddr6-and-gddr7-memory-kit-prices-for-rtx-gpus' },
    'toms-hbm': { kind: 'community', label: 'Tom’s Hardware 2025-12-19 · HBM은 같은 1GB에 DDR5보다 웨이퍼를 약 3배 사용, DDR5 32GB 키트 135→420달러, 2TB SSD 80→130달러', url: 'https://www.tomshardware.com/pc-components/ram/hbm-is-eating-your-ram' },
    'micron-crucial': { kind: 'official', label: 'Micron 발표(2025-12-03) · 크루셜 소비자 사업 종료, 2026년 2월(회계연도 2분기 말)까지만 출하, 이유는 AI 데이터센터 수요', url: 'https://investors.micron.com/news-releases/news-release-details/micron-announces-exit-crucial-consumer-business' },
    'trendforce': { kind: 'official', label: 'TrendForce 조사(Tom’s Hardware 2026-07-04 보도): 2026년 2분기 D램 계약 가격 약 60% 상승, 3분기 13~18% 추가 상승 전망', url: 'https://www.tomshardware.com/pc-components/ram/memory-price-surge-begins-to-cool-as-consumers-hit-affordability-limit-ai-demand-still-keeps-dram-and-nand-prices-climbing-through-q3-2026' },
    'wc-npu-apps': { kind: 'community', label: 'Windows Central 2026-04-05 · NPU를 쓰는 앱(포토샵의 선택·배경 제거·노이즈 제거, 캡컷 등)', url: 'https://www.windowscentral.com/artificial-intelligence/apps-use-npu-ai-pcs' },
    'npu-llm': { kind: 'community', label: 'Redrag 2026-07-25 · Ollama·LM Studio(llama.cpp)는 2026년 중반까지 NPU를 쓰지 않고 GPU·CPU에서 동작', url: 'https://www.redrag.in/2026/07/AI-PC-Laptop-NPU-Ollama-LM-Studio.html' },
    'ane-llm': { kind: 'community', label: 'Contra Collective 2026 · 맥의 LLM 실행 도구(llama.cpp·MLX·Ollama·LM Studio)는 뉴럴 엔진이 아니라 GPU(Metal)를 사용', url: 'https://contracollective.com/blog/gpu-vs-apple-neural-engine-local-llm-inference-m5-max-2026' },
    synk: { kind: 'synk', label: 'SYNK 판단 · 공식 자료가 없는 부분(동시 사용량, 가성비·여유 단계, 형태 추천)은 위 자료를 바탕으로 SYNK가 정한 기준이에요. 기준 문서: 추천기준.md' },
  };

  // 추천에 들어가는 부품과, 부품마다 반드시 채울 팁의 종류(제작 절차 §3). core/content-check.js가 검사한다.
  const COMPONENTS = {
    ram: ['what', 'why', 'price', 'skip', 'check'],
    gpu: ['what', 'why', 'price', 'skip', 'trap'],
    npu: ['what', 'why', 'skip', 'trap'],
    storage: ['why', 'price', 'skip'],
    form: ['why', 'trap'],
  };

  // 팁 은행. rules.js의 tipIds가 사람마다 고른다. covers = 이 카드가 채우는 팁 종류.
  const TIPS = {
    'ram-why': {
      component: 'ram', covers: ['what', 'why', 'check'], title: '램(RAM)은 왜 필요할까',
      body: [
        '램은 프로그램을 펼쳐 놓고 일하는 작업 책상이에요. 켜 둔 프로그램, 인터넷 탭, 편집 중인 영상 조각, AI 모델이 모두 이 책상 위에 올라가요.',
        '책상이 모자라면 컴퓨터는 당장 안 쓰는 걸 저장공간(SSD)으로 잠깐 옮겨요. SSD는 램보다 훨씬 느려서 창을 바꿀 때마다 멈칫하죠. “컴퓨터가 버벅인다”의 가장 흔한 이유예요.',
        '웹 AI는 계산을 서버가 해서 램을 조금만 써요. 내 컴퓨터에 설치한 AI는 모델 파일 전체를 올려야 해서 모델 크기만큼 더 필요해요. 8B 모델은 약 5GB예요.',
        '지금 얼마나 쓰는지는 윈도우 작업 관리자 → 성능 → 메모리, 맥 활성 상태 보기 → 메모리에서 볼 수 있어요.',
      ],
      src: ['ollama-qwen3'],
    },
    'ram-price': {
      component: 'ram', covers: ['price'], title: '램은 왜 이렇게 비싸졌을까',
      body: [
        'AI 데이터센터용 칩에는 HBM이라는 특수 메모리가 들어가요. HBM은 같은 1GB를 만드는 데 일반 램(DDR5)보다 반도체 원판(웨이퍼)을 약 3배 써요.',
        '메모리 회사들이 돈이 되는 HBM으로 생산을 돌리면서 일반 램이 모자라졌어요. 2025년 9월 135달러였던 DDR5 32GB 세트가 12월엔 420달러를 넘었어요.',
        'D램 칩을 만드는 큰 회사는 삼성전자·SK하이닉스·마이크론 세 곳이에요. 그중 마이크론이 AI 데이터센터에 집중하겠다며 2026년 2월을 끝으로 소비자용 크루셜 램 판매를 접었어요.',
        'TrendForce는 2026년 2분기 D램 계약 가격이 약 60% 올랐고 3분기에도 13~18% 더 오른다고 봤어요. 그래서 16GB에서 32GB로 올리는 값이 예전보다 훨씬 커요. 필요한 만큼만 고르는 게 가성비예요.',
      ],
      src: ['toms-hbm', 'micron-crucial', 'trendforce'],
    },
    'ram-laptop': {
      component: 'ram', covers: ['check', 'trap'], title: '노트북 램은 살 때 정해요',
      body: [
        '요즘 얇은 노트북은 램이 기판에 붙어 있어서 나중에 늘릴 수 없는 경우가 많아요.',
        '사기 전에 “램 증설이 되나요?”를 꼭 물어보세요. 안 된다면 ‘여유가 되면’ 용량을 처음에 고르는 게 나중에 새로 사는 것보다 싸요.',
      ],
      src: ['synk'],
    },
    'ram-desktop': {
      component: 'ram', covers: ['skip', 'check'], title: '데스크톱 램은 나중에 늘려도 돼요',
      body: [
        '데스크톱은 램을 꽂는 슬롯이 여러 개예요. 지금은 가성비 추천으로 시작하고, 모자라면 같은 규격의 램을 더 꽂으면 돼요.',
        '살 때 “램 슬롯이 몇 개 비어 있나요?”를 물어보세요. 슬롯이 꽉 차 있으면 늘릴 때 기존 램을 빼야 해서 돈이 더 들어요.',
      ],
      src: ['synk'],
    },
    'mac-unified': {
      component: 'ram', covers: ['what', 'why', 'skip'], title: '맥의 통합 메모리는 램이 곧 그래픽 메모리예요',
      body: [
        '맥은 CPU와 그래픽이 한 메모리를 같이 써요. 그래서 그래픽카드를 따로 고를 필요가 없고, 큰 AI 모델도 메모리 크기만큼 올릴 수 있어요.',
        '메모리 속도도 빨라요. 맥북 에어(M5)는 초당 153GB, 맥 미니 M5 Pro는 초당 307GB를 옮겨요. 일반 PC 램(DDR5 두 개)은 초당 약 90GB예요.',
        '대신 나중에 늘릴 수 없어요. 그래서 맥은 처음에 필요한 만큼 고르는 게 가장 중요해요.',
      ],
      src: ['apple-mba', 'apple-mac-desktop'],
    },
    'gpu-why': {
      component: 'gpu', covers: ['what', 'why'], title: '그래픽카드는 왜 필요할까',
      body: [
        'CPU가 뭐든 잘하는 일꾼 몇 명이라면, 그래픽카드는 단순한 계산을 동시에 하는 일꾼 수천 명이에요. RTX 5070에는 이런 코어가 6,144개 있어요. 화면의 수백만 점을 한꺼번에 그리거나, AI의 곱셈을 한꺼번에 하는 데 딱 맞아요.',
        '그래픽카드에는 전용 책상인 그래픽 메모리(VRAM)가 붙어 있어요. RTX 5070은 이 메모리에서 초당 672GB를 옮겨요. 일반 PC 램(초당 약 90GB)보다 7배 넘게 빨라요.',
        'AI는 답 한 글자를 만들 때마다 모델 전체를 훑어요. 그래서 모델이 그래픽 메모리에 통째로 들어가야 빨라요. 안 들어가면 느린 램을 오가며 크게 느려져요.',
        '영상 편집에서는 효과·색 보정·미리보기를, 3D에서는 렌더링을, 게임에서는 화면 그리기를 그래픽카드가 맡아요.',
      ],
      src: ['pcworld-5070', 'techspot-5070'],
    },
    'gpu-price': {
      component: 'gpu', covers: ['price', 'trap'], title: '그래픽카드는 왜 이렇게 비쌀까',
      body: [
        '그래픽카드 값의 큰 부분이 그래픽 메모리(GDDR7)예요. 이 메모리도 AI 붐으로 값이 올라서, 엔비디아가 2026년에 그래픽카드 제조사에 파는 칩·메모리 묶음 가격을 올렸어요. 매장 가격도 20~30% 올랐어요.',
        '2026년 8월 미국 중간 가격은 RTX 5060 약 470달러, RTX 5060 Ti 16GB 약 805달러, RTX 5070 약 900달러, RTX 5090 약 4,700달러였어요. 출시 가격(각 299·429·549·1,999달러)보다 크게 올랐죠.',
        '그래서 그래픽 메모리를 필요한 만큼만 사는 게 가성비예요. 같은 메모리면 더 싼 모델을, AI용이면 속도보다 메모리 크기를 먼저 보세요.',
        '함정: ‘게이밍’·‘AI’ 같은 광고 문구보다 그래픽 메모리(VRAM) 숫자를 보세요. 이름이 같아도 노트북용은 데스크톱용보다 약해요.',
      ],
      src: ['tpu-gddr7', 'wccftech-gpu', 'msrp-5060ti'],
    },
    'gpu-none': {
      component: 'gpu', covers: ['skip'], title: '그래픽카드가 따로 필요 없는 이유',
      body: [
        '요즘 CPU에는 그래픽 기능이 함께 들어 있어요(내장 그래픽). 웹 AI·문서·화상회의·짧은 편집은 이걸로 충분해요.',
        '외장 그래픽카드는 2026년 들어 값이 크게 올랐어요. 필요 없는 곳에 쓰지 않는 것만으로 수십만 원을 아껴요.',
        '나중에 무거운 작업을 시작하면, 데스크톱은 그래픽카드만 더 꽂으면 돼요.',
      ],
      src: ['wccftech-gpu'],
    },
    'laptop-gpu': {
      component: 'form', covers: ['why', 'trap'], title: '무거운 작업에 노트북을 권하지 않는 이유',
      body: [
        '같은 이름이라도 노트북용 그래픽은 더 약해요. RTX 5070은 데스크톱용이 코어 6,144개·250W, 노트북용이 코어 4,608개에 훨씬 낮은 전력으로 돌아가요. 처음 나온 노트북용은 그래픽 메모리도 8GB였어요(데스크톱 12GB).',
        '노트북은 열을 식힐 공간이 좁아서, 오래 무거운 작업을 하면 스스로 속도를 낮춰요.',
        '노트북은 램·그래픽카드를 나중에 바꿀 수 없어요. 데스크톱은 부품만 바꿔 오래 써요.',
        '밖에서는 가진 기기로 웹 AI·문서를 하고, 무거운 작업은 집 데스크톱에서 하거나 원격으로 켜서 쓰세요.',
      ],
      src: ['pcworld-5070'],
    },
    'npu-what': {
      component: 'npu', covers: ['what', 'why', 'skip', 'trap'], title: 'NPU(‘AI PC’)는 누구에게 필요할까',
      body: [
        'NPU는 가벼운 AI 기능을 전기를 적게 쓰며 계속 돌리는 작은 AI 전용 칩이에요. 코파일럿+ PC는 NPU 성능이 40 TOPS 이상이어야 해요.',
        '의미 있는 경우: 윈도우 화상회의 효과(배경 흐림·시선 맞춤·목소리 또렷하게), 실시간 번역 자막, Recall·Click to Do 같은 윈도우 기능, 포토샵·캡컷·다빈치 리졸브의 일부 AI 기능(선택·배경 제거·마스크)이에요. 노트북 배터리를 아껴 주는 게 가장 큰 장점이에요.',
        '차이 없는 경우: ChatGPT·Claude 같은 웹 AI(서버가 계산), 내 컴퓨터에 설치한 대화 AI(Ollama·LM Studio는 NPU를 안 써요), 게임, 그래픽카드가 있는 데스크톱이에요.',
        '함정: 자막만 켜는 건 NPU 없이 모든 윈도우 11에서 돼요. NPU가 필요한 번역 자막은 영어·중국어로만 번역되고 한국어로는 안 돼요. TOPS 숫자가 커도 대화 AI는 빨라지지 않아요.',
      ],
      src: ['ms-win11', 'ms-copilot-features', 'ms-live-captions', 'wc-npu-apps', 'npu-llm'],
    },
    'npu-llm': {
      component: 'npu', covers: ['what', 'why', 'skip', 'trap'], title: 'AI를 설치해도 NPU는 차이를 만들지 못해요',
      body: [
        'Ollama·LM Studio는 속을 보면 llama.cpp라는 엔진으로 돌아가요. 이 엔진은 모델을 그래픽카드·CPU에서 돌리고, 2026년 중반까지 NPU로는 보내지 않아요.',
        'NPU에서 돌리려면 모델을 회사마다 다른 형식으로 따로 바꿔야 해서, 흔한 도구에선 아직 ‘그냥 되는’ 길이 없어요.',
        '대화 AI의 속도는 NPU 숫자(TOPS)가 아니라 메모리 크기와 메모리 속도가 정해요. 그래서 돈은 램(맥)이나 그래픽 메모리(윈도우)에 쓰세요.',
        'NPU가 의미 있는 곳은 따로 있어요. 윈도우 화상회의 효과, 실시간 번역 자막, 포토샵·캡컷의 일부 AI 기능처럼 가벼운 AI를 배터리 걱정 없이 돌릴 때예요. 맥도 같아서, 모델은 뉴럴 엔진이 아니라 그래픽(GPU)으로 돌아가요.',
      ],
      src: ['npu-llm', 'ane-llm', 'ms-copilot-features'],
    },
    'ssd-price': {
      component: 'storage', covers: ['why', 'price', 'skip'], title: '저장공간(SSD)은 내장은 알맞게, 나머지는 외장으로',
      body: [
        '영상 원본·AI 모델·게임은 하나에 수십 GB씩이라 저장공간이 금방 차요.',
        'SSD의 메모리도 AI 서버가 많이 사 가면서 값이 올랐어요. 2025년 여름 80달러였던 2TB SSD가 11월엔 130달러가 됐어요.',
        '내장 SSD는 가성비 추천만큼 사고, 끝난 영상·모델 파일은 외장 SSD로 옮기세요. 맥은 내장 SSD를 나중에 바꿀 수 없고, 데스크톱 PC는 SSD를 한 칸 더 달 수 있어요.',
      ],
      src: ['toms-hbm'],
    },
  };

  const steps = [
    {
      id: 'owned', type: 'single', eyebrow: '먼저 내 상황부터', short: '지금 컴퓨터 유무',
      title: '지금 쓸 수 있는 컴퓨터가 있나요?',
      sub: '있다면 새로 사기 전에, 그 컴퓨터로 충분한지부터 같이 볼게요.',
      options: [
        { id: 'have', label: '있어요', sub: '이걸로 충분한지 알고 싶어요', tip: '좋아요. 마지막에 지금 컴퓨터로 할 수 있는 일과 부족한 점을 따로 알려 드릴게요.' },
        { id: 'new', label: '없어요, 새로 살 거예요', sub: '처음 사거나 바꿀 때가 됐어요', tip: '그럼 하려는 일에 딱 맞는 사양을 가성비 기준으로 찾아 드릴게요. 넘치게 사지 않는 게 목표예요.' },
        { id: 'extra', label: '있지만 하나 더 살까 해요', sub: '작업용을 따로 두고 싶어요', tip: '지금 컴퓨터로 되는 일과 새 컴퓨터가 맡을 일을 나눠서 볼게요.' },
      ],
      tip: { title: '웹에서 쓰는 AI는 ‘서버’가 계산해요', body: ['ChatGPT·Claude·Gemini를 인터넷 창에서 쓰면, 어려운 계산은 AI 회사의 서버가 해요. 내 컴퓨터는 질문을 보내고 답을 보여 주는 일만 하죠.', '그래서 웹 AI만 쓴다면 비싼 컴퓨터가 꼭 필요하지 않아요. 반대로 AI를 내 컴퓨터에 설치하면, 그 계산을 전부 내 컴퓨터가 해야 해요.'], visual: 'server' },
    },
    {
      id: 'uses', type: 'multi', eyebrow: '하고 싶은 일',
      title: '컴퓨터로 무엇을 하고 싶나요?',
      sub: '해당하는 걸 모두 골라 주세요. 고를 때마다 책상 그림에 올라가요.',
      options: [
        { id: 'web', label: 'AI와 대화·글쓰기·문서', sub: 'ChatGPT·Claude·Gemini, 한글·워드·엑셀', tip: '웹 AI는 서버가 계산해서 가벼워요. 램은 탭을 몇 개 여느냐가 더 중요해요.' },
        { id: 'meeting', label: '화상회의·온라인 수업', sub: 'Zoom·Teams·Meet, 회의 녹음 요약', tip: '화상회의는 카메라와 화면 공유를 함께 처리해요. 노트북이라면 NPU가 회의 효과를 맡아 배터리를 아껴 줘요.' },
        { id: 'photo', label: '사진·디자인', sub: '캔바·피그마, 포토샵, 3D', tip: '어떤 프로그램인지에 따라 차이가 커요. 다음 질문에서 자세히 볼게요.' },
        { id: 'video', label: '영상 편집', sub: '캡컷·프리미어·다빈치 리졸브·파이널 컷', tip: '영상 편집은 프로그램과 영상 크기(FHD·4K)가 사양을 정해요. 4K부터는 무거운 작업이라 데스크톱을 권해요.' },
        { id: 'code', label: '코딩·앱 만들기', sub: 'VS Code·Cursor, 앱·웹 개발', tip: '웹 개발은 가벼운 편이고, 휴대폰 에뮬레이터나 도커를 쓰면 램을 더 써요.' },
        { id: 'localai', label: '내 컴퓨터에 AI 설치하기', sub: 'Ollama·LM Studio, 이미지 생성 AI', tip: '여기부터는 내 컴퓨터가 직접 계산해요. 모델 크기만큼 메모리가 필요해서 사양이 크게 달라져요.' },
        { id: 'game', label: '게임도 할 거예요', sub: '그래픽이 화려한 PC 게임', tip: '게임은 그래픽카드가 핵심이라 무거운 작업이에요. 데스크톱을 권해요.' },
      ],
      tip: { title: '램(RAM)은 ‘작업 책상’이에요', body: ['프로그램을 켜면 책상 위에 펼쳐 놓고 일해요. 책상이 좁으면 서랍(저장공간 SSD)에 넣었다 꺼냈다 하느라 느려지죠.', 'SYNK는 16GB를 가성비 기준점으로 봐요. 아래에서 램 용량을 눌러 책상 크기를 비교해 보세요.'], visual: 'tiers' },
    },
    {
      id: 'video', type: 'group', when: a => (a.uses || []).includes('video'), eyebrow: '영상 편집',
      title: '어떤 영상을 편집하나요?',
      sub: '프로그램과 영상 크기에 따라 필요한 램이 두 배까지 차이 나요.',
      fields: [
        { id: 'app', label: '쓸 프로그램', options: [
          { id: 'capcut', label: '캡컷', tip: '캡컷은 가벼운 편이에요. 공식 최소 사양이 램 4GB예요.' },
          { id: 'premiere', label: '프리미어 프로', tip: '어도비는 윈도우 기준 램 32GB 이상, 그래픽 메모리 4GB 이상을 권해요.' },
          { id: 'resolve', label: '다빈치 리졸브', tip: '윈도우 기준 최소 램 16GB(효과 기능 퓨전을 쓰면 32GB), 그래픽 메모리 4GB 이상이 필요해요. 그래픽카드를 특히 많이 써요.' },
          { id: 'fcp', label: '파이널 컷 프로 (맥 전용)', tip: '맥에서만 돌아가요. 애플은 램 8GB 이상, 16GB를 권해요.' },
          { id: 'unknown', label: '아직 몰라요', tip: '괜찮아요. 처음이면 캡컷으로 시작하는 사람이 많아요. 흔한 기준으로 잡아 드릴게요.' },
        ] },
        { id: 'res', label: '영상 크기', options: [
          { id: 'fhd', label: 'FHD 이하', sub: '쇼츠·릴스·일반 유튜브', tip: 'FHD는 대부분의 SNS 영상 크기예요. 노트북으로도 충분히 편집할 수 있어요.' },
          { id: '4k', label: '4K 이상', sub: '고화질 원본 그대로', tip: '4K는 한 장면이 FHD의 4배예요. 무거운 작업이라 데스크톱을 권해요.' },
        ] },
        { id: 'load', label: '영상 길이와 효과', options: [
          { id: 'light', label: '짧고 효과 적게', sub: '1분 안팎', tip: '짧은 편집은 램 16GB가 가성비예요.' },
          { id: 'heavy', label: '길거나 효과 많이', sub: '10분 이상, 자막·효과 많이', tip: '긴 영상과 많은 효과는 미리보기를 만들 때 메모리를 더 써요. 캡컷이 아니라면 무거운 작업으로 봐요.' },
        ] },
      ],
      tip: { title: '4K는 FHD보다 한 장면이 4배 커요', body: ['FHD는 1920×1080, 4K는 3840×2160이라 한 장면에 담긴 점(픽셀)이 정확히 4배예요.', '편집 프로그램은 앞뒤 장면과 효과를 램과 그래픽 메모리에 올려 두고 미리보기를 만들어요. 그래서 4K부터는 필요한 사양이 크게 올라가요.'], visual: 'res' },
    },
    {
      id: 'photo', type: 'single', when: a => (a.uses || []).includes('photo'), eyebrow: '사진·디자인',
      title: '사진·디자인은 어떤 작업인가요?',
      options: [
        { id: 'web', label: '캔바·피그마 같은 웹 도구', sub: '인터넷 창에서 하는 디자인', tip: '웹 도구는 탭처럼 가벼워요. 램보다 화면 크기가 더 체감돼요.' },
        { id: 'adobe', label: '포토샵·라이트룸', sub: '사진 보정, 합성', tip: '포토샵은 램 최소 8GB, 권장 16GB 이상이에요.' },
        { id: 'heavy', label: '큰 사진을 많이, AI 채우기도', sub: 'RAW 대량 보정, 수십 개 레이어', tip: '파일이 크고 많을수록 램이 더 필요해요. 32GB가 가성비예요.' },
        { id: '3d', label: '3D 작업 (블렌더 등)', sub: '모델링·렌더링', tip: '블렌더는 권장 램 32GB, 그래픽 메모리 8GB예요. 무거운 작업이라 데스크톱을 권해요.' },
      ],
      tip: { title: '사진은 ‘파일 크기 × 여는 개수’가 램을 정해요', body: ['포토샵은 최소 8GB, 권장 16GB 이상이에요. 레이어가 많고 큰 파일을 여러 개 열수록 더 필요해요.', '3D는 차원이 달라요. 블렌더는 권장 램이 32GB, 그래픽 메모리 8GB예요.'] },
    },
    {
      id: 'code', type: 'single', when: a => (a.uses || []).includes('code'), eyebrow: '코딩·앱 만들기',
      title: '어떤 개발을 하나요?',
      options: [
        { id: 'web', label: '웹사이트·자동화·AI 코딩 도구', sub: 'VS Code, Cursor, 터미널', tip: '웹 개발과 AI 코딩 도구는 16GB면 대부분 충분해요.' },
        { id: 'mobile', label: '모바일 앱 (에뮬레이터 사용)', sub: '안드로이드 스튜디오, iOS 시뮬레이터', tip: '에뮬레이터는 컴퓨터 안에 휴대폰을 하나 더 켜는 거예요. 아이폰 앱까지 만들려면 맥이 필요해요.' },
        { id: 'server', label: '서버·도커 여러 개', sub: '컨테이너, 데이터베이스를 함께 띄워요', tip: '컨테이너마다 램을 따로 떼어 줘야 해서 32GB가 가성비예요.' },
      ],
      tip: { title: '에뮬레이터와 도커는 ‘컴퓨터 속 컴퓨터’예요', body: ['휴대폰 에뮬레이터나 도커는 내 컴퓨터 안에 작은 컴퓨터를 하나 더 켜는 거라, 그만큼 램을 따로 떼어 줘야 해요.', '웹 개발만 한다면 16GB로 충분한 경우가 많아요.'] },
    },
    {
      id: 'localai', type: 'multi', when: a => (a.uses || []).includes('localai'), eyebrow: '내 컴퓨터에 AI 설치',
      title: '내 컴퓨터에서 어떤 AI를 돌리고 싶나요?',
      sub: '여러 개면 모두 골라 주세요. 숫자 뒤의 B는 ‘10억 개’라는 뜻이에요.',
      options: [
        { id: 'small', label: '작은 대화 AI (4B~8B)', sub: '가볍게 체험, 요약·번역', tip: '8B 모델은 압축판 파일이 약 5GB라 16GB면 무난해요. 노트북도 괜찮아요.' },
        { id: 'mid', label: '중간 대화 AI (12B~14B)', sub: '조금 더 똑똑한 답이 필요해요', tip: '14B 모델은 약 9GB예요. 무거운 작업이라 데스크톱을 권해요. 맥 미니 24GB가 가성비예요.' },
        { id: 'large', label: '큰 대화 AI (27B~32B)', sub: '웹 AI에 가까운 품질을 원해요', tip: '32B 모델은 약 20GB예요. 맥 미니(M5 Pro) 48GB나, 윈도우라면 그래픽 메모리 24GB급이 필요해요.' },
        { id: 'huge', label: '아주 큰 대화 AI (70B급)', sub: '최고 품질, 비용은 각오했어요', tip: '70B급은 압축판도 43GB예요. 맥 스튜디오급 장비가 필요해서, 웹 AI 구독이 더 경제적일 수 있어요.' },
        { id: 'image', label: '이미지 생성 AI', sub: 'Stable Diffusion·FLUX, ComfyUI', tip: '이미지 생성은 그래픽 메모리가 핵심이에요. 커뮤니티 기준으로 SDXL은 8GB, FLUX는 12~16GB 이상이 편해요.' },
        { id: 'unsure', label: '잘 모르겠어요, 체험해 보고 싶어요', sub: '어떤 게 좋은지부터 알고 싶어요', tip: '처음이면 작은 모델(4B~8B)부터 해 보세요. 16GB면 충분해요.' },
      ],
      tip: { title: '설치형 AI는 ‘모델 전체’를 책상에 올려요', body: ['웹 AI와 달리 내 컴퓨터가 직접 계산해요. 그래서 모델 파일 전체를 램(맥) 또는 그래픽 메모리(윈도우)에 올려야 빨라요.', '광고에서 말하는 NPU·TOPS는 여기서 차이를 만들지 못해요. Ollama·LM Studio는 NPU를 쓰지 않거든요. 메모리 크기가 핵심이에요.'], visual: 'models' },
    },
    {
      id: 'multitask', type: 'single', eyebrow: '쓰는 습관', short: '켜 두는 개수',
      title: '평소에 한꺼번에 몇 개를 켜 두나요?',
      options: [
        { id: 'light', label: '창 몇 개만', sub: '탭 5개 안팎, 하나씩 끝내요', tip: '가볍게 쓰는 편이라 책상이 작아도 괜찮아요.' },
        { id: 'normal', label: '탭 10~20개와 메신저', sub: '카톡·음악도 켜 둬요', tip: '가장 흔한 습관이에요. 이 기준으로 계산할게요.' },
        { id: 'heavy', label: '탭 수십 개, 회의, 작업 프로그램', sub: '전부 켜 두고 오가요', tip: '켜 두는 게 많을수록 책상이 넓어야 해요. 한 단계 넉넉히 잡을 수 있어요.' },
      ],
      tip: { title: '책상이 가득 차면 서랍을 오가느라 느려져요', body: ['램이 모자라면 컴퓨터는 당장 안 쓰는 걸 저장공간(SSD)으로 잠깐 옮겨요. SSD는 램보다 훨씬 느려서, 창을 바꿀 때마다 멈칫하게 되죠.', '지금 얼마나 쓰는지는 윈도우는 작업 관리자 → 성능 → 메모리, 맥은 활성 상태 보기 → 메모리에서 볼 수 있어요.'], visual: 'swap' },
    },
    {
      id: 'current', type: 'group', when: a => ['have', 'extra'].includes(a.owned), eyebrow: '지금 컴퓨터', short: '지금 컴퓨터 사양',
      title: '지금 컴퓨터는 어떤가요?',
      sub: '모르는 칸은 ‘모르겠어요’를 골라도 괜찮아요.',
      fields: [
        { id: 'kind', label: '종류', options: [
          { id: 'laptop', label: '노트북', tip: '작업이 무거우면 이 노트북은 밖에서 계속 쓰고 데스크톱을 더하는 쪽을 알려 드릴게요.' },
          { id: 'desktop', label: '데스크톱', tip: '데스크톱이면 램만 더 꽂는 싼 방법이 있는지도 볼게요.' },
        ] },
        { id: 'ram', label: '램 용량', options: [
          { id: '4', label: '4GB' }, { id: '8', label: '8GB' }, { id: '16', label: '16GB' }, { id: '32', label: '32GB 이상' },
          { id: 'unknown', label: '모르겠어요', tip: '윈도우는 설정 → 시스템 → 정보 → ‘설치된 RAM’, 맥은 애플 메뉴 → 이 Mac에 관하여 → ‘메모리’에서 볼 수 있어요.' },
        ] },
        { id: 'os', label: '운영체제', options: [
          { id: 'win11', label: '윈도우 11' },
          { id: 'win10', label: '윈도우 10', tip: '윈도우 10은 2025년 10월 14일에 일반 지원이 끝났어요. 결과에서 확인 방법을 알려 드릴게요.' },
          { id: 'mac_as', label: '맥 (M1 이후)' },
          { id: 'mac_intel', label: '맥 (인텔)', tip: '인텔 맥은 macOS 26 Tahoe가 마지막 macOS예요.' },
          { id: 'unknown', label: '모르겠어요' },
        ] },
        { id: 'feel', label: '하려는 일을 해 보니', options: [
          { id: 'ok', label: '잘 돼요', tip: '잘 된다면 서두를 필요 없어요. 결과에서 지금 컴퓨터로 되는 일을 먼저 보여 드릴게요.' },
          { id: 'slow', label: '느리거나 멈춰요', tip: '느린 원인이 램이 아닐 수도 있어요. 결과에서 먼저 확인할 것을 알려 드릴게요.' },
          { id: 'untried', label: '아직 안 해 봤어요', tip: '사기 전에 지금 컴퓨터로 한 번 해 보는 게 가장 정확한 시험이에요.' },
        ] },
      ],
      tip: { title: '내 컴퓨터 램, 1분이면 확인해요', body: ['윈도우: 시작 → 설정 → 시스템 → 정보 → ‘설치된 RAM’.', '맥: 화면 왼쪽 위 애플 메뉴 → 이 Mac에 관하여 → ‘메모리’.'] },
    },
    {
      id: 'place', type: 'single', eyebrow: '들고 다니는 정도',
      title: '컴퓨터를 얼마나 들고 다니나요?',
      sub: '무거운 작업이 아니라면, 이 답으로 데스크톱과 노트북을 정해요.',
      options: [
        { id: 'home', label: '거의 책상에서만', sub: '집·사무실에서 옮길 일이 거의 없어요', tip: '그럼 데스크톱이 가성비예요. 같은 돈에 더 강하고, 램도 나중에 늘릴 수 있어요.' },
        { id: 'both', label: '가끔 들고 나가요', sub: '일주일에 한두 번 밖에서도 써요', tip: '노트북에 집에서는 모니터를 연결하는 조합이 편해요. 단, 작업이 무거우면 데스크톱을 권해요.' },
        { id: 'carry', label: '자주 들고 다녀요', sub: '학교·카페·출장이 많아요', tip: '무게와 배터리도 중요해요. 단, 작업이 무거우면 들고 다녀도 데스크톱을 권해요.' },
      ],
      tip: { title: '무거운 작업이면 들고 다녀도 데스크톱이에요', body: ['4K 편집·3D·AI 설치·게임 같은 무거운 작업은 노트북이 불리해요. 같은 이름의 그래픽이라도 노트북용이 더 약하고(RTX 5070: 코어 4,608개 대 6,144개), 오래 쓰면 열 때문에 속도를 낮춰요.', '노트북은 램·그래픽카드를 나중에 바꿀 수 없어요. 밖에서는 가진 기기로 가벼운 일을 하고, 무거운 작업은 데스크톱에서 하는 게 가성비예요.'] },
    },
    {
      id: 'os', type: 'single', eyebrow: '운영체제',
      title: '맥과 윈도우 중 어느 쪽이 편하세요?',
      options: [
        { id: 'mac', label: '맥이 편해요', sub: '아이폰과 함께 쓰기 좋아요', tip: '맥은 그래픽카드를 고를 필요가 없어요. 대신 메모리를 나중에 늘릴 수 없으니 처음에 알맞게 골라 드릴게요.' },
        { id: 'win', label: '윈도우가 편해요', sub: '쓰던 프로그램·게임이 윈도우용이에요', tip: '윈도우는 선택지가 많아요. 필요한 만큼만 고르도록 도와 드릴게요.' },
        { id: 'any', label: '상관없어요, 골라 주세요', sub: '용도에 맞춰 가성비로 추천해 주세요', tip: '대화 AI는 맥, 이미지 생성과 게임은 윈도우가 유리해요. 고른 작업으로 정할게요.' },
      ],
      tip: { title: '맥은 램을 그래픽과 함께 써요', body: ['맥의 ‘통합 메모리’는 CPU와 그래픽이 한 책상을 같이 써요. 큰 AI 모델을 올리기 유리하지만, 램이 곧 그래픽 메모리라 처음부터 알맞게 골라야 해요.', '윈도우는 램과 그래픽카드 메모리(VRAM)가 따로예요. 이미지 생성처럼 그래픽을 많이 쓰는 AI는 엔비디아 그래픽카드가 유리해요.'], visual: 'pool' },
    },
    {
      id: 'budget', type: 'single', eyebrow: '예산',
      title: '총예산은 어느 정도인가요?',
      sub: '모니터·키보드 같은 추가 비용까지 합친 금액이에요.',
      options: [
        { id: 'lt100', label: '100만 원 미만', tip: '가성비 추천을 그대로 따르면 돼요. 무거운 작업이라면 대안도 알려 드릴게요.' },
        { id: '100_150', label: '100~150만 원', tip: '대부분의 가벼운·중간 작업은 이 범위에서 가성비 추천을 맞출 수 있어요.' },
        { id: '150_250', label: '150~250만 원', tip: '무거운 작업도 가성비 추천은 가능한 범위가 많아요. 그래픽카드 값은 오늘 가격을 꼭 확인하세요.' },
        { id: 'gt250', label: '250만 원 이상', tip: '여유가 있으면 ‘여유가 되면’ 선택도 함께 보세요. 다다익선이에요.' },
        { id: 'unknown', label: '아직 모르겠어요', sub: '사양부터 보고 정할게요', tip: '사양을 먼저 보고, 결과의 프롬프트로 오늘 가격을 확인해 보세요.' },
      ],
      tip: { title: '2026년엔 램과 그래픽카드가 비싸졌어요', body: ['AI 데이터센터가 메모리를 대량으로 사들이면서, 일반 램(DDR5)과 그래픽 메모리(GDDR7) 값이 크게 올랐어요. TrendForce는 2026년 2분기 D램 계약 가격이 약 60% 올랐다고 봤어요.', '그래서 필요한 만큼 정확히 고르는 게 가장 큰 절약이에요. 결과에서 왜 비싼지와 어디에 먼저 돈을 쓸지 자세히 알려 드릴게요.'], src: 'trendforce' },
    },
  ];

  return Object.freeze({
    id: 'brief.computer', version: 2, checked: CHECKED,
    series: 'synkbrief 기초', title: 'AI 컴퓨터 맞춤 추천',
    intro: {
      eyebrow: 'synkbrief 기초 · 맞춤 추천',
      title: 'AI 하려고 컴퓨터 사기 전에,<br>내게 맞는 <span class="hl">사양부터</span> 알아봐요',
      lead: '몇 가지만 고르면 데스크톱인지 노트북인지, 램·저장공간·그래픽은 얼마나 필요한지 가성비 기준으로 계산해 드려요. 고르는 동안 ‘왜 그런지’와 ‘왜 비싼지’도 알려 드릴게요.',
      meta: ['약 1분', '고른 만큼 질문 6~11개', '가성비 기준', '로그인 없음'],
      privacy: '고른 내용은 이 기기에만 저장돼요. AI를 부르지 않고 이 화면 안에서 계산해요.',
      start: '시작하기',
    },
    steps, SOURCES, TIPS, COMPONENTS,
    guidePdf: 'guide.pdf',
    channels: { instagram: 'https://www.instagram.com/synkbrief/', youtube: 'https://www.youtube.com/@synkbrief' },
  });
});
