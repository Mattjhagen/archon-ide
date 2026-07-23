FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM rust:1.86-bookworm AS backend
WORKDIR /app/backend
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src
RUN cargo build --locked --release

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git bash openssh-client ripgrep \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 archon \
    && mkdir -p /app/frontend /workspace \
    && chown -R archon:archon /app /workspace
WORKDIR /app/backend
COPY --from=backend /app/backend/target/release/archon-backend ./archon-backend
COPY --from=frontend /app/frontend/dist /app/frontend/dist
USER archon
ENV PORT=8080
ENV RUST_LOG=info
EXPOSE 8080
CMD ["./archon-backend"]
