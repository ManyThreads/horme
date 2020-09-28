import mqtt, { AsyncMqttClient } from 'async-mqtt'
import chalk from 'chalk'
import loglevel from 'loglevel'
import { Static } from 'runtypes';

import { ConfigMessage, DeviceMessage, Subscription, Value } from '../common'
import getEnv from '../../src/env'
import util from '../../src/util'

/********** internal types ************************************************************************/

type Subscription = Static<typeof Subscription>
type Value = Static<typeof Value>

type Device = {
    uuid: string | null
    value: Value
}

type Topics = {
    data: string
    config: string
    depends: string[]
}

/********** module state **************************************************************************/

const env = getEnv.from_file()
const logger = util.logger
const subscriptions: Map<string, Subscription> = new Map()

const device: Device = {
    uuid: null,
    value: 'off',
}

/********** implementation ************************************************************************/

main().catch(err => util.abort(err))

async function main() {
    loglevel.setLevel(env.LOG_LEVEL)
    const [uuid, topic] = process.argv.slice(2)
    const dataTopic = 'data/' + topic
    logger.info(`ceiling-lamp service online (${topic})`)

    device.uuid = uuid

    const topics: Topics = {
        data: dataTopic,
        config: 'conf/' + topic,
        depends: []
    }

    const client = await mqtt.connectAsync(env.MQTT_HOST, env.MQTT_AUTH)

    client.on('message', (topic, msg) => {
        let promise
        switch (topic) {
            case topics.config:
                promise = handleConfigMessage(client, msg.toString(), topics)
                break
            default:
                if (topics.depends.includes(topic)) {
                    promise = handleDeviceMessage(client, topic, msg.toString(), topics)
                } else {
                    throw new Error('message on unsubscribed topic received')
                }
        }

        promise.catch(err => util.abort(err))
    })

    await client.subscribe(topics.config)
}

async function handleConfigMessage(client: AsyncMqttClient, msg: string, topics: Topics) {
    logger.debug(`config message received on topic '${topics.config}'`)
    const subs = ConfigMessage.check(JSON.parse(msg)).subs

    let unsubscribed = 0
    for (const [uuid, sub] of subscriptions) {
        if (!subs.find(sub => sub.uuid === uuid)) {
            subscriptions.delete(uuid)
            await client.unsubscribe(sub.topic)
            unsubscribed += 1
        }
    }

    let subscribed = 0
    for (const sub of subs) {
        if (!subscriptions.has(sub.uuid)) {
            subscriptions.set(sub.uuid, sub)
            await client.subscribe('data/' + sub.topic)
            subscribed += 1
        }
    }

    topics.depends = subs.map(sub => 'data/' + sub.topic)
    logger.info(`(re-)configuration complete, ${subscribed} added, ${unsubscribed} removed`)

    if (topics.depends.length == 0) {
        logger.warn('no light-switches configured, can not function properly')
    }
}

async function handleDeviceMessage(
    client: AsyncMqttClient,
    topic: string,
    msg: string,
    topics: Topics
) {
    logger.debug(`device message received on topic '${topic}'`)
    const deviceMessage = DeviceMessage.check(JSON.parse(msg))

    if (device.value !== deviceMessage.value) {
        device.value = deviceMessage.value
        await client.publish(topics.data, JSON.stringify(device), { retain: true })
        logger.debug(`retained state set to '${device.value}'`)
    } else {
        logger.warn('invalid state received (probable malfunction)')
    }
}