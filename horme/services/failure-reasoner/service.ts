import chalk from 'chalk';
import log from 'loglevel';
import mqtt, { AsyncMqttClient } from 'async-mqtt'

import common, { State as KnownState, Subscription } from '../common';
import { CONNECTION } from '../../src/env';
import util from '../../src/util';

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
        this.topics = {
            service: topic,
            config: topic + '/config',
        };
        this.client = client;

        this.client.on('message', (topic, msg) => {
            let promise;
            switch (topic) {
                case this.topics.config:
                    promise = this.handleConfigMessage(msg.toString());
                    break;
                default:
                    const uuid = topic.split('/').pop()!;
                    const observed = this.observed.get(uuid);
                    if (observed) {
                        promise = this.handleDeviceMessage(topic, msg.toString(), observed);
                    } else {
                        throw new Error('TODO');
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

                await this.client.subscribe(sub.topic);
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
            const index = parts.indexOf('room');
            const failure = parts.slice(0, index + 2).concat('failure').join('/');

            log.debug(`${util.timestamp()}: sending failure message to topic '${failure}'`);

            await this.client.publish(
                failure,
                JSON.stringify({ uuid: observed.sub.uuid, reason: 'unknown' }),
                { qos: 2 }
            );
        }
    }
}


/********** implementation ************************************************************************/

main().catch(err => util.abort(err));

/** Asynchronous service entry point. */
async function main() {
    log.setLevel('trace'); // TODO: read log level from .env
    const [uuid, base] = process.argv.slice(2);
    const serviceTopic = base + '/' + uuid;
    console.log(`${util.timestamp()}: failure-reasoner service online (${serviceTopic})`);

    const client = await mqtt.connectAsync(CONNECTION);
    const service = new Service(serviceTopic, client);
    await service.init();
}