export default {
    assertConfigMessage,
    assertDeviceMessage,
    assertState,
    assertSubscription,
    isSubscription,
}

export type State = 'on' | 'off';

export type DeviceMessage = {
    uuid: string;
    service: string;
    state: State;
}

export type Subscription = {
    uuid: string,
    topic: string,
    type: string;
}

export type ConfigMessage = {
    subs: Subscription[];
};

function assertConfigMessage(obj: any): ConfigMessage {
    if (Array.isArray(obj.subs)) {
        const allSubs = (obj.subs as any[]).every(sub => isSubscription(sub));
        if (allSubs) {
            return obj as ConfigMessage;
        }
    }

    throw new Error(`invalid config message format: ${JSON.stringify(obj)}`);
}

function isSubscription(obj: any): obj is Subscription {
    if (
        typeof obj.uuid === 'string'
        && typeof obj.topic === 'string'
        && typeof obj.type === 'string'
    ) {
        return true;
    } else {
        return false;
    }
}

function assertSubscription(obj: any): Subscription {
    if (isSubscription(obj)) {
        return obj as Subscription;
    } else {
        throw new Error('invalid subscription format');
    }
}

function assertState(obj: any): State {
    if (obj === 'on' || obj === 'off') {
        return obj as State;
    } else {
        throw new Error('invalid state format');
    }
}

function assertDeviceMessage(obj: any): DeviceMessage {
    if (
        typeof obj.uuid === 'string'
        && obj.type === 'light-switch'
        && (obj.state === 'on' || obj.state === 'off')
    ) {
        return obj as DeviceMessage;
    } else {
        throw new Error(`invalid format of device message: ${JSON.stringify(obj)}`);
    }
}