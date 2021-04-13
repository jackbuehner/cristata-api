import dotenv from 'dotenv';
import mongoose from 'mongoose';
import './articles.model';

// load environmental variables
dotenv.config();

// connect to mongoDB
mongoose.connect(
  `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@editor0.htefm.mongodb.net/db_2?retryWrites=true&w=majority`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  }
);
console.log(1);
