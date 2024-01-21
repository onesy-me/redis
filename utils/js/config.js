const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../../', `.env.${process.env.NODE_ENV === 'test' ? 'test' : 'dev'}`);

dotenv.config({ path: envPath });

class Config {
  default = {
    redis: {}
  };

  get config() {
    return {
      redis: {
        uri: process.env.SERVICE_REDIS_URI || this.default.redis.uri
      },
    };
  }
}

module.exports = new Config();
