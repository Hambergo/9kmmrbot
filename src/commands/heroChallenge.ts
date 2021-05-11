import { ChatUserstate } from 'tmi.js';
import CustomError from '../customError';
import Dota from '../dota';
import Mongo from '../mongo';

const mongo = Mongo.getInstance();
export default async function heroChallenge(channel: string, tags: ChatUserstate, commandName: string, debug: boolean = false, ...args: string[]): Promise<string> {
  const db = await mongo.db;
  const channelQuery = await db.collection('channels').findOne({ id: Number(tags['room-id']) });
  if (!channelQuery?.hc?.length) throw new CustomError('Couldn\'t get hero challenge stats');
  let game = { match_id: null };
  try {
    game = await Dota.findGame(channelQuery);
  } catch (err) {
    //
  }
  const gamesQuery = await db.collection('gameHistory').find({
    match_id: { $ne: game.match_id },
    players: { $elemMatch: { account_id: { $in: channelQuery.accounts }, hero_id: { $in: channelQuery.hc.map((hero: { hero_id: number; }) => hero.hero_id) } } },
    game_mode: { $in: [1, 2, 3, 4, 5, 8, 12, 13, 14, 16, 17, 18, 22] },
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
  const counters = [{ win: 0, lose: 0 }];
  for (let i = 1; i < channelQuery.hc.length; i += 1) {
    counters[i] = { win: 0, lose: 0 };
  }
  for (let i = 0; i < results.length; i += 1) {
    if (results[i]?.players) {
      const playerIndex = results[i].players.findIndex((player: { account_id: number; }) => channelQuery.accounts.some((account: number) => player.account_id === account));
      if (playerIndex !== -1) {
        const heroIndex = channelQuery.hc.findIndex((hero: { hero_id: number; }) => hero.hero_id === results[i].players[playerIndex].hero_id);
        const isPlayerRadiant = playerIndex < results[i].players.length / 2;
        if (heroIndex !== -1) {
          if ((isPlayerRadiant && results[i].radiant_win) || (!isPlayerRadiant && !results[i].radiant_win)) {
            counters[heroIndex].win += 1;
          } else {
            counters[heroIndex].lose += 1;
          }
        }
      } else {
        //
      }
    } else {
      //
    }
  }
  const heroesQuery = await db.collection('heroes').find({ id: { $in: channelQuery.hc.map((tempHero: { hero_id: number; }) => tempHero.hero_id) } }).toArray();
  const resultArr = [];
  for (let i = 0; i < channelQuery.hc.length; i += 1) {
    resultArr.push(`${Dota.getHeroName(channelQuery, heroesQuery.filter((hero) => hero.id === channelQuery.hc[i].hero_id), 0, 0)}: W ${counters[i].win} - L ${counters[i].lose}`);
  }
  return resultArr.join(', ');
}
