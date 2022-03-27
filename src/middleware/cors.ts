import cors from 'cors';
import { Configuration } from '../types/config';

const corsConfig = (config: Configuration): cors.CorsOptions => ({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow requests with no origin
    if (config.allowedOrigins.indexOf(origin) === -1) {
      const message = 'The CORS policy for this origin does not allow access from the particular origin:';
      return callback(new Error(message + origin), false);
    }
    return callback(null, true);
  },
  credentials: true, // set cookies on client
});

export { corsConfig };
