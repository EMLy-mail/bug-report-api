FROM oven/bun:alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

COPY src/ ./src/

EXPOSE 3000

# Use a small startup script that waits for MySQL to be ready
CMD ["bun", "run", "src/wait-for-mysql.ts"]
