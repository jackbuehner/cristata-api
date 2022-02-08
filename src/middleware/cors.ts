import cors from 'cors';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4000',
  'https://thepaladin.cristata.app',
  'https://api.thepaladin.cristata.app',
  'https://thepaladin.dev.cristata.app',
  'https://api.thepaladin.dev.cristata.app',
  'https://thepaladin.news',
  'https://new.thepaladin.news',
  'https://dev.thepaladin.news',
  'https://4000-gray-guineafowl-g1n8eq87.ws-us30.gitpod.io',
];

const corsConfig: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow requests with no origin
    if (allowedOrigins.indexOf(origin) === -1) {
      const message = 'The CORS policy for this origin does not allow access from the particular origin:';
      return callback(new Error(message + origin), false);
    }
    return callback(null, true);
  },
  credentials: true, // set cookies on client
};

export { corsConfig, allowedOrigins };
