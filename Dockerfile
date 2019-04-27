FROM node:latest
RUN mkdir -p /usr/src/9kmmrbot
WORKDIR /usr/src/9kmmrbot
COPY package.json /usr/src/9kmmrbot
RUN npm install
COPY . /usr/src/9kmmrbot
CMD ["node", "index"]
