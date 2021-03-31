import 'source-map-support/register';

import { env as getEnv, util } from 'horme-common';
import { FailureController } from './FailureController';
import { resetDatabase } from './neo4j';
import { PseudoPersistentStorage } from './db/PseudoPersistentStorage';
import { initStorage } from './db/testdata';
import { DefaultServiceController } from './service/DockerServiceController';

const env = getEnv.readEnvironment('reconf');
const logger = util.logger;

const storage = new PseudoPersistentStorage();
const service_controller = new DefaultServiceController(storage);

const cleanup = () => {
    service_controller.cleanUp();
    process.exit();
};

process.stdin.resume();
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

main().catch((err) => util.abort(err));

async function initServices() {
    (await storage.queryServices()).forEach(entry => {
        service_controller.startService(entry.uuid);
    });
}

async function main() {
    logger.setLogLevel(env.logLevel);
    await initStorage(storage);
    await resetDatabase();
    await initServices();
    const failure_controller = new FailureController(service_controller);
    await failure_controller.init();
    logger.info('initial configuration instantiated, listening...');
}
