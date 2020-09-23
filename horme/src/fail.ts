import chalk from 'chalk';
import log from 'loglevel';
import mqtt from 'async-mqtt';

import getEnv from './env';
import srv from './service';
import util from './util';

/********** exports ******************************************************************************/

export default {
    setupFailureListener
}

/********** internal types ************************************************************************/

type FailureMessage = {
    uuid: string
    reason: string
}

/********** module state **************************************************************************/

const env = getEnv.from_file()

/********** implementation ************************************************************************/

/** Initializes MQTT failure listener client */
async function setupFailureListener() {
    // connect MQTT client
    const client = await mqtt.connectAsync(env.MQTT_HOST, env.MQTT_AUTH)
    // set MQTT client message event listener
    client.on('message', (topic, msg) => {
        onFailure(topic, msg).catch(err => util.abort(err))
    })

    await client.subscribe([
        `fail/${env.APARTMENT}/global`,
        `fail/${env.APARTMENT}/bedroom/+`,
    ]);
}

/** Initiates failure handling & reconfiguration */
async function onFailure(topic: string, msg: Buffer) {
    log.debug(`${util.timestamp()}: failure message received on topic '${topic}'`)
    const failure = JSON.parse(msg.toString('utf-8'))
    assertFailureMessage(failure)

    log.debug(
        `${util.timestamp()}: removal of service ${chalk.underline(failure.uuid)} requested`
    );

    await srv.removeService(failure.uuid);
}

function assertFailureMessage(obj: any): asserts obj is FailureMessage {
    if (typeof obj.uuid !== 'string' && typeof obj.reason !== 'string') {
        throw new Error("invalid format of failure message")
    }
}