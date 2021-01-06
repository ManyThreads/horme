import { Array, Literal, String, Record, Union, Null } from 'runtypes';

export const Value = Union(Literal('on'), Literal('off'));

export const DeviceMessage = Record({
    uuid: String,
    type: String,
    value: Value,
});

export const Subscription = Record({
    uuid: String,
    type: String,
    topic: String,
});

export const ServiceInfo = Record({
    topic: String,
    apartment: String,
    room: String,
    uuid: String,
    type: String,
    sensor: String.Or(Null)
});

export const ConfigMessage = Record({
    info: ServiceInfo,
    add: Array(Subscription),
    del: Array(Subscription)
});