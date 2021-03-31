import FailureHandler from "./FailureHandler";
import { util } from 'horme-common';
import { ServiceController } from "../ServiceController";

const logger = util.logger;

export default class DefaultHandler implements FailureHandler {
    private service_controller: ServiceController;
    private time_span_s: number; ///< time span after service start in which a failure is handled by a reconfiguration instead of a restart.

    constructor(service_controller: ServiceController, time_span_s: number = 5) {
        this.service_controller = service_controller;
        this.time_span_s = time_span_s;
    }

    async handle(msg: { uuid: string; reason: string; }): Promise<void> {
        const handle = await this.service_controller.getHandle(msg.uuid);
        if (!handle) return;
        let now = new Date().getTime();
        let diff = now - handle.last_update;
        diff /= 1000; // strip ms
        if (diff < this.time_span_s) {
            logger.debug(`Default failure handler for ${msg.uuid} caused by ${msg.reason}, restarting...`);
            await this.service_controller.restartService(msg.uuid);
        } else {
            logger.debug(`Default failure handler for ${msg.uuid} caused by ${msg.reason}, reconfiguration...`);
            await this.service_controller.removeService(msg.uuid);
        }
    }
}