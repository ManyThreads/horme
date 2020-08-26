import { ServiceDescription, ServiceType, Uuid } from './service'

/********** exports ******************************************************************************/

export default {
    queryServiceSelection
}

/** Options for specifying which changes need to be made in the database. */
export interface ConfigUpdates {
    del: Uuid[];
}

export interface ServiceSelection {
    services: Map<ServiceType, ServiceDescription[]>;
}

/********** implementation ************************************************************************/

async function queryServiceSelection(updates?: ConfigUpdates): Promise<ServiceSelection> {
    if (updates) {
        if (updateCount === 0) {
            console.assert(updates.del[0] === 'fra');
            config.set('light-switch', [bedroomSwitch1]);
            bedroomLamp.depends = [bedroomSwitch1];
            failureReasoner.depends = [bedroomSwitch1];
            updateCount = 1;
        } else if (updateCount === 1) {
            console.assert(updates.del[0] === 'bri');
            config.set('camera-motion-detect', [camera]);
            bedroomLamp.depends = [];
            failureReasoner.depends = [];
            updateCount = 2;
        } else {
            throw new Error("exceeded bounds of static reconfiguration scenario");
        }
    }

    return { services: config };
}

const bedroomSwitch1: ServiceDescription = {
    uuid: 'bri',
    room: 'bedroom',
    type: 'light-switch',
    depends: []
};

const bedroomSwitch2: ServiceDescription = {
    uuid: 'fra',
    room: 'bedroom',
    type: 'light-switch',
    depends: []
};

const bedroomLamp: ServiceDescription = {
    uuid: 'abc',
    room: 'bedroom',
    type: 'ceiling-lamp',
    depends: [bedroomSwitch1, bedroomSwitch2]
};
const camera: ServiceDescription = {
    uuid: 'cam',
    room: 'bedroom',
    type: 'camera-motion-detect',
    depends: []
};

const failureReasoner: ServiceDescription = {
    uuid: 'flr',
    room: null,
    type: 'failure-reasoner',
    depends: [bedroomSwitch1, bedroomSwitch2]
};

const config: Map<string, ServiceDescription[]> = new Map([
    ['ceiling-lamp', [bedroomLamp]],
    ['light-switch', [bedroomSwitch1, bedroomSwitch2]],
    ['failure-reasoner', [failureReasoner]]
]);

let updateCount = 0;
