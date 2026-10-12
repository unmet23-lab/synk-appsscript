# 완료 기록 PDF 의존 파일

2026-10-13. 운영 실행에는 이 폴더의 `pdfkit.cjs`, `SUIT-Regular.otf`만 필요하다. Node의 기본 모듈을 사용하며 시스템 폰트, Chromium, Python, 저장소 루트의 `node_modules`, 개발 PC 절대경로는 사용하지 않는다. 실제 복사 경로 실행은 Windows Node 24에서 확인했으며 Linux 실기동은 별도다.

- PDFKit 0.20.2와 전이 의존성을 esbuild 0.28.1의 Node 22 대상 CommonJS 단일 번들로 고정했다. 정확한 버전·무결성은 `package-lock.json`, 번들 입력은 `bundle-inputs.json`에 있다. 이 폴더의 package manifest는 재생성용이며 운영 시 `npm install`은 필요 없다.
- SUIT는 기존 `docs/브랜드_폰트/SUIT/SUIT-Regular.otf`를 변경 없이 복사했다. `SUIT-OFL.txt`를 함께 보존한다.
- `THIRD-PARTY-LICENSES.txt`에 각 패키지에 포함된 라이선스·저작자 고지를 모았다. fontkit/dfa는 upstream에 별도 LICENSE 파일이 없어 패키지 README의 MIT 선언과 package.json 저작자 정보를 보존했다. brotli의 README MIT 선언과 decoder 소스의 Apache 2.0 고지·전문을 함께 포함했다. 이 예외는 실제 upstream 배포 상태이며 새로운 라이선스 주장을 추가하지 않았다.

재생성은 별도 임시 폴더에 이 폴더의 `package.json`·`package-lock.json`을 복사한 뒤 `npm ci --ignore-scripts --no-audit --no-fund`로 고정 의존성을 준비한다. 저장소 루트의 esbuild를 이용해 해당 임시 폴더의 `node_modules/pdfkit/js/pdfkit.js`를 진입점으로 `bundle:true, platform:'node', target:'node22', format:'cjs', minify:true, legalComments:'eof'` 옵션으로 `pdfkit.cjs`에 출력한다. 라이선스와 입력 목록을 갱신하고 `client-completion-records-renderer.test.mjs`를 실행한다. 생성 PDF는 실제 페이지 렌더링으로 확인한다.

공식 근거: [PDFKit 시작·페이지 번호·폰트](https://pdfkit.org/docs/getting_started.html), [텍스트 줄바꿈·높이 제한의 잘림 동작](https://pdfkit.org/docs/text.html), [PDFKit MIT 원문](https://github.com/foliojs/pdfkit/blob/master/LICENSE), [fontkit의 별도 LICENSE 부재 이슈](https://github.com/foliojs/fontkit/issues/255). 2026-10-13 확인.

본문에는 고정 높이나 말줄임을 사용하지 않는다. PDFKit 푸터가 본문 여백 때문에 빈 페이지를 추가하지 않도록 푸터를 쓰는 동안만 해당 페이지의 하단 여백을 해제한다. 내장 폰트가 지원하지 않는 문자는 `[U+코드]`로 명시하며 CSV에는 원래 문자를 유지한다. PDF/A 적합성이나 PDF 암호화를 구현했다고 주장하지 않는다.
