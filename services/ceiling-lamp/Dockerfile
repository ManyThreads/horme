FROM horme-service-builder as builder

ENV NODE_ENV development

WORKDIR /usr/src/ceiling-lamp
COPY . .
RUN yarn install && yarn build

FROM node:15-buster
WORKDIR /usr/bin/ceiling-lamp
COPY --from=builder /usr/src/ceiling-lamp .
ENTRYPOINT ["node", "dist/app.js"]