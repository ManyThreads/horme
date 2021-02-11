FROM node:15-buster as builder

COPY ./horme-common /usr/local/src/horme/horme-common
COPY ./services/ceiling-lamp /usr/local/src/horme/services/ceiling-lamp
WORKDIR /usr/local/src/horme/services/ceiling-lamp
RUN yarn install && yarn build

FROM node:15-buster
WORKDIR /usr/local/bin/horme/services/ceiling-lamp
COPY --from=builder /usr/local/src/horme/services/ceiling-lamp .
ENTRYPOINT ["node", "dist/app.js"]