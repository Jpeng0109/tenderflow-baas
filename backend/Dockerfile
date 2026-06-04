FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache docker-cli docker-cli-compose bash
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV PORT=4100
EXPOSE 4100 4200
CMD ["node", "src/index.js"]
