import { ChatUserstate } from 'tmi.js';
import Mongo, { ChannelsQuery, GameHistoryQuery, HeroesQuery } from '../mongo';
import Dota from '../dota';
import CustomError from '../customError';

const mongo = Mongo.getInstance();

export default async function lastgame(channel: string, tags: ChatUserstate, commandName: string, ...args: string[]) {
  const db = await mongo.db;
  const channelQuery = await db.collection<ChannelsQuery>('channels').findOne({ id: Number(tags['room-id']) }) as ChannelsQuery;
  const game = await Dota.findGame(channelQuery);
  if (!game) throw new CustomError('Game wasn\'t found');
  const gameHistory = await db.collection<GameHistoryQuery>('gameHistory').find({
    'players.account_id': {
      $in: channelQuery.accounts,
    },
  }, { sort: { createdAt: -1 }, limit: 2 }).toArray();
  if (!gameHistory.length) throw new CustomError('Game wasn\'t found');
  // eslint-disable-next-line prefer-const
  let [currentGame, oldGame] = gameHistory;
  if (currentGame.match_id !== game.match_id) oldGame = currentGame;
  if (!oldGame) throw new CustomError('Game wasn\'t found');
  const playersFromLastGame = [];
  for (let i = 0; i < game.players.length; i += 1) {
    if (!channelQuery.accounts.some((account: number) => account === game.players[i].account_id)) {
      const lastGamePlayer = oldGame.players.find((player: { account_id: number; }) => player.account_id === game.players[i].account_id);
      if (lastGamePlayer) {
        playersFromLastGame.push({
          old: lastGamePlayer,
          current: game.players[i],
          currentIndex: i,
          oldIndex: oldGame.players.indexOf(lastGamePlayer),
        });
      }
    }
  }
  const heroIds = new Set<Number>();
  for (let i = 0; i < playersFromLastGame.length; i += 1) {
    heroIds.add(playersFromLastGame[i].old.hero_id).add(playersFromLastGame[i].current.hero_id);
  }
  const heroesQuery = await db.collection<HeroesQuery>('heroes').find({ id: { $in: [...heroIds.values()] as number[] } }).toArray();
  if (playersFromLastGame.length) return playersFromLastGame.map((player) => `${Dota.getHeroName(channelQuery, heroesQuery.filter((hero) => hero.id === player.current.hero_id), game, player.currentIndex)} played as ${Dota.getHeroName(channelQuery, heroesQuery.filter((hero) => hero.id === player.old.hero_id), game, player.oldIndex)}`).join(', ');
  return 'Not playing with anyone from last game';
}
