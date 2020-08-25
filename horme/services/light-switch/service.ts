import mqtt, { AsyncMqttClient } from 'async-mqtt'

import { CONNECTION } from '../../src/env';
import util from '../../src/util';

/********** internal types ************************************************************************/

type State = 'on' | 'off';

type Device = {
    uuid: string | null;
    service: 'light-switch';
    state: State;
}

/********** module state **************************************************************************/

const device: Device = {
    uuid: null,
    service: 'light-switch',
    state: 'off',
};

/********** implementation ************************************************************************/

main().catch(err => util.abort(err));

/** Asynchronous service entry point. */
async function main() {
    const [uuid, base] = process.argv.slice(2);
    const deviceTopic = base + '/' + uuid;
    console.log(`${util.timestamp()}: light-switch service online (${deviceTopic})`);

    device.uuid = uuid;

    const client = await mqtt.connectAsync(CONNECTION);
    client.on('message', ({ }, { }) => {
        util.abort(new Error('light-switch service not configured to receive messages'));
    })

    if (uuid === 'fra') {
        await util.timeout(1000);
        await setState(client, deviceTopic, 'on');
        await util.timeout(1000);
        await setState(client, deviceTopic, 'off');
        await setState(client, deviceTopic, 'off');
    } else if (uuid === 'bri') {
        //await util.timeout(3000);
        //await setState(client, deviceTopic, 'on');
        //await util.timeout(1000);
        //await setState(client, deviceTopic, 'off');
        //await setState(client, deviceTopic, 'off');
    }
}

async function setState(client: AsyncMqttClient, topic: string, state: State) {
    device.state = state;
    console.log(`${util.timestamp()}: light switched '${state}'`);
    await client.publish(topic, JSON.stringify(device), { qos: 2 });
}