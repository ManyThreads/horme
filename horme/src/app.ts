import { CONNECTION } from './env';
import fail from './fail';
import serv from './service';
import util from './util';

main().catch(err => util.abort(err));

async function main() {
    await fail.setupFailureListener();

}