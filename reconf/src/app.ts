import 'source-map-support/register';

import loglevel from 'loglevel';

import { env as getEnv, util } from 'horme-common';
import fail from './fail';
import srv from './service';

const env = getEnv.fromFile();
const logger = util.logger;

main().catch(err => util.abort(err));

async function main() {
    loglevel.setLevel(env.LOG_LEVEL);
    await fail.setupFailureListener();
    await srv.configureServices();
    logger.info('initial configuration instantiated, listening...');
}