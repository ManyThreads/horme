import mqtt, { AsyncMqttClient } from 'async-mqtt';
import {
    env as getEnv,
    util,
    ConfigMessage,
    DeviceMessage,
    ServiceInfo,
    Value,
    parseAs
} from 'horme-common';

const env = getEnv.readEnvironment('service');
const logger = util.logger;

main().catch(err => util.abort(err));

async function main() {
    logger.setLogLevel(env.logLevel);
    logger.info('service started on topic ' + env.topic);
    const client = await mqtt.connectAsync(env.host, {
        ...env.auth,
        will: {
            topic: `fail/${env.topic}`,
            payload: JSON.stringify({ uuid: env.uuid, reason: 'dead' }),
            qos: 2,
            retain: false,
        }
    });

    const confTopic = 'conf/' + env.topic;
    const dataTopic = 'data/' + env.topic;

    let isConfigured = false;

    client.on('message', (topic, payload) => {
        if (topic === confTopic) {
            logger.debug(`config message received on topic '${topic}'`);
            const msg = parseAs(ConfigMessage, JSON.parse(payload.toString()));
            if (!msg) {
                logger.info("Light-switch received malformed config message.");
                return;
            }

            const serviceInfo = msg.info;

            if (!isConfigured) {
                logger.info(`initial configuration received ${msg.info.version}`);
                if (msg.info.version === 0) {
                    // simulate a start error
                    process.exit(1);
                }
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