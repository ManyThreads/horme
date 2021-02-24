import { returnQuery } from './neo4j';
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
    online: boolean;
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

//TODO: check for redundant aliases
async function importAutomations() {
    logger.info('Import external Automations...');
    const automationFolder = './config/automations/';
    const fs = require('fs');
    const files = await fs.readdirSync(automationFolder);

    //await fs.readdirSync(automationFolder).forEach(async (file: any) => {
    for (let file of files) {
        let fullPath = path.join(automationFolder, file);
        let config: Array<ServiceEntry> = JSON.parse(fs.readFileSync(fullPath.toString(), 'utf8'));
        for (const x of config) {

            //Walkaround for illegal '-' in typename
            let type = x.type;
            type = type.split('-').join('_');

            // If Device does not exist, add it to DB
            const a: string = 'MATCH (n: Automation:' + type + ' { alias: \'' + x.alias + '\', mainDevices: \'' + x.mainDevices + '\', replacementDevices: \'' + x.replacementDevices + '\', online: \'' + x.online + '\', room: \'' + x.room + '\'  }) RETURN n';

            const query = await returnQuery(a);
            if (query.records.length == 0) {
                const b: string = 'CREATE (n: Automation:' + type + ' { alias: \'' + x.alias + '\', mainDevices: \'' + x.mainDevices + '\', replacementDevices: \'' + x.replacementDevices + '\', online: \'' + x.online + '\', room: \'' + x.room + '\' })';
                await returnQuery(b);
            }
        };
    };
}

//TODO: currently always first replacement devices from type t is used
async function alternativeConfiguration(dev:string) {
    logger.info('searching alternative for device \'' + dev + '\'!');
    //get all importent attr from dev
    const repldev: string = 'MATCH (n: Automation) WHERE n.alias = \'' + dev + '\' RETURN n.replacementDevices, n.room';
    let realdev = await returnQuery(repldev);

    let devGroup = realdev.records[0].get('n.replacementDevices');
    let room = realdev.records[0].get('n.room');

    //get all types from group
    const grouprq: string = 'MATCH (n: DeviceGroup: ' + devGroup + ') RETURN n.devices';

    let groupres = await returnQuery(grouprq);
    
    //get device types (sorted by prio)
    var splitted = groupres.records[0].get('n.devices').split(',', 30);
    for (let type of splitted) {
        type = type.split('-').join('_');
        const e: string = 'MATCH (n: Automation: ' + type + ') WHERE n.online = \'true\' AND n.room = \'' + room + '\' RETURN n.alias';
        let back = await returnQuery(e);
        if(back.records.length != 0){
            logger.info('Found replacement device(s). Yey!');
            return back.records[0].get('n.alias');
        }
    }
    return null;

}

async function searchMainDevices() {

    logger.info('Searching for main devices');

    // Search for devices with all main devices
    const a: string = 'MATCH (n: Automation) WHERE NOT n.mainDevices = \'\' RETURN n.alias, n.mainDevices';

    const res = await returnQuery(a);

    if (res.records.length != 0) {
        //iterate over all devices with main devices
        res.records.forEach(async function (record) {
            //iterate over all searched main devices
            let md = record.get('n.mainDevices');
            let x = record.get('n.alias');
            var splitted = md.split(',', 30);

            for (let dev of splitted) {
                const d: string = 'MATCH (n: Automation) WHERE n.alias = \'' + dev + '\' RETURN n.alias, n.replacementDevices';
                const res1 = await returnQuery(d);
                if (res1.records.length == 0) {
                    logger.warn('Device with alias \'' + dev + '\' does not exist');
                    return;
                }

                const e: string = 'MATCH (n: Automation) WHERE n.online = \'true\' AND n.alias = \'' + dev + '\' RETURN n.alias';
                const res2 = await returnQuery(e);
                if (res2.records.length == 0) {
                    logger.warn('Device with alias \'' + dev + '\' is not online!');
                    //get alias from alternative
                    let alt = await alternativeConfiguration(dev);
                    if(alt) {
                        initRelationship(x, alt);
                    } else {
                        logger.info('No Device found :(');
                        // TODO remember not inited automations
                        return;
                    }
                } else {
                    initRelationship(x, dev);
                }
            }


        });

        // search for main devices
        //const c: string = 'MATCH (n: Automation WHERE n.alias = \'\' ) RETURN n';
        //const b: string = 'CREATE (n: Automation:' + type + ' { alias: \'' + x.alias + '\', mainDevices: \'' + x.mainDevices + '\', replacementDevices: \'' + x.replacementDevices + '\' })';
        //await returnQuery(b);
    } else {
        logger.error('got empty set');
    }
}

async function initRelationship(dev1:string, dev2:string) {
    logger.info('Adding relation from \"' + dev1 + '\" to \"' + dev2 + '\".');
    const e: string = 'MATCH (n: Automation {alias: \'' + dev1 + '\'}), (m: Automation {alias: \'' + dev2 + '\'}) CREATE (n)-[r:SUBSCRIBE]->(m)';
    await returnQuery(e);
    return;
}

async function importDeviceGroups() {
    logger.info('Import external Device Groups...');
    const deviceGroupsFolder = './config/device-groups/';
    const fs = require('fs');
    const files = await fs.readdirSync(deviceGroupsFolder);

    //await fs.readdirSync(deviceGroupsFolder).forEach(async (file: any) => {
    for (let file of files) {
        let fullPath = path.join(deviceGroupsFolder, file);
        let config: Array<DeviceGroup> = JSON.parse(fs.readFileSync(fullPath.toString(), 'utf8'));
        for (const x of config) {

            //Walkaround for illegal '-' in typename
            let name = x.name;
            name = name.split('-').join('_');

            // Add device group to DB
            const a: string = 'MATCH (n: DeviceGroup:' + name + ' { devices: \'' + x.types + '\' }) RETURN n';
            let res = await returnQuery(a);
            if (res.records.length == 0) {
                const b: string = 'CREATE (n: DeviceGroup:' + name + ' { devices: \'' + x.types + '\' })';
                await returnQuery(b);
            }
        };
    };
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
