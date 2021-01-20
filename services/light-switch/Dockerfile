FROM horme-service-builder as builder

ENV NODE_ENV development

WORKDIR /usr/src/light-switch
COPY . .
RUN yarn install && yarn build

FROM node:15-buster
WORKDIR /usr/bin/light-switch
COPY --from=builder /usr/src/light-switch .
ENTRYPOINT ["node", "dist/app.js"]