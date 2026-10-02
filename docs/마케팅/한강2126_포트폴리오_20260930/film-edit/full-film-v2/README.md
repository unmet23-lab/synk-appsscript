# SYNK 전체 영상 편집 준비본 v2

## 현재 상태

**2026-09-30: 콘티·주인공 보존 정정으로 전체 조립·렌더 보류.** `edit-plan.json`의 `cuts`는 비어 있다. 현재 `index.html`은 PULSE 5초의 기술 확인용이며 전체 영상 또는 장면 채택본이 아니다.

- HyperFrames 0.8.96 기존 설치를 재사용한다. 중복 패키지를 설치하지 않았다.
- 원본 HEVC를 별도 H.264 사본으로 정규화하고 원본 오디오·원본 파일은 보존했다.
- VR·까몽·휴대폰·강 소스의 이전 후보 구간은 `reuse-ranges.json`에 기록했으며 최종 승인으로 확대하지 않는다.
- 현재 `BRIEF.md`, `STORYBOARD-DELTA-REVIEW.md`, `EDITLOG.md`를 함께 확인한다.

## 확인된 기술 결과

- PULSE 5초: HyperFrames check 오류 0·경고 0, runtime/layout 오류 0.
- 0·1·2.5·4.5초 스냅샷 생성, 1·4.5초 실제 인물 프레임 확인.
- Studio 브라우저 재생이 0초에서 5초 끝까지 진행함을 확인했다. 직접 청취·전체 필름 품질 검증을 뜻하지 않는다.
- 준비된 기술 미리보기: `http://localhost:3151/#project/full-film-v2` (서버가 실행 중일 때).

## 재개할 때

담당자가 콘티와 인물 일치 여부를 확인한 소스와 정확한 프레임 구간을 주면 `edit-plan.json`을 갱신한다. `inFrame` 포함·`outFrame` 제외, 24fps 기준이다. 영상 소리도 같은 source in/out으로 자른다. 까몽 2배속 등 속도는 `playbackRate`에 기록한다.

```powershell
node scripts/build-edit.mjs --assets-only
npm run adopt
npm run build
node scripts/hf.mjs timeline --json
npm run check
node scripts/hf.mjs preview --background --port 3151
```

전체 컷 확인 후 공식 HyperFrames 렌더를 사용한다. `scripts/hf.mjs`는 기존 설치 중 프로젝트의 0.8.96 버전만 찾아 실행하며 패키지를 자동 설치하지 않는다. 최종 범위가 없는 상태에서는 `npm run build`와 렌더 전 빌드가 실패하도록 구성했다.

별도 음악·TTS·유료 생성은 수행하지 않았다. 사용자 지시를 반영한 소스가 준비되기 전 기존 후보를 이어 붙여 완성본으로 내지 않는다.
