import 'source-map-support/register'

import log from 'loglevel';

import fail from './fail';
import srv from './service';
import util from './util';

main().catch(err => util.abort(err));

async function main() {
    log.setLevel('trace'); // TODO: read log level from .env
    await fail.setupFailureListener();
    await srv.configureServices();
    console.log(`${util.timestamp()}: initial configuration instantiated, listening...`);
}