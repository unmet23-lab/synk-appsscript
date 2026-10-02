FROM node:24-bookworm-slim
ENV NODE_ENV=production SYNK_COMPANY_HOST=0.0.0.0 SYNK_COMPANY_PORT=4191 SYNK_COMPANY_DATA=/data
WORKDIR /workspace
COPY docs/마케팅/온라인마케팅지도/engagement/analytics.mjs /workspace/docs/마케팅/온라인마케팅지도/engagement/analytics.mjs
COPY docs/마케팅/온라인마케팅지도/engagement/company/*.mjs /workspace/docs/마케팅/온라인마케팅지도/engagement/company/
COPY docs/마케팅/온라인마케팅지도/engagement/company/public /workspace/docs/마케팅/온라인마케팅지도/engagement/company/public
COPY docs/브랜드_폰트/SUIT/SUIT-Variable.woff2 /workspace/docs/브랜드_폰트/SUIT/SUIT-Variable.woff2
COPY docs/브랜드_폰트/InterTight/InterTight-Regular.ttf docs/브랜드_폰트/InterTight/InterTight-SemiBold.ttf /workspace/docs/브랜드_폰트/InterTight/
COPY docs/브랜드_폰트/DM_Mono/DMMono-Regular.ttf /workspace/docs/브랜드_폰트/DM_Mono/DMMono-Regular.ttf
COPY docs/브랜드_폰트/InterTight/OFL.txt /workspace/docs/브랜드_폰트/InterTight/OFL.txt
COPY docs/브랜드_폰트/DM_Mono/OFL.txt /workspace/docs/브랜드_폰트/DM_Mono/OFL.txt
COPY docs/브랜드_폰트/SUIT/LICENSE_OFL.txt /workspace/docs/브랜드_폰트/SUIT/LICENSE_OFL.txt
COPY docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink-정밀.svg /workspace/docs/홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink-정밀.svg
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 4191
CMD ["node", "docs/마케팅/온라인마케팅지도/engagement/company/server.mjs"]
