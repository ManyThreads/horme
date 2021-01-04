import { Array, Literal, String, Record, Union } from 'runtypes';

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

export const ConfigMessage = Record({
    add: Array(Subscription),
    del: Array(Subscription)
});