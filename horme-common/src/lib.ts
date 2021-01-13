import { Array, Literal, Null, Number, String, Record, Union } from "runtypes";

export { default as env, MqttAuth, Environment, ServiceEnvironment } from './env';
export { default as util } from './util';

/** The transmitted values of binary sensors. */
export const Value = Union(Literal('on'), Literal('off'));

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

/** The format for a service failure message. */
export const FailureMessage = Record({
    uuid: String,
    reason: String,
});

/** The Service information sent with each configuration message. */
export const ServiceInfo = Record({
    topic: String,
    apartment: String,
    location: String,
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