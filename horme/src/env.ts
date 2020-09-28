import { LogLevelDesc } from 'loglevel'
import dotenv from 'dotenv'

import util from './util'

export default {
    from_file
}

/********** module state **************************************************************************/

let env: Env

////////////////////////////////////////////////////////////////////////////////////////////////////
// Env
////////////////////////////////////////////////////////////////////////////////////////////////////

/** Externally configured application environment */
export type Env = {
    APARTMENT: string
    MQTT_HOST: string
    MQTT_AUTH: Auth | undefined
    LOG_LEVEL: LogLevelDesc
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Auth
////////////////////////////////////////////////////////////////////////////////////////////////////

/** MQTT client authentication. */
export type Auth = {
    username: string
    pass: string | undefined
}

/********** functions *****************************************************************************/

// Returns global environment from .env file.
function from_file(): Env {
    if (env === undefined) {
        env = init_env()
    }

    return env
}

// Lazily initializes the module state.
function init_env(): Env {
    dotenv.config()
    return {
        APARTMENT: util.expect(process.env.APARTMENT, '.env file must specify "APARTMENT"'),
        MQTT_HOST: util.expect(process.env.MQTT_HOST, '.env file must specify "MQTT_HOST"'),
        MQTT_AUTH: parseMqttAuth(),
        LOG_LEVEL: parseLogLevel(),
    }
}

// Parses or returns log level from .env file or returns default ('error').
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

// Parses MQTT authentication, if specified.
function parseMqttAuth(): Auth | undefined {
    const [user, pass] = [process.env.MQTT_USER, process.env.MQTT_PASS];
    if (user === undefined && pass === undefined) {
        return undefined;
    } else if (typeof user === 'string') {
        return { username: user, pass: pass };
    } else {
        throw new Error(`.env file must also specify "MQTT_USER" if "MQTT_PASS" is specified`);
    }
}