import log from 'loglevel';
import mqtt from 'async-mqtt'

import { CONNECTION } from '../../src/env';
import util from '../../src/util';

/********** implementation ************************************************************************/

main().catch(err => util.abort(err));

/** Asynchronous service entry point. */
async function main() {
    log.setLevel('trace'); // TODO: read log level from .env
    const [uuid, base] = process.argv.slice(2);
    const deviceTopic = base + '/' + uuid;
    log.info(`${util.timestamp()}: camera service online (${deviceTopic})`);

    const client = await mqtt.connectAsync(CONNECTION);
    client.on('message', ({ }, { }) => {
        util.abort(new Error('camera-motion-detect service not configured to receive messages'));
    })
}