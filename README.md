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

See documentation for [Debian](https://docs.docker.com/engine/install/debian/#installation-methods)
or [Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

## 1.2 Post-installation

See documentation for Linux [post-installation steps](https://docs.docker.com/engine/install/linux-postinstall/).

# 2. Usage

## 2.1 Build

Build common:

```bash
docker run --env NODE_ENV=development -t --rm -v $(pwd):/build -w /build node:15-buster sh -c "cd common && yarn install && yarn build"
```

Build reconf:

```bash
docker run --env NODE_ENV=development -t --rm -v $(pwd):/build -w /build node:15-buster sh -c "cd horme && yarn install && yarn build"
```

Build test services:
TODO: generic setup process for services

```bash
cd services
cd camera-motion-detect
./docker_build.sh
cd ..
cd ceiling-lamp/
yarn install && yarn build
cd ..
cd failure-reasoner/
yarn install && yarn build
cd ..
cd light-switch/
yarn install && yarn build
```

## 2.2 Run

```bash
docker-compose -f neo4j/docker-compose.yml -f mosquitto/docker-compose.yml up -d --build && docker-compose -f horme/docker-compose.yml up --build
```

## 2.3 Stop

```bash
docker-compose -f neo4j/docker-compose.yml -f mosquitto/docker-compose.yml -f horme/docker-compose.yml down -v --remove-orphans
```

## 2.4 Purging all Docker Containers, Images, Volumes and Networks

```bash
$ docker system prune -a --volumes
```

# 3. Service Contracts (Compliant Service Specification)

The HorME configuration & re-configuration system manages the dynamic
instantiation and communication between between compliant but otherwise
independent _service_ applications.
Services are specified by **configuration files**, which must contain the
relevant information for instantiating the service as well as their
dependencies.
All managed services are required to handle their own message publication and
subscription via the MQTT protocol.
Services are instantiated by the configuration system and are passed a set of
required service parameters as **program arguments**.
If a service is defined with dependencies, the configuration system is obliged
to send the service an initial **configuration message**, containing a list of
MQTT topics, to which the service must subscribe.
All topics are generated, defined and communicated by the configuration system.

## 3.1 Configuration Files

The service configuration file format is as of yet not finally pinned down, but
currently includes the following properties:

```json
{
  "cmd": {
    "exec": "[command or path to executable (string)]",
    "args": ["[arguments (list of strings, maybe empty)]"]
  }
}
```

### 3.1.1 Example

```json
{
  "cmd": {
    "exec": "node dist/services/ceiling-lamp/service.js --color",
    "args": []
  }
}
```

## 3.2 Program Arguments

Every compliant service must accept and handle an _ordered set_ of program
arguments, which are passed down to it by the configuration system.

- 1. service UUID: an unique **string** assigned to the service instance
- 2. service topic: the unique topic (path) **string** assigned to the service
- 3. MQTT host: the MQTT host address
- 4. MQTT authentication (optional): **either** username and password, only
     username or no argument at all (all **strings**)

### 3.2.1 Service Topic

The configuration system hands only the "raw" topic string to each service, any
topic prefixes must be appended by the service itself (see
[Section 3.4](#34-mqtt-topic-structure)).

### 3.2.2 MQTT Host Argument

The MQTT host argument is passed in the following format:

```
{protocol}://{hostname|ip-address}:{port}
```

#### 3.2.2.1 Example

`tcp://mosquitto:1883`

As of now, only the TCP protocol is used.

## 3.3 Configuration Messages

There are two scenarios, in which the configuration system will send a
configuration message to a service, and only services specifying dependent
services in their configuration need bother with configuration messages at all.

- 1. initial configuration (notifying the service of the topics of its
     dependencies)
- 2. reconfiguration (notifying the service of added and removed dependencies)

The format of configuration messages is as follows:

```json
{
  "add": ["[list of subscriptions (strings)]"],
  "del": ["[list of subscriptions (strings)]"]
}
```

Each subscription entry has the following structure:

```json
{
  "uuid": "[string]",
  "type": "[string]",
  "topic": "[string]"
}
```

Either list may be empty, but the property must still be present in the message.
Initial configuration messages must never contain any removals (empty list in
`del` property).
All communicated topics are "raw", i.e., without any prefixes (see
[Section 3.4](#34-mqtt-topic-structure)).
All configuration messages must be sent as `retain` messages, meaning they will
be stored by the MQTT broker.

## 3.4 MQTT Topic Structure

All topics generated by the configuration system must adhere to the following
format:

```
{$apartment-identifier}/{"global"|$room-identifier}/{$service-type}{$service-uuid}
```

Note, that the `service-type` and `service-uuid` are concatenated in the final
part of the topic.
In order to avoid topic string parsing as much as possible, services are
encouraged to send their type and uuid in every message they publish.
Services, that are not associated with a specific room have the special
`"global"` string in their topic instead of a `room-identifier`.

### 3.4.1 Topic Prefixes

Topics may be prefixed with one of four possible prefix strings:

- 1. `data`
- 2. `conf`
- 3. `fail`
- 4. `inf`

A fifth `cmd` prefix is reserved for potential use at a later stage

Services that publish data must publish it to their assigned topic prefixed with
`data` and services with dependencies must listen to their assigned topic
prefixed with `conf` for configuration messages.
The `fail` prefix is exclusively reserved for failure notification by the
configuration system and the `inf` prefix is reserved for event and state
inference communication.

### 3.4.2 Examples

A service of type `light-switch` with the UUID `550e8400-e29b-11d4-a716-446655440000`
must **publish** all of its registered events to the following topic and any
dependent services must likewise **subscribe** to it:

`data/apt-421/bedroom/light-switch550e8400-e29b-11d4-a716-446655440000`

A service of type `ceiling-lamp` with the UUID `79cfa266-06fb-11eb-adc1-0242ac120002`
must **subscribe** to this topic:

`conf/apt-421/bedroom/ceiling-lamp79cfa266-06fb-11eb-adc1-0242ac120002`

# 4. Current Scenario

(bound to change)

As of now, the following service types are modelled:

- 1. `light-switch`
- 2. `camera-motion-detect`
- 3. `failure-detect`
- 4. `ceiling-lamp`

Both `light-switch` and `camera-motion-detect` services can be used to infer
_presence_ in their respective room.
`failure-detect` services are exclusively used to detect failure of
`light-switch` service instances (for now).
Both `failure-detect` and `ceiling-lamp` depend on any number of `light-switch`
services (two as of now).

All services publish their state in messages of the following format:

```json
{
  "uuid": "[string]",
  "type": "[string]",
  "value": "[on|off]", // for now there are only binary sensor services
  "timestamp": "[unsigned long integer]" // UNIX time in seconds
}
```

## 5. Glossary

TODO
