# SYNK 브랜드 오프닝 — 현재 v5

2026-10-09. 승인 synk 펠트 로고 뒤, 몽글·까몽·마린과 한국 풍경을 한 장면으로 새로 생성한 Vertex Veo 타이틀을 연결한다. ‘게임 스타트’와 ‘© 2027 SYNK’는 별도 텍스트다. 공개 배포 없이 로컬 개발판과 전달용 영상을 준비했다.

## 현재 결과

- [세로 WORLD 연결](renders/SYNK_WORLD_opening_Veo31_felt_v5_1080x1920.mp4): 1080×1920, 10.6초.
- [가로 WORLD 연결](renders/SYNK_WORLD_opening_Veo31_felt_v5_1920x1080.mp4): 1920×1080, 10.6초.
- [세로 회사 단독](renders/SYNK_company_opening_candidate_1080x1920.mp4): 기존 승인 로고 연출, 2.6초.
- [가로 회사 단독](renders/SYNK_company_opening_candidate_1920x1080.mp4): 기존 승인 로고 연출, 2.6초.

합본은 H.264 30fps와 후보 사운드 AAC다. 배경 원본은 Vertex `veo-3.1-generate-001`, 각각 1080p/24fps/8초의 최대 초기 길이다. 첫·마지막 이미지를 지정해 장면 전체를 생성했다. 얼굴·머리·배를 따로 덧붙이는 합성이나 역재생은 없다. 웹 사본에는 1초 간격 키프레임을 넣는 인코딩만 적용했다.

가까운 나무와 잎이 강 위의 배를 가리고, 배는 끝까지 지나간 뒤 사라진다. 마린은 머리 하나와 노란 펠트 부분, 몽글은 입 없는 원래 얼굴을 유지한다. 모바일은 배가 없는 7~8초, PC는 6~8초 구간만 반복한다. 이 반복 정책과 클릭 후 게임 입구 연결은 [공통 웹 런타임](../../experiences/brand-opening/README.md)이 담당한다. MP4에는 전체 한 번의 이동이 들어 있다.

## 원고와 재현

기본 세로 원고는 [index.html](index.html), 가로는 [compositions/landscape.html](compositions/landscape.html)이다. 회사 단독 원고는 `compositions/logo-outro.html`과 `compositions/company-landscape.html`에 있다. [BRIEF.md](BRIEF.md), [shot-plan.json](shot-plan.json), [자산 기록](assets/index.md)이 현재 범위를 설명한다.

HyperFrames 0.8.143, GSAP 3.14.2와 로컬 브랜드 서체를 사용한다. 정상 설치된 공식 CLI 경로로 실행했으며 현재 버전 점검에서 같은 0.8.143을 확인했다.

```powershell
npx --yes hyperframes@0.8.143 check .
npx --yes hyperframes@0.8.143 render . --quality delivery -o renders/SYNK_WORLD_opening_Veo31_felt_v5_1080x1920.mp4
npx --yes hyperframes@0.8.143 render . -c compositions/landscape.html --quality delivery -o renders/SYNK_WORLD_opening_Veo31_felt_v5_1920x1080.mp4
```

Studio는 [localhost:3002](http://localhost:3002/#project/synk-brand-opening)에 있다. 일반 HTML만 복사하면 자산이 빠진다. 소스를 편집할 때는 프로젝트 폴더 전체, 단순 재생에는 MP4를 전달한다.

## 확인과 이전 버전

가로·세로 `check` 통과 기록은 `check-felt-v5-portrait.json`과 `check-felt-v5-landscape.json`이다. 로고의 2MB inline 한도 경고는 원본을 자르거나 축소하지 않고 파일 사본을 함께 두어 해결한다. Studio 그룹 구조·독립 원고의 로컬 타이밍에 관한 권고가 남아 있으며 현재 재생·글자 배치 오류로 판정된 항목은 없다.

실제 원본 MP4를 순서대로 디코딩해 반초 간격 17개씩의 얼굴·배·전체 장면을 확인했다. [시각 검수](../../experiences/brand-opening/qa/felt-v5/visual-review.json)와 `qa/felt-v5/`에 증거가 있다. 웹 시작 흐름은 Edge 4가지 화면 크기의 69개 검사에서 JavaScript 오류·누락 자료 0을 확인했다. 출력 MP4의 끝 재생과 코덱·프레임 검사는 [재생 기록](../../experiences/brand-opening/qa/video-playback.json)에 남긴다.

v1은 실제 3D 캡처를 쓴 최초 시안, v2는 첫 Veo 출력이다. v3 얼굴·배 합성본은 사용자가 보고한 머리 겹침·잘못된 가림으로 제외했다. v4의 네이티브 연장도 펠트 재질 변화와 새 배 출현으로 제외했다. 이 파일들은 기록으로만 보존하며 현재 시작 화면에는 v5를 연결한다.

이 타이틀 풍경은 게임플레이 3D 그래픽의 완성을 뜻하지 않는다. Unity·Unreal·Atlas 로고는 사용하지 않았다. 후보 WAV의 사운드 정본 채택·스피커 청취와 물리 휴대폰·스토어·공개 배포는 이번 로컬 검수와 별개다.

최신 [전달 ZIP](../../experiences/brand-opening/delivery/SYNK_오프닝준비_v5_20261009.zip)은 현재 MP4 네 개와 웹 코드·자산·검수 기록을 포함한다. 35개 자료의 내부 해시를 확인했다. 실제 출력의 3·10·마지막 프레임은 `snapshots/felt-v5-portrait/`와 `snapshots/felt-v5-landscape/`에서 점검했으며 저작권 문구가 아래쪽에 위치함을 확인했다. 네 MP4 모두 끝 재생·media error 0, 회사 78프레임·WORLD 318프레임을 확인했다. 최종 캡처는 두 비율 모두 hardware GPU / screenshot 경로이며, 메모리 부담을 줄이기 위해 한 작업자로 출력했다.
