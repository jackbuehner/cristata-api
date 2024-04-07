import cors from 'cors';
import express from 'express';

if (!process.env.PORT) throw new Error('PORT not defined in env');

// create express app
const app = express();

// enable CORS for the app
app.use(cors({ origin: true }));

// always redirect troop-370 file urls since they no longer use Cristata
// but they want the old filestore urls to still work
app.get('/filestore/troop-370/:_id', (req, res) => {
  res.redirect(301, `https://troop370atlanta.org/cristata-filestore/${req.params._id}`);
});

app.listen(process.env.PORT, () => {
  console.log(`Cristata server stub listening on port ${process.env.PORT}!`);
});
