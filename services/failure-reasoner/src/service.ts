import mqtt, { AsyncMqttClient } from "async-mqtt";
import { Static } from "runtypes";

import {
  ConfigMessage,
  DeviceMessage,
  Subscription,
  Value,
  util,
  env as getEnv,
} from "horme-common";

/********** service state *************************************************************************/

const env = getEnv.from_file();
const logger = util.logger;

/********** implementation ************************************************************************/

main().catch((err) => util.abort(err));

/** Asynchronous service entry point. */
async function main() {
  logger.getLogLevel().setLevel(env.LOG_LEVEL);
  const [_, topic, host] = process.argv.slice(3);
  logger.info(`failure-reasoner service online (${topic})`);

  const client = await mqtt.connectAsync(host, env.MQTT_AUTH);

  const service = new Service(topic, client);
  await service.init();
}

/********** internal types ************************************************************************/

type State = Static<typeof Value> | "unknown";
type Subscription = Static<typeof Subscription>;

type LightSwitch = {
  sub: Subscription;
  state: State;
};

class Service {
  private topics: { service: string; config: string };
  private client: AsyncMqttClient;
  private observed: Map<string, LightSwitch> = new Map();

  /** construct service instance and register MQTT listener */
  constructor(topic: string, client: AsyncMqttClient) {
    this.topics = { service: topic, config: `conf/${topic}` };
    this.client = client;

    this.client.on("message", (topic, msg) => {
      let promise;
      switch (topic) {
        case this.topics.config:
          promise = this.handleConfigMessage(msg.toString());
          break;
        default:
          const device = JSON.parse(msg.toString()) as {
            uuid: string;
            type: string;
          };
          const observed = this.observed.get(device.uuid);
          if (observed) {
            promise = this.handleDeviceMessage(topic, msg.toString(), observed);
          } else {
            throw new Error("message on un-subscribed topic received");
          }
      }

      promise.catch((err) => util.abort(err));
    });
  }

  /** Initializes the service instance */
  async init() {
    await this.client.subscribe(this.topics.config, { qos: 2 });
  }

  /** Handles configuration messages by updating the service's MQTT subscriptions. */
  private async handleConfigMessage(msg: string) {
    logger.debug(`config message received on topic '${this.topics.config}'`);
    const config = ConfigMessage.check(JSON.parse(msg));

    const del = config.del.map((sub) => `data/${sub.topic}`);
    const add = config.add.map((sub) => `data/${sub.topic}`);

    for (const sub of config.del) {
      this.observed.delete(sub.uuid);
    }

    for (const sub of config.add) {
      this.observed.set(sub.uuid, { sub, state: "unknown" });
    }

    if (del.length > 0) {
      await this.client.unsubscribe(del);
    }

    if (add.length > 0) {
      await this.client.subscribe(add);
    }

    logger.info(
      `(re-)configuration complete, ${add.length} added, ${del.length} removed`
    );

    /*const subs = ConfigMessage.check(JSON.parse(msg)).subs

        let unsubscribed = 0
        for (const [uuid, observed] of this.observed) {
            if (!subs.find(sub => sub.uuid === uuid)) {
                this.observed.delete(uuid)
                await this.client.unsubscribe(observed.sub.topic)
                unsubscribed += 1
            }
        }

        let subscribed = 0
        for (const sub of subs) {
            if (!this.observed.has(sub.uuid)) {
                this.observed.set(sub.uuid, {
                    sub: sub,
                    state: 'unknown',
                })

                await this.client.subscribe('data/' + sub.topic)
                subscribed += 1
            }
        }

        logger.info(`(re-)configuration complete, ${subscribed} added, ${unsubscribed} removed`)*/
  }

  private async handleDeviceMessage(
    topic: string,
    msg: string,
    observed: LightSwitch
  ) {
    logger.debug(`device message received on topic '${topic}'`);
    const deviceMsg = DeviceMessage.check(JSON.parse(msg));

    if (observed.state === "unknown" || observed.state !== deviceMsg.value) {
      observed.state = deviceMsg.value;
    } else {
      logger.warn("probable light-switch malfunction detected");

      const parts = topic.split("/");
      parts.shift();
      const failure = ["fail"].concat(parts).join("/");
      logger.debug(`sending failure message to topic '${failure}'`);

      await this.client.publish(
        failure,
        JSON.stringify({ uuid: observed.sub.uuid, reason: "unknown" }),
        { qos: 2 }
      );
    }
  }
}
