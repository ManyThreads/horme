import neo4j, { Session } from 'neo4j-driver'
import util from './util';
import getEnv from './env';

const env = getEnv.fromFile();
const logger = util.logger;

// testfucntion for executing queries
export async function testfunc() {
    var name = 'James';
    var a = `CREATE (n: Person {name: '${name}' }) RETURN n`;
    await noReturnQuery(a);
    var b: Promise<string> = returnQuery(a);
    let me: string = await b
    logger.info(me)
}

//executes a query without a return
export async function noReturnQuery(n :string){
  var driver = neo4j.driver('bolt://neo4j:7687', neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASS));
  var session = driver.session()
  logger.info(`Execute No-Return Query: '${n}'.`);
  await session.run(n)
  session.close();
  await driver.close();
}

//resets the whole database
export async function resetDatabase(){
  var driver = neo4j.driver('bolt://neo4j:7687', neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASS));
  var session = driver.session()
  logger.info(`Reset Neoj Database`);
  await session.run("MATCH (n) DETACH DELETE n");
  session.close();
  await driver.close();
}

//executes query with return
export async function returnQuery(n :string): Promise<string> {
  var driver = neo4j.driver('bolt://neo4j:7687', neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASS));
  var session = driver.session()
  logger.info(`Execute Return Query: '${n}'.`);
  var entireResult = ''
  await session.run(n).then(result => {
    return result.records.map(record => { // Iterate through records
      entireResult = record.get("n"); // Access the name property from the RETURN statement
    });
})
.then(() => {
  session.close();
  driver.close()});
  return entireResult
}