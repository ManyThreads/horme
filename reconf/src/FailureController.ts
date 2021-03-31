import { AsyncMqttClient, connect } from 'async-mqtt';
import { env as getEnv, util, FailureMessage, parseAs } from 'horme-common';

import DefaultHandler from './failure/DefaultHandler';
import FailureHandler from './failure/FailureHandler';
import { ServiceController } from './ServiceController';

export class FailureController {
    private env = getEnv.readEnvironment('reconf');
    private logger = util.logger;
    private client: AsyncMqttClient;
    private handler: FailureHandler;

    constructor(service_controller: ServiceController) {
        this.client = connect(this.env.host, this.env.auth);
        this.handler = new DefaultHandler(service_controller);
    }

    async init(): Promise<void> {
        this.client.on('message', (topic, msg) => {
            this.onFailure(topic, msg).catch((err) => util.abort(err));
        });

        await this.client.subscribe([
            `fail/${process.env.HORME_APARTMENT}/global`,
            `fail/${process.env.HORME_APARTMENT}/bedroom/+`,
        ]);
    }

    private async onFailure(topic: string, msg: Buffer) {
        this.logger.debug(`failure message received on topic '${topic}'`);
        const failure = parseAs(FailureMessage, JSON.parse(msg.toString('utf-8')));
        if (failure !== undefined) {
            this.handler.handle(failure);
        } else {
            this.logger.info(`Received malformed failure message on topic '${topic}'`);
        }
    }
}
