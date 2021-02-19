import { ServiceEntry } from "../db";
import { ServiceHandle } from "../service";

export default class ServiceFactory {
    createServiceHandle(entry: ServiceEntry, topic: string): ServiceHandle {
        return {
            depends: [],
            info: {
                topic,
                apartment: process.env.HORME_APARTMENT!,
                location: entry.room ?? 'global',
                uuid: entry.uuid,
                type: entry.type,
                version: 0,
                sensor: null,
            },
            published_version: NaN,
            last_update: new Date().getTime(),
        };
    }
}