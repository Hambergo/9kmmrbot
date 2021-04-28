import { ChatUserstate } from 'tmi.js';
import CustomError from '../customError';
import Dota from '../dota';
import Mongo from '../mongo';
import Twitch from '../twitch';

const mongo = Mongo.getInstance();
export default async function score(channel: string, tags: ChatUserstate, commandName: string, debug: boolean = false, ...args: string[]): Promise<string> {
  const db = await mongo.db;
  const [channelQuery, { data: [stream] }, { data: videos }] = await Promise.all([
    db.collection('channels').findOne({ id: Number(tags['room-id']) }),
    Twitch.api('streams', { user_id: tags['room-id'] }),
    Twitch.api('videos', { user_id: tags['room-id'], type: 'archive' }),
  ]);
  if (!stream || stream.type !== 'live' || !stream.started_at) {
    throw new CustomError('Stream isn\'t live');
  }
  let streamStart = new Date(stream.started_at);
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
  let game = { match_id: null };
  try {
    game = await Dota.findGame(channelQuery);
  } catch (err) {
    //
  }

  const gamesQuery = await db.collection('gameHistory').find({
    match_id: { $ne: game.match_id },
    'players.account_id': { $in: channelQuery.accounts },
    game_mode: { $in: [1, 2, 3, 4, 5, 8, 12, 13, 14, 16, 17, 18, 22] },
    createdAt: { $gte: streamStart },
  }, { sort: { createdAt: -1 } }).toArray();
  const resultsArr = [];
  const needToGetResult: number[] = [];
  for (let i = 0; i < gamesQuery.length; i += 1) {
    if (gamesQuery[i].radiant_win === undefined) {
      resultsArr.push(Dota.api('IDOTA2Match_570/GetMatchDetails/v1', { match_id: gamesQuery[i].match_id }).catch(() => ({
        result: gamesQuery[i],
      })).then((matchResult) => {
        if (matchResult?.result?.players) {
          for (let j = 0; j < matchResult.result.players.length; j += 1) {
          // eslint-disable-next-line no-param-reassign
            if (gamesQuery[i].players[j]) matchResult.result.players[j].account_id = gamesQuery[i].players[j].account_id;
          }
        }
        return matchResult.result;
      }));
      needToGetResult.push(i);
    } else {
      resultsArr.push(gamesQuery[i]);
    }
  }
  const results = await Promise.all(resultsArr);
  for (let i = 0; i < needToGetResult.length; i += 1) {
    if (results[needToGetResult[i]]?.match_id && results[needToGetResult[i]]?.radiant_win !== undefined) db.collection('gameHistory').updateOne({ match_id: results[needToGetResult[i]].match_id }, { $set: { match_id: results[needToGetResult[i]].match_id, radiant_win: results[needToGetResult[i]].radiant_win } }, { upsert: true });
  }
  const counters = { win: 0, lose: 0 };
  for (let i = 0; i < results.length; i += 1) {
    if (results[i]?.players) {
      const playerIndex = results[i].players.findIndex((player: { account_id: number; }) => channelQuery.accounts.some((account: number) => player.account_id === account));
      if (playerIndex !== -1) {
        const isPlayerRadiant = playerIndex < results[i].players.length / 2;
        if ((isPlayerRadiant && results[i].radiant_win) || (!isPlayerRadiant && !results[i].radiant_win)) {
          counters.win += 1;
        } else {
          counters.lose += 1;
        }
      } else {
        //
      }
    } else {
      //
    }
  }
  return `W ${counters.win} - L ${counters.lose}`;
}
