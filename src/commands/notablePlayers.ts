import { ChatUserstate } from 'tmi.js';
import Dota from '../dota';
import Mongo, {
  ChannelsQuery, GameModesQuery, GamesQuery, HeroesQuery, NotablePlayersQuery,
} from '../mongo';
import Twitch from '../twitch';

const mongo = Mongo.getInstance();
const twitch = Twitch.getInstance();

const parseNotablePlayers = async (game: GamesQuery, channelQuery: ChannelsQuery, debug: boolean): Promise<string> => {
  const db = await mongo.db;
  const [heroesQuery, notablePlayersQuery, gameModesQuery] = await Promise.all([
    db.collection<HeroesQuery>('heroes').find({
      id: {
        $in: game.players.map((player) => player.hero_id),
      },
    }).toArray(),
    db.collection<NotablePlayersQuery>('notablePlayers').find({
      $and: [
        {
          id: {
            $in: game.players.map((player) => player.account_id),
          },
        },
        {
          $or: [
            { channel: { $exists: false } },
            { channel: channelQuery.id },
          ],
        },
        {
          enabled: true,
        }],
    }).sort({ channel: -1 }).toArray(),
    db.collection<GameModesQuery>('gameModes').findOne({ id: game.game_mode }),
  ]);
  const gameMode = gameModesQuery?.name || 'Unknown';
  const mmr = game.average_mmr ? ` [${game.average_mmr} avg MMR]` : '';
  const { emotesets } = twitch;
  const nps = [];
  for (let i = 0; i < game.players.length; i += 1) {
    const np = notablePlayersQuery.find((tnp) => tnp.id === game.players[i].account_id);
    const heroNames = heroesQuery.filter((hero) => hero.id === game.players[i].hero_id);
    if (debug || (np && (channelQuery.self || !channelQuery.accounts.includes(game.players[i].account_id)))) {
      const heroName = Dota.getHeroName(channelQuery, heroNames, game, i);
      nps.push(`${np?.name || ''} (${debug ? `${game.players[i].account_id}, ` : ''}${heroName})`);
    }
  }
  return `${game.weekend_tourney_skill_level ? `Battle cup T${game.weekend_tourney_skill_level} ${['', 'Finals', 'Semi Finals', 'Quarter Finals'][game.weekend_tourney_bracket_round as number]}` : gameMode}${mmr}: ${nps.length ? nps.join(', ') : 'No other notable player found'}`;
};
async function getNotablePlayers(tags: ChatUserstate, debug: boolean = false) {
  const db = await mongo.db;
  const roomId = Number(tags['room-id']);
  const userId = Number(tags['user-id']);
  const channelQuery = await db.collection<ChannelsQuery>('channels').find({ id: { $in: [userId, roomId] } }).toArray();
  const channelDocument = channelQuery.find((document) => document.id === roomId) as ChannelsQuery;
  const userDocument = channelQuery.find((document) => document.id === userId) as ChannelsQuery;
  try {
    if (debug && roomId !== userId && !userDocument?.globalMod && (!(channelDocument?.mods?.some((mod: Number) => mod === userId)))) return '';
  } catch (err) {
    //
  }
  const game = await Dota.findGame(channelDocument, true);
  return parseNotablePlayers(game, channelDocument, debug);
}
export default async function notablePlayers(channel: string, tags: ChatUserstate, commandName: string, ...args: string[]): Promise<string> {
  return getNotablePlayers(tags);
}
export async function notablePlayersDebug(channel: string, tags: ChatUserstate, commandName: string, ...args: string[]): Promise<string> {
  return getNotablePlayers(tags, true);
}
