FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
