import { execSync } from "child_process";
import { parseAs, ServiceConfig } from "horme-common";
import { ServiceEntry, ServiceType } from "../PersistentStorage";
import fs from 'fs/promises';

/** Creates the topic for the service instance of the given service type. */
export const buildTopic = (entry: ServiceEntry): string => {
    const base =
        entry.room !== null
            ? `${process.env.HORME_APARTMENT}/${entry.room}`
            : `${process.env.HORME_APARTMENT}/global`;
    return `${base}/${entry.type}${entry.uuid}`;
}

export const getNetworkName = (): string => {
    const hostname = execSync(`docker inspect -f \"{{.Name}}\" $HOSTNAME`);
    const network = execSync(`docker inspect -f \"{{json .NetworkSettings.Networks }}\" ${hostname} `);
    const network_object = JSON.parse(network.toString());
    return Object.keys(network_object)[0];
}

export const readConfig = async (type: ServiceType): Promise<ServiceConfig | undefined> => {
    const file = await fs.readFile(`./config/services/${type}.json`);
    return parseAs(ServiceConfig, JSON.parse(file.toString()));
}