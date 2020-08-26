import chalk from 'chalk';
import log from 'loglevel';

import { promisify } from 'util';

export default {
    abort,
    expect,
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
            log.error(chalk.red(err.stack));
        } else {
            log.error(chalk.red(err));
        }
    }

    process.exit(1);
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