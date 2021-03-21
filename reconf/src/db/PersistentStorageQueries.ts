
import { addService, removeService, ServiceEntry } from "../db";
import { returnQuery } from "../neo4j";
import { PersistentStorage } from "../PersistentStorage";
import { util } from 'horme-common';

const logger = util.logger;

//This class is used as an api for communication with the db

export class PseudoPersistentStorage implements PersistentStorage {

    //Adds ServiceEntry to db and instantiateService
    //TODO: Add return for successful instantiation
    async createService(service: ServiceEntry) {
        addService(service);
    }
    async updateService(service: ServiceEntry): Promise<void> {
        throw new Error("Method not implemented.");
    }

    //Removes service from DB
    async removeService(uuid: string): Promise<void> {
        removeService(uuid);
    }

    //returns all existing service in the database as ServiceEntity
    async queryServices(): Promise<ServiceEntry[]> {
        const entries: ServiceEntry[] = [];
        const a: string = 'MATCH (n: Service) RETURN n';
        const query = await returnQuery(a);
        if (query.records.length != 0) {
            for (let x of query.records) {
                const entry: ServiceEntry = {
                    type: x.get('n.type'),
                    uuid: x.get('n.uuid'),
                    mainDevices: x.get('n.mainDevices'),
                    replacementDevices: x.get('n.replacementDevices'),
                    room: x.get('n.room'),
                    configMsg: x.get('n.configMsg'),
                    online: x.get('n.online'),
                };
                entries.push(entry);
            }
            
        }
        return entries;
    }

    //returns service entry of service with uuid
    async queryService(uuid: string): Promise<ServiceEntry | undefined> {
        const a: string = 'MATCH (n: Service { uuid: \'' + uuid + '\'}) RETURN n';
        const query = await returnQuery(a);
        if (query.records.length != 0) {
            if (query.records.length > 0) {
                logger.error('possible redundancies found')
            }
            const entry: ServiceEntry = {
                type: query.records[0].get('n.type'),
                uuid: query.records[0].get('n.uuid'),
                mainDevices: query.records[0].get('n.mainDevices'),
                replacementDevices: query.records[0].get('n.replacementDevices'),
                room: query.records[0].get('n.room'),
                configMsg: query.records[0].get('n.configMsg'),
                online: query.records[0].get('n.online'),
            };
            return entry;

        }
        return undefined;
    }

    //get all service entries from room
    async queryServicesInRoom(room: string): Promise<ServiceEntry[]> {
        const entries: ServiceEntry[] = [];
        const a: string = 'MATCH (n: Service: { room: \'' + room + '\'}) RETURN n';
        const query = await returnQuery(a);
        for (let x of query.records) {
            const entry: ServiceEntry = {
                type: x.get('n.type'),
                uuid: x.get('n.uuid'),
                mainDevices: x.get('n.mainDevices'),
                replacementDevices: x.get('n.replacementDevices'),
                room: x.get('n.room'),
                configMsg: x.get('n.configMsg'),
                online: x.get('n.online'),
            };
            entries.push(entry);

        }
        return entries;
    }
};
