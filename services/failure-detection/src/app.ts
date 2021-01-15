import mqtt, { AsyncMqttClient } from 'async-mqtt';
import {
    env as getEnv,
    util,
    FailureMessage, Value, createConfigMessage, createDeviceMessage
} from 'horme-common';

type ServiceState = {
    client: AsyncMqttClient,
    map: Map<string, Value>,
};

const env = getEnv.readEnvironment('service');
const logger = util.logger;

// lazily initialized service state;
let state: ServiceState;

main().catch(err => util.abort(err));

/** Asynchronous service entry point. */
async function main() {
    logger.setLogLevel(env.logLevel);
    logger.info(`failure-reasoner service online (${env.topic})`);

    state = {
        client: await mqtt.connectAsync(env.host, env.auth),
        map: new Map(),
    };

    const confTopic = 'conf' + env.topic;
    state.client.on('message', (topic, payload) => {
        let promise: Promise<void>;
        if (topic === confTopic) {
            promise = handleDeviceMessage(topic, payload.toString());
        } else {
            promise = handleConfigMessage(topic, payload.toString());
        }

        promise.catch(err => util.abort(err));
    });

    await state.client.subscribe(confTopic);
}

async function handleConfigMessage(topic: string, payload: string) {
    logger.debug(`config message received on topic '${topic}'`);
    const msg = createConfigMessage(JSON.parse(payload));
    if (!msg) {
        logger.info("Failure-reasoner received malformed config message.");
        return;
    }

    const add = msg.add.map(sub => 'data/' + sub.topic);
    const del = msg.del.map(sub => 'data/' + sub.topic);

    msg.del.forEach(sub => state.map.delete(sub.uuid));

    if (add.length > 0) {
        await state.client.subscribe(add);
    }

    if (del.length > 0) {
        await state.client.unsubscribe(del);
    }

    logger.info(`(re-)configuration complete, ${add.length} added, ${del.length} removed`);
}

async function handleDeviceMessage(topic: string, payload: string) {
    logger.debug(`device message received on topic '${topic}'`);
    const msg = createDeviceMessage(JSON.parse(payload));
    if (!msg) {
        logger.info("Failure-reasoner received malformed device message.");
        return;
    }

    const prev = state.map.get(msg.uuid);
    state.map.set(msg.uuid, msg.value);

    if (prev !== undefined && prev === msg.value) {
        // malfunction
        logger.warn('probable light-switch malfunction detected');
        const parts = topic.split('/');
        parts.shift();
        const failTopic = ['fail'].concat(parts).join('/');
        logger.debug(`sending failure message to topic '${failTopic}`);

        let failMsg: FailureMessage = {
            uuid: msg.uuid,
            reason: 'unknown',
        };

        await state.client.publish(failTopic, JSON.stringify(failMsg));
    }
}