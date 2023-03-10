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
        if (msgid === 'msg_banned') this.part(channel).catch(() => { });
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
    this.client.on('globaluserstate' as any, async (tags: { 'emote-sets': string }) => {
      let needToUpdate = false;
      const emotesets = tags['emote-sets'].split(',');
      const oldKeys = Object.keys(this.emotesets).sort();
      if (oldKeys.length !== emotesets.length) needToUpdate = true;
      for (let i = 0; i < oldKeys.length && !needToUpdate; i += 1) {
        if (oldKeys[i] !== emotesets[i]) {
          console.log('difference', oldKeys[i], emotesets[i]);
          needToUpdate = true;
        }
      }
      if (!needToUpdate) return;
      console.log('updating emotesets...', oldKeys, emotesets);
      const helixEmotes: { set: any, name: any, id: any }[] = [];
      const promise = async () => {
        await Twitch.api('chat/emotes/set', { emote_set_id: emotesets.splice(0, 25) })
          .then((data: any) => helixEmotes.push(...data?.data?.map((emote: { emote_set_id: any; name: any; id: any }) => ({ set: emote.emote_set_id, name: emote.name, id: emote.id }))));
        if (emotesets.length) {
          await promise();
        }
      };
      if (emotesets.length) {
        await promise();
      }
      this.emotesets = {};
      for (let i = 0; i < helixEmotes?.length; i += 1) {
        if (!this.emotesets[helixEmotes[i].set]) this.emotesets[helixEmotes[i].set] = [];
        this.emotesets[helixEmotes[i].set].push({ code: helixEmotes[i].name, id: helixEmotes[i].id });
      }
    });
    this.client.on('message', async (channel: string, tags: ChatUserstate, message: string, self: boolean) => {
      if (self) return;
      let response: string = '';
      try {
        // console.time(`${tags.id}.${channel}.${message}`);
        response = await this.commands.runCommand(channel, tags, message);
      } catch (err: any) {
        if (err.name === 'CustomError') response = err.message;
        else {
          console.log(channel, message, err);
        }
      } finally {
        if (response) {
          if (process.env.NODE_ENV === 'production') {
            this.say(channel, response).catch((err) => { });
          }
          console.log(`<${channel.substring(1)}> ${response}`);
          // console.timeEnd(`${tags.id}.${channel}.${message}`);
          const db = await mongo.db;
          db.collection('channels').updateOne({ id: Number(tags['room-id']) }, { $inc: { count: 1 } });
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
    return this.client.say(channel, message);
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
    const now = Date.now();
    // console.time(`twitchapi.${now}.${path}?${querystring.stringify(qs)}`);
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
          // console.timeEnd(`twitchapi.${now}.${path}?${querystring.stringify(qs)}`);
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
