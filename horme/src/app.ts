import loglevel from "loglevel";

import { util, env as getEnv } from "horme-common";
import fail from "./fail";
import srv from "./service";

const env = getEnv.from_file();
const logger = util.logger;

main().catch((err) => util.abort(err));

async function main() {
  loglevel.setLevel(env.LOG_LEVEL);
  await fail.setupFailureListener();
  await srv.configureServices();
  logger.info("initial configuration instantiated, listening...");
}
