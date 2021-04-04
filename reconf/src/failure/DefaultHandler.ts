import FailureHandler from "./FailureHandler";
import { util } from 'horme-common';
import service from "../service";

const logger = util.logger;

export default class DefaultHandler implements FailureHandler {
    async handle(msg: { uuid: string; reason: string; }): Promise<void> {
        logger.debug(`Default failure handler for ${msg.uuid} caused by ${msg.reason}`);
        await service.removeService(msg.uuid);
        //await service.stopService(msg.uuid);
        //await service.startService(msg.uuid);
    }
}