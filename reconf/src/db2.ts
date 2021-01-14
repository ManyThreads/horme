import fs from 'fs/promises';

import {
    Array as ArrayType, String as StringType, Number as NumberType, Record, Static
} from 'runtypes';

import { Uuid, ServiceType } from './service';

export default { queryServiceSelection };

const state: {
    stale: boolean,
    db: Map<ServiceType, ServiceDeclaration[]>
} = { stale: true, db: new Map() };

const ServiceDeclaration = Record({
    id: StringType,
    type: StringType,
    location: StringType,
    applications: ArrayType(StringType),
    priority: NumberType,
    dependsOn: ArrayType(StringType),
});
type ServiceDeclaration = Static<typeof ServiceDeclaration>;

async function queryServiceSelection(updates?: Uuid[]): Promise<void> {
    if (state.stale) {
        await loadDatabaseConfig();
        state.stale = false;
    }

    // delete service entry with uuid
    updates?.forEach(uuid => {
        for (let services of state.db.values()) {
            services = services.filter(service => service.id === uuid);
        }
    });

    return;
}

async function loadDatabaseConfig() {
    const file = await fs.readFile('./config/db.json');
    const content = Record({ services: ArrayType(ServiceDeclaration) })
        .check(JSON.parse(file.toString()));

    for (const service of content.services) {
        const list = getOrCreateEntry(service.type);
        list.push(service);
    }
}

function getOrCreateEntry(type: ServiceType): ServiceDeclaration[] {
    let entry = state.db.get(type);
    if (entry === undefined) {
        entry = [];
        state.db.set(type, entry);
    }

    return entry;
}