FROM oven/bun:1 AS builder
WORKDIR /app
COPY . .
RUN bun install
RUN bun run build:server

FROM ubuntu:24.04
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
# Install jj
RUN curl -fsSL https://github.com/jj-vcs/jj/releases/latest/download/jj-x86_64-unknown-linux-gnu.tar.gz | tar xz -C /usr/local/bin/ || true
COPY --from=builder /app/apps/server/dist/jjhub /usr/local/bin/jjhub
EXPOSE 3000
CMD ["jjhub"]
