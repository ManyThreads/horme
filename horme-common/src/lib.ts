import { Array, Literal, Null, Number, Static, String, Record, Runtype, Union } from "runtypes";

export { default as env, MqttAuth, Environment, ServiceEnvironment } from './env';
export { default as util } from './util';

/** The transmitted values of binary sensors. */
const ValueR = Union(Literal("on"), Literal("off"));
export type Value = Static<typeof ValueR>

/** The format for device messages. */
const DeviceMessageR = Record({
    apartment: String,
    location: String,
    uuid: String,
    type: String,
    value: ValueR,
    sensor: String.Or(Null),
    timestamp: Number,
});
export type DeviceMessage = Static<typeof DeviceMessageR>;

/** The format for a service failure message. */
const FailureMessageR = Record({
    uuid: String,
    reason: String,
});
export type FailureMessage = Static<typeof FailureMessageR>;

/** The Service information sent with each configuration message. */
export const ServiceInfoR = Record({
    topic: String,
    apartment: String,
    location: String,
    uuid: String,
    type: String,
    sensor: String.Or(Null)
});
export type ServiceInfo = Static<typeof ServiceInfoR>;

/** The contents of a transmitted service subscription announcement. */
const SubscriptionR = Record({
    uuid: String,
    type: String,
    topic: String,
});
export type Subscription = Static<typeof SubscriptionR>;

/** The format for configuration messages. */
export const ConfigMessageR = Record({
    info: ServiceInfoR,
    add: Array(SubscriptionR),
    del: Array(SubscriptionR),
});
export type ConfigMessage = Static<typeof ConfigMessageR>;

/** The configuration for starting a service instance of a type. */
const ServiceConfigR = Record({
    sensor: String.Or(Null),
    cmd: Record({
        exec: String,
        args: Array(String)
    })
});

export type ServiceConfig = Static<typeof ServiceConfigR>

const checkT = <T, R extends Runtype<T>>(msg: any, r: R): T | undefined => {
    try {
        return r.check(msg);
    } catch (error) {
        return undefined;
    }
}

export const createDeviceMessage = (msg: any) => checkT<DeviceMessage, typeof DeviceMessageR>(msg, DeviceMessageR);
export const createFailureMessage = (msg: any) => checkT<FailureMessage, typeof FailureMessageR>(msg, FailureMessageR);
export const createServiceInfo = (msg: any) => checkT<ServiceInfo, typeof ServiceInfoR>(msg, ServiceInfoR);
export const createSubscription = (msg: any) => checkT<Subscription, typeof SubscriptionR>(msg, SubscriptionR);
export const createConfigMessage = (msg: any) => checkT<ConfigMessage, typeof ConfigMessageR>(msg, ConfigMessageR);
export const createServiceConfig = (msg: any) => checkT<ServiceConfig, typeof ServiceConfigR>(msg, ServiceConfigR);