FROM node:24-bookworm-slim
ENV NODE_ENV=production SYNK_SPACESHIP_PUBLIC=1 SYNK_SPACESHIP_MAX_ROOMS=50
WORKDIR /app
COPY --chown=node:node server.mjs core.mjs ./
COPY --chown=node:node deploy/runtime.mjs ./deploy/runtime.mjs
USER node
EXPOSE 4318
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "--input-type=module", "-e", "const r=await fetch('http://127.0.0.1:4318/api/spaceship/health',{signal:AbortSignal.timeout(3000)});if(!r.ok||(await r.json()).service!=='spaceship-coop')process.exit(1)"]
CMD ["node", "deploy/runtime.mjs"]
