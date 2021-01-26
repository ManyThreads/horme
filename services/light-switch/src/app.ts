import mqtt, { AsyncMqttClient } from 'async-mqtt';
import {
    env as getEnv,
    util,
    ConfigMessage, DeviceMessage, ServiceInfo, Value
} from 'horme-common';
import { Static } from 'runtypes';

type ConfigMessage = Static<typeof ConfigMessage>;
type DeviceMessage = Static<typeof DeviceMessage>;
type ServiceInfo = Static<typeof ServiceInfo>;
type Value = Static<typeof Value>;

const env = getEnv.readEnvironment('service');
const logger = util.logger;

main().catch(err => util.abort(err));

async function main() {
    logger.setLogLevel(env.logLevel);
    logger.info('service started on topic ' + env.topic);
    const client = await mqtt.connectAsync(env.host, env.auth);

    const confTopic = 'conf/' + env.topic;
    const dataTopic = 'data/' + env.topic;

    let isConfigured = false;

    client.on('message', (topic, payload) => {
        if (topic === confTopic) {
            logger.debug(`config message received on topic '${topic}'`);
            const msg = ConfigMessage.check(JSON.parse(payload.toString()));
            const serviceInfo = msg.info;

            if (!isConfigured) {
                logger.info('initial configuration received');
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
    logger.debug('subscribed to topic(s): ' + confTopic);
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
        const delay = 10000 + Math.random() * 100000;
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