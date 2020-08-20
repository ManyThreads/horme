import { ServiceDescription, ServiceType } from './service'

export default {
    queryServiceSelection
}

export interface ConfigUpdates {
    del: string[];
}

export interface ServiceSelection {
    services: Map<ServiceType, ServiceDescription[]>;
}

async function queryServiceSelection(updates?: ConfigUpdates): Promise<ServiceSelection> {
    if (updates !== undefined) {
        console.assert(!was_reconfigured);
        console.assert(updates.del[0] === 'bri');
        bedroomLamp.depends = [bedroomSwitch2];
        failureReasoner.depends = [bedroomSwitch2, bedroomLamp];
        was_reconfigured = true;
    }

    return { services: config };
}

const bedroomSwitch1: ServiceDescription = { uuid: 'bri', room: 'bedroom', depends: [] };
const bedroomSwitch2: ServiceDescription = { uuid: 'fra', room: 'bedroom', depends: [] };
const bedroomLamp: ServiceDescription = {
    uuid: 'abc',
    room: 'bedroom',
    depends: [bedroomSwitch1, bedroomSwitch2]
};
const camera: ServiceDescription = { uuid: 'cam', room: 'bedroom', depends: [] };
const failureReasoner: ServiceDescription = {
    uuid: 'flr',
    room: null,
    depends: [bedroomSwitch1, bedroomSwitch2, bedroomLamp]
};

const config: Map<ServiceType, ServiceDescription[]> = new Map([
    ['ceiling-lamp', [bedroomLamp]],
    ['light-switch', [bedroomSwitch1, bedroomSwitch2]],
    ['failure-reasoner', [failureReasoner]]
]);

let was_reconfigured = false;
