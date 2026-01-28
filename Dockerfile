# ---------- build ----------
FROM oven/bun:1 AS build
WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---------- runtime ----------
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

# Copiamos el output de Nitro/TanStack Start
COPY --from=build /app/.output ./.output

# Puerto típico (ajústalo si tu app usa otro)
ENV PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]

