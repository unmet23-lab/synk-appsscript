# 관용구 퀴즈 #2 · 나라별 채널판(10-18)

유호님 「똑같은 내용으로 언어만 해당 나라 언어로」. 26개 채널, 영상 36초 1080×1920, 소리 −14.2 LUFS. 영어 채널은 @synkkorean 영어판에 끝 계정만 바꿨고, 나머지는 화면 글을 그 나라 말로 바꾸고 나레이션은 한국어로만 말하는 몽골어판 소리를 그대로 쓴다.
폴더마다 `video.mp4`(git 밖) · `upload.mp4`(크롬 확장 올리기 10MB 제한용 2Mbps 사본, 7.3MB 안팎, 원본과 SSIM 0.996) · `cover.png`(1.3초, 오답 딱지 장면) · `게시문안.txt`. 문안 정본은 `문안.json`, 화면 글 정본은 `remotion/src/kids/locales.ts`.
검토: 초안(Claude) → Fable 교정 → 제미나이 검문(문법 아르곤 · 직역 역번역 flash, `tools/현지어대조.js`, 결과 `검문/`) → 역번역 뜻 대조(`검문/뜻대조.txt`). 원어민 검수는 없다. 싱할라어 ZWJ 지적은 바이트로 확인한 오판.
다시 만들기: `cd remotion && node 현지어_렌더.mjs [cc …]` → `node 현지어_게시묶음.mjs`.

| 채널 | 플랫폼 | 끝 화면 계정 | 화면 글 | 영상 |
|---|---|---|---|---|
| lab-us-youtube | 유튜브 쇼츠 | @synklabusa | English | 14.8MB |
| lab-au-youtube | 유튜브 쇼츠 | @synklabaustralia | English | 14.8MB |
| lab-nz-youtube | 유튜브 쇼츠 | @synklabnewzealand | English | 14.8MB |
| lab-ca-youtube | 유튜브 쇼츠 | @synklabcanada | English | 14.8MB |
| lab-ph-youtube | 유튜브 쇼츠 | @synklabphilippines | Filipino (Taglish) | 15.0MB |
| lab-py-youtube | 유튜브 쇼츠 | @synklabparaguay | español (Paraguay · México) | 14.9MB |
| lab-mx-youtube | 유튜브 쇼츠 | @synklabmexico | español (Paraguay · México) | 14.9MB |
| lab-br-youtube | 유튜브 쇼츠 | @synklabbrasil | português (Brasil) | 15.1MB |
| lab-tw-youtube | 유튜브 쇼츠 | @synklabtaiwan | 繁體中文 (台灣) | 14.6MB |
| lab-jp-youtube | 유튜브 쇼츠 | @synklabjapan | 日本語 | 14.7MB |
| lab-vn-youtube | 유튜브 쇼츠 | @synklabvietnam | Tiếng Việt | 14.7MB |
| lab-th-youtube | 유튜브 쇼츠 | @synklabthailand | ภาษาไทย | 14.5MB |
| lab-id-youtube | 유튜브 쇼츠 | @synklabindonesia | Bahasa Indonesia | 15.0MB |
| lab-my-youtube | 유튜브 쇼츠 | @synklabmalaysia | Bahasa Melayu | 14.9MB |
| lab-in-youtube | 유튜브 쇼츠 | @synklabindia | हिन्दी | 14.6MB |
| lab-kg-youtube | 유튜브 쇼츠 | @synklabkyrgyzstan | кыргызча | 15.0MB |
| lab-lk-youtube | 유튜브 쇼츠 | @synklabsrilanka | සිංහල | 16.1MB |
| lab-mm-youtube | 유튜브 쇼츠 | @synklabmyanmar | မြန်မာ | 15.1MB |
| lab-ru-rutube | 루튜브 | SYNK LAB Russia | русский (Rutube) | 14.9MB |
| lab-np-facebook | 페이스북 릴스 | @synklab.np | नेपाली (Facebook) | 14.6MB |
| lab-kh-facebook | 페이스북 릴스 | SYNK LAB Cambodia | ភាសាខ្មែរ (Facebook) | 14.7MB |
| lab-lk-facebook | 페이스북 릴스 | SYNK LAB Sri Lanka | සිංහල | 16.1MB |
| lab-mm-tiktok | 틱톡 | @synklab.mm | မြန်မာ | 15.1MB |
| lab-vn-tiktok | 틱톡 | @synklab.vn | Tiếng Việt | 14.7MB |
| lab-uz-telegram | 텔레그램 | @synklab_uz | oʻzbekcha (Telegram) | 14.9MB |
| lab-cn-xiaohongshu | 샤오훙수 | SYNK LAB | 简体中文 (小红书) | 14.6MB |
