import { LogLevelDesc } from 'loglevel';
import dotenv from 'dotenv';

import util from './util';

export default { fromFile };

// lazily initialized environment
let env: Environment;

/** The externally configured environment. */
export type Environment = {
    LOG_LEVEL: LogLevelDesc,
    MQTT_HOST: string,
    MQTT_AUTH?: Auth,
};

/** The MQTT authentication data. */
export type Auth = {
    username: string,
    pass?: string,
};

/** Reads the deployment specific environment from the .env file in the parent directory. */
function fromFile(): Environment {
    if (env === undefined) {
        dotenv.config();
        env = {
            LOG_LEVEL: parseLogLevel(),
            MQTT_HOST: util.expect(process.env.MQTT_HOST, '.env file must specify "APARTMENT'),
            MQTT_AUTH: parseMqttAuth(),
        };
    }

    return env;
}

/** Parses or returns log level from .env file or returns default ('error'). */
function parseLogLevel(): LogLevelDesc {
    const logLevel = process.env.LOG_LEVEL;
    if (typeof logLevel === 'undefined') {
        return 'error';
    } else {
        const levels = ['trace', 'debug', 'info', 'warn', 'error', 'silent'];
        if (levels.includes(logLevel)) {
            return logLevel as LogLevelDesc;
        }

        throw new Error(`env must specify valid "LOG_LEVEL" (${levels}), got "${logLevel}"`);
    }
}

/** Parses MQTT authentication, if specified. */
function parseMqttAuth(): Auth | undefined {
    const [user, pass] = [process.env.MQTT_USER, process.env.MQTT_PASS];
    if (user === undefined && pass === undefined) {
        return undefined;
    } else if (user !== undefined) {
        return { username: user, pass: pass };
    } else {
        throw new Error('.env file must also specify "MQTT_USER" if "MQTT_PASS" is specified');
    }
}