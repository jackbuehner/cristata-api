import { ConfigFunc, Configuration } from '../types/config';
import { database } from './database';

const config: ConfigFunc = (helpers): Configuration => ({
  database: database(helpers),
});

export { config };
