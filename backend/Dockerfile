# ── Build stage ────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
# Skip Chromium download here; the runtime image provides system Chromium.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build

# ── Runtime stage ──────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# Optional: bundle a full LaTeX toolchain (heavy). Build with:
#   docker build --build-arg WITH_LATEX=true -t aijs-backend .
ARG WITH_LATEX=false

# System Chromium for Puppeteer (much smaller than the bundled download) + deps.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation ca-certificates \
    && if [ "$WITH_LATEX" = "true" ]; then \
         apt-get install -y --no-install-recommends \
           texlive-latex-recommended texlive-latex-extra texlive-fonts-recommended \
           texlive-luatex latexmk ; \
       fi \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# JSON datastore lives here; mount a volume to persist it.
RUN mkdir -p /app/data
EXPOSE 4000
CMD ["node", "dist/index.js"]
