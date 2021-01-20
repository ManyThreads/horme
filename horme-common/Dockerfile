FROM node:15-buster

COPY . /usr/lib/horme-common/
RUN yarn global add typescript                    \
    && tsc --declaration -p /usr/lib/horme-common \
    && yarn global add                            \
        async-mqtt                                \
        runtypes                                  \
        @types/node                               \
