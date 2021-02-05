FROM node:15-buster as builder

ENV NODE_ENV development

COPY . .
WORKDIR /services/failure-reasoner
RUN yarn install && yarn build

FROM node:15-buster
COPY --from=builder /services/failure-reasoner /usr/src/app
