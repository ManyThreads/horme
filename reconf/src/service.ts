import { spawn, ChildProcessWithoutNullStreams, execSync } from 'child_process';
import fs from 'fs/promises';

import chalk from 'chalk';
import mqtt from 'async-mqtt';
import { Array as ArrayType, Static, String, Record } from 'runtypes';

import db from './db';
import { env as getEnv, util, Subscription } from 'horme-common';

export default { cleanUp, configureServices, removeService };

/** The service UUID. */
export type Uuid = string;
/** The string describing the type of a service. */
export type ServiceType = string;
/** The process handle for a service */
export type ServiceProcess = ChildProcessWithoutNullStreams;

export type ServiceSelection = [ServiceType, SelectedService[]][];

/** The description of an individual not yet started service instance. */
export interface ServiceDescription {
    uuid: Uuid;
    type: ServiceType;
    room: string | null;
}

/** The description of an un-instantiated service and its dependencies. */
export interface SelectedService extends ServiceDescription {
    depends: Uuid[];
}

/** The configuration for starting a service instance of a type. */
const ServiceConfig = Record({
    //sensor: String.Or(Null),
    image: String,
    args: ArrayType(String),
});

type ServiceConfig = Static<typeof ServiceConfig>;

/** The handle to an actively running service instance. */
interface Service extends ServiceDescription {
    topic: string;
    proc: ServiceProcess;
    depends: Service[];
}

type Subscription = Static<typeof Subscription>;

const env = getEnv.readEnvironment('reconf');
const logger = util.logger;
/** The MQTT client used by the service configurator to exchange messages. */
const client = mqtt.connect(env.host, env.auth);
/** The hashmap containing all active instantiated services. */
const services: Map<Uuid, Service> = new Map();
const serviceNamePrefix = 'horme-';

/** Instantiates and configures the set of services selected from the database. */
async function configureServices(): Promise<void> {
    // query current service selection from database
    const result = await db.queryServiceSelection();
    // instantiate all not yet instantiated services, insert them into global map
    const instantiated = await instantiateServices(result);
    // set and configure all service dependencies
    await Promise.all(instantiated.map(args => configureService(...args)));
}

/** Removes the service with the given `uuid` and triggers a full service selection
 *  and configuration update. */
async function removeService(uuid: string): Promise<void> {
    // retrieve updated service selection from database
    const reconfiguration = await db.queryServiceSelection({ del: [uuid] });

    const previousServices = Array.from(services.values());
    const newServices = Array.from(reconfiguration.flatMap(([_, instances]) => {
        return instances.map(instance => instance.uuid);
    }));

    // determine services which are no longer present in updated service selection
    const removals = previousServices.filter(prev => !newServices.includes(prev.uuid));

    // remove all services no longer present in the new configuration and kill their respective
    // processes
    for (const service of removals) {
        logger.warn('killing process of service ' + chalk.underline(service.uuid));

        execSync(`docker stop ${serviceNamePrefix}${service.uuid}`);
        execSync(`docker rm ${serviceNamePrefix}${service.uuid}`);
        services.delete(service.uuid);
    }

    // instantiate all new services
    const instantiatedServices = await instantiateServices(reconfiguration);

    // configure all newly instantiated services and re-configure all changed services
    logger.info('initiating service reconfiguration...');
    await Promise.all(instantiatedServices.map(args => configureService(...args)));
}

function cleanUp(): void {
    execSync(`docker stop -t 1 $(docker ps -q -f "name=${serviceNamePrefix}")`);
    execSync(`docker rm $(docker ps -a -q -f "name=${serviceNamePrefix}")`);
}

/** Instantiates all (not yet instantiated) services in the given `selection`. */
async function instantiateServices(
    selection: ServiceSelection
): Promise<[Service, Uuid[]][]> {
    const promises = await Promise.all(selection.map(async ([type, selected]) => {
        const file = await fs.readFile(`./config/services/${type}.json`);
        const config = ServiceConfig.check(JSON.parse(file.toString()));

        return await Promise.all(Array.from(selected.map(sel => instantiateService(sel, config))));
    }));

    return promises.flat();
}

/** Instantiates a service of the given type/description/config if it does not already exist. */
async function instantiateService(
    selected: SelectedService,
    config: ServiceConfig
): Promise<[Service, Uuid[]]> {
    const desc: ServiceDescription = {
        uuid: selected.uuid,
        type: selected.type,
        room: selected.room,
    };

    const service = services.get(desc.uuid);
    if (service === undefined) {
        const topic = buildTopic(desc);
        const proc = startService(desc, config, topic);

        const entry: Service = {
            topic,
            proc,
            depends: [],
            ...desc,
        };

        services.set(desc.uuid, entry);
        return [entry, selected.depends];
    } else {
        return [service, selected.depends];
    }
}

/** Sets the dependencies of the corresponding service instance. */
async function configureService(service: Service, depends: Uuid[]) {
    let reconfigure = false;
    const previous = service.depends;

    const add: Subscription[] = [];
    const del: Subscription[] = [];

    // filter all services that will be retained from the previous configuration
    const retained = previous.filter(prev => {
        if (depends.find(uuid => prev.uuid === uuid)) {
            // if a previous service is found in the new configuration, keep it
            return true;
        } else {
            // ...otherwise filter it out
            del.push({ uuid: prev.uuid, topic: prev.topic, type: prev.topic });
            reconfigure = true;
            return false;
        }
    });

    // determine all services in the new configuration that were not present in the previous one
    const additions = depends.reduce((filtered, dep) => {
        const found = previous.find(prev => prev.uuid === dep);
        if (!found) {
            const dependency = services.get(dep)!;
            add.push({ uuid: dependency.uuid, topic: dependency.topic, type: dependency.type });
            reconfigure = true;
            filtered.push(dependency);
        }

        return filtered;
    }, [] as Service[]);

    service.depends = retained.concat(additions);

    if (reconfigure) {
        const topic = `conf/${service.topic}`;
        await client.publish(topic, JSON.stringify({ add, del }), { qos: 2, retain: true });
        logger.debug(`config message sent to '${topic}'`);
    }
}

function startService(
    desc: ServiceDescription,
    config: ServiceConfig,
    topic: string
): ServiceProcess {
    const serviceEnv = [
        'HORME_MQTT_HOST=' + env.host,
        'HORME_MQTT_USER=' + env.auth?.username,
        'HORME_MQTT_PASS=' + env.auth?.pass,
        'HORME_TOPIC=' + topic,
        'HORME_UUID=' + desc.uuid,
    ];

    const cmd = [
        'run', '-t',
        '--name', serviceNamePrefix + desc.uuid,
        '--env', serviceEnv.join(' '),
        config.image, config.args.join(' ')
    ];

    const instance = spawn('docker', cmd);
    instance.stdout.on('data', (data: Buffer) => {
        console.log(`\tfrom '${desc.type}/${chalk.underline(desc.uuid)}' (stdout):`);
        const lines = data.toString('utf-8').split('\n');
        for (const line of lines) {
            console.log(`\t${line}`);
        }
    });

    instance.stderr.on('data', (data: Buffer) => {
        console.log(`\tfrom '${desc.type}/${chalk.underline(desc.uuid)}' (stderr):`);
        const lines = data.toString('utf-8').split('\n');
        for (const line of lines) {
            console.log(`\t${line}`);
        }
    });

    return instance;
}

/** Creates the topic for the service instance of the given service type. */
function buildTopic(instance: ServiceDescription): string {
    const base = instance.room !== null
        ? `${process.env.HORME_APARTMENT}/${instance.room}`
        : `${process.env.HORME_APARTMENT}/global`;
    return `${base}/${instance.type}${instance.uuid}`;
}
