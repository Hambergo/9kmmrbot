FROM node:lts-alpine as builder
RUN apk add --no-cache subversion git openssh && npm i -g npm
USER node
WORKDIR /usr/src/app
COPY --chown=node:node package*.json tsconfig.json ./
RUN npm ci
COPY --chown=node:node src src
RUN npm run build
FROM node:lts-alpine as prod_node_modules
RUN apk add --no-cache subversion git openssh && npm i -g npm
WORKDIR /usr/src/app
COPY package*.json .
RUN npm ci --prod
FROM node:lts-alpine
USER node
WORKDIR /usr/src/app
COPY --chown=node:node --from=prod_node_modules /usr/src/app/node_modules node_modules
RUN mkdir -p volumes
COPY --chown=node:node package*.json .
COPY --from=builder --chown=node:node /usr/src/app/dist dist/
CMD ["npm", "start"]
EXPOSE 9229