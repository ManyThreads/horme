FROM node:14.8-buster AS builder
RUN apt update && apt upgrade -y && apt install libmosquitto-dev clang -y
RUN mkdir /usr/src/motion_sensor
WORKDIR /usr/src/motion_sensor
COPY external/source .
RUN clang++ -std=c++17 -O3 -o /usr/bin/motion_sensor client.cpp tracker.cpp linux/camera.cpp main.cpp -lmosquitto -lpthread

FROM node:14.8-buster
RUN apt update \
    && apt upgrade -y \
    && apt autoremove --purge \
    && apt install default-jre libmosquitto-dev -y
COPY --from=builder /usr/bin/motion_sensor /usr/bin/motion_sensor
USER node
ENTRYPOINT "/bin/bash"
