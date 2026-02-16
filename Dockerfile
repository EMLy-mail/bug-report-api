FROM oven/bun:alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

COPY tsconfig.json ./
COPY src/ ./src/

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
