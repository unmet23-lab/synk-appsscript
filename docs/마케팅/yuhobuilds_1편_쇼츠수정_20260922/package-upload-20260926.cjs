'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=__dirname,output=path.join(base,'업로드_최종_20260926'),audit=path.join(base,'검수/업로드_20260926');
const report=JSON.parse(fs.readFileSync(path.join(audit,'final-validation.json'),'utf8'));
const captions=JSON.parse(fs.readFileSync(path.join(audit,'final-captions.json'),'utf8'));
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let html=fs.readFileSync(path.join(base,'_src_preview.html'),'utf8')
 .replaceAll('yuhobuilds_EP01.mp4','yuhobuilds_EP01_FINAL_1080x1920.mp4')
 .replaceAll('poster.png','yuhobuilds_EP01_COVER.png').replaceAll('captions.srt','yuhobuilds_EP01_자막.srt')
 .replace('번역만 하려던 사람의 첫 앱 도전 · yuhobuilds</title>','1편 업로드 최종본 · yuhobuilds</title>')
 .replace('76초 · 정의로 임시 내레이션 · 괴상한 앱 대사·눈물 수정본','73초 · 1080 × 1920 · 업로드용 최종본 · 2026.09.26')
 .replace('영상 다운로드','업로드할 MP4').replace('수정한 장면','고군분투 장면')
 .replace('<!-- CAPTIONS_CONTENT -->',captions.map(c=>`<p class="caption"><span class="caption-time">${new Date(c.startMs).toISOString().slice(14,19)}</span><span>${escape(c.text)}</span></p>`).join('\n'));
fs.writeFileSync(path.join(output,'_src_preview.html'),html);
html=require(path.join(base,'../../../tools/lib/브랜드폰트.js')).심기(html).html;
fs.writeFileSync(path.join(output,'preview.html'),html);
const guide=`# yuhobuilds 1편 · 오늘 업로드할 파일

**영상: [yuhobuilds_EP01_FINAL_1080x1920.mp4](yuhobuilds_EP01_FINAL_1080x1920.mp4)**

- 길이 ${report.durationSeconds.toFixed(3)}초, 세로 1080×1920, 30fps, H.264/AAC.
- 음성·배경음악·효과음·화면 자막이 영상에 모두 들어 있다.
- 표지는 [yuhobuilds_EP01_COVER.png](yuhobuilds_EP01_COVER.png).
- [별도 자막](yuhobuilds_EP01_자막.srt)은 플랫폼의 선택형 자막 기능이 필요할 때 사용하는 파일이다. 화면 자막을 추가로 굽는 용도가 아니다.
- [미리보기](preview.html)와 MP4는 같은 폴더에 두면 된다. 서버 접속이 안 되면 MP4를 직접 열어 재생할 수 있다.

## 이번 마감

2편이 AI 추천을 비교하고 선택하는 이야기로 완성돼, 이전의 ‘다음 편엔 설정부터’ 예고 3.133초를 제거했다. ‘불편한 일 하나’ → ‘제가 헤맨 길, 여러분은 건너뛰세요’ → ‘왕초보에서 1인 기업가까지, 여러분의 시간을 아껴드립니다’로 마친다. 대사·타이핑·표정·농담은 기존 내용을 유지했다. 연결부 자막을 정리하고 배경음악과 페이드아웃을 새 길이에 맞췄다.

기존 76초 MP4와 제작 원본은 상위 폴더에 보존했다. 새 음성 합성이나 외부 업로드는 하지 않았다.

## 파일 검수

- 전체 프레임·오디오 디코딩 성공, 검은 구간 없음, 재생 시작용 메타데이터 앞부분 배치 확인.
- ${report.captionCount}개 자막의 원고 일치·시간 범위·겹침 검사 통과.
- 원고에서 삭제한 예고 외의 내레이션 PCM은 기존 음성과 일치.
- 타이핑 끝과 실제 예시 발화 끝의 차이 ${report.typingErrorMs}ms, 한 프레임 이내.
- 최종 AAC ${report.loudness.input_i} LUFS, true peak ${report.loudness.input_tp} dBTP.
- 실제 MP4에서 추출한 34개 화면으로 17개 장면과 시작·엔딩을 확인했다. 브라우저의 영상 진행과 마지막 화면·정상 종료도 확인했다.
- 직접 청취 평가는 별도이며, 음량 수치 검사와 구분한다. 최종 시청 승인 및 게시 여부를 대신하지 않는다.

상세 기록: [최종 검수 JSON](../검수/업로드_20260926/final-validation.json). 실제 출력 화면·브라우저 재생 확인 결과도 여기에 기록한다.

영상 SHA-256: \`${report.sha256}\`
`;
fs.writeFileSync(path.join(output,'전달안내.md'),guide);
const fileNames=['yuhobuilds_EP01_FINAL_1080x1920.mp4','yuhobuilds_EP01_COVER.png','yuhobuilds_EP01_자막.srt'];
fs.writeFileSync(path.join(output,'파일확인.json'),JSON.stringify(fileNames.map(name=>({name,bytes:fs.statSync(path.join(output,name)).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(output,name))).digest('hex')})),null,2));
console.log('Delivery preview, guide and checksums prepared.');
