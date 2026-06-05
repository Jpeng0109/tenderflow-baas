# Render cloud API — no Docker-in-Docker, includes experiment snapshot
FROM node:20-alpine
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev --no-optional

COPY backend/src ./src
COPY backend/data ./data

ENV NODE_ENV=production
ENV CLOUD_DEMO_MODE=true
ENV PORT=4100

EXPOSE 4100
CMD ["node", "src/index.js"]
