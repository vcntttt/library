# ---------- build ----------
FROM oven/bun:1 AS build
WORKDIR /app

COPY bun.lock package.json ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---------- runtime ----------
FROM oven/bun:1 AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY bun.lock package.json ./
RUN bun install --production --frozen-lockfile

COPY --from=build /app/.output ./.output
COPY drizzle ./drizzle
COPY scripts ./scripts

EXPOSE 3000

CMD ["sh", "./scripts/start.sh"]
