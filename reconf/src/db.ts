import { addConfigToDB} from './neo4j';
import { ServiceType, Uuid } from './service';

export default { queryServiceSelection };

/** The array of selected service type and instances. */
export type ServiceSelection = [ServiceType, ServiceEntry[]][];
/** Options for specifying which changes need to be made in the database. */
export type ConfigUpdates = {
    del: Uuid[];
};
/** The description of an un-instantiated service and its dependencies. */
export type ServiceEntry = {
    uuid: Uuid;
    type: ServiceType;
    room: string | null;
    depends: Uuid[];
};

/********** implementation ************************************************************************/

async function queryServiceSelection(updates?: ConfigUpdates): Promise<ServiceSelection> {
    if (updates) {
        if (updateCount === 0) {
            console.assert(updates.del[0] === 'fra');
            config.set('light-switch', [bedroomSwitch1]);
            bedroomLamp.depends = [bedroomSwitch1.uuid];
            failureReasoner.depends = [bedroomSwitch1.uuid];
            updateCount = 1;
        } else if (updateCount === 1) {
            console.assert(updates.del[0] === 'bri');
            // config.set('camera-motion-detect', [camera]);
            bedroomLamp.depends = [];
            failureReasoner.depends = [];
            updateCount = 2;
        } else {
            throw new Error('exceeded bounds of static reconfiguration scenario');
        }
    }
    
    await addConfigToDB(Array.from(config));

    return Array.from(config);
}

export async function queryService(uuid: string): Promise<ServiceEntry | undefined> {
    for (let [_, value] of config) {
        for (let entry of value) {
            if (entry.uuid === uuid) return entry;
        }
    }
    return undefined;
}

const bedroomSwitch1: ServiceEntry = {
    uuid: 'bri',
    room: 'bedroom',
    type: 'light-switch',
    depends: [],
};

const bedroomSwitch2: ServiceEntry = {
    uuid: 'fra',
    room: 'bedroom',
    type: 'light-switch',
    depends: [],
};

const bedroomLamp: ServiceEntry = {
    uuid: 'abc',
    room: 'bedroom',
    type: 'ceiling-lamp',
    depends: [bedroomSwitch1.uuid, bedroomSwitch2.uuid],
};

const camera: ServiceEntry = {
    uuid: 'cam',
    room: 'bedroom',
    type: 'camera-motion-detect',
    depends: [],
};

const failureReasoner: ServiceEntry = {
    uuid: 'flr',
    room: null,
    type: 'failure-reasoner',
    depends: [bedroomSwitch1.uuid, bedroomSwitch2.uuid],
};

const config: Map<ServiceType, ServiceEntry[]> = new Map([
    ['ceiling-lamp', [bedroomLamp]],
    ['light-switch', [bedroomSwitch1, bedroomSwitch2]],
    //['failure-reasoner', [failureReasoner]]
]);

let updateCount = 0;
