import chalk from 'chalk'
import log from 'loglevel'
import mqtt, { AsyncMqttClient } from 'async-mqtt'

import common, { Subscription, State } from '../common'
import getEnv from '../../src/env'
import util from '../../src/util'

/********** internal types ************************************************************************/

type Device = {
    uuid: string | null
    state: State
}

type Topics = {
    data: string
    config: string
    depends: string[]
}

/********** module state **************************************************************************/

const env = getEnv.from_file()
const subscriptions: Map<string, Subscription> = new Map()

const device: Device = {
    uuid: null,
    state: 'off',
}

/********** implementation ************************************************************************/

main().catch(err => util.abort(err))

async function main() {
    log.setLevel('trace')  // TODO: read log level from .env
    const [uuid, topic] = process.argv.slice(2)
    const dataTopic = 'data/' + topic
    log.info(`${util.timestamp()}: ceiling-lamp service online (${topic})`)

    device.uuid = uuid

    const topics: Topics = {
        data: dataTopic,
        config: 'config/' + topic,
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
    log.debug(`${util.timestamp()}: config message received on topic '${topics.config}'`)
    const subs = common.assertConfigMessage(JSON.parse(msg)).subs

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

    log.info(
        `${util.timestamp()}: (re-)configuration complete, ${subscribed} added, ${unsubscribed} removed`
    )

    if (topics.depends.length == 0) {
        log.warn(
            `${util.timestamp()}: ${chalk.yellow('no light-switches configured, can not function properly')}`
        )
    }
}

async function handleDeviceMessage(
    client: AsyncMqttClient,
    topic: string,
    msg: string,
    topics: Topics
) {
    log.debug(`${util.timestamp()}: device message received on topic '${topic}'`)
    const dev = common.assertDeviceMessage(JSON.parse(msg))

    if (device.state !== dev.state) {
        device.state = dev.state
        await client.publish(topics.data, JSON.stringify(device), { retain: true })
        log.debug(`${util.timestamp()}: retained state set to '${device.state}'`)
    } else {
        log.warn(
            `${util.timestamp()}: ${chalk.yellow('invalid state received (probable malfunction)')}`
        )
    }
}