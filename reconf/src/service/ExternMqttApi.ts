import { AsyncMqttClient, connect, Packet } from "async-mqtt";
import { env, util } from "horme-common";
import { ServiceController } from "../ServiceController";

export class ExternMqttApi {
    private env = env.readEnvironment('reconf');
    private client: AsyncMqttClient;
    private service_controller: ServiceController;
    constructor(service_controller: ServiceController) {
        this.client = connect(this.env.host, {...this.env.auth, protocolVersion: 5});
        this.service_controller = service_controller;
    }

    async init(): Promise<void> {
        this.client.on('message', (topic, msg, packet) => {
            this.onMessage(topic, msg, packet).catch((err) => util.abort(err));
        });

        await this.client.subscribe(`api/+`);
    }

    private async onMessage(topic: string, payload: Buffer, packet: Packet) {
        if (topic === `api/room`) {
            
        }
    }
}