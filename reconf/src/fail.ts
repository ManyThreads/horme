import mqtt from 'async-mqtt';
import { env as getEnv, util, FailureMessage, parseAs } from 'horme-common';

import DefaultHandler from './failure/DefaultHandler';

export default { setupFailureListener };

const env = getEnv.readEnvironment('reconf');
const logger = util.logger;

/** Initializes the MQTT failure listener client and registers callback. */
async function setupFailureListener(): Promise<void> {
    // connect MQTT client
    const client = await mqtt.connectAsync(env.host, env.auth);
    // set MQTT client message event listener
    client.on('message', (topic, msg) => {
        onFailure(topic, msg).catch((err) => util.abort(err));
    });

    await client.subscribe([
        `fail/${process.env.HORME_APARTMENT}/global`,
        `fail/${process.env.HORME_APARTMENT}/bedroom/+`,
    ]);
}

const defaultHandler = new DefaultHandler();

/** Initiates MQTT failure handling & reconfiguration. */
async function onFailure(topic: string, msg: Buffer) {
    logger.debug(`failure message received on topic '${topic}'`);
    const failure = parseAs(FailureMessage, JSON.parse(msg.toString('utf-8')));
    if (failure !== undefined) {
        defaultHandler.handle(failure);
    } else {
        logger.info(`Received malformed failure message on topic '${topic}'`);
    }
}
