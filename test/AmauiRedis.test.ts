/* tslint:disable: no-shadowed-variable */
import { assert } from '@onesy/test';

import OnesyRedis from '../src';

import Config from '../utils/js/config';

const options = {
  uri: Config.config.redis.uri
};

preAll(async () => {
  const redis = new OnesyRedis(options);

  await redis.reset();

  await redis.disconnect;
});

group('OnesyRedis', () => {
  let redis: OnesyRedis;
  const messages = [];

  pre(async () => {
    redis = new OnesyRedis(options);

    redis.subscription.subscribe(message => messages.push(message));
  });

  post(async () => {
    await redis.reset();

    await redis.disconnect;
  });

  group('client', () => {
    to('connect', async () => {
      await redis.client;

      assert(redis.connected).true;
      assert(messages).eql(['connected']);
    });

    to('disconnect', async () => {
      await redis.disconnect;

      assert(redis.connected).false;
      assert(messages).eql(['connected', 'disconnected']);
    });
  });

  to('reset', async () => {
    await redis.set('a', 'a14');

    let a = await redis.get('a');

    assert(a).eq('a14');

    await redis.reset();

    a = await redis.get('a');

    assert(a).not.exist;
  });

});
