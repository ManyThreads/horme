import { PersistentStorage, ServiceEntry, UnInitServiceEntry } from "../PersistentStorage";
import { v4 } from 'uuid';
import { cloneArray, cloneObject } from "horme-common";

export class PseudoPersistentStorage implements PersistentStorage {
    private services: ServiceEntry[] = [];

    async createService(service: UnInitServiceEntry): Promise<ServiceEntry> {
        const entry: ServiceEntry = {
            ...service,
            uuid: v4(),
            depends: [],
        }
        this.services.push(entry);
        return entry;
    }
    async updateService(service: ServiceEntry): Promise<void> {
        let entry = this.services.find(service => service.uuid === service.uuid);
        if (entry !== undefined) {
            entry = cloneObject(service);
        }
    }
    async removeService(uuid: string): Promise<void> {
        let index = this.services.findIndex(service => service.uuid === uuid);
        if (index > -1) {
            this.services.splice(index, 1);
        }
    }
    async queryServices(): Promise<ServiceEntry[]> {
        return cloneArray(this.services);
    }
    async queryService(uuid: string): Promise<ServiceEntry | undefined> {
        let result = this.services.find(service => service.uuid === uuid);
        if (result !== undefined) {
            return cloneObject(result);
        }
        return undefined;
    }
    async queryServicesInRoom(room: string): Promise<ServiceEntry[]> {
        const entries: ServiceEntry[] = [];
        this.services.forEach(service => {
            if (service.room === room) {
                entries.push(service);
            }
        })
        return cloneArray(entries);
    }
};