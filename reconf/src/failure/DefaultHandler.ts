import FailureHandler from "./FailureHandler";
import { util } from 'horme-common';
import service from "../service";
import { queryService } from "../db";

const logger = util.logger;

export default class DefaultHandler implements FailureHandler {
    private time_span_s: number; ///< time span after service start in which a failure is handled by a reconfiguration instead of a restart.

    constructor(time_span_s: number = 5) {
        this.time_span_s = time_span_s;
    }

    async handle(msg: { uuid: string; reason: string; }): Promise<void> {
        const entry = await queryService(msg.uuid);
        if (!entry) return;
        const handle = service.getServiceHandle(entry);
        let now = new Date().getTime();
        let diff = now - handle.last_update;
        diff /= 1000; // strip ms
        if (diff < this.time_span_s) {
            logger.debug(`Default failure handler for ${msg.uuid} caused by ${msg.reason}, restarting...`);
            await service.stopService(msg.uuid);
            await service.startService(msg.uuid);
        } else {
            logger.debug(`Default failure handler for ${msg.uuid} caused by ${msg.reason}, reconfiguration...`);
            await service.removeService(msg.uuid);
        }
    }
}