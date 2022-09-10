import cors from 'cors';

const corsConfig = (): cors.CorsOptions => ({
  origin: true,
  credentials: true, // set cookies on client
});

export { corsConfig };
