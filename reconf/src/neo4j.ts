import neo4j, { Session } from 'neo4j-driver'
import util from './util';
import getEnv from './env';
import { SelectedService, ServiceSelection } from './service';

const env = getEnv.fromFile();
const logger = util.logger;
const driver = neo4j.driver('bolt://neo4j:7687', neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASS));

//resets the whole database
export async function resetDatabase(){
  var session = driver.session()
  logger.info(`Reset Neoj Database`);
  await session.run("MATCH (n) DETACH DELETE n");
  session.close();
}

//executes query with return
export async function returnQuery(n :string): Promise<string> {
  var session = driver.session()
  //logger.info(`[Neo4j] '${n}'.`);
  var entireResult = ''
  await session.run(n).then(result => {
    return result.records.map(record => { // Iterate through records
      entireResult = record.get("n"); // Access the name property from the RETURN statement
    });
})
.then(() => {
  session.close()});
  //driver.close()});
  return entireResult
}
var i = true;
export async function addConfigToDB(config: [string, SelectedService[]][]) {
  //if (i) {
    i = false
    for (const element of config) {
          for (const elem2 of element[1]) {

              //Walkaround for '-' in typename
              var type = elem2.type
              type = type.split('-').join('_')

              //Check if Service does exist
              var a: string = 'MATCH (n:' + type + ' { uuid: \'' + elem2.uuid + '\' }) RETURN n'
              if (await returnQuery(a) == "") {
                var b: string = 'CREATE (n:' + type + ' { uuid: \'' + elem2.uuid + '\'})'
                var wayne = await returnQuery(b)

                //check if Room exist
                if(elem2.room) {
                  var room: string = 'MATCH (n:Room { name: \'' + elem2.room + '\'}) RETURN n'
                  var me = await returnQuery(room)
                  if (me == "") {
                    var newroom: string = 'CREATE (n:Room { name: \'' + elem2.room + '\'})'
                    await returnQuery(newroom);
                  }

                  //set service and room in ralationship
                  var newroom: string = 'MATCH (n:Room), (m:' + type + ') WHERE n.name = \'' + elem2.room + '\' AND m.uuid = \'' + elem2.uuid + '\' CREATE (m)-[r:BELONGS_TO]->(n)' 
                  await returnQuery(newroom);
                }
                
              }
          }
        }
  //}
}