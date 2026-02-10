FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/runner/package.json apps/runner/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/connectors/core/package.json packages/connectors/core/package.json
COPY packages/connectors/ir-sms/package.json packages/connectors/ir-sms/package.json
COPY packages/connectors/ir-payment/package.json packages/connectors/ir-payment/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @asdev/sdk build \
  && pnpm --filter @asdev/connector-core build \
  && pnpm --filter @asdev/connector-ir-sms build \
  && pnpm --filter @asdev/connector-ir-payment build \
  && pnpm --filter @asdev/runner build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
EXPOSE 4000
CMD ["node", "apps/runner/dist/server.js"]
