import chalk from 'chalk';
import loglevel from 'loglevel';

import { promisify } from 'util';

const logger = {
    trace: (msg: string) => loglevel.trace(`${timestamp()}: ${msg}`),
    debug: (msg: string) => loglevel.debug(`${timestamp()}: ${msg}`),
    warn: (msg: string) => loglevel.warn(chalk.yellow(`${timestamp()}: ${msg}`)),
    error: (msg: string) => loglevel.error(chalk.red(`${timestamp()}: ${msg}`)),
    info: (msg: string) => loglevel.info(`${timestamp()}: ${msg}`),
}

export default {
    abort,
    expect,
    logger,
    msg,
    timeout,
    timestamp,
}

/** Asynchronous variant of setTimeout */
async function timeout(ms: number) {
    await (promisify(setTimeout))(ms);
}

/** Aborts the app after an error */
function abort(err?: Error) {
    if (err !== undefined) {
        if (err.stack) {
            logger.error(chalk.red(err.stack));
        } else {
            logger.error(chalk.red(err));
        }
    }

    process.exit(1);
}

function msg(str: string): string {
    return `${timestamp()}: ${str}`
}

function expect<T>(maybe: T | undefined, err: string): T {
    if (maybe !== undefined) {
        return maybe!;
    } else {
        throw new Error(err);
    }
}

function timestamp(): string {
    const now = new Date().toUTCString();
    return `[${now}]`;
}