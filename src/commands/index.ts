import { ChatUserstate } from 'tmi.js';
import Mongo from '../mongo';

const mongo = Mongo.getInstance();

export enum UserLevel {
  Everyone,
  Mods,
  ChannelOwner,
  GlobalMod
}

interface Command {
  triggers: string[]
  channels?: Number[]
  filename: string
  command: string,
  cooldown: number
}

export default class CommandSingleton {
  private static instance: CommandSingleton;

  private commands: Array<Command> = [];

  private constructor() {
    this.refreshCommands();
  }

  public static getInstance(): CommandSingleton {
    if (!CommandSingleton.instance) CommandSingleton.instance = new CommandSingleton();
    return CommandSingleton.instance;
  }

  public refreshCommands(): void {
    this.commands = [];
    mongo.db.then(async (db) => {
      this.commands = await db.collection('commands').find({}).toArray();
    });
  }

  private commandsCooldowns: { [key: string]: { [key: string]: ReturnType<typeof setTimeout> } } = {}

  public runCommand(channel: string, tags: ChatUserstate, message: string): Promise<string> {
    const args: string[] = message.split(' ');
    const commandName = args.shift()?.toLowerCase();
    for (let i = 0; i < this.commands.length; i += 1) {
      if (this.commands[i].triggers.includes(commandName as string)
        && (!this.commands[i].channels
          || this.commands[i].channels?.includes(Number(tags['room-id'] as string)))) {
        const {
          filename, command, cooldown,
        } = this.commands[i];
        if (!this.commandsCooldowns[tags['room-id'] as string]) this.commandsCooldowns[tags['room-id'] as string] = {};
        let offCooldown = !this.commandsCooldowns[tags['room-id'] as string][`${filename}/${command}`];
        if (offCooldown) {
          this.commandsCooldowns[tags['room-id'] as string][`${filename}/${command}`] = setTimeout(() => {
            delete this.commandsCooldowns[tags['room-id'] as string][`${filename}/${command}`];
          }, cooldown);
        }
        return new Promise((res, rej) => {
          Promise.resolve().then(async () => {
            const db = await mongo.db;
            const channelQuery = await db.collection('channels').findOne({ id: Number(tags['user-id']) });
            if (channelQuery?.globalMod) {
              offCooldown = true;
              clearTimeout(this.commandsCooldowns[tags['room-id'] as string][`${filename}/${command}`]);
              this.commandsCooldowns[tags['room-id'] as string][`${filename}/${command}`] = setTimeout(() => {
                delete this.commandsCooldowns[tags['room-id'] as string][`${filename}/${command}`];
              }, cooldown);
            }
            if (offCooldown) {
              import(filename).then((temp) => temp[command](channel, tags, commandName, ...args))
                .then((response) => {
                  if (response) res(response);
                })
                .catch((err) => rej(err));
            }
          });
        });
      }
    }
    return Promise.resolve('');
  }
}
