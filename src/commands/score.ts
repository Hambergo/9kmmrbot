import { ChatUserstate } from 'tmi.js';
import { Long } from 'mongodb';
import CustomError from '../customError';
import Dota from '../dota';
import Mongo, {
  ChannelsQuery, GameHistoryQuery, GamesQuery, StreamsQuery,
} from '../mongo';
import Twitch from '../twitch';

const mongo = Mongo.getInstance();

function getMatchType(game: { lobby_type: number, game_mode: number }): 'ranked' | 'turbo' | 'unranked' {
  if (game.lobby_type === 7) return 'ranked';
  if (game.game_mode === 23) return 'turbo';
  return 'unranked';
}

function pushWinLossString(wl: string[], match_type: string, counters: { win: number, lose: number }) {
  if (counters.win + counters.lose > 0) wl.push(`${match_type} W ${counters.win} - L ${counters.lose}`);
}

export default async function score(channel: string, tags: ChatUserstate, commandName: string, debug: boolean = false, ...args: string[]): Promise<string> {
  const db = await mongo.db;
  const videosPromise = Twitch.api('videos', { user_id: tags['room-id'], type: 'archive' });
  const [channelQuery, { data: [liveStream] }] = await Promise.all([
    db.collection<ChannelsQuery>('channels').findOne({ id: Number(tags['room-id']) }),
    Twitch.api('streams', { user_id: tags['room-id'] }),
  ]);
  if (!liveStream || liveStream.type !== 'live' || !liveStream.started_at) {
    throw new CustomError('Stream isn\'t live');
  }
  if (!channelQuery?.accounts?.length) throw new CustomError('No accounts connected');
  const cachedStreamPromise = db.collection<StreamsQuery>('streams').findOne({ user_id: Number(tags['room-id']) });
  let game: GamesQuery;
  const gamePromise = Dota.findGame(channelQuery).catch(() => {
    const empty: GamesQuery = {
      average_mmr: 0,
      activate_time: 0,
      deactivate_time: 0,
      game_mode: 0,
      league_id: 0,
      match_id: new Long(),
      lobby_id: new Long(),
      lobby_type: 0,
      players: [],
      server_steam_id: new Long(),
      weekend_tourney_bracket_round: null,
      weekend_tourney_skill_level: null,
      createdAt: new Date(),
    };
    return empty;
  });
  let streamStart = new Date(liveStream.started_at);
  try {
    const cachedStream = await cachedStreamPromise;
    if (!cachedStream) {
      const { data: videos } = await videosPromise;
      if (videos && videos.length) {
        for (let i = 0; i < videos.length; i += 1) {
          const videoStart = new Date(videos[i].created_at);
          const h = videos[i].duration.search('h');
          const m = videos[i].duration.search('m');
          const s = videos[i].duration.search('s');
          const duration = (h > 0 ? 3600 * Number(videos[i].duration.substring(0, h)) : 0)
            + (m > h ? 60 * Number(videos[i].duration.substring(h + 1, m)) : 0)
            + (s === videos[i].duration.length - 1 ? Number(videos[i].duration.substring(m + 1, s)) : 0);
          if (new Date(videoStart.valueOf() + (duration + 1800) * 1000) > streamStart) {
            streamStart = videoStart;
          } else {
            break;
          }
        }
      }
      db.collection<StreamsQuery>('streams').updateOne({ user_id: Number(tags['room-id']) }, { $set: { user_id: Number(tags['room-id']), startTime: streamStart, createdAt: new Date() } }, { upsert: true });
    } else {
      streamStart = cachedStream?.startTime as Date || streamStart;
    }
  } catch (err: any) {
    //
  }
  streamStart = new Date(streamStart.valueOf() - 600000);

  const gamesQueryPromise = db.collection<GameHistoryQuery>('gameHistory').find({
    'players.account_id': { $in: channelQuery.accounts },
    'players.hero_id': { $ne: 0 },
    lobby_type: { $in: [0, 7] },
    createdAt: { $gte: streamStart },
  }, { sort: { createdAt: -1 } }).toArray();
  try {
    game = await gamePromise;
  } catch (err) {
    //
  }
  const resultsArr = [];
  const needToGetResult: number[] = [];
  const gamesQuery = await gamesQueryPromise;
  const filteredGames = gamesQuery.filter((filteredGame) => filteredGame?.createdAt > streamStart && filteredGame?.match_id !== game?.match_id);
  for (let i = 0; i < filteredGames.length; i += 1) {
    // eslint-disable-next-line no-continue
    if (i > 0 && filteredGames[i].match_id === filteredGames[i - 1].match_id) continue;
    if (filteredGames[i].radiant_win === undefined) {
      resultsArr.push(Dota.api('IDOTA2Match_570/GetMatchDetails/v1', { match_id: filteredGames[i].match_id.toString() }).catch(() => ({
        result: filteredGames[i],
      })).then((matchResult) => {
        if (matchResult?.result?.players) {
          matchResult.result.players.sort((p1: {
            hero_id: any;
            account_id: any; player_slot: number;
          }, p2: {
            account_id: any;
            hero_id: any; player_slot: number;
          }) => p1.player_slot - p2.player_slot);
          for (let j = 0; j < matchResult.result.players.length; j += 1) {
            // eslint-disable-next-line no-param-reassign
            matchResult.result.players[j].account_id = filteredGames[i].players.find((player) => player.hero_id === matchResult.result.players[j].hero_id)?.account_id;
          }
        }
        return matchResult.result;
      }));
      needToGetResult.push(i);
    } else {
      resultsArr.push(filteredGames[i]);
    }
  }
  const results = (await Promise.all(resultsArr)).filter((result) => result && !result.error);
  for (let i = 0; i < needToGetResult.length; i += 1) {
    if (results[needToGetResult[i]]?.match_id && results[needToGetResult[i]]?.radiant_win !== undefined) db.collection<GameHistoryQuery>('gameHistory').updateOne({ match_id: results[needToGetResult[i]].match_id }, { $set: { match_id: results[needToGetResult[i]].match_id, radiant_win: results[needToGetResult[i]].radiant_win, players: results[needToGetResult[i]].players } }, { upsert: true });
  }
  const counters = { ranked: { win: 0, lose: 0 }, unranked: { win: 0, lose: 0 }, turbo: { win: 0, lose: 0 } };
  for (let i = 0; i < results.length; i += 1) {
    const match_type = getMatchType(results[i]);
    if (results[i]?.players) {
      const playerIndex = results[i].players.findIndex((player: { account_id: number; }) => channelQuery.accounts.some((account: number) => player.account_id === account));
      if (results[i]?.radiant_win !== undefined && playerIndex !== -1) {
        const isPlayerRadiant = playerIndex < results[i].players.length / 2;
        if ((isPlayerRadiant && results[i].radiant_win === true) || (!isPlayerRadiant && results[i].radiant_win === false)) {
          counters[match_type].win += 1;
        } else {
          counters[match_type].lose += 1;
        }
      } else {
        //
      }
    } else {
      //
    }
  }
  const wl_array: string[] = [];
  pushWinLossString(wl_array, 'Ranked', counters.ranked);
  pushWinLossString(wl_array, 'Unranked', counters.unranked);
  pushWinLossString(wl_array, 'Turbo', counters.turbo);
  if (wl_array.length === 0) return 'No games played on stream yet';
  return wl_array.join(' | ');
}
