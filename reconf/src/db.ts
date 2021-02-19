import { returnQuery} from './neo4j';
import { ServiceType, Uuid } from './service';
import fs from 'fs/promises';
import { env as getEnv, util, ConfigMessage, Subscription, ServiceConfig, ServiceInfo, parseAs } from 'horme-common';
import path from 'path';

export default { DataToDB };

/** The array of selected service type and instances. */
export type ServiceSelection = [ServiceType, ServiceEntry[]][];

export type DeviceGroup = {
    name: string;
    types: [string];
};

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

const logger = util.logger;

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
    
    await addConfigToDB(Array.from(config));

    return null;
}
*/

async function DataToDB() {
    await importAutomations();
    await importDeviceGroups();
    await searchMainDevices();
}

async function importAutomations() {
    logger.info('Import external Automations...');
    const automationFolder = './config/automations/';
    const fs = require('fs');

    fs.readdirSync(automationFolder).forEach(async (file: any) => {
        let fullPath = path.join(automationFolder, file);
        let config: Array<ServiceEntry> = JSON.parse(fs.readFileSync(fullPath.toString(),'utf8'));
        for(const x of config) {
            
            //Walkaround for illegal '-' in typename
            let type = x.type;
            type = type.split('-').join('_');

            // If Device does not exist, add it to DB
            const a: string = 'MATCH (n: Automation:' + type + ' { alias: \'' + x.alias + '\', mainDevices: \'' + x.mainDevices + '\', replacementDevices: \'' + x.replacementDevices + '\' }) RETURN n';
            
            const query = await returnQuery(a);
            if (query == '') {
                const b: string = 'CREATE (n: Automation:' + type + ' { alias: \'' + x.alias + '\', mainDevices: \'' + x.mainDevices + '\', replacementDevices: \'' + x.replacementDevices + '\' })';
                await returnQuery(b);
            }
        };
    });
}

async function searchMainDevices() {

    logger.info('searching for main devices');

    // Search for devices with all main devices
    const a: string = 'MATCH (n: Automation) WHERE NOT n.mainDevices = \'\' RETURN n.alias';
    const res = await returnQuery(a);
    logger.info(a);
    if ( res != '') {
        //iterate over all devices
        for(const x of res) {
            logger.info('searching for ' + x);

            //check if needed device is in database
            const d: string = 'MATCH (n: Automation) WHERE n.alias = \'' + x + '\' RETURN n.alias';
            const res1 = await returnQuery(d);
            if (res1 == '') {
                logger.warn('Device with alias \'' + x + '\' does not exist');
                break;
            }

            const e: string = 'MATCH (n: Automation) WHERE n.online = true RETURN n.alias';
            const res2 = await returnQuery(e);
            if (res2 == '') {
                logger.warn('Device with alias \'' + x + '\' is not online!');
                //rekonf
                break;
            } else {
                const e: string = 'MATCH (n,m: Automation) WHERE n.alias = \'' + x + '\' AND m.alias = \'' + d + '\' CREATE (n)-[r:SUBSCRIBE]->(m)';
                const res2 = await returnQuery(e);
            }
        }

        // search for main devices
        //const c: string = 'MATCH (n: Automation WHERE n.alias = \'\' ) RETURN n';
        //const b: string = 'CREATE (n: Automation:' + type + ' { alias: \'' + x.alias + '\', mainDevices: \'' + x.mainDevices + '\', replacementDevices: \'' + x.replacementDevices + '\' })';
        //await returnQuery(b);
    }
}

async function importDeviceGroups() {
    logger.info('Import external Device Groups...');
    const deviceGroupsFolder = './config/device-groups/';
    const fs = require('fs');
    console.log(deviceGroupsFolder);

    fs.readdirSync(deviceGroupsFolder).forEach(async (file: any) => {
        let fullPath = path.join(deviceGroupsFolder, file);
        let config: Array<DeviceGroup> = JSON.parse(fs.readFileSync(fullPath.toString(),'utf8'));
        for(const x of config) {

            //Walkaround for illegal '-' in typename
            let name = x.name;
            name = name.split('-').join('_');

            // Add device group to DB
            const a: string = 'MATCH (n: DeviceGroup:' + name + ' { alias: \'' + x.types + '\' }) RETURN n';
            if (await returnQuery(a) == '') {
                const b: string = 'CREATE (n: DeviceGroup:' + name + ' { alias: \'' + x.types + '\' })';
                await returnQuery(b);
            }
        };  
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
