import { promisify } from 'util';

export default {
    abort,
    expect,
    timeout,
    timestamp,
}

/** asynchronous variant of setTimeout */
async function timeout(ms: number) {
    await (promisify(setTimeout))(ms);
}

/** aborts the app after an error */
function abort(err?: Error) {
    if (err !== undefined) {
        console.error(err);
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