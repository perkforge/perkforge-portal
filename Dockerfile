# Supply a reviewed Node 24 Debian slim image by immutable digest. No implicit tag.
ARG NODE_IMAGE
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json index.html ./
COPY src ./src
COPY architecture/public ./architecture/public
COPY scripts/architecture-model.mjs ./scripts/architecture-model.mjs
RUN npm run build
RUN npm prune --omit=dev

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=1000:1000 /app/node_modules ./node_modules
COPY --from=build --chown=1000:1000 /app/dist ./dist
COPY --chown=1000:1000 package.json ./
COPY --chown=1000:1000 server ./server
USER 1000:1000
EXPOSE 3000
CMD ["node", "server/index.mjs"]
