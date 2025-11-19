# syntax=docker/dockerfile:1

FROM node:20-bullseye-slim AS base
ENV ROLLUP_SKIP_NODEJS_NATIVE=true \
    npm_config_ignore_optional=true \
    RULE_LOOM_DATABASE_URL="file:/app/.ruleloom/orchestrator.db"
WORKDIR /app

COPY package*.json ./
COPY packages/rule-loom-core/package*.json packages/rule-loom-core/
COPY packages/rule-loom-engine/package*.json packages/rule-loom-engine/
COPY packages/rule-loom-lib/package*.json packages/rule-loom-lib/
COPY packages/rule-loom-runner/package*.json packages/rule-loom-runner/
COPY packages/rule-loom-orchestrator/package*.json packages/rule-loom-orchestrator/
COPY packages/rule-loom-orchestrator-ui/package*.json packages/rule-loom-orchestrator-ui/

RUN npm install --omit=optional

RUN ARCH=$(uname -m) \
  && if [ "$ARCH" = "x86_64" ]; then npm install --no-save @rollup/rollup-linux-x64-gnu; \
     elif [ "$ARCH" = "aarch64" ]; then npm install --no-save @rollup/rollup-linux-arm64-gnu; \
     else echo "Unsupported architecture $ARCH" && exit 1; fi

COPY . .

RUN mkdir -p .ruleloom
RUN npx prisma migrate deploy --schema prisma/schema.prisma

RUN npm run build --workspace rule-loom-orchestrator-ui
RUN npm run build --workspaces
RUN npm run build --workspace rule-loom-orchestrator

FROM node:20-bullseye-slim AS runner
ENV ROLLUP_SKIP_NODEJS_NATIVE=true \
    npm_config_ignore_optional=true \
    RULE_LOOM_DATABASE_URL="file:/app/.ruleloom/orchestrator.db"
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app /app
RUN npm prune --omit=dev

COPY docker/orchestrator.yaml /app/config/orchestrator.yaml

EXPOSE 4100
CMD ["node", "packages/rule-loom-orchestrator/dist/cli.js", "--config", "/app/config/orchestrator.yaml", "--port", "4100"]
