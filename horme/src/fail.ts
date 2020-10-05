import chalk from 'chalk';
import mqtt from 'async-mqtt';
import { Static, String, Record } from 'runtypes'

import getEnv from './env';
import srv from './service';
import util from './util';

/********** exports ******************************************************************************/

export default {
    setupFailureListener
}

/********** internal types ************************************************************************/

const FailureMessage = Record({
    uuid: String,
    reason: String
})

type FailureMessage = Static<typeof FailureMessage>

/********** module state **************************************************************************/

const env = getEnv.from_file()
const logger = util.logger

/********** implementation ************************************************************************/

/** initializes the MQTT failure listener client and registers callback */
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
    ])
}

/** initiates MQTT failure handling & reconfiguration */
async function onFailure(topic: string, msg: Buffer) {
    logger.debug(`failure message received on topic '${topic}'`)
    const failure = FailureMessage.check(JSON.parse(msg.toString('utf-8')))
    logger.debug(`removal of service ${chalk.underline(failure.uuid)} requested`)

    await srv.removeService(failure.uuid)
}