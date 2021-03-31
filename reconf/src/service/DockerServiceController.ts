import { AsyncMqttClient, connect } from "async-mqtt";
import chalk from 'chalk';
import { execSync, spawn } from "child_process";
import { util, env as getEnv, ServiceConfig, ConfigMessage, Subscription } from "horme-common";
import { PersistentStorage, ServiceEntry } from "../PersistentStorage";
import { ServiceController, ServiceHandle, ServiceProcess, Uuid } from "../ServiceController";
import ServiceFactory from "./ServiceFactory";
import { buildTopic, getNetworkName, readConfig } from "./utils";

/**
 * Docker prefix used to identify all created sibling containers
 */
const serviceNamePrefix = 'horme-';

export class DefaultServiceController implements ServiceController {
    private env = getEnv.readEnvironment('reconf');
    private logger = util.logger;
    private services: Map<Uuid, ServiceHandle> = new Map();
    private factory = new ServiceFactory();
    private client: AsyncMqttClient;
    private storage: PersistentStorage;

    constructor(storage: PersistentStorage) {
        this.client = connect(this.env.host, this.env.auth);
        this.storage = storage;
    }
    cleanUp(): void {
        this.logger.info('stopping all docker containers.');
        execSync(`docker ps -a -q -f "name=${serviceNamePrefix}" | xargs -I {} docker stop -t 1 {} `);
        execSync(`docker ps -a -q -f "name=${serviceNamePrefix}" | xargs -I {} docker rm {} `);
    }
    async startService(service_id: Uuid): Promise<void> {
        const entry = await this.storage.queryService(service_id);
        if (!entry) return;
        const config = await readConfig(entry.type);
        if (!config) return;
        const topic = buildTopic(entry);

        let handle = this.services.get(service_id);
        if (handle === undefined) {
            handle = this.factory.createServiceHandle(entry, topic);
        }
        if (handle === undefined) {
            this.logger.error("");
            return;
        }
        handle.info.version++; // TODO: encapsule
        handle.last_update = new Date().getTime();
        this.configureService(handle, entry.depends);
        const proc = this.startDockerService(entry, config, topic);
        handle.proc = proc;
        this.services.set(handle.info.uuid, handle);
    }
    async stopService(service_id: Uuid): Promise<void> {
        // stop and remove container, continue rm on stop failure
        execSync(`docker stop ${serviceNamePrefix}${service_id} || true && docker rm ${serviceNamePrefix}${service_id} || true`);
    }
    async restartService(service_id: Uuid): Promise<void> {
        this.stopService(service_id);
        this.startService(service_id);
    }
    async removeService(service_id: Uuid): Promise<void> {
        // retrieve updated service selection from database
        // const reconfiguration = await this.storage.queryServiceSelection({ del: [service_id] });

        // const previousServices = Array.from(services.values());
        // const newServices = Array.from(
        //     reconfiguration.flatMap(([_, instances]) => {
        //         return instances.map((instance) => instance.uuid);
        //     })
        // );

        // // determine services which are no longer present in updated service selection
        // const removals = previousServices.filter((prev) => !newServices.includes(prev.info.uuid));

        // // remove all services no longer present in the new configuration and kill their respective
        // // processes
        // for (const service of removals) {
        //     logger.warn('killing process of service ' + chalk.underline(service.info.uuid));

        //     stopService(service.info.uuid);
        //     services.delete(service.info.uuid);
        // }

        // // instantiate all new services
        // const instantiatedServices = await instantiateServices(reconfiguration);

        // // configure all newly instantiated services and re-configure all changed services
        // logger.info('initiating service reconfiguration...');
        // await Promise.all(instantiatedServices.map((args) => configureService(...args)));
    }
    async getHandle(service_id: Uuid): Promise<ServiceHandle | undefined> {
        return this.services.get(service_id);
    }
    private async configureService(service: ServiceHandle, depends: Uuid[], init = false) {
        const { add, del } = this.setServiceDependencies(service, depends);
        const reconfigure = add.length && del.length;

        if (init || reconfigure || service.published_version !== service.info.version) {
            service.published_version = service.info.version;
            const topic = `conf/${service.info.topic}`;
            const msg: ConfigMessage = { add, del, info: service.info };
            const payload = JSON.stringify(msg);
            await this.client.publish(topic, payload, { retain: true });
            this.logger.debug(`config message sent to '${topic}', payload:\n\t${payload}`);
        }
    }

    /**
     * 
     * @param {ServiceHandle} service The service handle to update.
     * @param {Uuid} depends The service uuids the given service depends on.
     * @return {{add: Subscription[], del: Subscription}} The subscription changes that need to be applied.
     */
    private setServiceDependencies(
        service: ServiceHandle,
        depends: Uuid[]): { add: Subscription[], del: Subscription[] } {
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
                const dependency = this.services.get(dep)!;
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


    private startDockerService(entry: ServiceEntry, config: ServiceConfig, topic: string): ServiceProcess {
        const cmd = [
            'run',
            '-t',
            '--rm',
            '--name',
            serviceNamePrefix + entry.uuid,
            '-e',
            'HORME_LOG_LEVEL=' + this.env.logLevel,
            '-e',
            'HORME_MQTT_HOST=' + this.env.host,
            '-e',
            'HORME_SERVICE_TOPIC=' + topic,
            '-e',
            'HORME_SERVICE_UUID=' + entry.uuid,
            '--network',
            `${getNetworkName()}`,
            config.image,
            config.args.join(' '),
        ];

        this.logger.debug(`Service start: ${cmd}`);
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
}