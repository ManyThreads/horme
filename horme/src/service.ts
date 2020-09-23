import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import fs from 'fs/promises'

import chalk from 'chalk'
import log from 'loglevel'
import mqtt from 'async-mqtt'

import { Subscription } from '../services/common'

import db from './db'
import getEnv from './env'
import util from './util'

/********** exports *******************************************************************************/

export default {
    configureServices,
    removeService
}

/********** exported types ************************************************************************/

/** The service UUID. */
export type Uuid = string
/** The string describing the type of a service. */
export type ServiceType = string
/** The process handle for a service */
export type ServiceProcess = ChildProcessWithoutNullStreams

export type ServiceSelection = [ServiceType, SelectedService[]][]

/** The description of an individual not yet started service instance. */
export interface ServiceDescription {
    uuid: Uuid
    type: ServiceType
    room: string | null
}

/** The description of an un-instantiated service and its dependencies. */
export interface SelectedService extends ServiceDescription {
    depends: Uuid[]
}

/********** internal types ************************************************************************/

/** The configuration for starting a service instance of a type. */
type ServiceConfig = {
    cmd: {
        exec: string
        args: string[]
    }
}

/** The handle to an actively running service instance. */
interface Service extends ServiceDescription {
    topic: string
    proc: ServiceProcess
    depends: Service[]
}

/********** module state **************************************************************************/

const env = getEnv.from_file()
/** The MQTT client used by the service configurator to exchange messages. */
const client = mqtt.connect(env.MQTT_HOST, env.MQTT_AUTH)
/** The hashmap containing all active instantiated services. */
const services: Map<Uuid, Service> = new Map()

/********** implementation ************************************************************************/

/** Instantiates and configures the set of services selected from the database. */
async function configureServices() {
    // query current service selection from database
    const result = await db.queryServiceSelection()
    // instantiate all not yet instantiated services, insert them into global map
    const instantiated = await instantiateServices(result)
    // set and configure all service dependencies
    await Promise.all(instantiated.map(args => configureService(...args)))
}

/** Removes the service with the given `uuid` and triggers a full service selection
 *  and configuration update. */
async function removeService(uuid: string) {
    // retrieve updated service selection from database
    const reconfiguration = await db.queryServiceSelection({ del: [uuid] })

    const previousServices = Array.from(services.values())
    const newServices = Array.from(reconfiguration.flatMap(([{ }, instances]) => {
        return instances.map(instance => instance.uuid)
    }))

    // determine services which are no longer present in updated service selection
    const removals = previousServices.filter(prev => !newServices.includes(prev.uuid))

    // remove all services no longer present in the new configuration and kill their respective
    // processes
    for (const service of removals) {
        log.warn(
            `${util.timestamp()}: ${chalk.yellow('killing process of service ' + chalk.underline(service.uuid))}`
        )

        service.proc.kill()
        services.delete(service.uuid)
    }

    // instantiate all new services
    const instantiatedServices = await instantiateServices(reconfiguration)

    // configure all newly instantiated services and re-configure all changed services
    log.info(`${util.timestamp()}: initiating service reconfiguration...`)
    await Promise.all(instantiatedServices.map(args => configureService(...args)))
}

/** Instantiates all (not yet instantiated) services in the given `selection`. */
async function instantiateServices(
    selection: ServiceSelection
): Promise<[Service, Uuid[]][]> {
    const promises = await Promise.all(selection.map(async ([type, selected]) => {
        const file = await fs.readFile(`./services/${type}/config.json`)
        const config = assertServiceConfig(JSON.parse(file.toString()))

        return await Promise.all(Array.from(selected.map(sel => instantiateService(sel, config))))
    }))

    return promises.flat()
}

/** Instantiates a service of the given type/description/config if it does not already exist. */
async function instantiateService(
    selected: SelectedService,
    config: ServiceConfig
): Promise<[Service, Uuid[]]> {
    const desc = selected as ServiceDescription
    const service = services.get(desc.uuid)
    if (service === undefined) {
        const topic = buildTopic(desc)
        const proc = startService(desc, config, topic)

        const entry: Service = {
            topic,
            proc,
            depends: [],
            ...desc
        }

        services.set(desc.uuid, entry)
        return [entry, selected.depends]
    } else {
        return [service, selected.depends]
    }
}

/** Sets the dependencies of the corresponding service instance */
async function configureService(service: Service, depends: Uuid[]) {
    let reconfigure = false
    const previous = service.depends

    const subs: Subscription[] = []
    const retained = previous.filter(prev => {
        if (depends.find(uuid => prev.uuid === uuid)) {
            subs.push({ uuid: prev.uuid, topic: prev.topic, type: prev.topic })
            return true
        } else {
            reconfigure = true
            return false
        }
    })

    const additions = depends.reduce((filtered, dep) => {
        const found = previous.find(prev => prev.uuid === dep)
        if (!found) {
            const dependency = services.get(dep)!
            subs.push({ uuid: dependency.uuid, topic: dependency.topic, type: dependency.type })
            reconfigure = true
            filtered.push(dependency)
        }

        return filtered
    }, [] as Service[])

    service.depends = retained.concat(additions)

    if (reconfigure) {
        const topic = `config/${service.topic}`
        await client.publish(topic, JSON.stringify({ subs: subs }), { qos: 2, retain: true })
        log.debug(`${util.timestamp()}: config message sent to '${topic}'`)
    }
}

// TODO: async-ify
function startService(
    desc: ServiceDescription,
    config: ServiceConfig,
    topic: string,
): ServiceProcess {
    const exec = config.cmd.exec.split(' ')
    const [path, args] = [exec.shift(), exec.concat([desc.uuid, topic]).concat(config.cmd.args)]

    if (path === undefined) {
        throw new Error('invalid command path in config file')
    } else {
        const proc = spawn(path, args)
        proc.stdout.on('data', (data: Buffer) => {
            console.log(`\tfrom '${desc.type}/${chalk.underline(desc.uuid)}' (stdout):`)
            const lines = data.toString('utf-8').split('\n')
            for (const line of lines) {
                console.log(`\t${line}`)
            }
        })

        proc.stderr.on('data', (data: Buffer) => {
            console.log(`\tfrom '${desc.type}/${chalk.underline(desc.uuid)}' (stderr):`)
            const lines = data.toString('utf-8').split('\n')
            for (const line of lines) {
                console.log(`\t${line}`)
            }
        })

        return proc
    }
}

/** Validates that `obj` is of type `ServiceConfig` or throws an error. */
function assertServiceConfig(obj: any): ServiceConfig {
    const isServiceConfig = (obj: any) => {
        if (typeof obj.cmd.exec !== "string" || !Array.isArray(obj.cmd.args)) {
            return false
        }

        return (obj.cmd.args as string[]).every(arg => typeof arg === 'string')
    }

    if (isServiceConfig(obj)) {
        return obj as ServiceConfig
    } else {
        throw new Error("invalid format of service config")
    }
}

/** Creates the topic for the service instance of the given service type. */
function buildTopic(instance: ServiceDescription): string {
    const base = instance.room !== null
        ? `${env.APARTMENT}/${instance.room}`
        : `${env.APARTMENT}/global`
    return `${base}/${instance.type}${instance.uuid}`
}