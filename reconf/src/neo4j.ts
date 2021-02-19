import neo4j, { Driver } from 'neo4j-driver';
import { env as getEnv, util } from 'horme-common';
import { ServiceEntry } from './db';

const env = getEnv.readEnvironment('reconf');
const logger = util.logger;
let driver: Driver;

//Connect to the Server
//As reconf is ready before neo4j has fully started, we need to wait to wait until a valid connection could be established 
export async function connectNeo4j() {
    logger.info('Connecting to Neo4j...');
    while(true) {
        try {
            let d = neo4j.driver('bolt://neo4j:7687', neo4j.auth.basic('neo4j', 'admin'));

            const session = d.session();
            const finish = await session.run('RETURN 1').then((server) => {
                if (server) {
                    return true;
                } else {
                    return false;
                }
            });
            if (await finish) {
                driver = d;
                logger.info('Connected to Neo4j!');
                return;
            }
            
        } catch (error) {}
    }
    
}

//reset whole database
export async function resetDatabase(): Promise<void>{
    if(driver === undefined) {
        await connectNeo4j();
    }
    const session = driver.session();
    logger.info('Reset Neo4j database...');
    await session.run('MATCH (n) DETACH DELETE n')
        .then(() => {
            session.close();});
}

//execute query with return
export async function returnQuery(n :string): Promise<string> {
    if(driver === undefined) {
        await connectNeo4j();
    }
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
async function updateAllDependencies(config: [string, ServiceEntry[]][]) {
    if(driver === undefined) {
        await connectNeo4j();
    }

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
    if(driver === undefined) {
        await connectNeo4j();
    }
    const session = driver.session();
    logger.info('Reset all Depends_Of relations...');
    await session.run('MATCH ()-[r:DEPENDS_ON]-() DELETE r')
        .then(() => {
            session.close();});
    return;
}

export async function addConfigToDB(config: [string, ServiceEntry[]][]): Promise<void> {
    if(driver === undefined) {
        await connectNeo4j();
    }
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