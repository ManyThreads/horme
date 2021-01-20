import { LogLevelDesc } from 'loglevel';
import dotenv from 'dotenv';

import util from './util';

export default { readEnvironment };

/** The externally configured environment. */
export type Environment = {
    logLevel: LogLevelDesc,
    host: string,
    auth?: MqttAuth,
};

/** The externally configured service environment */
export type ServiceEnvironment = Environment & { topic: string, uuid: string };

/** The MQTT authentication data. */
export type MqttAuth = {
    username: string,
    pass?: string,
};

// lazily initialized (reconf) environment
let env: Environment;

function readEnvironment(type: 'reconf'): Environment;
function readEnvironment(type: 'service'): ServiceEnvironment;

function readEnvironment(type: 'reconf' | 'service'): Environment | ServiceEnvironment {
    if (type === 'reconf') {
        if (env === undefined) {
            dotenv.config();
            env = Object.freeze({
                logLevel: parseLogLevel(),
                host: parseMqttHost(),
                auth: parseMqttAuth(),
            });
        }

        return env;
    } else {
        return {
            logLevel: parseLogLevel(),
            host: parseMqttHost(),
            auth: parseMqttAuth(),
            ...parseServiceEnvironment(),
        };
    }
}

/** Parses or returns log level from .env file or returns default ('error'). */
function parseLogLevel(): LogLevelDesc {
    const logLevel = process.env.HORME_LOG_LEVEL;
    if (typeof logLevel === 'undefined') {
        return 'error';
    } else {
        const levels = ['trace', 'debug', 'info', 'warn', 'error', 'silent'];
        if (levels.includes(logLevel)) {
            return logLevel as LogLevelDesc;
        }

        throw new Error(`env must specify valid "HORME_LOG_LEVEL" (${levels}), got "${logLevel}"`);
    }
}

/** Parses the MQTT host parameter string. */
function parseMqttHost(): string {
    return util.expect(process.env.HORME_MQTT_HOST, 'env must specify "HORME_MQTT_HOST"');
}

/** Parses MQTT authentication, if specified. */
function parseMqttAuth(): MqttAuth | undefined {
    const [user, pass] = [process.env.HORME_MQTT_USER, process.env.HORME_MQTT_PASS];
    if (user === undefined && pass === undefined) {
        return undefined;
    } else if (user !== undefined) {
        return { username: user, pass: pass };
    } else {
        throw new Error(
            'env must also specify "HORME_MQTT_USER" if "HORME_MQTT_PASS" is specified'
        );
    }
}

/** Parses environment variables required for services. */
function parseServiceEnvironment(): { topic: string, uuid: string } {
    const [topic, uuid] = [process.env.HORME_SERVICE_TOPIC, process.env.HORME_SERVICE_UUID];
    if (topic === undefined || uuid === undefined) {
        throw new Error(
            '(service) env must specifiy "HORME_SERVICE_TOPIC" and "HORME_SERVICE_UUID"'
        );
    } else {
        return { topic, uuid };
    }

}