import { ChildProcessWithoutNullStreams } from "child_process";
import { ServiceInfo } from "horme-common";

export type Uuid = string;
export type ServiceProcess = ChildProcessWithoutNullStreams;

/** The handle to an actively running service instance. */
export type ServiceHandle = {
    info: ServiceInfo;
    proc?: ServiceProcess;
    depends: ServiceHandle[];
    published_version: number; ///< The currently published config version
    last_update: number;
};

export interface ServiceController {
    cleanUp(): void;
    startService(service_id: Uuid): Promise<void>;
    stopService(service_id: Uuid): Promise<void>;
    restartService(service_id: Uuid): Promise<void>;
    removeService(service_id: Uuid): Promise<void>;
    getHandle(service_id: Uuid): Promise<ServiceHandle | undefined>;
};