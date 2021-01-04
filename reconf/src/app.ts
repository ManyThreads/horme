import 'source-map-support/register';

import loglevel from 'loglevel';

import getEnv from './env';
import fail from './fail';
import srv from './service';
import util from './util';

const env = getEnv.fromFile();
const logger = util.logger;

main().catch(err => util.abort(err));

async function main() {
    loglevel.setLevel(env.LOG_LEVEL);
    await fail.setupFailureListener();
    await srv.configureServices();
    logger.info('initial configuration instantiated, listening...');
}