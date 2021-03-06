import { returnQuery } from './neo4j';
import { ServiceType, Uuid } from './service';
import fs from 'fs/promises';
import { env as getEnv, util, ConfigMessage, Subscription, ServiceConfig, ServiceInfo, parseAs } from 'horme-common';
import path from 'path';
import { QueryResult } from 'neo4j-driver';
import { instantiateService } from './service';

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
        //config.forEach(x =>
        for (const x of config) {

            //Walkaround for illegal '-' in typename
            let type = x.type;
            let newworld = type.split('-').join('_');

            // If Device does not exist, add it to DB
            const a: string = 'MATCH (n: Automation:' + newworld + ' { alias: \'' + x.alias + '\', mainDevices: \'' + x.mainDevices + '\', replacementDevices: \'' + x.replacementDevices + '\', online: \'' + x.online + '\', room: \'' + x.room + '\'  }) RETURN n';

            const query = await returnQuery(a);
            if (query.records.length == 0) {
                const b: string = 'CREATE (n: Automation:' + newworld + ' { alias: \'' + x.alias + '\', mainDevices: \'' + x.mainDevices + '\', replacementDevices: \'' + x.replacementDevices + '\', online: \'' + x.online + '\', room: \'' + x.room + '\', instantiated: \'false\' })';
                await returnQuery(b);
                const file = await fs.readFileSync(`./config/services/${type}.json`, 'utf8');
                const back = await parseAs(ServiceConfig, JSON.parse(file.toString()));
                if (!back) break;
                await instantiateService(x, back);
            }
        };
    };
};

//TODO: currently always first replacement devices from type t is used
//BUG: When searching a replacement device for a device which is offline and the device-group of the missing device-type is the same as a later main device, 
//  -  the replacement device could 'steal' the device of a later main-device, which then also needs a replacement device, as the main device is already in use.

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
        const e: string = 'MATCH (n: Automation: ' + type + ') WHERE n.online = \'true\' AND n.room = \'' + room + '\' AND NOT (n)-[:SUBSCRIBE]->() RETURN n.alias';
        let back = await returnQuery(e);
        if(back.records.length != 0){
            logger.info('Found replacement device(s). Yey!');
            return back.records[0].get('n.alias');
        }
    }
    return null;

}

async function initMissingAutomations() {
    logger.info('Try to add not instantiated devices to the database');

    // Search for devices which are not instantiated
    const a: string = 'MATCH (n: Automation) WHERE n.instantiated = \'false\' RETURN n.mainDevices';

    const res = await returnQuery(a);
    initiateDevices(res);
}

async function initiateDevices(res: QueryResult) {
    if (res.records.length != 0) {
        //iterate over all devices with main devices
        for(const record of res.records) {
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

                const e: string = 'MATCH (n: Automation) WHERE n.online = \'true\' AND n.alias = \'' + dev + '\' AND NOT (n)-[:SUBSCRIBE]->() RETURN n.alias';
                const res2 = await returnQuery(e);
                if (res2.records.length == 0) {
                    logger.warn('Device with alias \'' + dev + '\' is not online!');
                    //get alias from alternative
                    let alt = await alternativeConfiguration(dev);
                    if(alt) {
                        initRelationship(x, alt);
                    } else {
                        logger.info('No Device found :(');
                        return;
                    }
                } else {
                    initRelationship(x, dev);
                }
            }


        };
    } else {
        logger.error('got empty set');
    }
}

async function searchMainDevices() {

    logger.info('Searching for main devices');

    // Search for devices with all main devices
    const a: string = 'MATCH (n: Automation) WHERE NOT n.mainDevices = \'\' RETURN n.mainDevices, n.alias';

    const res = await returnQuery(a);
    initiateDevices(res);
}

async function initRelationship(dev1:string, dev2:string) {
    logger.info('Adding relation from \"' + dev1 + '\" to \"' + dev2 + '\".');
    const e: string = 'MATCH (n: Automation {alias: \'' + dev1 + '\'}), (m: Automation {alias: \'' + dev2 + '\'}) CREATE (m)-[r:SUBSCRIBE]->(n)';
    await returnQuery(e);
    const g: string = 'MATCH (n: Automation {alias: \'' + dev1 + '\'}) SET n.initiated = \'true\'';
    await returnQuery(g);
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
