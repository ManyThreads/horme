import chalk from 'chalk';
import loglevel, { LogLevelDesc } from 'loglevel';

import { promisify } from 'util';

/** Logging function wrappers with timestamps for `loglevel`. */
const logger = Object.freeze({
    trace: (...msg: any[]): void => loglevel.trace(`${timestamp()}: ${msg}`),
    debug: (...msg: any[]): void => loglevel.debug(`${timestamp()}: ${msg}`),
    warn: (...msg: any[]): void => loglevel.warn(`${timestamp()}: ${chalk.yellow(msg)}`),
    error: (...msg: any[]): void => loglevel.error(`${timestamp()}: ${chalk.red(msg)}`),
    info: (...msg: any[]): void => loglevel.info(`${timestamp()}: ${msg}`),
    setLogLevel: (level: LogLevelDesc): void => loglevel.setLevel(level)
});

/** Exported functions and objects. */
export default { abort, expect, logger, timeout };

/** An asynchronous variant of setTimeout. */
async function timeout(ms: number): Promise<void> {
    await (promisify(setTimeout))(ms);
}

/** Aborts the app as reaction to an error. */
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

/** Returns the expected value or throws an error if it is undefined. */
function expect<T>(maybe: T | undefined, err: string): T {
    if (maybe !== undefined) {
        return maybe;
    } else {
        throw new Error(err);
    }
}

/** Returns a formatted timestamp string. */
function timestamp(): string {
    const now = new Date().toUTCString();
    return `[${now}]`;
}