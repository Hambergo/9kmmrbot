import { ChatUserstate } from 'tmi.js';
import Mongo, { ChannelsQuery } from '../mongo';
import Twitch from '../twitch';

const twitch = Twitch.getInstance();
const mongo = Mongo.getInstance();

export async function join(channel: string, tags: ChatUserstate, commandName: string, ...args: string[]) {
  const db = await mongo.db;
  twitch.join(tags.username as string).catch((err) => { });
  db.collection<ChannelsQuery>('channels').updateOne({ id: Number(tags['user-id']) }, { $set: { name: tags.username } }, { upsert: true });
  return `Joining ${tags.username}`;
}

export async function part(channel: string, tags: ChatUserstate, commandName: string, ...args: string[]) {
  const db = await mongo.db;
  twitch.part(tags.username as string).catch((err) => { });
  db.collection<ChannelsQuery>('channels').updateOne({ id: Number(tags['user-id']) }, { $unset: { name: '' } }, { upsert: true });
  return `Leaving ${tags.username}`;
}
