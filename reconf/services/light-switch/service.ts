import loglevel from 'loglevel';
import mqtt, { AsyncMqttClient } from 'async-mqtt';
import getEnv from '../../src/env';
import util from '../../src/util';

/********** internal types ************************************************************************/

type State = 'on' | 'off'

type Device = {
    uuid: string | null
    type: 'light-switch'
    value: State
    timestamp: number
}

/********** module state **************************************************************************/

const env = getEnv.fromFile();
const logger = util.logger;
const device: Device = {
    uuid: null,
    type: 'light-switch',
    value: 'off',
    timestamp: 0,
};

/********** implementation ************************************************************************/

main().catch(err => util.abort(err));

/** Asynchronous service entry point. */
async function main() {
    loglevel.setLevel(env.LOG_LEVEL);
    const [uuid, topic, host] = process.argv.slice(3);
    const dataTopic = 'data/' + topic;
    logger.info(`light-switch service online (${topic})`);

    device.uuid = uuid;

    const client = await mqtt.connectAsync(host, env.MQTT_AUTH);
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
        await util.timeout(5000);
        await setState(client, dataTopic, 'on');
        await util.timeout(1000);
        await setState(client, dataTopic, 'off');
        await setState(client, dataTopic, 'off');
    }
}

async function setState(client: AsyncMqttClient, topic: string, state: State) {
    device.value = state;
    device.timestamp = new Date().getTime();
    logger.debug(`light switched '${state}'`);
    logger.debug(`device message sent to topic '${topic}'`);
    await client.publish(topic, JSON.stringify(device), { qos: 2 });
}