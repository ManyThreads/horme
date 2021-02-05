import neo4j from 'neo4j-driver';
import util from './util';
import getEnv from './env';
import { SelectedService } from './service';

const env = getEnv.fromFile();
const logger = util.logger;
const driver = neo4j.driver('bolt://neo4j:7687', neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASS));

//reset whole database
export async function resetDatabase(): Promise<void>{
    const session = driver.session();
    logger.info('Reset Neoj database');
    await session.run('MATCH (n) DETACH DELETE n')
        .then(() => {
            session.close();});
}

//execute query with return
export async function returnQuery(n :string): Promise<string> {
    const session = driver.session();
    let entireResult = '';
    await session.run(n).then(result => {
        return result.records.map(record => { // Iterate through records
            entireResult = record.get('n'); // Access the name property from the RETURN statement
        });
    })
        .then(() => {
            session.close();});
    return entireResult;
}

//add all dependencies from services to other services
async function updateAllDependencies(config: [string, SelectedService[]][]) {

    //Reset all current dependencies, as device dependencies may change during reconfiguration
    await resetAllDependencies();

    for (const element of config) {
        for (const elem2 of element[1]) {
            for (const deps of elem2.depends) {

                //if dependency dev exists
                const dev: string = 'MATCH (n) WHERE n.uuid = \'' + deps + '\' RETURN n';
                const res = await returnQuery(dev);
                if (res != '') {

                    //check if relation already exists
                    const checkrel: string = 'MATCH (n)-[DEPENDS_ON]->(m) WHERE n.uuid = \'' + elem2.uuid + '\' AND m.uuid = \'' + deps + '\' RETURN n'; 
                    const result = await returnQuery(checkrel);
                    if (result == '') {

                        //create relation
                        const newrel: string = 'MATCH (n), (m) WHERE n.uuid = \'' + elem2.uuid + '\' AND m.uuid = \'' + deps + '\' CREATE (n)-[r:DEPENDS_ON]->(m)'; 
                        await returnQuery(newrel);
                    }
                }
            }
        }   
    }
}

//Reset all current dependencies
async function resetAllDependencies() {
    const session = driver.session();
    logger.info('Reset all Depends_Of relation');
    await session.run('MATCH ()-[r:DEPENDS_ON]-() DELETE r')
        .then(() => {
            session.close();});
    return;
}

export async function addConfigToDB(config: [string, SelectedService[]][]): Promise<void> {

    for (const element of config) {
        for (const elem2 of element[1]) {

            //Walkaround for illegal '-' in typename
            let type = elem2.type;
            type = type.split('-').join('_');

            //Check if Service does exist
            const a: string = 'MATCH (n:' + type + ' { uuid: \'' + elem2.uuid + '\' }) RETURN n';
            if (await returnQuery(a) == '') {
                const b: string = 'CREATE (n:' + type + ' { uuid: \'' + elem2.uuid + '\'})';
                await returnQuery(b);

                //check if Room exist
                if(elem2.room) {
                    const room: string = 'MATCH (n:Room { name: \'' + elem2.room + '\'}) RETURN n';
                    const me = await returnQuery(room);
                    if (me == '') {
                        const newroom: string = 'CREATE (n:Room { name: \'' + elem2.room + '\'})';
                        await returnQuery(newroom);
                    }

                    //set service and room in ralationship
                    const newroom: string = 'MATCH (n:Room), (m:' + type + ') WHERE n.name = \'' + elem2.room + '\' AND m.uuid = \'' + elem2.uuid + '\' CREATE (m)-[r:BELONGS_TO]->(n)'; 
                    await returnQuery(newroom);
                }
                
            }
        }
    }

    //Update current dependencies (based on config) after all nodes are created
    await updateAllDependencies(config);
}