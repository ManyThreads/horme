import mqtt, { AsyncMqttClient } from 'async-mqtt';
import {
    env as getEnv,
    util,
    DeviceMessage, ServiceInfo, Value, createConfigMessage
} from 'horme-common';

const env = getEnv.readEnvironment('service');
const logger = util.logger;

main().catch(err => util.abort(err));

async function main() {
    const client = await mqtt.connectAsync(env.host, env.auth);

    const confTopic = 'conf/' + env.topic;
    const dataTopic = 'data/' + env.topic;

    let isConfigured = false;

    client.on('message', (topic, payload) => {
        if (topic === confTopic) {
            logger.debug(`config message received on topic '${topic}'`);
            const msg = createConfigMessage(JSON.parse(payload.toString()));
            if (!msg) {
                logger.info("Light-switch received malformed config message.");
                return;
            }
            const serviceInfo = msg.info;

            if (!isConfigured) {
                isConfigured = true;
                simulateSwitchActivity(
                    client,
                    serviceInfo,
                    dataTopic
                ).catch(err => util.abort(err));
            }
        }
    });

    await client.subscribe(confTopic);
}

async function simulateSwitchActivity(
    client: AsyncMqttClient,
    serviceInfo: ServiceInfo,
    topic: string
) {
    let state: Value = 'off';
    const publish = async () => {
        const msg: DeviceMessage = {
            ...serviceInfo,
            value: state,
            timestamp: new Date().getTime(),
        };

        await client.publish(topic, JSON.stringify(msg));
    };

    while (true) {
        const delay = 1000 + Math.random() * 10000;
        await util.timeout(delay);

        const simulateError = Math.random() <= 0.01;
        if (simulateError) {
            await publish();
            break;
        } else {
            state = state === 'off' ? 'on' : 'off';
            await publish();
        }
    }
}