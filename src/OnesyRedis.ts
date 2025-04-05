import redis, { createClient } from 'redis';

import merge from '@onesy/utils/merge';
import stringify from '@onesy/utils/stringify';
import parse from '@onesy/utils/parse';
import { ConnectionError } from '@onesy/errors';
import OnesyLog from '@onesy/log';
import OnesySubscription from '@onesy/subscription';

export interface IMessageDataOptions {
  parse?: boolean;
}

export interface IOptions {
  uri?: string;
}

export const optionsDefault: IOptions = {};

export type IRedisClient = redis.RedisClientType<redis.RedisDefaultModules, any, any>;

class OnesyRedis {
  public client_: IRedisClient;
  public clientSubscriber: IRedisClient;
  public connected = false;
  private amalog: OnesyLog;
  private options_: IOptions = optionsDefault;
  // For listening on redis events
  public subscription = new OnesySubscription();

  public get options(): IOptions {
    return this.options_;
  }

  public set options(options: IOptions) {
    this.options_ = merge(options, optionsDefault);
  }

  public constructor(options: IOptions = optionsDefault) {
    this.options = options;

    this.amalog = new OnesyLog({
      arguments: {
        pre: [
          'Redis'
        ]
      }
    });
  }

  public async get(key: string, options = { parse: true }): Promise<any> {
    const client = await this.client;

    const value = await client.get(key);

    return options.parse ? parse(value) : value;
  }

  public async add(key: string, value: any): Promise<any> {
    const client = await this.client;

    return client.set(key, value);
  }

  // alias
  public set = this.add;

  public async remove(key: string): Promise<any> {
    const client = await this.client;

    return client.del(key);
  }

  // alias
  public delete = this.remove;

  public async subscribe(channels: string | string[], method: (message: string) => any, bufferMode?: boolean) {
    await this.connection;

    // we have to separate subscribe, publish client context
    const client = this.clientSubscriber;

    return client.subscribe(channels, method as any, bufferMode);
  }

  public async unsubscribe(channels: string | string[], method: (message: string) => any, bufferMode?: boolean): Promise<void> {
    const client = await this.client;

    return client.unsubscribe(channels, method as any, bufferMode);
  }

  public messageData(message: string, options: IMessageDataOptions = { parse: true }) {
    if (message) {
      const data = message;

      return options.parse ? parse(data) : data;
    }
  }

  public async publish(channel: string, data?: any, options = { serialize: true }): Promise<any> {
    const client = await this.client;

    const message = options.serialize ? stringify(data) : data;

    return client.publish(channel, message);
  }

  public get client(): Promise<IRedisClient> {
    return new Promise(async (resolve, reject) => {
      if (this.connected && this.client_) return resolve(this.client_);

      try {
        return resolve(await this.connect());
      }
      catch (error) {
        throw error;
      }
    });
  }

  // alias for the client
  public get connection(): Promise<IRedisClient> {
    return new Promise(async (resolve, reject) => {
      if (this.connected && this.client_) return resolve(this.client_);

      try {
        return resolve(await this.connect());
      }
      catch (error) {
        throw error;
      }
    });
  }

  public get disconnect(): Promise<void> {
    return new Promise(async resolve => {
      if (this.connected) {
        try {
          await this.client_.disconnect();

          this.amalog.important(`Disconnected`);

          this.connected = false;
          this.client_ = undefined;
          this.clientSubscriber = undefined;

          this.subscription.emit('disconnected');

          return resolve();
        }
        catch (error) {
          this.amalog.warn(`Connection close error`, error);

          this.subscription.emit('disconnect:error', error);

          throw new ConnectionError(error);
        }
      }

      return resolve();
    });
  }

  public async connect(): Promise<IRedisClient | undefined> {
    const { uri } = this.options;

    try {
      this.client_ = createClient({ url: uri });

      await this.client_.connect();

      this.clientSubscriber = this.client_.duplicate();

      await this.clientSubscriber.connect();

      this.amalog.info(`Connected`);

      this.connected = true;

      this.subscription.emit('connected');

      this.client_.on('end', () => this.amalog.important('Client closed'));

      return this.client_;
    }
    catch (error) {
      this.amalog.warn(`Connection error`, error);

      this.connected = false;

      this.subscription.emit('connect:error', error);

      throw new ConnectionError(error);
    }
  }

  // Be very careful with this one,
  // it removes all data in the redis,
  // usually used for testing only
  public async reset(): Promise<any> {
    if (this.connected) {
      const client = await this.client;

      if (client) return client.flushDb();
    }

    this.amalog.important(`All cleaned`);

    this.subscription.emit('reset');
  }

}

export default OnesyRedis;
