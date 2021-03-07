import { FailureMessage } from "horme-common";


export default interface FailureHandler {
    handle(msg: FailureMessage): Promise<void>;
};