import mqtt from 'async-mqtt';

import { APARTMENT, CONNECTION } from './env';
import util from './util';

/********** exports ******************************************************************************/

export default {
    setupFailureListener
}

/********** module state **************************************************************************/

const client = mqtt.connect(CONNECTION);

/********** implementation ************************************************************************/

async function setupFailureListener() {
    client.on('message', (_, msg) => {
        const failure = assertFailureMessage(JSON.parse(msg.toString('utf-8')));
        onFailure(failure).catch(err => util.abort(err));
    });

    await client.subscribe([
        `${APARTMENT}/failure`,
        `${APARTMENT}/room/*/failure`
    ]);
}

async function onFailure(msg: FailureMessage) {
    const service =
        // 1. remove service from DB by uuid
        //   - 1.1. re-run configuration service selection
        //   - 1.2. retrieve new configuration
        // 2. determine delta to old service config
        // 3. send messages for changes
        console.assert(false);
}

type FailureMessage = {
    uuid: string;
    reason: string;
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