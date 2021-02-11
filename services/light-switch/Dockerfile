FROM node:15-buster as builder

#ENV NODE_ENV=production
COPY ./horme-common /usr/local/src/horme/horme-common
COPY ./services/light-switch /usr/local/src/horme/services/light-switch
WORKDIR /usr/local/src/horme/services/light-switch
RUN yarn install && yarn build

FROM node:15-buster
WORKDIR /usr/local/bin/horme/services/light-switch
COPY --from=builder /usr/local/src/horme/services/light-switch .
ENTRYPOINT ["node", "dist/app.js"]