import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs/promises'

import mqtt from 'async-mqtt';

import { default as db, ServiceSelection } from './db';
import { APARTMENT, CONNECTION } from './env';
import util from './util';

/********** exports ******************************************************************************/

export default {
    configureServices,
    removeService
}

export type ServiceType = string;
export type ServiceInstanceEntry = [ServiceType, ServiceDescription];
export type ServiceProc = ChildProcessWithoutNullStreams;

/** The description of an individual not yet started service instance. */
export interface ServiceId {
    uuid: string;
    room: string | null;
}

/** The description of an un-instantiated service and its dependencies. */
export type ServiceDescription = ServiceId & { depends: ServiceDescription[] };

/** The configuration for starting a service instance of a type. */
export interface ServiceCommand {
    exec: string,
    args: string[]
}

/** The service execution configuration. */
export interface ServiceConfig {
    cmd: ServiceCommand,
}

/********** internal types ************************************************************************/

/** The handle to an actively running service instance. */
type ServiceHandle = {
    topic: string;
    proc: ServiceProc;
}

/** An instance of an instantiated but yet un-configured service. */
type InstantiatedService = ServiceDescription & ServiceHandle;
/** An instance of an instantiated and configured service. */
type ConfiguredService = ServiceId
    & { depends: ConfiguredService[] }
    & ServiceHandle
    & { reconfigure: boolean };

/********** module state **************************************************************************/

const client = mqtt.connect(CONNECTION);
const services: Map<ServiceType, ConfiguredService> = new Map();

/********** implementation ************************************************************************/

/** Instantiates and configures the set of services selected from the database. */
async function configureServices() {
    // query current service selection from database
    const result = await db.queryServiceSelection();
    // instantiate all not yet instantiated services, insert them into global map
    const instantiated = await instantiateServices(result);
    // set and configure all service dependencies
    await Promise.all(instantiated.map(([_, service]) => configureService(service)));
}

async function removeService(uuid: string) {
    const service = util.expect(services.get(uuid), 'removal of non-existing service requested');
    // retrieve updated service selection from database
    const reconfiguration = await db.queryServiceSelection({ del: [uuid] });
    // instantiate all new services
    const instantiatedServices = await instantiateServices(reconfiguration);

    // determine services which are no longer present in updated service selection
    const previousServices = Array.from(services.keys());
    const removals = previousServices.filter(uuid => !instantiatedServices
        .map(([uuid, _]) => uuid)
        .includes(uuid)
    );

    // remove no longer present services and kill their respective processes
    for (const uuid of removals) {
        const removed = services.get(uuid)!;
        removed.proc.kill();
        services.delete(uuid);
    }

    // update all service's dependencies
    for (const [uuid, instance] of instantiatedServices) {
        const service = services.get(uuid)!;
        const depends = instance.depends.map(dep => {
            // does the dependency exist in both configurations?
            const dependency = service.depends.find(curr => curr.uuid == dep.uuid);
            if (dependency !== undefined) {
                return dependency;
            } else {
                service.reconfigure = true;
                return services.get(dep.uuid)!;
            }
        })
    }

    for (const service of services.values()) {
        if (service.reconfigure) {

        }
    }
}

async function instantiateServices(
    selection: ServiceSelection
): Promise<[string, InstantiatedService][]> {
    const promises = Array.from(selection.services).map(async ([type, instances]) => {
        // retrieve configuration file for current service type
        const file = await fs.readFile(`./services/${type}/config.json`);
        const config = assertServiceConfig(file);

        return await Promise.all(instances.map(instance => {
            return instantiateService([type, instance], config);
        }));
    });

    return (await Promise.all(promises)).flat();
}

async function instantiateService(
    [type, desc]: ServiceInstanceEntry,
    config: ServiceConfig,
): Promise<[string, InstantiatedService]> {
    const id = desc as ServiceId;
    const instantiated = desc as InstantiatedService;

    const service = services.get(id.uuid);
    if (service === undefined) {
        // start new service it does not already exist
        const topic = buildTopic([type, desc]);
        const proc = startService(desc.uuid, topic, config);

        // insert service without dependency configuration
        services.set(desc.uuid, {
            uuid: id.uuid,
            room: id.room,
            depends: [],
            topic: topic,
            proc: proc,
            reconfigure: desc.depends.length == 0 ? false : true
        });

        instantiated.topic = topic;
        instantiated.proc = proc;
    } else {
        // otherwise return handle of existing service
        instantiated.topic = service.topic;
        instantiated.proc = service.proc;
    }

    return [id.uuid, instantiated];
}

async function configureService(instantiated: InstantiatedService) {
    const service = services.get(instantiated.uuid)!;
    if (!service.reconfigure) {
        return;
    }

    const topics = [];
    for (const dep of instantiated.depends) {
        const handle = services.get(dep.uuid);
        if (handle === undefined) {
            throw new Error('invalid service dependency (service not defined)');
        } else {
            topics.push(handle.topic);
            service.depends.push(handle);
        }
    }

    const configTopic = `${service.topic}/${service.uuid}/config`;
    await client.publish(
        configTopic, JSON.stringify({ subscribe: topics }),
        { qos: 1, retain: true }
    );

    service.reconfigure = false;
}

function startService(
    uuid: string,
    topic: string,
    config: ServiceConfig
): ServiceProc {
    const exec = config.cmd.exec.split(' ');
    const [path, args] = [exec.shift(), exec.concat([uuid, topic]).concat(config.cmd.args)];

    if (path === undefined) {
        throw new Error('invalid command path in config file');
    } else {
        const proc = spawn(path, args, {});
        proc.stdout.on('data', data => console.log(`${uuid}: ${data}`));
        proc.stderr.on('data', data => console.log(`${uuid} (err): ${data}`));

        return proc;
    }
}

function assertServiceConfig(obj: any): ServiceConfig {
    const isServiceConfig = (obj: any) => {
        if (typeof obj.exec !== "string" || !Array.isArray(obj.args)) {
            return false;
        }

        return (obj.args as string[]).every(arg => typeof arg === 'string');
    };

    if (isServiceConfig(obj)) {
        return obj as ServiceConfig;
    } else {
        throw new Error("invalid format of service config");
    }
}

/** Creates the topic for the service instance of the given service type. */
function buildTopic([type, instance]: ServiceInstanceEntry): string {
    const base = instance.room !== null
        ? `${APARTMENT}/room/${instance.room}`
        : `${APARTMENT}`;
    return base + '/' + type;
}