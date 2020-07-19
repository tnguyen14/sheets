FROM mhart/alpine-node:14

WORKDIR /src

COPY package.json package-lock.json ./

RUN npm ci --prod

FROM mhart/alpine-node:slim-14

WORKDIR /src
COPY --from=0 /src .
COPY . .
CMD ["node", "index.js"]
