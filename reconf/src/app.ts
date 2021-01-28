import 'source-map-support/register';

import { env as getEnv, util } from 'horme-common';
import fail from './fail';
import srv from './service';

const env = getEnv.readEnvironment('reconf');
const logger = util.logger;

const cleanup = () => {
    srv.cleanUp();
    process.exit();
};

process.stdin.resume();
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

main().catch((err) => util.abort(err));

async function main() {
    logger.setLogLevel(env.logLevel);
    await fail.setupFailureListener();
    await srv.configureServices();
    logger.info('initial configuration instantiated, listening...');
}
