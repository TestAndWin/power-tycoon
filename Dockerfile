# Build: engine + web + api, then a pruned production copy of the api package.
FROM node:24-alpine AS build
RUN apk add --no-cache python3 make g++ \
  && corepack enable
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY packages packages
COPY apps apps
RUN pnpm build \
  && pnpm --filter @power-tycoon/api deploy --prod --config.inject-workspace-packages=true /out \
  && cp -r apps/web/dist /out/web

# Runtime: only node, the compiled api with its production dependencies and the web build.
FROM node:24-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data \
    WEB_ROOT=/app/web
WORKDIR /app
# npm, npx and corepack are not needed at runtime; dropping them shrinks the attack surface
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=build --chown=1001:1001 /out /app
RUN mkdir -p /data && chown 1001:1001 /data
USER 1001
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/server.js"]
