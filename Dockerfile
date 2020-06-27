FROM mhart/alpine-node:12

WORKDIR /src

COPY package.json /src/
COPY package-lock.json /src/
RUN npm install
COPY . /src/

CMD ["npm", "start"]
