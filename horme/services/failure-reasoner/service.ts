import chalk from 'chalk';
import log from 'loglevel';
import mqtt, { AsyncMqttClient } from 'async-mqtt'

import common, { State as KnownState, Subscription } from '../common';
import getEnv from '../../src/env';
import util from '../../src/util';

const env = getEnv.from_file()

/********** implementation ************************************************************************/

main().catch(err => util.abort(err));

/** Asynchronous service entry point. */
async function main() {
    log.setLevel('trace'); // TODO: read log level from .env
    const [uuid, topic] = process.argv.slice(2);
    console.log(`${util.timestamp()}: failure-reasoner service online (${topic})`);

    const client = await mqtt.connectAsync(env.MQTT_HOST, env.MQTT_AUTH);

    const service = new Service(topic, client);
    await service.init();
}

/********** internal types ************************************************************************/

type State = KnownState | 'unknown';

type LightSwitch = {
    sub: Subscription;
    state: State;
};

class Service {
    private topics: {
        service: string;
        config: string;
    };
    private client: AsyncMqttClient;
    private observed: Map<string, LightSwitch> = new Map();

    /** Construct service instance and register MQTT listener. */
    constructor(topic: string, client: AsyncMqttClient) {
        this.topics = { service: topic, config: 'config/' + topic }
        this.client = client

        this.client.on('message', (topic, msg) => {
            let promise;
            switch (topic) {
                case this.topics.config:
                    promise = this.handleConfigMessage(msg.toString());
                    break;
                default:
                    const device = JSON.parse(msg.toString()) as { uuid: string, type: string }
                    const observed = this.observed.get(device.uuid);
                    if (observed) {
                        promise = this.handleDeviceMessage(topic, msg.toString(), observed);
                    } else {
                        throw new Error('message on un-subscribed topic received');
                    }
            }

            promise.catch(err => util.abort(err));
        });
    }

    /** Initializes the service instance */
    async init() {
        await this.client.subscribe(this.topics.config, { qos: 2 });
    }

    /** Handles configuration messages by updating the service's MQTT subscriptions. */
    private async handleConfigMessage(msg: string) {
        log.debug(
            `${util.timestamp()}: config message received on topic '${this.topics.config}'`
        );

        const subs = common.assertConfigMessage(JSON.parse(msg)).subs;

        let unsubscribed = 0;
        for (const [uuid, observed] of this.observed) {
            if (!subs.find(sub => sub.uuid === uuid)) {
                this.observed.delete(uuid);
                await this.client.unsubscribe(observed.sub.topic);
                unsubscribed += 1;
            }
        }

        let subscribed = 0;
        for (const sub of subs) {
            if (!this.observed.has(sub.uuid)) {
                this.observed.set(sub.uuid, {
                    sub: sub,
                    state: 'unknown',
                });

                await this.client.subscribe('data/' + sub.topic);
                subscribed += 1;
            }
        }

        log.info(
            `${util.timestamp()}: (re-)configuration complete, ${subscribed} added, ${unsubscribed} removed`
        );
    }

    private async handleDeviceMessage(topic: string, msg: string, observed: LightSwitch) {
        console.log(`${util.timestamp()}: device message received on topic '${topic}'`);
        const deviceMsg = common.assertDeviceMessage(JSON.parse(msg));

        if (observed.state === 'unknown' || observed.state !== deviceMsg.state) {
            observed.state = deviceMsg.state;
        } else {
            log.warn(
                `${util.timestamp()}: ${chalk.yellow('probable light-switch malfunction detected')}`
            );

            const parts = topic.split('/');
            parts.shift();
            const failure = ['fail'].concat(parts).join('/');
            log.debug(`${util.timestamp()}: sending failure message to topic '${failure}'`);

            await this.client.publish(
                failure,
                JSON.stringify({ uuid: observed.sub.uuid, reason: 'unknown' }),
                { qos: 2 }
            );
        }
    }
}