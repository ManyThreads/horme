import { Array, Literal, Null, String, Record, Union } from "runtypes";

export { default as env, Auth, Environment } from './env';
export { default as util } from './util';

/** The transmitted values of binary sensors. */
export const Value = Union(Literal('on'), Literal('off'));

/** The format for device messages. */
export const DeviceMessage = Record({
    uuid: String,
    type: String,
    value: Value,
});

/** The Service information sent with each configuration message. */
export const ServiceInfo = Record({
    topic: String,
    apartment: String,
    room: String,
    uuid: String,
    type: String,
    sensor: String.Or(Null)
});

/** The contents of a transmitted service subscription announcement. */
export const Subscription = Record({
    uuid: String,
    type: String,
    topic: String,
});

/** The format for configuration messages. */
export const ConfigMessage = Record({
    info: ServiceInfo,
    add: Array(Subscription),
    del: Array(Subscription),
});