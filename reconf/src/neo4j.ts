import neo4j, { Driver } from 'neo4j-driver';
import { env as getEnv, util } from 'horme-common';
import { ServiceEntry } from './db';
import { QueryResult } from 'neo4j-driver/types/result';

const env = getEnv.readEnvironment('reconf');
const logger = util.logger;
let driver: Driver;

//Connect to the Server
//As reconf is ready before neo4j has fully started, we need to wait to wait until a valid connection could be established 
export async function connectNeo4j() {
    logger.info('Connecting to Neo4j...');
    while(true) {
        try {
            let d = neo4j.driver('bolt://neo4j:7687', neo4j.auth.basic(env.neo.username, env.neo.pass));

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
export async function returnQuery(n :string): Promise<QueryResult> {
    if(driver === undefined) {
        await connectNeo4j();
    }
    const session = driver.session();
    let result = await session.run(n);
    return result;
}

//add all dependencies from services to other services
async function updateAllDependencies(config: [string, ServiceEntry[]][]) {
    if(driver === undefined) {
        await connectNeo4j();
    }

    //Reset all current dependencies, as device dependencies may change during reconfiguration
    await resetAllDependencies();
}

export async function updateDatabase(topic: string, message: string) {
    logger.error('topic: ' + topic);
    logger.error('message: ' + message);
}

//Reset all current dependencies
async function resetAllDependencies() {
    if(driver === undefined) {
        await connectNeo4j();
    }
    const session = driver.session();
    logger.info('Reset all Depends_Of relations...');
    await session.run('MATCH ()-[r:SUBSCRIBE]-() DELETE r')
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
        }
    }

    //Update current dependencies (based on config) after all nodes are created
    await updateAllDependencies(config);
}