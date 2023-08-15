import { ChatUserstate } from 'tmi.js';
import CustomError from '../customError';
import Dota from '../dota';
import Mongo, {
  CardsQuery, ChannelsQuery, HeroesQuery,
} from '../mongo';
import Twitch from '../twitch';

const mongo = Mongo.getInstance();
const dota = Dota.getInstance();
const twitch = Twitch.getInstance();

export default async function smurfs(channel: string, tags: ChatUserstate, commandName: string, debug: boolean = false, ...args: string[]): Promise<string> {
  const db = await mongo.db;
  const channelQuery = await db.collection<ChannelsQuery>('channels').findOne({ id: Number(tags['room-id']) });
  if (!channelQuery?.accounts?.length) throw new CustomError('No accounts connected');
  const game = await Dota.findGame(channelQuery, true);
  const cards = await dota.getCards(game.players.map((player: { account_id: number; }) => player.account_id), game.lobby_id);
  const heroesQuery = await db.collection<HeroesQuery>('heroes').find({
    id: {
      $in: game.players.map((player: { hero_id: number; }) => player.hero_id),
    },
  }).toArray();
  const { emotesets } = twitch;
  const result = [];
  for (let i = 0; i < game.players.length; i += 1) {
    const heroNames = heroesQuery.filter((th) => {
      if (th.id !== game.players[i].hero_id) return false;
      for (let j = 0; j < th.emotesets?.length; j += 1) {
        if (!emotesets[th.emotesets[j]]?.some((emote: { id: number; }) => emote.id === (th.emotes as number[])[j])) {
          return false;
        }
      }
      return true;
    });
    const heroName = Dota.getHeroName(channelQuery, heroNames, game, i);
    result.push({ heroName, lifetime_games: (cards.find((card) => card.id === game.players[i].account_id) as CardsQuery).lifetime_games });
  }
  return result.sort((c1, c2) => c1.lifetime_games - c2.lifetime_games).map((c) => `${c.heroName}: ${c.lifetime_games}`).join(', ');
}
