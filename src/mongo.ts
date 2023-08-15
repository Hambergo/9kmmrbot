import { Db, Long, MongoClient } from 'mongodb';

export default class Mongo {
  private static instance: Mongo;

  public db: Promise<Db>;

  private client: Promise<MongoClient>;

  private connect(): Promise<Db> {
    return this.client.then((client) => client.db()).catch(() => this.connect());
  }

  private constructor() {
    this.client = MongoClient.connect(process.env.MONGO_URL as string);
    this.db = this.connect();
  }

  public static getInstance(): Mongo {
    if (!Mongo.instance) Mongo.instance = new Mongo();
    return Mongo.instance;
  }

  public exit(): Promise<boolean> {
    return new Promise((resolve) => {
      this.client.then((client) => setTimeout(() => {
        client.close().then(() => {
          console.log('Manually disconnected from mongo');
          resolve(true);
        });
      }, 3000));
    });
  }
}

export interface ChannelsQuery {
  id: number
  count?: number
  accounts: number[]
  delay?: {
    enabled: boolean
    seconds?: number
  }
  mods?: number[]
  name: string
  globalMod?: boolean
  self?: boolean
  hc?: { hero_id: string }[]
  emotes?: boolean
}
export interface PlayersQuery {
  account_id: number
  hero_id: number
}
export interface GamesQuery {
  average_mmr: number
  activate_time: number
  deactivate_time: number
  game_mode: number
  league_id: number
  match_id: Long
  lobby_id: Long
  lobby_type: number
  players: PlayersQuery[]
  server_steam_id: Long
  weekend_tourney_bracket_round: number | null
  weekend_tourney_skill_level: number | null
  createdAt: Date
}
export interface GameHistoryQuery {
  average_mmr: number
  game_mode: number
  league_id: number
  match_id: Long
  lobby_id: Long
  lobby_type: number
  players: PlayersQuery[]
  server_steam_id: Long
  weekend_tourney_bracket_round: number | null
  weekend_tourney_skill_level: number | null
  createdAt: Date
  radiant_win?: boolean
}
export interface RpsQuery {
  status: string
  WatchableGameID: Long | null
  watching_server: Long | null
  steam_id: Long
  createdAt: Date
  param0: string | null
}
export interface CommandsQuery {
  triggers: string[]
  filename: string
  command: string
  channels: number[]
  cooldown: number
}
export interface HeroesQuery {
  id: number
  localized_name: string
  custom?: boolean
  emotes?: number[]
  emotesets: string[]
}
export interface NotablePlayersQuery {
  id: number
  channel: number | null
  name: string
  enabled: boolean
  lastChangedBy: number | null
  lastChanged?: Date
}
export interface GameModesQuery {
  id: number
  name: string
}
export interface CardsQuery {
  id: number
  lobby_id: Long
  createdAt: Date
  leaderboard_rank: number
  rank_tier: number
  lifetime_games: number
}
export interface ErrorsQuery {
  message: string
  name: string
  stack: string | undefined
  createdAt: Date
}
export interface MedalsQuery {
  rank_tier: number
  name: string
}
export interface StreamsQuery {
  user_id: number
  startTime: Date
  createdAt: Date
}
export interface RealTimeStatsPlayersQuery {
  accountid: number
  playerid: number
  team: number
  heroid: number
}
export interface RealTimeStatsTeamsQuery {
  team_number: number
  players: RealTimeStatsPlayersQuery[]
}
export interface RealTimeStatsQuery {
  server_steam_id: Long
  buildings: []
  createdAt: Date
  graph_data: {}
  match: {}
  teams: RealTimeStatsTeamsQuery[]
}
