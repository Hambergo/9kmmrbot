import { Long } from 'mongodb';
import { ChatUserstate } from 'tmi.js';
import CustomError from '../customError';
import Dota from '../dota';
import Mongo from '../mongo';
import Twitch from '../twitch';

const mongo = Mongo.getInstance();
const dota = Dota.getInstance();
const twitch = Twitch.getInstance();

export default async function medal(channel: string, tags: ChatUserstate, commandName: string, debug: boolean = false, ...args: string[]): Promise<string> {
  const db = await mongo.db;
  const channelQuery = await db.collection('channels').findOne({ id: Number(tags['room-id']) });
  if (!channelQuery?.accounts?.length) throw new CustomError(`No accounts connected to ${channelQuery.name}`);
  let lobbyId: Long;
  try {
    lobbyId = (await Dota.findGame(channelQuery)).lobby_id;
  } catch (err) {
    lobbyId = Long.fromNumber(0);
  }
  const cards = await dota.getCards(channelQuery.accounts, lobbyId);
  const bestCard = cards.reduce((best, card) => {
    if (!card) return best;
    if (card.rank_tier > best.rank_tier
      || (card.rank_tier === best.rank_tier
        && card.leaderboard_rank > 0
        && card.leaderboard_rank < best.leaderboard_rank)) return card;
    return best;
  }, { rank_tier: -10, leaderboard_rank: 0 });
  const medalQuery = await db.collection('medals').findOne({ rank_tier: bestCard.rank_tier });
  if (bestCard.leaderboard_rank) return `#${bestCard.leaderboard_rank}`;
  if (medalQuery) return medalQuery.name;
  return 'Unknown';
}
export async function gameMedals(channel: string, tags: ChatUserstate, commandName: string, debug: boolean = false, ...args: string[]): Promise<string> {
  const db = await mongo.db;
  const channelQuery = await db.collection('channels').findOne({ id: Number(tags['room-id']) });
  if (!channelQuery?.accounts?.length) throw new CustomError(`No accounts connected to ${channelQuery?.name ?? 'Unknown'}`);
  const game = await Dota.findGame(channelQuery, true);
  const cards = await dota.getCards(game.players.map((player: { account_id: number; }) => player.account_id), game.lobby_id);
  const medalQuery = await db.collection('medals').find({ rank_tier: { $in: cards.map((card) => card.rank_tier) } }).toArray();
  const medals = [];
  for (let i = 0; i < cards.length; i += 1) {
    const currentMedal = medalQuery.find((temporaryMedal) => temporaryMedal.rank_tier === cards[i].rank_tier);
    if (!currentMedal) medals[i] = 'Unknown';
    else {
      medals[i] = currentMedal.name;
      if (cards[i].leaderboard_rank > 0) medals[i] = `#${cards[i].leaderboard_rank}`;
    }
  }
  const heroesQuery = await db.collection('heroes').find({
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
        if (!emotesets[th.emotesets[j]]?.some((emote: { id: number; }) => emote.id === th.emotes[j])) {
          return false;
        }
      }
      return true;
    });
    const heroName = Dota.getHeroName(channelQuery, heroNames, game.lobby_type, i);
    result.push({ heroName, medal: medals[i] });
  }
  return result.map((m) => `${m.heroName}: ${m.medal}`).join(', ');
}
