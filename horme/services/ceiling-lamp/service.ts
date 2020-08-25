import mqtt, { AsyncMqttClient } from 'async-mqtt'

import common, { State } from '../common';
import { CONNECTION } from '../../src/env';
import util from '../../src/util';

/********** internal types ************************************************************************/

type Device = {
    uuid: string | null;
    state: State;
}

type Topics = {
    device: string;
    config: string;
    depends: string[];
};

/********** module state **************************************************************************/

const device: Device = {
    uuid: null,
    state: 'off',
};

/********** implementation ************************************************************************/

main().catch(err => util.abort(err));

async function main() {
    const [uuid, base] = process.argv.slice(2);
    const deviceTopic = base + '/' + uuid;
    console.log(`${util.timestamp()}: ceiling-lamp service online (${deviceTopic})`);

    device.uuid = uuid;

    const topics: Topics = {
        device: deviceTopic,
        config: deviceTopic + '/config',
        depends: []
    };

    const client = await mqtt.connectAsync(CONNECTION);
    client.on('message', (topic, msg) => {
        let promise;
        switch (topic) {
            case topics.config:
                promise = handleConfigMessage(client, msg.toString(), topics);
                break;
            default:
                if (topics.depends.includes(topic)) {
                    promise = handleDeviceMessage(client, topic, msg.toString(), topics);
                } else {
                    throw new Error('message on unsubscribed topic received');
                }
        }

        promise.catch(err => util.abort(err));
    });

    await client.subscribe(topics.config);
}

async function handleConfigMessage(client: AsyncMqttClient, msg: string, topics: Topics) {
    console.log(`${util.timestamp()}: message received on config topic`);
    const subs = common.assertConfigMessage(JSON.parse(msg)).subs;
    topics.depends = subs.map(sub => sub.topic);

    await client.subscribe(topics.depends);
    console.log(`${util.timestamp()}: configuration complete, ${subs.length} added`);
}

async function handleDeviceMessage(
    client: AsyncMqttClient,
    topic: string,
    msg: string,
    topics: Topics
) {
    console.log(`${util.timestamp()}: device message received on topic '${topic}'`);
    const dev = common.assertDeviceMessage(JSON.parse(msg));

    if (device.state !== dev.state) {
        device.state = dev.state;
        await client.publish(topics.device, JSON.stringify(device), { retain: true });
        console.log(`${util.timestamp()}: retained state set to '${device.state}'`);
    } else {
        console.error(`${util.timestamp()}: invalid state received (ERROR)`);
    }
}