import querystring from 'querystring';
import fs from 'fs';
import { get } from 'http';
import crypto from 'crypto';
import { ID } from '@node-steam/id';
import { Long } from 'mongodb';
import DotaLong from 'long';
import Mongo, {
  CardsQuery,
  ChannelsQuery, GameHistoryQuery, GamesQuery, PlayersQuery, RealTimeStatsPlayersQuery, RealTimeStatsQuery, RealTimeStatsTeamsQuery, RpsQuery,
} from './mongo';
import CustomError from './customError';
import Twitch from './twitch';

const Steam = require('steam');
const Dota2 = require('dota2');

const mongo = Mongo.getInstance();
const twitch = Twitch.getInstance();

const wait = (time: number) => new Promise((resolve) => { setTimeout(resolve, time || 0); });
const retry = (cont: number, fn: () => Promise<any>, delay: number): Promise<any> => fn().catch((err) => (cont > 0 ? wait(delay).then(() => retry(cont - 1, fn, delay)) : Promise.reject(err)));

const promiseTimeout = (promise: Promise<any>, ms: number, reason: string) => new Promise((resolve, reject) => {
  let timeoutCleared = false;
  const timeoutId = setTimeout(() => {
    timeoutCleared = true;
    reject(new CustomError(reason));
  }, ms);
  promise.then((result) => {
    if (!timeoutCleared) {
      clearTimeout(timeoutId);
      resolve(result);
    }
  }).catch((err) => {
    if (!timeoutCleared) {
      clearTimeout(timeoutId);
      reject(err);
    }
  });
});

type steamUserDetails = {
  account_name: string, password: string, sha_sentryfile?: Buffer
}

const generateRP = (txt: string) => {
  const temp: { [name: string]: any } = {};
  // eslint-disable-next-line no-control-regex
  txt.replace(/(?:^\x00([^\x00]*)\x00(.*)\x08$|\x01([^\x00]*)\x00([^\x00]*)\x00)/gm, (_match, ...args) => {
    if (args[0]) {
      temp[args[0]] = generateRP(args[1]);
    } else if (args[2]) {
      [, , , temp[args[2]]] = args;
    }
    return '';
  });
  return temp;
};
const emptyStringArray: string[] = [];
const generateObject = (txt: string) => {
  const temp: any = {};
  txt.replace(/(?:(\w+): (\w+|"[^"]*"))|(?:(\w+) { ([^}]*) })/g, (_match, ...args) => {
    if (args[0]) {
      if (temp[args[0]]) {
        temp[args[0]] = emptyStringArray.concat(temp[args[0]], [args[1].trim('"')]);
      } else {
        temp[args[0]] = args[1].trim('"');
      }
    } else if (args[2]) {
      if (temp[args[2]]) {
        temp[args[2]] = emptyStringArray.concat(temp[args[2]], [generateObject(args[3])]);
      } else {
        temp[args[2]] = generateObject(args[3]);
      }
    }
    return '';
  });
  return temp;
};

export default class Dota {
  private static instance: Dota;

  private steamClient;

  private steamUser;

  private steamRichPresence;

  private dota2;

  private getGames(lobbyIds: Long[], time: Date) {
    if (!this.dota2._gcReady || !this.steamClient.loggedOn) return;
    new Promise((resolve, reject) => {
      if (!this.dota2._gcReady || !this.steamClient.loggedOn) return;
      let games: any = [];
      let count = 0;
      const start_game = 90;
      const callbackSpecificGames = (data: { specific_games: boolean; game_list: any[]; start_game: number; }) => {
        if (data.specific_games) {
          games = games.concat(data.game_list.filter((game) => game.players && game.players.length > 0));
          count -= 1;
          if (count === 0) {
            this.dota2.removeListener('sourceTVGamesData', callbackSpecificGames);
            resolve(games.filter((game: { lobby_id: Long; }, index: number) => games.findIndex((g: { lobby_id: Long; }) => g.lobby_id === game.lobby_id) === index));
          }
        }
      };
      const callbackNotSpecificGames = (data: { specific_games: boolean; game_list: any[]; league_id: number; start_game: number; }) => {
        if (!data.specific_games) {
          games = games.concat(data.game_list.filter((game: { players: string | any[]; }) => game.players?.length > 0));
          if (data.league_id === 0 && start_game === data.start_game) {
            this.dota2.removeListener('sourceTVGamesData', callbackNotSpecificGames);
            if (lobbyIds.length) {
              this.dota2.on('sourceTVGamesData', callbackSpecificGames);
              while (lobbyIds.length > 0) {
                count += 1;
                const tempLobbyIds = lobbyIds.splice(0, 20).map((lobbyId) => new DotaLong(lobbyId.getLowBits(), lobbyId.getHighBits()));
                setTimeout(() => {
                  this.dota2.requestSourceTVGames({ lobby_ids: tempLobbyIds, start_game: 0 });
                }, 100 * (count - 1));
              }
            } else {
              resolve(games.filter((game: { lobby_id: Long; }, index: number) => games.findIndex((g: { lobby_id: Long; }) => g.lobby_id === game.lobby_id) === index));
            }
          }
        }
      };
      this.dota2.on('sourceTVGamesData', callbackNotSpecificGames);
      for (let start = 0; start < 100; start += 10) {
        setTimeout(() => {
          this.dota2.requestSourceTVGames({ start_game: start });
        }, 50 * start);
      }
    }).then(async (games: any) => {
      const db = await mongo.db;
      // eslint-disable-next-line no-param-reassign
      games = games
        .map((match: {
          average_mmr: number; game_mode: number; league_id: number;
          match_id: any; lobby_id: any; lobby_type: number; activate_time: any, deactivate_time: any,
          players: any; server_steam_id: any; weekend_tourney_bracket_round: any;
          weekend_tourney_skill_level: any;
        }) => ({
          average_mmr: match.average_mmr,
          activate_time: match.activate_time,
          deactivate_time: match.deactivate_time,
          game_mode: match.game_mode,
          league_id: match.league_id,
          match_id: new Long(match.match_id.low, match.match_id.high),
          lobby_id: new Long(match.lobby_id.low, match.lobby_id.high),
          lobby_type: match.lobby_type,
          players: match.players ? match.players.map((player: { account_id: number; hero_id: number; }) => ({
            account_id: player.account_id,
            hero_id: player.hero_id,
          })) : null,
          server_steam_id: new Long(match.server_steam_id.low, match.server_steam_id.high),
          weekend_tourney_bracket_round: match.weekend_tourney_bracket_round,
          weekend_tourney_skill_level: match.weekend_tourney_skill_level,
          createdAt: time,
        }))
        // .filter((match: { players: { hero_id: number; }[]; }) => !match.players.some((player: { hero_id: number; }) => player.hero_id === 0))
        .filter((match: { match_id: Long; }, index: number, self: { match_id: Long; }[]) => index === self.findIndex((tempMatch: { match_id: Long; }) => tempMatch.match_id.equals(match.match_id)));
      if (games.length) db.collection<GamesQuery>('games').insertMany(games);
      const gamesHistoryQuery = (await db.collection<GameHistoryQuery>('gameHistory').find({ match_id: { $in: games.map((game: { match_id: Long; }) => game.match_id) } }, { projection: { match_id: 1, players: 1 } }).toArray())
        .map((match) => {
          if (typeof match.match_id === 'number') {
            // eslint-disable-next-line no-param-reassign
            match.match_id = Long.fromNumber(match.match_id);
          }
          return match;
        });
      const filteredGames = games.filter((game: { match_id: Long; players: PlayersQuery[] }) => !game.players.some((player) => player.hero_id === 0) && !gamesHistoryQuery.some((historyGame: { match_id: Long; }) => game.match_id.equals(historyGame.match_id)));
      if (filteredGames.length) db.collection<GameHistoryQuery>('gameHistory').insertMany(filteredGames);
    });
  }

  private getRichPresence(accounts: string[]) {
    if (!this.dota2._gcReady || !this.steamClient.loggedOn) return;
    this.steamRichPresence.once('info', async (data: { rich_presence: string | any[]; }) => {
      const rps = [];
      const now = new Date();
      for (let i = 0; i < data.rich_presence.length; i += 1) {
        const temp = data.rich_presence[i].rich_presence_kv?.toString();
        if (temp?.length > 0) {
          const object = generateRP(temp);
          if (object.RP) {
            const rp = object.RP;
            rp.steam_id = Long.fromString(data.rich_presence[i].steamid_user);
            if (rp.watching_server) {
              rp.watching_server = Long.fromString(new ID(rp.watching_server).getSteamID64());
            }
            // let party = '';
            // const partyKeys = Object.keys(rp).filter((key) => key.startsWith('party')).sort();
            // partyKeys.forEach((key) => {
            //   party += rp[key];
            //   delete rp[key];
            // });
            // if (rp.BattleCup) {
            //   rp.BattleCup = generateObject(rp.BattleCup);
            // }
            // if (rp.lobby) {
            //   rp.lobby = generateObject(rp.lobby);
            // }
            // if (party) {
            //   rp.party = generateObject(party);
            // }
            if (rp.WatchableGameID === '0') {
              delete rp.WatchableGameID;
            } else if (rp.WatchableGameID) rp.WatchableGameID = Long.fromString(rp.WatchableGameID);
            rp.createdAt = now;
            if (!['#DOTA_RP_INIT', '#DOTA_RP_IDLE'].includes(rp.status)) {
              rps.push({
                status: rp.status,
                WatchableGameID: rp.WatchableGameID,
                watching_server: rp.watching_server,
                steam_id: rp.steam_id,
                createdAt: rp.createdAt,
                param0: rp.param0,
              });
            }
          }
        }
      }
      const lobbyIds = new Set<Long>();
      const db = await mongo.db;
      if (rps.length) {
        db.collection<RpsQuery>('rps').insertMany(rps);
        rps.filter((rp) => rp.WatchableGameID).forEach((rp) => lobbyIds.add(rp.WatchableGameID as Long));
        this.getGames(Array.from(lobbyIds), now);
      }
    });
    this.steamRichPresence.request(accounts);
  }

  private interval: ReturnType<typeof setTimeout>;

  private constructor() {
    this.steamClient = new Steam.SteamClient();
    this.steamUser = new Steam.SteamUser(this.steamClient);
    this.steamRichPresence = new Steam.SteamRichPresence(this.steamClient, 570);
    this.dota2 = new Dota2.Dota2Client(this.steamClient, false, false);
    const details: steamUserDetails = { account_name: process.env.STEAM_USER as string, password: process.env.STEAM_PASS as string };
    if (fs.existsSync('./volumes/servers.json')) {
      Steam.servers = JSON.parse(fs.readFileSync('./volumes/servers.json').toString());
    }
    if (fs.existsSync('./volumes/sentry')) {
      const sentry = fs.readFileSync('./volumes/sentry');
      if (sentry.length) details.sha_sentryfile = sentry;
    }
    this.interval = setInterval(async () => {
      if (!this.dota2._gcReady || !this.steamClient.loggedOn) return;
      const accounts = new Set<string>();
      const db = await mongo.db;
      const channelsQuery = await db.collection<ChannelsQuery>('channels').find({ name: { $exists: true, $ne: '' }, accounts: { $exists: true, $type: 'array' } }).toArray();
      channelsQuery.forEach((channel) => channel.accounts.forEach((account) => accounts.add(this.dota2.ToSteamID(account).toString())));
      this.getRichPresence(Array.from(accounts));
    }, 30000);
    this.steamClient.on('connected', () => {
      this.steamUser.logOn(details);
    });
    this.steamClient.on('logOnResponse', (response: { eresult: any; }) => {
      if (response.eresult === Steam.EResult.OK) {
        console.log('logged in to steam');
        this.dota2.launch();
      }
    });
    this.dota2.on('hellotimeout', () => {
      // this.dota2.Logger.debug = () => {};
      this.dota2.exit();
      setTimeout(() => {
        if (this.steamClient.loggedOn) this.dota2.launch();
      }, 30000);
      console.log('hello time out!');
      // this.steamClient.disconnect();
      // setTimeout(this.dota2.launch, 10000);
    });
    this.steamClient.on('loggedOff', () => {
      this.steamClient.connect();
      console.log('logged off from steam');
    });
    this.steamClient.on('error', (error: any) => {
      console.log(`steam error ${error}`);
      this.steamClient.connect();
    });
    this.steamClient.on('servers', (servers: {
      host: string,
      port: number
    }) => {
      fs.writeFileSync('./volumes/servers.json', JSON.stringify(servers));
    });
    this.steamUser.on('updateMachineAuth', (sentry: any, callback: any) => {
      const hashedSentry = crypto.createHash('sha1').update(sentry.bytes).digest();
      fs.writeFileSync('./volumes/sentry', hashedSentry);
      callback({
        sha_file: hashedSentry,
      });
    });
    this.dota2.on('ready', () => {
      console.log('connected to dota game coordinator');
    });
    this.dota2.on('unready', () => {
      console.log('disconnected from dota game coordinator');
    });
    this.steamClient.connect();
  }

  public static getInstance(): Dota {
    if (!Dota.instance) Dota.instance = new Dota();
    return Dota.instance;
  }

  public static async findGame(channelQuery: ChannelsQuery, allowSpectating: boolean = false) {
    const db = await mongo.db;
    if (!channelQuery?.accounts?.length) throw new CustomError('No accounts connected');
    const seconds: number = channelQuery.delay?.enabled ? channelQuery.delay.seconds || 30 : 0;
    const [gamesQuery, rpsQuery] = await Promise.all([db.collection<GamesQuery>('games').aggregate<GamesQuery>([
      { $match: { createdAt: { $gte: new Date(new Date().getTime() - 900000) } } },
      { $group: { _id: '$createdAt' } }, { $sort: { _id: -1 } }, { $skip: seconds / 30 }, { $limit: 1 },
      {
        $lookup: {
          from: 'games', localField: '_id', foreignField: 'createdAt', as: 'matches',
        },
      },
      { $unwind: '$matches' }, { $replaceRoot: { newRoot: '$matches' } },
      { $match: { 'players.account_id': { $in: channelQuery.accounts } } },
    ], { allowDiskUse: true }).toArray(),
    db.collection<RpsQuery>('rps').aggregate<RpsQuery>([
      { $match: { createdAt: { $gte: new Date(new Date().getTime() - 900000) } } },
      { $group: { _id: '$createdAt' } }, { $sort: { _id: -1 } }, { $skip: seconds / 30 }, { $limit: 1 },
      {
        $lookup: {
          from: 'rps', localField: '_id', foreignField: 'createdAt', as: 'rps',
        },
      },
      { $unwind: '$rps' }, { $replaceRoot: { newRoot: '$rps' } },
      {
        $match: {
          steam_id: {
            $in: channelQuery.accounts.map((account) => {
              const id = this.getInstance().dota2.ToSteamID(account);
              return id;
            }),
          },
        },
      },
    ], { allowDiskUse: true }).toArray(),
    ]);
    if (gamesQuery.length === 0 || gamesQuery[0] === undefined) {
      if (rpsQuery.length === 0 || !allowSpectating) throw new CustomError("Game wasn't found");
      if (rpsQuery[0].watching_server || rpsQuery[0].WatchableGameID) {
        const match = rpsQuery[0].WatchableGameID ? { lobby_id: rpsQuery[0].WatchableGameID } : { server_steam_id: rpsQuery[0].watching_server };
        const spectatedGames = await db.collection<GamesQuery>('games').aggregate<GamesQuery>([
          { $match: { createdAt: { $gte: new Date(new Date().getTime() - 900000) } } },
          { $group: { _id: '$createdAt' } }, { $sort: { _id: -1 } }, { $skip: seconds / 30 }, { $limit: 1 },
          {
            $lookup: {
              from: 'games', localField: '_id', foreignField: 'createdAt', as: 'matches',
            },
          },
          { $unwind: '$matches' }, { $replaceRoot: { newRoot: '$matches' } },
          { $match: match },
        ], { allowDiskUse: true }).toArray();
        if (spectatedGames.length) {
          if (spectatedGames[0] === undefined) throw new CustomError('Game wasn\'t found');
          if (spectatedGames[0].average_mmr > 5420 && spectatedGames[0].players.length === 10) {
            const sorted = await this.getRealTimeStats(spectatedGames[0]);
            spectatedGames[0].players.sort((p1, p2) => {
              const t1 = sorted.teams.find((team) => team.players.find((p) => p.accountid === p1.account_id)) as RealTimeStatsTeamsQuery;
              const t2 = sorted.teams.find((team) => team.players.find((p) => p.accountid === p2.account_id)) as RealTimeStatsTeamsQuery;
              const ps1 = t1.players.find((p) => p.accountid === p1.account_id) as RealTimeStatsPlayersQuery;
              const ps2 = t2.players.find((p) => p.accountid === p2.account_id) as RealTimeStatsPlayersQuery;
              return t1.team_number === t2.team_number ? ps1.playerid - ps2.playerid : t1.team_number - t2.team_number;
            });
          }
          return spectatedGames[0];
        }
      }
    }
    if (gamesQuery[0] === undefined) throw new CustomError('Game wasn\'t found');
    gamesQuery.sort((a, b) => b.activate_time - a.activate_time);
    if (gamesQuery[0].average_mmr > 5420 && gamesQuery[0].players.length === 10) {
      const sorted = await this.getRealTimeStats(gamesQuery[0]);
      if (sorted.teams) {
        gamesQuery[0].players.sort((p1, p2) => {
          const t1 = sorted.teams.find((team) => team.players.find((p) => p.accountid === p1.account_id)) as RealTimeStatsTeamsQuery;
          const t2 = sorted.teams.find((team) => team.players.find((p) => p.accountid === p2.account_id)) as RealTimeStatsTeamsQuery;
          const ps1 = t1.players.find((p) => p.accountid === p1.account_id) as RealTimeStatsPlayersQuery;
          const ps2 = t2.players.find((p) => p.accountid === p2.account_id) as RealTimeStatsPlayersQuery;
          return t1.team_number === t2.team_number ? ps1.playerid - ps2.playerid : t1.team_number - t2.team_number;
        });
      }
    }
    return gamesQuery[0];
  }

  private static async getRealTimeStats(query: GamesQuery): Promise<RealTimeStatsQuery> {
    const db = await mongo.db;
    const rtsQuery = await db.collection<RealTimeStatsQuery>('realTimeStats').findOne({ server_steam_id: query.server_steam_id });
    if (!rtsQuery) {
      return Dota.api('IDOTA2MatchStats_570/GetRealtimeStats/v1/', { server_steam_id: query.server_steam_id.toString() })
        .catch(() => ({
          match: {
            server_steam_id: query.server_steam_id,
          },
          teams: [{
            team_number: 2,
            players: [query.players.slice(0, 5).map((p) => ({
              accountid: p.account_id, heroid: p.hero_id,
            }))],
          }, {
            team_number: 3,
            players: [query.players.slice(5, 10).map((p) => ({
              accountid: p.account_id, heroid: p.hero_id,
            }))],
          }],
        }))
        .then((rts) => {
          if (rts.match) {
            // console.log(
            //   rts.match?.server_steam_id,
            //   rts.teams?.find((team: any) => team.team_number === 2).players.map((player: any) => `${player.accountid}:${player.heroid}`),
            //   rts.teams?.find((team: any) => team.team_number === 3).players.map((player: any) => `${player.accountid}:${player.heroid}`),
            //   rts.match === undefined ? rts : true,
            // );
            // eslint-disable-next-line no-param-reassign
            rts.match.server_steam_id = new Long(rts.match.server_steam_id);
            // eslint-disable-next-line no-param-reassign
            rts.match.match_id = new Long(rts.match.match_id);
            // eslint-disable-next-line no-param-reassign
            rts.createdAt = new Date();
            if ((rts.teams?.find((team: any) => team.team_number === 2).players.length || 0)
              + (rts.teams?.find((team: any) => team.team_number === 3).players.length || 0) === 10) {
              db.collection<RealTimeStatsQuery>('realTimeStats').updateOne({ server_steam_id: query.server_steam_id }, { $set: rts }, { upsert: true });
            }
          }
          return rts;
        });
    }
    // console.log(
    //   rtsQuery.server_steam_id,
    //   rtsQuery.teams.find((team: any) => team.team_number === 2)?.players.map((player: any) => `${player.accountid}:${player.heroid}`),
    //   rtsQuery.teams.find((team: any) => team.team_number === 3)?.players.map((player: any) => `${player.accountid}:${player.heroid}`),
    // );
    return rtsQuery;
  }

  public static getHeroName(channelQuery: ChannelsQuery, heroesQuery: any, game: GamesQuery, index: number) {
    const heroNames = heroesQuery.filter((th: { emotesets: any[]; emotes: any[]; }) => {
      for (let j = 0; j < th.emotesets?.length; j += 1) {
        if (!twitch.emotesets[th.emotesets[j]]?.some((emote: { id: number; }) => emote.id.toString() === th.emotes[j].toString())) {
          return false;
        }
      }
      return true;
    });
    if (!heroNames.length) return 'Unknown';
    let heroName = channelQuery.emotes ? heroNames[Math.trunc(Math.random() * heroNames.length)].localized_name : heroNames.find((name: { custom: any; }) => (name.custom ?? false) === false).localized_name || 'Unknown';
    if (game.lobby_type !== 1 && (heroName === 'Unknown' || heroName === 'Not Picked') && game.average_mmr <= 5420) heroName = 'Blue,Teal,Purple,Yellow,Orange,Pink,Gray,Light Blue,Green,Brown'.split(',')[index];
    return heroName;
  }

  public getCard(account: any): Promise<any> {
    return promiseTimeout(new Promise((resolve, reject) => {
      if (!this.dota2._gcReady || !this.steamClient.loggedOn) reject(new CustomError('Error getting medal'));
      else {
        this.dota2.requestProfileCard(account, (err: any, card: any) => {
          if (err) reject(err);
          resolve(card);
        });
      }
    }), 1000, 'Error getting medal');
  }

  public getCards(accounts: number[], lobbyId: Long): Promise<CardsQuery[]> {
    return Promise.resolve().then(async () => {
      const db = await mongo.db;
      const promises = [];
      const cards = await db.collection<CardsQuery>('cards').find({ id: { $in: accounts }, lobby_id: { $in: [new Long(), lobbyId] } }).sort({ createdAt: -1 }).toArray();
      const arr: CardsQuery[] = [];
      for (let i = 0; i < accounts.length; i += 1) {
        let needToGetCard = false;
        if (lobbyId === Long.fromNumber(0)) {
          const card = cards.find((tempCard) => tempCard.id === accounts[i] && tempCard.lobby_id === new Long() && new Date(tempCard.createdAt).valueOf() < Date.now() - 1.8e6);
          if (!card) needToGetCard = true;
          else arr[i] = card;
        } else {
          const card = cards.find((tempCard) => tempCard.id === accounts[i] && tempCard.lobby_id.toString() === lobbyId.toString());
          if (!card || typeof card.rank_tier !== 'number') needToGetCard = true;
          else arr[i] = card;
        }
        if (needToGetCard) {
          promises.push(retry(10, () => this.getCard(accounts[i]), 100)
            .catch(() => ({ rank_tier: -10, leaderboard_rank: 0 }))
            .then((temporaryCard) => {
              arr[i] = {
                id: accounts[i],
                lobby_id: lobbyId,
                createdAt: new Date(),
                rank_tier: temporaryCard.rank_tier || 0,
                leaderboard_rank: temporaryCard.leaderboard_rank || 0,
                lifetime_games: temporaryCard.lifetime_games,
              };
              if (temporaryCard.rank_tier !== -10) {
                db.collection<CardsQuery>('cards').updateOne({
                  id: accounts[i],
                  lobby_id: lobbyId,
                }, {
                  $set: arr[i],
                }, {
                  upsert: true,
                });
              }
            }));
        }
      }
      return Promise.all(promises).then(() => arr);
    });
  }

  public exit(): Promise<boolean> {
    return new Promise((resolve) => {
      clearInterval(this.interval);
      console.log('Clearing getting matches interval');
      this.dota2.exit();
      console.log('Manually closed dota');
      this.steamClient.disconnect();
      console.log('Manually closed steam');
      this.steamClient.removeAllListeners();
      this.dota2.removeAllListeners();
      console.log('Removed all listeners from dota and steam');
      resolve(true);
    });
  }

  public static api(path: string, qs: querystring.ParsedUrlQueryInput = {}): Promise<any> {
    // eslint-disable-next-line no-param-reassign
    qs.key = process.env.STEAM_WEBAPI_KEY;
    const now = Date.now();
    // console.time(`dotaapi.${now}.${path}?${querystring.stringify(qs)}`);
    return new Promise((resolve, reject) => {
      const req = get(`http://api.steampowered.com/${path}?${querystring.stringify(qs)}`, (result) => {
        let data = '';
        result.on('data', (chunk) => {
          data += chunk;
        });
        result.on('end', () => {
          // console.timeEnd(`dotaapi.${now}.${path}?${querystring.stringify(qs)}`);
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      });
      req.on('error', (err) => reject(err));
    });
  }
}
