import { Client, ChatUserstate } from 'tmi.js';
import { get } from 'https';
import querystring from 'querystring';
import CommandSingleton from './commands';
import Mongo from './mongo';

const mongo = Mongo.getInstance();

export default class Twitch {
  private static instance: Twitch;

  private client: Client;

  private commands = CommandSingleton.getInstance();

  public emotesets: any = {}

  private constructor() {
    this.client = new Client({
      options: { debug: false, joinInterval: 300 },
      logger: {
        error: (msg: string) => { },
        info: (msg: string) => { },
        warn: (msg: string) => { },
      },
      connection: {
        reconnect: true,
        secure: true,
      },
      identity: {
        username: 'bot-name',
        password: process.env.TWITCH_AUTH,
      },
    });
    this.client.on('notice', async (channel, msgid, message) => {
      if (msgid === 'msg_channel_suspended' || msgid === 'msg_banned') {
        if (msgid === 'msg_banned') this.part(channel).catch(() => {});
        const db = await mongo.db;
        db.collection('channels').updateOne({ name: channel.substring(1) }, { $unset: { name: '' } });
      }
    });
    this.client.on('connected', async () => {
      console.log('Connected to twitch');
    });
    Promise.resolve().then(async () => {
      const [channelsQuery, streamIds] = await Promise.all([
        (await mongo.db).collection('channels').find({ name: { $exists: true } }, { sort: { count: -1 } }).toArray(),
        Twitch.api('streams', { game_id: 29595, first: 100 }).then(({ data: streams }) => streams.map((stream: { user_id: any; }) => Number(stream.user_id))),
      ]);
      const liveStreamsToJoin = channelsQuery.filter((channel) => streamIds.includes(channel.id)).map((channel: { name: any; }) => channel.name);
      const channelsSort = new Set<string>(liveStreamsToJoin);
      channelsQuery.forEach((channel) => channelsSort.add(channel.name));
      const channels = Array.from(channelsSort.values());
      channels.unshift('9kmmrbot');
      this.client.getOptions().channels = channels;
      this.client.connect();
    });
    this.client.on('emotesets', (_, emotesets) => {
      this.emotesets = emotesets;
    });
    this.client.on('message', async (channel: string, tags: ChatUserstate, message: string, self: boolean) => {
      if (self) return;
      let response: string = '';
      try {
        response = await this.commands.runCommand(channel, tags, message);
      } catch (err) {
        if (err.name === 'CustomError') response = err.message;
        else {
          console.log(channel, message, err);
        }
      } finally {
        if (response) {
          if (process.env.NODE_ENV === 'production') {
            this.say(channel, response);
          }
          console.log(`<${channel.substring(1)}> ${response}`);
          const db = await mongo.db;
          db.collection('channels').updateOne({ id: tags['room-id'] }, { $inc: { count: 1 } });
        }
      }
    });
  }

  public static getInstance(): Twitch {
    if (!Twitch.instance) Twitch.instance = new Twitch();
    return Twitch.instance;
  }

  public join(channel: string) {
    return this.client.join(channel);
  }

  public part(channel: string) {
    return this.client.part(channel);
  }

  public say(channel: string, message: string) {
    this.client.say(channel, message);
  }

  public exit(): Promise<boolean> {
    return new Promise((resolve) => {
      this.client.disconnect().then(() => console.log('Manually disconnected from twitch')).then(() => {
        this.client.removeAllListeners();
        console.log('Removed all listeners from twitch');
        resolve(true);
      });
    });
  }

  public static api(path: string, qs?: querystring.ParsedUrlQueryInput): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = get('https://api.twitch.tv', {
        path: `/helix/${path}?${querystring.stringify(qs)}`,
        headers: {
          Authorization: `Bearer ${process.env.TWITCH_AUTH}`,
          'Client-ID': process.env.TWITCH_CLIENT_ID,
        },
      }, (result) => {
        let data = '';
        result.on('data', (chunk) => {
          data += chunk;
        });
        result.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      });
      req.on('error', (err) => {
        reject(err);
      });
    });
  }
}
