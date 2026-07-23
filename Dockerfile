FROM node:20-slim AS build
ARG APP_VERSION=dev
ARG GIT_SHA=dev
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY shared shared
COPY backend backend
COPY frontend frontend
RUN npm run build -w shared
RUN VITE_APP_VERSION="$APP_VERSION" VITE_GIT_SHA="$GIT_SHA" npm run build -w frontend
RUN npm run build -w backend

FROM node:20-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
RUN npm ci --omit=dev --workspace=backend --workspace=shared --include-workspace-root

FROM node:20-slim AS runtime
ARG APP_VERSION=dev
ARG GIT_SHA=dev
WORKDIR /app
ENV NODE_ENV=production
ENV APP_VERSION=$APP_VERSION
ENV GIT_SHA=$GIT_SHA
COPY --from=prod-deps /app ./
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend-dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node backend/dist/db/migrate.js && node backend/dist/index.js"]
