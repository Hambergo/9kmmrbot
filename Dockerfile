FROM node:lts-alpine@sha256:19eaf41f3b8c2ac2f609ac8103f9246a6a6d46716cdbe49103fdb116e55ff0cc as base
RUN apk add --no-cache subversion git openssh && npm i -g npm
WORKDIR /usr/src/app
COPY package*.json ./
FROM base as builder
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit
COPY src .eslintrc.json src/
COPY tsconfig.json ./
RUN npm run lint && npm run build
FROM base as prod_node_modules
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --prefer-offline --no-audit
FROM node:lts-alpine@sha256:19eaf41f3b8c2ac2f609ac8103f9246a6a6d46716cdbe49103fdb116e55ff0cc
USER node
WORKDIR /usr/src/app
COPY --chown=node:node --from=prod_node_modules /usr/src/app/node_modules node_modules
RUN mkdir -p volumes
COPY --chown=node:node package*.json .
COPY --from=builder --chown=node:node /usr/src/app/dist dist/
# CMD ["npm", "start"]
CMD [ "node", "-r", "source-map-support/register", "--trace-warnings", "dist/index.js"]