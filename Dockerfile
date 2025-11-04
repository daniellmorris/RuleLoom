# syntax=docker/dockerfile:1

FROM node:20-bullseye-slim AS base
ENV ROLLUP_SKIP_NODEJS_NATIVE=true \
    npm_config_ignore_optional=true
WORKDIR /app

COPY package*.json ./
COPY packages/tree-exe-core/package*.json packages/tree-exe-core/
COPY packages/tree-exe-engine/package*.json packages/tree-exe-engine/
COPY packages/tree-exe-lib/package*.json packages/tree-exe-lib/
COPY packages/tree-exe-runner/package*.json packages/tree-exe-runner/
COPY packages/tree-exe-orchestrator/package*.json packages/tree-exe-orchestrator/
COPY packages/tree-exe-orchestrator-ui/package*.json packages/tree-exe-orchestrator-ui/

RUN npm install --omit=optional

RUN ARCH=$(uname -m) \
  && if [ "$ARCH" = "x86_64" ]; then npm install --no-save @rollup/rollup-linux-x64-gnu; \
     elif [ "$ARCH" = "aarch64" ]; then npm install --no-save @rollup/rollup-linux-arm64-gnu; \
     else echo "Unsupported architecture $ARCH" && exit 1; fi

COPY . .

RUN npm run build --workspace tree-exe-orchestrator-ui
RUN npm run build --workspaces
RUN npm run build --workspace tree-exe-orchestrator

FROM node:20-bullseye-slim AS runner
ENV ROLLUP_SKIP_NODEJS_NATIVE=true \
    npm_config_ignore_optional=true
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app /app
RUN npm prune --omit=dev

COPY docker/orchestrator.yaml /app/config/orchestrator.yaml

EXPOSE 4100
CMD ["node", "packages/tree-exe-orchestrator/dist/cli.js", "--config", "/app/config/orchestrator.yaml", "--port", "4100"]
