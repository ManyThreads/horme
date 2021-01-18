import chalk from 'chalk';
import loglevel from 'loglevel';

import { promisify } from 'util';

/** logging function wrappers for `loglevel` */
const logger = {
    trace: (msg: string): void => loglevel.trace(`${timestamp()}: ${msg}`),
    debug: (msg: string): void => loglevel.debug(`${timestamp()}: ${msg}`),
    warn: (msg: string): void => loglevel.warn(`${timestamp()}: ${chalk.yellow(msg)}`),
    error: (msg: string): void => loglevel.error(`${timestamp()}: ${chalk.red(msg)}`),
    info: (msg: string): void => loglevel.info(`${timestamp()}: ${msg}`),
};

export default {
    abort,
    expect,
    logger,
    timeout,
};

/** asynchronous variant of setTimeout */
async function timeout(ms: number): Promise<void> {
    await (promisify(setTimeout))(ms);
}

/** aborts the app after an error */
function abort(err?: Error): void {
    if (err !== undefined) {
        if (err.stack) {
            logger.error(chalk.red(err.stack));
        } else {
            logger.error(chalk.red(err));
        }
    }

    process.exit(1);
}

function expect<T>(maybe: T | undefined, err: string): T {
    if (maybe !== undefined) {
        return maybe;
    } else {
        throw new Error(err);
    }
}

function timestamp(): string {
    const now = new Date().toUTCString();
    return `[${now}]`;
}