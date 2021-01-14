import chalk from 'chalk';
import mqtt from 'async-mqtt';
import { Static, String, Record } from 'runtypes';
import { env as getEnv, util } from 'horme-common';

import srv from './service';

export default { setupFailureListener };

const FailureMessage = Record({
    uuid: String,
    reason: String
});

type FailureMessage = Static<typeof FailureMessage>;

const env = getEnv.readEnvironment('reconf');
const logger = util.logger;

/** Initializes the MQTT failure listener client and registers callback. */
async function setupFailureListener(): Promise<void> {
    // connect MQTT client
    const client = await mqtt.connectAsync(env.host, env.auth);
    // set MQTT client message event listener
    client.on('message', (topic, msg) => {
        onFailure(topic, msg).catch(err => util.abort(err));
    });

    await client.subscribe([
        `fail/${env.APARTMENT}/global`,
        `fail/${env.APARTMENT}/bedroom/+`,
    ]);
}

/** Initiates MQTT failure handling & reconfiguration. */
async function onFailure(topic: string, msg: Buffer) {
    logger.debug(`failure message received on topic '${topic}'`);
    const failure = FailureMessage.check(JSON.parse(msg.toString('utf-8')));
    logger.debug(`removal of service ${chalk.underline(failure.uuid)} requested`);

    await srv.removeService(failure.uuid);
}