FROM node:lts-alpine@sha256:b4cca2f95c701d632ffd39258f9ec9ee9fb13c8cc207f1da02eb990c98395ac1 as base
RUN apk add --no-cache subversion git openssh && npm i -g npm
WORKDIR /usr/src/app
COPY package*.json ./
FROM base as builder
RUN --mount=type=cache,target=/root/.npm npm ci --prefer-offline --no-audit
COPY src src
COPY tsconfig.json ./
RUN npm run build
FROM base as prod_node_modules
RUN --mount=type=cache,target=/root/.npm npm ci --prod --prefer-offline --no-audit
FROM node:lts-alpine@sha256:b4cca2f95c701d632ffd39258f9ec9ee9fb13c8cc207f1da02eb990c98395ac1
USER node
WORKDIR /usr/src/app
COPY --chown=node:node --from=prod_node_modules /usr/src/app/node_modules node_modules
RUN mkdir -p volumes
COPY --chown=node:node package*.json .
COPY --from=builder --chown=node:node /usr/src/app/dist dist/
# CMD ["npm", "start"]
CMD [ "node", "-r", "source-map-support/register", "--trace-warnings", "dist/index.js"]