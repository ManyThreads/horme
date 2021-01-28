FROM node:15-buster as builder

ENV NODE_ENV=production
ENV NODE_ENV=production
COPY ./horme-common /usr/local/src/horme/horme-common
COPY ./service/light-switch /usr/local/src/horme/light-switch
WORKDIR /usr/local/src/horme/light-switch
RUN yarn install && yarn build

FROM node:15-buster
WORKDIR /usr/local/bin/horme/light-switch
COPY --from=builder /usr/local/src/horme/light-switch .
ENTRYPOINT ["yarn", "app"]