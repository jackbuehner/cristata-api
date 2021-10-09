import mongoose from 'mongoose';
import { config } from '../config';
import './articles.model';
import './photoRequests.model';
import './photos.model';
import './settings.model';
import './shorturl.model';

// destructure connection info from config
const { username, password, host, database, options } = config.database.connection;

// connect to mongoDB
mongoose.connect(`mongodb+srv://${username}:${password}@${host}/${database}?${options}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
});
