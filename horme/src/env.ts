import { LogLevelDesc } from 'loglevel'
import dotenv from 'dotenv'

dotenv.config();

export const LOG_LEVEL = 'debug';
export const APARTMENT = process.env.APARTMENT;
export const HOST = process.env.MQTT_HOST;
export const USER = process.env.MQTT_USER;
export const PASS = process.env.MQTT_PASS;