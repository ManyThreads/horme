import 'source-map-support/register'

import log from 'loglevel'

import env from './env'
import fail from './fail'
import srv from './service'
import util from './util'

const environment = env.from_file()

main().catch(err => util.abort(err))

async function main() {
    log.setLevel(environment.LOG_LEVEL);
    await fail.setupFailureListener();
    await srv.configureServices();
    console.log(`${util.timestamp()}: initial configuration instantiated, listening...`);
}