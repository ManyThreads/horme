FROM node:15-buster

COPY . /usr/lib/horme-common/
WORKDIR /usr/lib/horme-common
RUN yarn global add typescript && \
    yarn install && \
    tsc --declaration -p /usr/lib/horme-common 
