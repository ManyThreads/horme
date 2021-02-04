import {
    Array,
    Literal,
    Number,
    Union,
    Static,
    String,
    Record,
    Null,
    Runtype,
} from "runtypes";

/** The transmitted values of binary sensors. */
export const Value = Union(Literal("on"), Literal("off"));
export type Value = Static<typeof Value>;

/** The format for device messages. */
export const DeviceMessage = Record({
    apartment: String,
    location: String,
    uuid: String,
    type: String,
    value: Value,
    sensor: String.Or(Null),
    timestamp: Number,
});
export type DeviceMessage = Static<typeof DeviceMessage>;

/** The format for a service failure message. */
export const FailureMessage = Record({
    uuid: String,
    reason: String,
});
export type FailureMessage = Static<typeof FailureMessage>;

/** The Service information sent with each configuration message. */
export const ServiceInfo = Record({
    topic: String,
    apartment: String,
    location: String,
    uuid: String,
    type: String,
    sensor: String.Or(Null),
});
export type ServiceInfo = Static<typeof ServiceInfo>;

/** The contents of a transmitted service subscription announcement. */
export const Subscription = Record({
    uuid: String,
    type: String,
    topic: String,
});
export type Subscription = Static<typeof Subscription>;

/** The format for configuration messages. */
export const ConfigMessage = Record({
    info: ServiceInfo,
    add: Array(Subscription),
    del: Array(Subscription),
});
export type ConfigMessage = Static<typeof ConfigMessage>;

/** The configuration for starting a service instance of a type. */
export const ServiceConfig = Record({
    image: String,
    args: Array(String),
});

/*export interface Automation {
    type: String;
    alias: String;
    mainDevices: [String];
    replacementDevices: [String];
    room: String;
    configMsg: String;
};*/

export type ServiceConfig = Static<typeof ServiceConfig>;

export const parseAs = <T, R extends Runtype<T>>(r: R, msg: any): Static<R> | undefined => {
    try {
        return r.check(msg);
    } catch (error) {
        return undefined;
    }
};