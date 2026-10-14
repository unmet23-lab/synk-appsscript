# Build on the same Debian ABI as the runtime. Bookworm's FFmpeg 5.1 lacks
# the seekable fd protocol used by delivery-file-inspection.mjs.
# SYNK_FFMPEG_BUILD_BEGIN
FROM node:24-bookworm-slim AS synk-ffmpeg-build
USER root
RUN set -eu; \
    apt-get update; \
    apt-get install -y --no-install-recommends build-essential pkg-config nasm ca-certificates curl gnupg xz-utils libx264-dev libvpx-dev libdav1d-dev zlib1g-dev; \
    rm -rf /var/lib/apt/lists/*; \
    mkdir -p /tmp/synk-ffmpeg/gnupg /opt/synk-ffmpeg/bin /opt/synk-ffmpeg/share; \
    chmod 700 /tmp/synk-ffmpeg/gnupg; \
    cd /tmp/synk-ffmpeg; \
    curl --proto '=https' --tlsv1.2 --fail --silent --show-error --connect-timeout 20 --max-time 180 --output ffmpeg-7.1.5.tar.xz https://ffmpeg.org/releases/ffmpeg-7.1.5.tar.xz; \
    curl --proto '=https' --tlsv1.2 --fail --silent --show-error --connect-timeout 20 --max-time 60 --output ffmpeg-7.1.5.tar.xz.asc https://ffmpeg.org/releases/ffmpeg-7.1.5.tar.xz.asc; \
    curl --proto '=https' --tlsv1.2 --fail --silent --show-error --connect-timeout 20 --max-time 60 --output ffmpeg-devel.asc https://ffmpeg.org/ffmpeg-devel.asc; \
    printf '%s\n' 'de668509caf9e35e3cd162473441fdb29538c6d96ed080292b3cf9e6fc5d558f  ffmpeg-7.1.5.tar.xz' '7ce4b9d56e3ef0cd4c3a9c0b2c8a034ac91e6c4c011c1f10b05a8aa7292fca35  ffmpeg-7.1.5.tar.xz.asc' '397b3becedcd5a98769967ff1ff8501ddc89f8368b8f766e4701377d7dbaabe5  ffmpeg-devel.asc' | sha256sum --check --strict; \
    gpg --batch --homedir /tmp/synk-ffmpeg/gnupg --import ffmpeg-devel.asc; \
    gpg --batch --homedir /tmp/synk-ffmpeg/gnupg --status-fd 1 --verify ffmpeg-7.1.5.tar.xz.asc ffmpeg-7.1.5.tar.xz > signature.status; \
    grep -q '^\[GNUPG:\] VALIDSIG FCF986EA15E6E293A5644F10B4322F04D67658D8 ' signature.status; \
    tar -xf ffmpeg-7.1.5.tar.xz; \
    cd ffmpeg-7.1.5; \
    ./configure --prefix=/opt/synk-ffmpeg --disable-autodetect --disable-doc --disable-debug --disable-ffplay --disable-shared --enable-static --enable-gpl --enable-libx264 --enable-libvpx --enable-libdav1d --enable-zlib --disable-network --disable-protocols --enable-protocol=file,pipe,fd --disable-indevs --enable-indev=lavfi --disable-outdevs --disable-encoders --enable-encoder=libx264,libvpx_vp9,aac,png,mjpeg,rawvideo,wrapped_avframe --disable-filters --enable-filter=aformat,anull,aresample,atrim,asetpts,color,crop,format,hflip,null,pad,rotate,scale,setsar,setpts,sine,testsrc2,transpose,trim,vflip; \
    make -j2 ffmpeg ffprobe; \
    install -m 0755 ffmpeg ffprobe /opt/synk-ffmpeg/bin/; \
    install -m 0644 COPYING.GPLv2 /opt/synk-ffmpeg/share/; \
    printf '%s\n' '{"version":"7.1.5","sourceUrl":"https://ffmpeg.org/releases/ffmpeg-7.1.5.tar.xz","sourceSha256":"de668509caf9e35e3cd162473441fdb29538c6d96ed080292b3cf9e6fc5d558f","signatureSha256":"7ce4b9d56e3ef0cd4c3a9c0b2c8a034ac91e6c4c011c1f10b05a8aa7292fca35","keySha256":"397b3becedcd5a98769967ff1ff8501ddc89f8368b8f766e4701377d7dbaabe5","signerFingerprint":"FCF986EA15E6E293A5644F10B4322F04D67658D8","signatureVerified":true,"runtimePackages":["libx264-164","libvpx7","libdav1d6","zlib1g"]}' > /opt/synk-ffmpeg/share/source.json
# SYNK_FFMPEG_BUILD_END
FROM node:24-bookworm-slim
# SYNK_FFMPEG_RUNTIME_BEGIN
RUN apt-get update && apt-get install -y --no-install-recommends libx264-164 libvpx7 libdav1d6 zlib1g && rm -rf /var/lib/apt/lists/*
COPY --from=synk-ffmpeg-build /opt/synk-ffmpeg/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=synk-ffmpeg-build /opt/synk-ffmpeg/bin/ffprobe /usr/local/bin/ffprobe
COPY --from=synk-ffmpeg-build /opt/synk-ffmpeg/share/ /usr/local/share/synk-ffmpeg/
# SYNK_FFMPEG_RUNTIME_END
ENV NODE_ENV=production SYNK_COMPANY_HOST=0.0.0.0 SYNK_COMPANY_PORT=4191 SYNK_COMPANY_DATA=/data MESSENGER_DATA_DIR=/data/messenger
WORKDIR /workspace
# Runtime sources and current authenticated guides only. Private data stays on /data.
COPY ["docs/마케팅/온라인마케팅지도/engagement/analytics.mjs","/workspace/docs/마케팅/온라인마케팅지도/engagement/analytics.mjs"]
COPY ["docs/마케팅/온라인마케팅지도/engagement/company/*.mjs","/workspace/docs/마케팅/온라인마케팅지도/engagement/company/"]
COPY ["docs/마케팅/온라인마케팅지도/engagement/company/vendor/completion-pdf/pdfkit.cjs","docs/마케팅/온라인마케팅지도/engagement/company/vendor/completion-pdf/SUIT-Regular.otf","docs/마케팅/온라인마케팅지도/engagement/company/vendor/completion-pdf/SUIT-OFL.txt","docs/마케팅/온라인마케팅지도/engagement/company/vendor/completion-pdf/THIRD-PARTY-LICENSES.txt","/workspace/docs/마케팅/온라인마케팅지도/engagement/company/vendor/completion-pdf/"]
COPY ["docs/마케팅/온라인마케팅지도/engagement/company/workroom-guide.json","docs/마케팅/온라인마케팅지도/engagement/company/content-catalog.json","docs/마케팅/온라인마케팅지도/engagement/company/benchmark-upload-template.json","/workspace/docs/마케팅/온라인마케팅지도/engagement/company/"]
COPY ["docs/마케팅/온라인마케팅지도/engagement/company/BENCHMARK_RESEARCH_PROMPT.md","/workspace/docs/마케팅/온라인마케팅지도/engagement/company/BENCHMARK_RESEARCH_PROMPT.md"]
COPY ["docs/마케팅/온라인마케팅지도/engagement/company/public","/workspace/docs/마케팅/온라인마케팅지도/engagement/company/public"]
COPY ["docs/마케팅/온라인마케팅지도/engagement/company/deploy/healthcheck.mjs","/workspace/docs/마케팅/온라인마케팅지도/engagement/company/deploy/healthcheck.mjs"]
COPY ["tools/company-messenger/server.mjs","tools/company-messenger/drive-storage.mjs","tools/company-messenger/company-integration.mjs","tools/company-messenger/collaboration-service.mjs","tools/company-messenger/productivity-service.mjs","tools/company-messenger/direct-task-service.mjs","tools/company-messenger/web-push-service.mjs","tools/company-messenger/platform-navigation.mjs","/workspace/tools/company-messenger/"]
COPY ["tools/company-messenger/public","/workspace/tools/company-messenger/public"]
COPY ["atlas/engine.js","atlas/trail.js","atlas/personalization.js","atlas/domain.js","atlas/temper-outcomes.js","atlas/interpretation.js","atlas/work.js","/workspace/atlas/"]
COPY ["atlas/ask.js","/workspace/atlas/ask.js"]
COPY ["experiences/shift-workbench/model.mjs","experiences/shift-workbench/storage-upgrade.mjs","/workspace/experiences/shift-workbench/"]
COPY ["experiences/teacher-world/index.html","experiences/teacher-world/app.mjs","experiences/teacher-world/personalization-ui.mjs","experiences/teacher-world/style.css","experiences/teacher-world/personalization.css","/workspace/experiences/teacher-world/"]
COPY ["experiences/teacher-world/signal.css","experiences/teacher-world/workspace-overview.css","experiences/teacher-world/workspace-overview.mjs","experiences/teacher-world/sharing-fence.mjs","/workspace/experiences/teacher-world/"]
COPY ["experiences/teacher-world/assets/wide-butter.webp","/workspace/experiences/teacher-world/assets/"]
COPY ["experiences/teacher-world/assets/app-world.png","experiences/teacher-world/assets/synk-logo.svg","experiences/teacher-world/assets/sticker-book.webp","experiences/teacher-world/assets/sticker-person.webp","experiences/teacher-world/assets/SUIT-Variable.woff2","experiences/teacher-world/assets/InterTight-700.woff2","experiences/teacher-world/assets/DMMono-Medium.ttf","experiences/teacher-world/assets/slab-cream-long.webp","experiences/teacher-world/assets/slab-coral-long.webp","experiences/teacher-world/assets/chip-blush-long.webp","experiences/teacher-world/assets/thread-shift.webp","experiences/teacher-world/assets/badge-cream.webp","experiences/teacher-world/assets/badge-check.webp","experiences/teacher-world/assets/wide-coral.webp","/workspace/experiences/teacher-world/assets/"]
COPY ["experiences/atlas-lab/consultation.mjs","experiences/atlas-lab/interpretation.mjs","experiences/atlas-lab/model-extraction.mjs","experiences/atlas-lab/model-host.mjs","experiences/atlas-lab/matching.mjs","experiences/atlas-lab/matching-ui.mjs","experiences/atlas-lab/meeting.mjs","experiences/atlas-lab/meeting-ui.mjs","experiences/atlas-lab/reconnect.mjs","experiences/atlas-lab/discovery.mjs","experiences/atlas-lab/discovery-ui.mjs","experiences/atlas-lab/journey-memory.mjs","experiences/atlas-lab/participant-launcher.mjs","/workspace/experiences/atlas-lab/"]
COPY ["experiences/atlas-lab/index.html","experiences/atlas-lab/lab.js","experiences/atlas-lab/lab.css","/workspace/experiences/atlas-lab/"]
COPY ["experiences/atlas-lab/meeting-regions.mjs","/workspace/experiences/atlas-lab/meeting-regions.mjs"]
COPY ["experiences/learning-hub/atlas-learning.js","/workspace/experiences/learning-hub/atlas-learning.js"]
COPY ["experiences/learning-hub/assets/scrapbook.css","experiences/learning-hub/assets/SUIT-Variable.woff2","experiences/learning-hub/assets/InterTight-700.woff2","experiences/learning-hub/assets/sticker-book.webp","experiences/learning-hub/assets/slab-cream-long.webp","experiences/learning-hub/assets/slab-blush-long.webp","/workspace/experiences/learning-hub/assets/"]
COPY ["experiences/korean-rhythm/personalization.mjs","experiences/korean-rhythm/core.mjs","experiences/korean-rhythm/suno-tracks.mjs","experiences/korean-rhythm/listening.mjs","experiences/korean-rhythm/narration.mjs","/workspace/experiences/korean-rhythm/"]
COPY ["experiences/order-rush/learning.mjs","/workspace/experiences/order-rush/learning.mjs"]
COPY ["docs/마케팅/맞춤도구/computer/content.js","docs/마케팅/맞춤도구/computer/rules.js","/workspace/docs/마케팅/맞춤도구/computer/"]
COPY ["docs/마케팅/클라이언트_발주서_20260930/receiver/sync.cjs","/workspace/docs/마케팅/클라이언트_발주서_20260930/receiver/sync.cjs"]
COPY ["docs/마케팅/맞춤도구/assets/laptop-felt.webp","docs/마케팅/맞춤도구/assets/fb-tile-cream-long.webp","docs/마케팅/맞춤도구/assets/fb-tile-butter-long.webp","docs/마케팅/맞춤도구/assets/fb-slab-black-long.webp","/workspace/docs/마케팅/맞춤도구/assets/"]
COPY ["docs/디자인/펠트스크랩북/scrapbook.css","/workspace/docs/디자인/펠트스크랩북/scrapbook.css"]
COPY ["docs/브랜드_폰트/SUIT/SUIT-Variable.woff2","/workspace/docs/브랜드_폰트/SUIT/SUIT-Variable.woff2"]
COPY ["docs/브랜드_폰트/SUIT/LICENSE_OFL.txt","/workspace/docs/브랜드_폰트/SUIT/LICENSE_OFL.txt"]
COPY ["docs/브랜드_폰트/InterTight/InterTight-Regular.ttf","docs/브랜드_폰트/InterTight/InterTight-SemiBold.ttf","docs/브랜드_폰트/InterTight/OFL.txt","/workspace/docs/브랜드_폰트/InterTight/"]
COPY ["docs/브랜드_폰트/DM_Mono/DMMono-Regular.ttf","docs/브랜드_폰트/DM_Mono/OFL.txt","/workspace/docs/브랜드_폰트/DM_Mono/"]
COPY ["docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink-정밀.svg","/workspace/docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink-정밀.svg"]
COPY ["docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/04_SYNK_크루_핸드북.txt","/workspace/docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/04_SYNK_크루_핸드북.txt"]
COPY ["docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/SYNK LAB 급여 인센티브 정본.txt","/workspace/docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/SYNK LAB 급여 인센티브 정본.txt"]
COPY ["docs/개인정보처리방침_초안_v1.md","/workspace/docs/개인정보처리방침_초안_v1.md"]
COPY ["docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/02_학생_복지_프로그램.txt","/workspace/docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/02_학생_복지_프로그램.txt"]
COPY ["docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/02B_장학제도_운영규칙_내부용.txt","/workspace/docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/02B_장학제도_운영규칙_내부용.txt"]
COPY ["docs/포토부스_설계.md","/workspace/docs/포토부스_설계.md"]
COPY ["docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/03_유학_프로그램.txt","/workspace/docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/03_유학_프로그램.txt"]
COPY ["docs/수강약관_초안_v1.md","/workspace/docs/수강약관_초안_v1.md"]
COPY ["docs/커리큘럼_정본_v1.md","/workspace/docs/커리큘럼_정본_v1.md"]
COPY ["docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/10_SYNK_LAB_수업_커리큘럼.txt","/workspace/docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/10_SYNK_LAB_수업_커리큘럼.txt"]
COPY ["docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/SYNK LAB 강사 수업 규칙.txt","/workspace/docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/SYNK LAB 강사 수업 규칙.txt"]
COPY ["docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/SYNK LAB 주간 교안 양식.txt","/workspace/docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/SYNK LAB 주간 교안 양식.txt"]
COPY ["docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/SYNK LAB 소그룹 과업 은행.txt","/workspace/docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/SYNK LAB 소그룹 과업 은행.txt"]
COPY ["docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/09_학부모_안내문.txt","/workspace/docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/09_학부모_안내문.txt"]
COPY ["docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/08_설명회_원장_스피치.txt","/workspace/docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/08_설명회_원장_스피치.txt"]
COPY ["docs/정본/SYNK/SYNK FAQ.txt","/workspace/docs/정본/SYNK/SYNK FAQ.txt"]
COPY ["docs/자주묻는질문_정본.md","/workspace/docs/자주묻는질문_정본.md"]
COPY ["docs/마케팅/콘텐츠_제작양식.md","/workspace/docs/마케팅/콘텐츠_제작양식.md"]
COPY ["docs/마케팅/콘텐츠_운영체계_20260927.md","/workspace/docs/마케팅/콘텐츠_운영체계_20260927.md"]
COPY ["docs/명품_기준_v1.md","/workspace/docs/명품_기준_v1.md"]
COPY ["docs/디자인/펠트스크랩북/README.md","/workspace/docs/디자인/펠트스크랩북/README.md"]
COPY ["docs/마케팅/제작양식/AI_소식_도구추천.md","/workspace/docs/마케팅/제작양식/AI_소식_도구추천.md"]
COPY ["docs/마케팅/제작양식/AI_활용법.md","/workspace/docs/마케팅/제작양식/AI_활용법.md"]
COPY ["docs/마케팅/채널과_발행.md","/workspace/docs/마케팅/채널과_발행.md"]
COPY ["docs/마케팅/제작양식/제작여정_쇼츠.md","/workspace/docs/마케팅/제작양식/제작여정_쇼츠.md"]
COPY ["docs/마케팅/제작양식/LAB_상황극.md","/workspace/docs/마케팅/제작양식/LAB_상황극.md"]
COPY ["docs/마케팅/제작양식/LAB_표현소개.md","/workspace/docs/마케팅/제작양식/LAB_표현소개.md"]
COPY ["docs/마케팅/제작양식/인물클립.md","/workspace/docs/마케팅/제작양식/인물클립.md"]
COPY ["docs/마케팅/제작양식/인터뷰.md","/workspace/docs/마케팅/제작양식/인터뷰.md"]
COPY ["docs/마케팅/제작양식/회사소개_작업물.md","/workspace/docs/마케팅/제작양식/회사소개_작업물.md"]
COPY ["docs/마케팅/제작양식/글_뉴스레터.md","/workspace/docs/마케팅/제작양식/글_뉴스레터.md"]
COPY ["docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Paper-정밀.svg","/workspace/docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Paper-정밀.svg"]
COPY ["docs/디자인/SNS키트/assets/logo-synk-paper.webp","/workspace/docs/디자인/SNS키트/assets/logo-synk-paper.webp"]
COPY ["docs/디자인/SNS키트/assets/logo-lab.webp","/workspace/docs/디자인/SNS키트/assets/logo-lab.webp"]
COPY ["docs/디자인/SNS키트/assets/logo-shift.webp","/workspace/docs/디자인/SNS키트/assets/logo-shift.webp"]
COPY ["docs/디자인/SNS키트/assets/logo-pulse.webp","/workspace/docs/디자인/SNS키트/assets/logo-pulse.webp"]
COPY ["docs/디자인/SNS키트/assets/mascot-몽글_본체.webp","/workspace/docs/디자인/SNS키트/assets/mascot-몽글_본체.webp"]
COPY ["docs/디자인/SNS키트/assets/mascot-까몽_본체.webp","/workspace/docs/디자인/SNS키트/assets/mascot-까몽_본체.webp"]
COPY ["docs/디자인/SNS키트/assets/mascot-마린_본체.webp","/workspace/docs/디자인/SNS키트/assets/mascot-마린_본체.webp"]
COPY ["docs/브랜드_폰트/InterTight/InterTight-Medium.ttf","/workspace/docs/브랜드_폰트/InterTight/InterTight-Medium.ttf"]
COPY ["docs/브랜드_폰트/DM_Mono/DMMono-Medium.ttf","/workspace/docs/브랜드_폰트/DM_Mono/DMMono-Medium.ttf"]
COPY ["docs/디자인/펠트부품/assets/ui/slab-coral-long.webp","/workspace/docs/디자인/펠트부품/assets/ui/slab-coral-long.webp"]
COPY ["docs/디자인/펠트부품/assets/ui/badge-check.webp","/workspace/docs/디자인/펠트부품/assets/ui/badge-check.webp"]
COPY ["docs/디자인/SNS키트/assets/felt-laptop.webp","/workspace/docs/디자인/SNS키트/assets/felt-laptop.webp"]
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 4191
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD ["node", "docs/마케팅/온라인마케팅지도/engagement/company/deploy/healthcheck.mjs"]
CMD ["node", "docs/마케팅/온라인마케팅지도/engagement/company/server.mjs"]
