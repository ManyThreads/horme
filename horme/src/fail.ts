import chalk from 'chalk';
import log from 'loglevel';
import mqtt from 'async-mqtt';

import { APARTMENT, CONNECTION } from './env';
import srv from './service';
import util from './util';

/********** exports ******************************************************************************/

export default {
    setupFailureListener
}

/********** internal types ************************************************************************/

type FailureMessage = {
    uuid: string;
    reason: string;
}

/********** module state **************************************************************************/

const client = mqtt.connect(CONNECTION);

/********** implementation ************************************************************************/

async function setupFailureListener() {
    client.on('message', (topic, msg) => {
        onFailure(topic, msg).catch(err => util.abort(err));
    });

    await client.subscribe([
        `apartment/${APARTMENT}/failure`,
        `apartment/${APARTMENT}/room/bedroom/failure`
    ]);
}

async function onFailure(topic: string, msg: Buffer) {
    log.debug(`${util.timestamp()}: failure message received on topic '${topic}'`);
    const failure = assertFailureMessage(JSON.parse(msg.toString('utf-8')));
    log.debug(
        `${util.timestamp()}: removal of service ${chalk.underline(failure.uuid)} requested`
    );

    await srv.removeService(failure.uuid);
}

function assertFailureMessage(obj: any): FailureMessage {
    if (isFailureMessage(obj)) {
        return obj as FailureMessage;
    } else {
        throw new Error("invalid format of failure message");
    }
}

function isFailureMessage(obj: any): obj is FailureMessage {
    return typeof obj.uuid === 'string' && typeof obj.reason === 'string';
}