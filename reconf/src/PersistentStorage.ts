import { ServiceEntry } from "./db";

/** The service UUID. */
export type Uuid = string;
export type Room = string;

/** The string describing the type of a service. */
export type ServiceType = string;

/** The array of selected service type and instances. */
export type ServiceSelection = [ServiceType, ServiceEntry[]][];
/** Options for specifying which changes need to be made in the database. */
export type ConfigUpdates = {
    del: Uuid[];
};

export interface PersistentStorage {
    createService(service: ServiceEntry): void;
    updateService(service: ServiceEntry): Promise<void>;
    removeService(uuid: Uuid): Promise<void>;
    queryServices(): Promise<ServiceEntry[]>;
    queryService(uuid: Uuid): Promise<ServiceEntry | undefined>;
    queryServicesInRoom(room: Room): Promise<ServiceEntry[]>;
};