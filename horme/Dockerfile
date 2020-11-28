FROM node:15-buster

RUN apt-get update

# docker binary used with docker socket of host machine to create sibling containers in reconf
RUN apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add -
RUN add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/debian \
   $(lsb_release -cs) \
   stable"
RUN apt-get update
RUN apt-get install -y docker-ce
# we dont have the docker.sock mounted through a volume here, so no smoke test possible
# RUN docker version