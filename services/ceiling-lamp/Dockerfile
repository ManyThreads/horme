FROM node:15-buster as builder

ENV NODE_ENV=production
COPY ./horme-common /usr/local/src/horme/horme-common
COPY ./service/ceiling-lamp /usr/local/src/horme/ceiling-lamp
WORKDIR /usr/local/src/horme/ceiling-lamp
RUN yarn install && yarn build

FROM node:15-buster
WORKDIR /usr/local/bin/horme/ceiling-lamp
COPY --from=builder /usr/local/src/horme/ceiling-lamp .
ENTRYPOINT ["yarn", "app"]