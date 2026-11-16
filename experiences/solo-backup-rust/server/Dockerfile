# Work-backup provisioning server (STAGE1_DESIGN.md 4.5 「개통 서버 구현 설계」).
# One image, three compose services: `node main.mjs api|keys|files`, each with its own
# user, secrets and network. No npm dependencies — node:sqlite, node:crypto, node:http.
# Build context: experiences/solo-backup-rust/server. Tests, operator tools and the mail
# relay source are not copied (top-level *.mjs only).
FROM node:24-bookworm-slim
ENV NODE_ENV=production NODE_OPTIONS=--disable-warning=ExperimentalWarning
WORKDIR /app
COPY *.mjs ./
RUN set -eu; \
    mkdir -p /data /state /backups; \
    chown 10771:10771 /data /backups; \
    chmod 0555 /app; chmod 0444 /app/*.mjs
USER 10771:10771
EXPOSE 4191
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.WB_PORT||4191)+(process.env.WB_HEALTH||'/v1/health')).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "main.mjs", "api"]
