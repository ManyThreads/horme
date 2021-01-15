FROM node:15-buster as builder

ENV NODE_ENV development

COPY . .
WORKDIR /services/light-switch
RUN yarn install && yarn build

FROM node:15-buster
COPY --from=builder /services/light-switch /usr/src/app
CMD ["node" "/usr/src/app/dist/app.js"]
