import { returnQuery } from './neo4j';
import { setDependencies, ServiceType, Uuid } from './service';
import { ServiceConfig, parseAs, util } from 'horme-common';
import path from 'path';
import { QueryResult } from 'neo4j-driver';
import { createService } from './service';

export default { initializeDatabase };

const logger = util.logger;

/** The array of selected service type and instances. */
export type ServiceSelection = [ServiceType, ServiceEntry[]][];

export type DeviceGroup = {
    name: string;
    types: [string];
};

/** Options for specifying which changes need to be made in the database. */
export type ConfigUpdates = {
    del: Uuid[];
};
/** The description of an un-instantiated service and its dependencies. */
export type ServiceEntry = {
    type: string;
    uuid: string;
    mainDevices: [string];
    replacementDevices: [string];
    room: string;
    configMsg: string;
    online: boolean;
};

/********** implementation ************************************************************************/

async function initializeDatabase() {
    logger.info('Import external Services...');
    await importServices();
    logger.info('Import external DeviceGroups...');
    await importDeviceGroups();
    logger.info('Import external MainDevices...');
    await initMissingServices();
}

//TODO: check for redundant uuides
async function importServices() {
    const serviceFolder = './config/serviceconf/';
    const fs = require('fs');
    const files = await fs.readdirSync(serviceFolder);

    for (let file of files) {
        let fullPath = path.join(serviceFolder, file);
        let config: Array<ServiceEntry> = JSON.parse(fs.readFileSync(fullPath.toString(), 'utf8'));
        for (const x of config) {
            addService(x);
        };
    };
};

export async function getSEfromUuid(uuid: string): Promise<ServiceEntry | undefined> {
    const a: string = 'MATCH (n: Service { uuid: \'' + uuid + '\'}) RETURN n.type, n.uuid, n.mainDevices, n.replacementDevices, n.room, n.configMsg, n.online';
    const query = await returnQuery(a);
    if (query.records.length != 0) {
        let x = query.records[0];
        const entry: ServiceEntry = {
            type: x.get('n.type'),
            uuid: x.get('n.uuid'),
            mainDevices: x.get('n.mainDevices'),
            replacementDevices: x.get('n.replacementDevices'),
            room: x.get('n.room'),
            configMsg: x.get('n.configMsg'),
            online: x.get('n.online'),
        };
        return entry;
    }
    return undefined;
}

//TODO: currently always first replacement devices from type t is used
//BUG: When searching a replacement device for a device which is offline and the device-group of the missing device-type is the same as a later main device, 
//  -  the replacement device could 'steal' the device of a later main-device, which then also needs a replacement device, as the main device is already in use.

async function alternativeConfiguration(dev:string, to:string) {
    logger.info('searching alternative for device \'' + dev + '\'!');

    //get all importent attributes from dev
    const repldev: string = 'MATCH (n: Service) WHERE n.uuid = \'' + dev + '\' RETURN n.replacementDevices, n.room';
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

        //for each replacement type, search for devices in the current room
        const e: string = 'MATCH (n: Service: ' + type + '), ( m: Service ) WHERE n.online = \'true\' AND m.uuid = \'' + to + '\' AND n.room = \'' + room + '\' AND NOT (n)-[:SUBSCRIBE]->(m) RETURN n.uuid';
        let back = await returnQuery(e);
        if(back.records.length != 0){
            let newuuid = back.records[0].get('n.uuid');
            logger.debug('Found replacement device for \'' + dev + '\' with name \'' + newuuid + '\'');
            return newuuid;
        }
    }
    return null;

}

//remove service from db
//TODO: remove depends
export async function removeService(uuid: string): Promise<void> {
    const a: string = 'MATCH (n: Service { uuid: \'' + uuid + '\' }) RETURN n';
    let back = await returnQuery(a);
    if(back.records.length != 0){
        logger.info('Removing service with uuid \'' + uuid + '\'!');

        //DETACH implies that all relations are deleted too
        const removeQuery: string = 'MATCH (n: Service { uuid: \'' + uuid + '\' }) DETACH DELETE n';
        back = await returnQuery(removeQuery);
    }
}


//should be called when new devices are added to net network/switched state to online again
export async function initMissingServices() {
    // Search for devices which are not configured
    const a: string = 'MATCH (n: Service) WHERE n.configured = \'false\' AND NOT n.mainDevices = \'\' RETURN n.mainDevices, n.uuid';

    const res = await returnQuery(a);
    configureServices(res);
}


//create configurations for services
async function configureServices(res: QueryResult) {
    if (res.records.length != 0) {
        //iterate over all devices with main devices
        for(const record of res.records) {
            //iterate over all searched main devices
            let md = record.get('n.mainDevices');
            let x = record.get('n.uuid');
            var splitted = md.split(',', 30);
            for (let dev of splitted) {
                const d: string = 'MATCH (n: Service) WHERE n.uuid = \'' + dev + '\' RETURN n.uuid, n.replacementDevices';
                const res1 = await returnQuery(d);
                if (res1.records.length == 0) {
                    logger.warn('Device with uuid \'' + dev + '\' does not exist');
                    return;
                }

                const e: string = 'MATCH (n: Service), (m: Service) WHERE n.online = \'true\' AND n.uuid = \'' + dev + '\' AND m.uuid = \'' + x + '\' AND NOT (n)-[:SUBSCRIBE]->(m) RETURN n.uuid';
                const res2 = await returnQuery(e);
                if (res2.records.length == 0) {
                    logger.warn('Device with uuid \'' + dev + '\' is not available for this configuration!');
                    //get uuid from alternative
                    let alt = await alternativeConfiguration(dev, x);
                    if(alt) {
                        initRelationship(x, alt);
                    } else {
                        logger.info('No replacement device found for \'' + dev + '\'');
                        return;
                    }
                } else {
                    initRelationship(x, dev);
                }
                setDependencies(dev);
            }
            setDependencies(x);
            const finished: string = 'MATCH (n: Service { uuid: \'' + x + '\' }) SET n.configured = \'true\'';
            await returnQuery(finished);

        };

    } else {
        logger.error('got empty set');
    }
}

async function initRelationship(dev1:string, dev2:string) {
    logger.info('Adding relation from \"' + dev1 + '\" to \"' + dev2 + '\".');
    const e: string = 'MATCH (n: Service {uuid: \'' + dev1 + '\'}), (m: Service {uuid: \'' + dev2 + '\'}) CREATE (m)-[r:SUBSCRIBE]->(n)';
    await returnQuery(e);
    const g: string = 'MATCH (n: Service {uuid: \'' + dev1 + '\'}) SET n.initiated = \'true\'';
    await returnQuery(g);
    return;
}

//read device types from json
async function importDeviceGroups() {
    logger.info('Import external Device Groups...');
    const deviceGroupsFolder = './config/device-groups/';
    const fs = require('fs');
    const files = await fs.readdirSync(deviceGroupsFolder);

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

//create service based on a service entry
export async function addService(x: ServiceEntry){

    const fs = require('fs');

    //Walkaround for illegal '-' in typename
    let type = x.type;
    let newworld = type.split('-').join('_');

    // If Device does not exist, add it to DB
    const a: string = 'MATCH (n: Service:' + newworld + ' { uuid: \'' + x.uuid + '\', mainDevices: \'' + x.mainDevices + '\', replacementDevices: \'' + x.replacementDevices + '\', online: \'' + x.online + '\', room: \'' + x.room + '\'  }) RETURN n';

    const query = await returnQuery(a);
    if (query.records.length == 0) {

        //check if service can be configured (has main devices)
        if (x.mainDevices.length > 0) {
            const b: string = 'CREATE (n: Service:' + newworld + ' { uuid: \'' + x.uuid + '\', mainDevices: \'' + x.mainDevices + '\', replacementDevices: \'' + x.replacementDevices + '\', online: \'' + x.online + '\', room: \'' + x.room + '\', configured: \'false\' })';
            await returnQuery(b);
        } else {
            const b: string = 'CREATE (n: Service:' + newworld + ' { uuid: \'' + x.uuid + '\', mainDevices: \'' + x.mainDevices + '\', replacementDevices: \'' + x.replacementDevices + '\', online: \'' + x.online + '\', room: \'' + x.room + '\', configured: \'true\' })';
            await returnQuery(b);
        }
        const file = await fs.readFileSync(`./config/services/${type}.json`, 'utf8');
        const back = await parseAs(ServiceConfig, JSON.parse(file.toString()));
        if (!back) {
            return;
        } 
        await createService(x, back);
    }
}

