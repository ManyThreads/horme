import { ServiceType, Uuid } from './service';
import fs from 'fs/promises';
import { env as getEnv, util, ConfigMessage, Subscription, ServiceConfig, ServiceInfo, parseAs } from 'horme-common';
import path from 'path';

export default { DataToDB };

/** The array of selected service type and instances. */
export type ServiceSelection = [ServiceType, ServiceEntry[]][];

export type AutomationSelection = [ServiceType, ServiceEntry[]][];
/** Options for specifying which changes need to be made in the database. */
export type ConfigUpdates = {
    del: Uuid[];
};
/** The description of an un-instantiated service and its dependencies. */
export type ServiceEntry = {
    /*uuid: Uuid;
    type: ServiceType;
    room: string | null;
    depends: Uuid[];*/
    type: string;
    alias: string;
    mainDevices: [string];
    replacementDevices: [string];
    room: string;
    configMsg: string;
};

/********** implementation ************************************************************************/

/*async function queryServiceSelection(updates?: ConfigUpdates): Promise<Array<ServiceEntry>> {
    var config = importAutomations();
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

    return null;
}
*/

async function DataToDB() {
    importAutomations();
    importDeviceGroups();
}

async function importAutomations() {
    const automationFolder = './config/automations/';
    const fs = require('fs');

    fs.readdirSync(automationFolder).forEach((file: any) => {
        let fullPath = path.join(automationFolder, file);
        let config: Array<ServiceEntry> = JSON.parse(fs.readFileSync(fullPath.toString(),'utf8'));
        config.forEach((test1) => {
            console.log(test1.type);
            // Add automation to DB
        })
    });
}

async function importDeviceGroups() {
    const deviceGroupsFolder = './config/device-groups/';
    const fs = require('fs');

    fs.readdirSync(deviceGroupsFolder).forEach((file: any) => {
        let fullPath = path.join(deviceGroupsFolder, file);
        let config: Array<ServiceEntry> = JSON.parse(fs.readFileSync(fullPath.toString(),'utf8'));
        config.forEach((test1) => {
            console.log(test1.type);
            // Add device group to DB
        })
    });
}

/*const bedroomSwitch1: ServiceEntry = {
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

const config: Map<ServiceType, Automation[]> = new Map([
    ['ceiling-lamp', [bedroomLamp]],
    ['light-switch', [bedroomSwitch1, bedroomSwitch2]],
    //['failure-reasoner', [failureReasoner]]
]);*/

//let updateCount = 0;
