import log from 'loglevel';
import mqtt, { AsyncMqttClient } from 'async-mqtt'

import getEnv from '../../src/env';
import util from '../../src/util';

/********** internal types ************************************************************************/

type State = 'on' | 'off';

type Device = {
    uuid: string | null;
    type: 'light-switch';
    state: State;
    timestamp: number;
}

/********** module state **************************************************************************/

const env = getEnv.from_file()
const device: Device = {
    uuid: null,
    type: 'light-switch',
    state: 'off',
    timestamp: 0,
};

/********** implementation ************************************************************************/

main().catch(err => util.abort(err));

/** Asynchronous service entry point. */
async function main() {
    log.setLevel('trace'); // TODO: read log level from .env
    const [uuid, topic] = process.argv.slice(2);
    const dataTopic = 'data/' + topic
    log.info(`${util.timestamp()}: light-switch service online (${topic})`);

    device.uuid = uuid;

    const client = await mqtt.connectAsync(env.MQTT_HOST, env.MQTT_AUTH);
    client.on('message', ({ }, { }) => {
        util.abort(new Error('light-switch service not configured to receive messages'));
    });

    if (uuid === 'fra') {
        await util.timeout(1000);
        await setState(client, dataTopic, 'on');
        await util.timeout(1000);
        await setState(client, dataTopic, 'off');
        await setState(client, dataTopic, 'off');
    } else if (uuid === 'bri') {
        await util.timeout(7000);
        await setState(client, dataTopic, 'on');
        await util.timeout(1000);
        await setState(client, dataTopic, 'off');
        await setState(client, dataTopic, 'off');
    }
}

async function setState(client: AsyncMqttClient, topic: string, state: State) {
    device.state = state;
    device.timestamp = new Date().getTime();
    log.debug(`${util.timestamp()}: light switched '${state}'`);
    log.debug(`${util.timestamp()}: device message sent to topic '${topic}'`);
    await client.publish(topic, JSON.stringify(device), { qos: 2 });
}