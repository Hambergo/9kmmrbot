import Twitch from './twitch';
import Dota from './dota';
import Mongo, { ErrorsQuery } from './mongo';

const dota = Dota.getInstance();
const twitch = Twitch.getInstance();
const mongo = Mongo.getInstance();
process.on('uncaughtException', async (err) => {
  const db = await mongo.db;
  db.collection<ErrorsQuery>('errors').insertOne({
    message: err.message,
    name: err.name,
    stack: err.stack,
    createdAt: new Date(),
  }).catch(() => { }).then(() => console.log(err));
});
process.on('SIGTERM', () => {
  console.log('Received SIGTERM');
  Promise.all([
    twitch.exit(),
    dota.exit(),
    mongo.exit()]).then(() => process.exit(0));
});
