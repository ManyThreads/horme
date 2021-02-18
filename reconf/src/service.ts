import { spawn, ChildProcessWithoutNullStreams, execSync } from 'child_process';
import fs from 'fs/promises';

import chalk from 'chalk';
import mqtt from 'async-mqtt';

import db, { queryService, ServiceEntry, ServiceSelection } from './db';
import {
    env as getEnv,
    util,
    ConfigMessage,
    Subscription,
    ServiceConfig,
    ServiceInfo,
    parseAs,
} from 'horme-common';
import ServiceFactory from './service/ServiceFactory';

export default { cleanUp, configureServices, removeService, startService, stopService };

/** The service UUID. */
export type Uuid = string;
/** The string describing the type of a service. */
export type ServiceType = string;

/** The process handle for a service */
export type ServiceProcess = ChildProcessWithoutNullStreams;

/** The handle to an actively running service instance. */
export type ServiceHandle = {
    info: ServiceInfo;
    proc?: ServiceProcess;
    depends: ServiceHandle[];
    published_version: number; ///< The currently published config version
};

const env = getEnv.readEnvironment('reconf');
const logger = util.logger;
/** The MQTT client used by the service configurator to exchange messages. */
const client = mqtt.connect(env.host, env.auth);
const services: Map<Uuid, ServiceHandle> = new Map();
const factory = new ServiceFactory();
const serviceNamePrefix = 'horme-';

/** Instantiates and configures the set of services selected from the database. */
async function configureServices(): Promise<void> {
    // query current service selection from database
    const result = await db.queryServiceSelection();
    // instantiate all not yet instantiated services, insert them into global map
    const instantiated = await instantiateServices(result);
    // set and configure all service dependencies
    await Promise.all(instantiated.map((args) => configureService(...args, true)));
}

/** Removes the service with the given `uuid` and triggers a full service selection
 *  and configuration update. */
async function removeService(uuid: string): Promise<void> {
    // retrieve updated service selection from database
    const reconfiguration = await db.queryServiceSelection({ del: [uuid] });

    const previousServices = Array.from(services.values());
    const newServices = Array.from(
        reconfiguration.flatMap(([_, instances]) => {
            return instances.map((instance) => instance.uuid);
        })
    );

    // determine services which are no longer present in updated service selection
    const removals = previousServices.filter((prev) => !newServices.includes(prev.info.uuid));

    // remove all services no longer present in the new configuration and kill their respective
    // processes
    for (const service of removals) {
        logger.warn('killing process of service ' + chalk.underline(service.info.uuid));

        stopService(service.info.uuid);
        services.delete(service.info.uuid);
    }

    // instantiate all new services
    const instantiatedServices = await instantiateServices(reconfiguration);

    // configure all newly instantiated services and re-configure all changed services
    logger.info('initiating service reconfiguration...');
    await Promise.all(instantiatedServices.map((args) => configureService(...args)));
}

async function startService(uuid: string) {
    const entry = await queryService(uuid);
    if (!entry) return;
    const config = await readConfig(entry.type);
    if (!config) return;

    logger.debug(`Start service ${uuid}`)

    const handle = getServiceHandle(entry);
    handle.info.version++; // TODO: not here..
    configureService(handle, entry.depends);
    const proc = _startService(entry, config, buildTopic(entry));
    handle.proc = proc;
    updateServiceHandle(handle);
}

async function stopService(uuid: string) {
    // stop and remove container, continue rm on stop failure
    execSync(`docker stop ${serviceNamePrefix}${uuid} || true && docker rm ${serviceNamePrefix}${uuid} || true`);
}

function cleanUp(): void {
    logger.info('stopping all docker containers.');
    execSync(`docker stop -t 1 $(docker ps -q -f "name=${serviceNamePrefix}")`);
    execSync(`docker rm $(docker ps -a -q -f "name=${serviceNamePrefix}")`);
}

/** Instantiates all (not yet instantiated) services in the given `selection`. */
async function instantiateServices(
    selection: ServiceSelection
): Promise<[ServiceHandle, Uuid[]][]> {
    const promises = await Promise.all(
        selection.map(async ([type, selected]) => {
            const config = await readConfig(type);
            if (!config) return [];
            return await Promise.all(
                Array.from(selected.map((sel) => instantiateService(sel, config)))
            );
        })
    );

    return promises.flat();
}

async function readConfig(type: ServiceType): Promise<ServiceConfig | undefined> {
    const file = await fs.readFile(`./config/services/${type}.json`);
    return parseAs(ServiceConfig, JSON.parse(file.toString()));
}

/** Instantiates a service of the given type/description/config if it does not already exist. */
async function instantiateService(
    entry: ServiceEntry,
    config: ServiceConfig
): Promise<[ServiceHandle, Uuid[]]> {

    const handle = services.get(entry.uuid);
    if (handle === undefined) {
        const topic = buildTopic(entry);
        const proc = _startService(entry, config, topic);
        const handle: ServiceHandle = factory.createServiceHandle(entry, topic);
        handle.proc = proc;

        updateServiceHandle(handle);
        return [handle, entry.depends];
    } else {
        updateServiceHandle(handle);
        return [handle, entry.depends];
    }
}

/** Sets the dependencies of the corresponding service instance. */
async function configureService(service: ServiceHandle, depends: Uuid[], init = false) {
    const { add, del } = setServiceDependencies(service, depends);
    const reconfigure = add.length && del.length;

    if (init || reconfigure || service.published_version !== service.info.version) {
        service.published_version = service.info.version;
        const topic = `conf/${service.info.topic}`;
        const msg: ConfigMessage = { add, del, info: service.info };
        const payload = JSON.stringify(msg);
        await client.publish(topic, payload, { retain: true });
        logger.debug(`config message sent to '${topic}', payload:\n\t${payload}`);
    }
}

function _startService(entry: ServiceEntry, config: ServiceConfig, topic: string): ServiceProcess {
    const cmd = [
        'run',
        '-t',
        '--rm',
        '--name',
        serviceNamePrefix + entry.uuid,
        '-e',
        'HORME_LOG_LEVEL=' + env.logLevel,
        '-e',
        'HORME_MQTT_HOST=' + env.host,
        '-e',
        'HORME_SERVICE_TOPIC=' + topic,
        '-e',
        'HORME_SERVICE_UUID=' + entry.uuid,
        '--network',
        'horme_default',
        config.image,
        config.args.join(' '),
    ];

    logger.debug(`Service start: ${cmd}`);
    const instance = spawn('docker', cmd);
    instance.stdout.on('data', (data: Buffer) => {
        console.log(`\tfrom '${entry.type}/${chalk.underline(entry.uuid)}' (stdout):`);
        const lines = data.toString('utf-8').split('\n');
        for (const line of lines) {
            console.log(`\t${line}`);
        }
    });

    instance.stderr.on('data', (data: Buffer) => {
        console.log(`\tfrom '${entry.type}/${chalk.underline(entry.uuid)}' (stderr):`);
        const lines = data.toString('utf-8').split('\n');
        for (const line of lines) {
            console.log(`\t${line}`);
        }
    });

    return instance;
}

function updateServiceHandle(handle: ServiceHandle): void {
    services.set(handle.info.uuid, handle);
}

/**
 * 
 * @param {ServiceEntry} entry The entry to retrieve the service handle for.
 * @return {ServiceHandle} The corresponding service for the given entry. If no handle exists a new instance is created.
 */
function getServiceHandle(entry: ServiceEntry): ServiceHandle {
    const handle = services.get(entry.uuid);
    if (handle === undefined) {
        const handle: ServiceHandle = factory.createServiceHandle(entry, buildTopic(entry));
        services.set(entry.uuid, handle);
        return handle;
    }
    return handle;
}

/**
 * 
 * @param {ServiceHandle} service The service handle to update.
 * @param {Uuid} depends The service uuids the given service depends on.
 * @return {{add: Subscription[], del: Subscription}} The subscription changes that need to be applied.
 */
function setServiceDependencies(service: ServiceHandle, depends: Uuid[]): { add: Subscription[], del: Subscription[] } {
    const previous = service.depends;

    const add: Subscription[] = [];
    const del: Subscription[] = [];

    // filter all services that will be retained from the previous configuration
    const retained = previous.filter((prev) => {
        if (depends.find((uuid) => prev.info.uuid === uuid)) {
            // if a previous service is found in the new configuration, keep it
            return true;
        } else {
            // ...otherwise filter it out
            del.push({
                uuid: prev.info.uuid,
                topic: prev.info.topic,
                type: prev.info.topic,
            });
            return false;
        }
    });

    // determine all services in the new configuration that were not present in the previous one
    const additions = depends.reduce((filtered, dep) => {
        const found = previous.find((prev) => prev.info.uuid === dep);
        if (!found) {
            const dependency = services.get(dep)!;
            filtered.push(dependency);
            add.push({
                uuid: dependency.info.uuid,
                topic: dependency.info.topic,
                type: dependency.info.type,
            });
        }

        return filtered;
    }, [] as ServiceHandle[]);

    service.depends = retained.concat(additions);
    return { add, del };
}

/** Creates the topic for the service instance of the given service type. */
export function buildTopic(entry: ServiceEntry): string {
    const base =
        entry.room !== null
            ? `${process.env.HORME_APARTMENT}/${entry.room}`
            : `${process.env.HORME_APARTMENT}/global`;
    return `${base}/${entry.type}${entry.uuid}`;
}
