import Twitch from './twitch';
import Dota from './dota';
import Mongo from './mongo';

const dota = Dota.getInstance();
const twitch = Twitch.getInstance();
const mongo = Mongo.getInstance();
// Twitch.api('games', { name: 'Dota 2' }).then(({ data: [{ id }] }) => console.log(id));
// Twitch.api('streams', { game_id: 29595, first: 100 }).then(({ data: streams }) => console.log(JSON.stringify(streams.map((stream: { user_id: any; }) => stream.user_id))));
process.on('SIGTERM', () => {
  console.log('Received SIGTERM');
  Promise.all([
    twitch.exit(),
    dota.exit(),
    mongo.exit()]).then(() => process.exit(0));
});
