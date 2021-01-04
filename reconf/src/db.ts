import { SelectedService, ServiceSelection, ServiceType, Uuid } from './service';

/********** exports ******************************************************************************/

export default {
    queryServiceSelection
};

/** Options for specifying which changes need to be made in the database. */
export interface ConfigUpdates {
    del: Uuid[];
}

/********** implementation ************************************************************************/

async function queryServiceSelection(
    updates?: ConfigUpdates
): Promise<ServiceSelection> {
    if (updates) {
        if (updateCount === 0) {
            console.assert(updates.del[0] === 'fra');
            config.set('light-switch', [bedroomSwitch1]);
            bedroomLamp.depends = [bedroomSwitch1.uuid];
            failureReasoner.depends = [bedroomSwitch1.uuid];
            updateCount = 1;
        } else if (updateCount === 1) {
            console.assert(updates.del[0] === 'bri');
            config.set('camera-motion-detect', [camera]);
            bedroomLamp.depends = [];
            failureReasoner.depends = [];
            updateCount = 2;
        } else {
            throw new Error('exceeded bounds of static reconfiguration scenario');
        }
    }

    return Array.from(config);
}

const bedroomSwitch1: SelectedService = {
    uuid: 'bri',
    room: 'bedroom',
    type: 'light-switch',
    depends: []
};

const bedroomSwitch2: SelectedService = {
    uuid: 'fra',
    room: 'bedroom',
    type: 'light-switch',
    depends: []
};

const bedroomLamp: SelectedService = {
    uuid: 'abc',
    room: 'bedroom',
    type: 'ceiling-lamp',
    depends: [bedroomSwitch1.uuid, bedroomSwitch2.uuid]
};
const camera: SelectedService = {
    uuid: 'cam',
    room: 'bedroom',
    type: 'camera-motion-detect',
    depends: []
};

const failureReasoner: SelectedService = {
    uuid: 'flr',
    room: null,
    type: 'failure-reasoner',
    depends: [bedroomSwitch1.uuid, bedroomSwitch2.uuid]
};

const config: Map<ServiceType, SelectedService[]> = new Map([
    ['ceiling-lamp', [bedroomLamp]],
    ['light-switch', [bedroomSwitch1, bedroomSwitch2]],
    ['failure-reasoner', [failureReasoner]]
]);

let updateCount = 0;