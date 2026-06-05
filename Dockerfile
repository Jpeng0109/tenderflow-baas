# Optional local/docker build — Render Blueprint uses native Node (see render.yaml)
FROM node:20-alpine
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev --no-optional

COPY backend/src ./src
COPY backend/data ./data

ENV NODE_ENV=production
ENV CLOUD_DEMO_MODE=true
# Do NOT set PORT — Render injects PORT at runtime (typically 10000)

EXPOSE 10000
CMD ["node", "src/index.js"]
