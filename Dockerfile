FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM rust:1.88-bookworm AS backend
WORKDIR /app/backend
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src
RUN cargo build --locked --release

FROM docker.io/tailscale/tailscale:stable AS tailscale

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git bash openssh-client ripgrep iptables iproute2 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 archon \
    && mkdir -p /app/frontend /workspace /var/run/tailscale /var/lib/tailscale \
    && chown -R archon:archon /app /workspace
WORKDIR /app/backend
COPY --from=backend /app/backend/target/release/archon-backend ./archon-backend
COPY --from=frontend /app/frontend/dist /app/frontend/dist
COPY --from=tailscale /usr/local/bin/tailscaled /usr/local/bin/tailscaled
COPY --from=tailscale /usr/local/bin/tailscale /usr/local/bin/tailscale
COPY start.sh /app/start.sh
RUN chmod 0755 /app/start.sh
ENV PORT=8080
ENV RUST_LOG=info
EXPOSE 8080
CMD ["/app/start.sh"]
