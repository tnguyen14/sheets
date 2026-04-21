FROM node:lts-alpine

WORKDIR /src

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

FROM node:lts-alpine

WORKDIR /src
COPY --from=0 /src .
COPY . .
CMD ["node", "index.js"]
