import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs/promises'

import chalk from 'chalk';
import log from 'loglevel';
import mqtt from 'async-mqtt';

import { Subscription } from '../services/common';

import { default as db, ServiceSelection } from './db';
import { APARTMENT, HOST } from './env';
import util from './util';

/********** exports ******************************************************************************/

export default {
    configureServices,
    removeService
}

/** The service UUID. */
export type Uuid = string;
/** The string describing the type of a service. */
export type ServiceType = string;

export type ServiceInstanceEntry = [ServiceType, ServiceDescription];
export type ServiceProc = ChildProcessWithoutNullStreams;

/** The description of an individual not yet started service instance. */
export interface ServiceId {
    uuid: Uuid;
    room: string | null;
    type: ServiceType;
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
    & ServiceHandle;

/********** module state **************************************************************************/

/** The MQTT client used by the service configurator to exchange messages. */
const client = mqtt.connect(HOST, { username: 'horme', password: 'hormeadmin' });
/** The hashmap containing all active instantiated services. */
const services: Map<Uuid, ConfiguredService> = new Map();

/********** implementation ************************************************************************/

/** Instantiates and configures the set of services selected from the database. */
async function configureServices() {
    // query current service selection from database
    const result = await db.queryServiceSelection();
    // instantiate all not yet instantiated services, insert them into global map
    const instantiated = await instantiateServices(result);
    // set and configure all service dependencies
    await Promise.all(instantiated.map(([{ }, service]) => configureService(service)));
}

/** Removes the service with the given `uuid` and triggers a full service selection
 *  and configuration update. */
async function removeService(uuid: string) {
    // retrieve updated service selection from database
    const reconfiguration = await db.queryServiceSelection({ del: [uuid] });

    const previousServices = Array.from(services.keys());
    const newServices = Array.from(reconfiguration.services).flatMap(([{ }, instances]) => {
        return instances.map(instance => instance.uuid);
    });

    // determine services which are no longer present in updated service selection
    const removals = previousServices.filter(uuid => !newServices.includes(uuid));

    // remove all services no longer present in the new configuration and kill their respective
    // processes
    for (const uuid of removals) {
        log.warn(
            `${util.timestamp()}: ${chalk.yellow('killing process of service ' + chalk.underline(uuid))}`
        );

        const removed = services.get(uuid)!;
        removed.proc.kill();
        services.delete(uuid);
    }

    // instantiate all new services
    const instantiatedServices = await instantiateServices(reconfiguration);

    // configure all newly instantiated services and re-configure all changed services
    log.info(`${util.timestamp()}: initiating service reconfiguration...`);
    await Promise.all(instantiatedServices.map(([{ }, instantiated]) => {
        configureService(instantiated)
    }));
}

/** Instantiates all (not yet instantiated) services in the given `selection`. */
async function instantiateServices(
    selection: ServiceSelection
): Promise<[Uuid, InstantiatedService][]> {
    const promises = Array.from(selection.services).map(async ([type, instances]) => {
        // retrieve configuration file for current service type
        const file = await fs.readFile(`./services/${type}/config.json`);
        const config = assertServiceConfig(JSON.parse(file.toString()));

        // instantiate all instances of the current service type
        return Promise.all(instances.map(instance => instantiateService([type, instance], config)));
    });

    return (await Promise.all(promises)).flat();
}

/** Instantiates a service of the given type/description/config if it does not already exist. */
async function instantiateService(
    [type, desc]: ServiceInstanceEntry,
    config: ServiceConfig,
): Promise<[Uuid, InstantiatedService]> {
    const id = desc as ServiceId;
    const instantiated = desc as InstantiatedService;

    const service = services.get(id.uuid);
    if (service) {
        // service is already instantiated
        instantiated.topic = service.topic;
        instantiated.proc = service.proc;
    } else {
        // start new service if it does not already exist
        const topic = buildTopic([type, desc]);
        // TODO: use async version for 'spawn' (external dependency)
        const proc = startService(type, desc.uuid, topic, config);

        // insert service without dependency configuration
        services.set(desc.uuid, {
            uuid: id.uuid,
            room: id.room,
            type: type,
            depends: [],
            topic: topic,
            proc: proc
        });

        instantiated.topic = topic;
        instantiated.proc = proc;
    }

    return [id.uuid, instantiated];
}

/** Sets the dependencies of the corresponding service instance */
async function configureService(instantiated: InstantiatedService) {
    const service = util.expect(services.get(instantiated.uuid), 'expected instantiated service');
    const previous: [string, ConfiguredService][] = service.depends.map(dep => [dep.uuid, dep]);

    let reconfigure = false;
    const subs: Subscription[] = [];

    // determine whether any dependencies have changed (either removed or added)
    const retained = previous
        .filter(([uuid, service]) => {
            if (instantiated.depends.find(dep => dep.uuid === uuid)) {
                // if a service exists both in `instantiated` and in `previous` it is also part of
                // of the new configuration
                subs.push({
                    uuid: uuid,
                    topic: service.topic + '/' + uuid,
                    type: service.type,
                });
                return true;
            } else {
                // ...otherwise, at least one dependency has changed, requiring a new config message
                // to be sent
                reconfigure = true;
                return false;
            }
        })
        .map(([{ }, service]) => service);

    // determine only added dependencies
    const additions = instantiated.depends.reduce((filtered, dep) => {
        const result = previous.find(([uuid, { }]) => dep.uuid === uuid);
        if (!result) {
            const instance = util.expect(
                services.get(dep.uuid),
                'expected instantiated service'
            );

            subs.push({
                uuid: instance.uuid,
                topic: instance.topic + '/' + instance.uuid,
                type: instance.type,
            });

            // at least one dependency was added, requiring a new config message to be sent
            reconfigure = true;
            filtered.push(instance);
        }

        return filtered;
    }, [] as ConfiguredService[]);

    // set the service dependencies to the sum of all retained and added services
    service.depends = retained.concat(additions);

    if (reconfigure) {
        const configTopic = `config/${service.topic}/${service.uuid}`;
        await client.publish(
            configTopic, JSON.stringify({ subs: subs }),
            { qos: 2, retain: true }
        );
        log.debug(`${util.timestamp()}: config message sent to '${configTopic}'`);
    }
}

// TODO: async-ify
function startService(
    type: ServiceType,
    uuid: Uuid,
    topic: string,
    config: ServiceConfig
): ServiceProc {
    const exec = config.cmd.exec.split(' ');
    const [path, args] = [exec.shift(), exec.concat([uuid, topic]).concat(config.cmd.args)];

    if (path === undefined) {
        throw new Error('invalid command path in config file');
    } else {
        const proc = spawn(path, args);
        proc.stdout.on('data', (data: Buffer) => {
            console.log(`\tfrom '${type}/${chalk.underline(uuid)}' (stdout):`);
            const lines = data.toString('utf-8').split('\n');
            for (const line of lines) {
                console.log(`\t${line}`);
            }
        });

        proc.stderr.on('data', (data: Buffer) => {
            console.log(`\tfrom '${type}/${chalk.underline(uuid)}' (stderr):`);
            const lines = data.toString('utf-8').split('\n');
            for (const line of lines) {
                console.log(`\t${line}`);
            }
        });

        return proc;
    }
}

/** Validates that `obj` is of type `ServiceConfig` or throws an error. */
function assertServiceConfig(obj: any): ServiceConfig {
    const isServiceConfig = (obj: any) => {
        if (typeof obj.cmd.exec !== "string" || !Array.isArray(obj.cmd.args)) {
            return false;
        }

        return (obj.cmd.args as string[]).every(arg => typeof arg === 'string');
    };

    if (isServiceConfig(obj)) {
        return obj as ServiceConfig;
    } else {
        throw new Error("invalid format of service config");
    }
}

/** Creates the topic for the service instance of the given service type. */
function buildTopic([{ }, instance]: ServiceInstanceEntry): string {
    const base = instance.room !== null
        ? `${APARTMENT}/room/${instance.room}`
        : `${APARTMENT}`;
    return base;
}