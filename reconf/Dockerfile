FROM node:15-buster as builder

COPY ./horme-common /usr/local/src/horme/horme-common
COPY ./reconf /usr/local/src/horme/reconf
WORKDIR /usr/local/src/horme/reconf
RUN yarn install && yarn build

FROM node:15-buster
RUN apt-get update && apt-get install -y docker.io wait-for-it
WORKDIR /usr/local/bin/horme/reconf
COPY --from=builder /usr/local/src/horme/reconf .
