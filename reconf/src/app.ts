import 'source-map-support/register';

import loglevel from 'loglevel';

import getEnv from './env';
import fail from './fail';
import srv from './service';
import util from './util';
import { testfunc } from './neo4j';

const env = getEnv.fromFile();
const logger = util.logger;

main().catch(err => util.abort(err));
async function main() {
    loglevel.setLevel(env.LOG_LEVEL);
    testfunc();
    await fail.setupFailureListener();
    await srv.configureServices();
    logger.info('initial configuration instantiated, listening...');
}