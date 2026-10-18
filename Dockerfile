# Build stage: has TypeScript, Vite and dev dependencies, never ships
FROM docker.io/library/node:24-slim@sha256:<pinned-digest> AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run typecheck && npm run build && npm prune --omit=dev

# Runtime stage: only compiled output and production dependencies
FROM docker.io/library/node:24-slim@sha256:<pinned-digest>
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=root:root /app/dist ./dist
COPY --from=build --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/package.json ./
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/server/index.js"]
