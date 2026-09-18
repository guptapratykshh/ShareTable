FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci

FROM deps AS build
COPY server/tsconfig.json server/
COPY server/src server/src
COPY client/index.html client/vite.config.ts client/tsconfig.json client/tsconfig.app.json client/tsconfig.node.json client/
COPY client/public client/public
COPY client/src client/src
RUN npm run build -w server
ENV VITE_API_URL=
RUN npm run build -w client

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 RUNTIME=ap-runner CLIENT_DIST=/app/client/dist
COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci --omit=dev --workspace=server --include-workspace-root
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
WORKDIR /app/server
EXPOSE 8080
CMD ["node", "dist/index.js"]
