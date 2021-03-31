import mqtt, { AsyncMqttClient } from 'async-mqtt';
import {
    env as getEnv,
    ServiceInfo,
    util,
    DeviceMessage,
    ConfigMessage,
    parseAs
} from 'horme-common';
import { parse } from 'path';

// lazily initialized with first configuration message
let serviceInfo: ServiceInfo;
let subCount = 0;

const env = getEnv.readEnvironment('service');
const logger = util.logger;

main().catch(err => util.abort(err));

async function main() {
    logger.setLogLevel(env.logLevel);
    logger.info('service started on topic ' + env.topic);

    const confTopic = 'conf/' + env.topic;
    const dataTopic = 'data/' + env.topic;

    const client = await mqtt.connectAsync(env.host, {
        ...env.auth,
        will: {
            topic: `fail/${env.topic}`,
            payload: JSON.stringify({ uuid: env.uuid, reason: 'dead' }),
            qos: 2,
            retain: false,
        }
    });

    client.on('message', (topic, msg) => {
        let promise: Promise<void>;
        if (topic === confTopic) {
            promise = handleConfigMessage(client, topic, msg.toString());
        } else {
            promise = handleDataMessage(client, topic, dataTopic, msg.toString());
        }

        promise.catch(err => util.abort(err));
    });

    await client.subscribe(confTopic);
    logger.debug('subscribed to topic(s): ' + confTopic);
}

async function handleConfigMessage(client: AsyncMqttClient, topic: string, msg: string) {
    logger.debug(`config message received on topic '${topic}'`);

    const config = parseAs(ConfigMessage, JSON.parse(msg));
    if (!config) {
        logger.info("Ceiling-lamp received malformed config message.")
        return;
    }
    if (serviceInfo === undefined) {
        logger.info('initial configuration received');
        serviceInfo = config.info;
    }

    const add = config.add.map(sub => 'data/' + sub.topic);
    const del = config.del.map(sub => 'data/' + sub.topic);

    if (add.length > 0) {
        subCount += add.length;
        await client.subscribe(add);
        logger.debug('subscribed to topic(s): ' + add.join(', '));
    }

    if (del.length > 0) {
        subCount -= del.length;
        await client.subscribe(del);
        logger.debug('unsubscribed from topic(s): ' + del.join(', '));
    }

    logger.info(`(re-)configuration complete, ${add.length} added, ${del.length} removed`);

    if (subCount === 0) {
        logger.warn('no depencies configured, can not function properly');
    }
}

async function handleDataMessage(
    client: AsyncMqttClient,
    recvTopic: string,
    sendTopic: string,
    msg: string,
) {
    logger.debug(`data message received on topic '${recvTopic}'`);

    if (serviceInfo === undefined) {
        throw new Error('service info not initialized');
    }

    const device = parseAs(DeviceMessage, JSON.parse(msg));
    if (!device) {
        logger.info("Ceiling-lamp received malformed device message.");
        return;
    }

    const response: DeviceMessage = {
        ...serviceInfo,
        value: device.value,
        timestamp: new Date().getTime(),
    };
    await client.publish(sendTopic, JSON.stringify(response), { retain: true });
    logger.debug(`retained state set to: '${device.value}'`)
}