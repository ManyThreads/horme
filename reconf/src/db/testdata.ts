import { PersistentStorage } from "../PersistentStorage";

export const initStorage = async (storage: PersistentStorage) => {
    const bedroomSwitch1 = await storage.createService({ room: 'bedroom', type: 'light-switch', });
    const bedroomSwitch2 = await storage.createService({ room: 'bedroom', type: 'light-switch', });
    const bedroomLamp = await storage.createService({ room: 'bedroom', type: 'ceiling-lamp', });

    bedroomLamp.depends = [bedroomSwitch1.uuid, bedroomSwitch2.uuid];
    storage.updateService(bedroomLamp);
};