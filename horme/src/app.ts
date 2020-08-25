import fail from './fail';
import srv from './service';
import util from './util';

main().catch(err => util.abort(err));

async function main() {
    await fail.setupFailureListener();
    await srv.configureServices();
    console.log(`${util.timestamp()}: initial configuration instantiated, listening...`);
}