# HorME Reconfig Prototype

Project website: https://manythreads.github.io/horme/

# 1. Requirements

## 1.1 Installation

The following assumes a Linux environment.

1. `docker`
2. `docker-compose`

**Arch based:**

```bash
$ pacman -S docker docker-compose
```

**Debian based:**

See documentation for [Debian](https://docs.docker.com/engine/install/debian/#installation-methods) or [Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

## 1.2 Post-installation

See documentation for Linux [post-installation steps](https://docs.docker.com/engine/install/linux-postinstall/).

# 2. Usage

## 2.1 Starting & Building Containers

First time container instantiation takes some time for downloading and configuring the images.

```bash
$ docker-compose run --rm reconf
```

## 2.2 Inside `reconf` Container

The above command starts a `bash` instance within the container inside the mounted `app/` directory.
The following command installs the required `npm` packages and is only required once:

```bash
$ npm install
```

Afterwards, type the following command to execute the example application once:

```bash
$ npm start
```

## 2.3 Stopping Auxiliary Containers

```bash
$ docker-compose down
```

## 2.4 Purging all Docker Containers, Images, Volumes and Networks

```bash
$ docker system prune -a --volumes
```

## 3. Relationship Modeling

### 4.1 Device Related

- apartment *contains* room (1:n)
- room *contains* device (1:n)
- device *is of* type (1:1)
- type *provides* **service** (1:n)

#### Open Questions: Inter-service dependencies?

### 4.2 Inhabitant related

- person *inhabits* apartment (1:1)
- person *has* ailment (1:n)
- ailment *requires* **service** (1:n)

## 4. MQTT Topic Modeling

**General Pattern:**

`{apt}/{room}/{device-type}/{device-uuid}`

**Sub-Paths**:

e.g. `apt-421/living-room/television/{device-uuid}/[remote-control|switch|..]`

## 5. Glossary

**device**: A physical sensor or actor installed in an apartment that is at least able to publish MQTT messages