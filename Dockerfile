FROM node:lts-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

FROM node:lts-alpine

WORKDIR /app
COPY --from=0 /app .
COPY . .
CMD ["node", "src/index.js"]
