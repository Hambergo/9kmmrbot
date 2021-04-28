import { ChatUserstate } from 'tmi.js';
import { request } from 'https';
import CustomError from '../customError';
import Dota from '../dota';
import Mongo from '../mongo';
import Twitch from '../twitch';

const mongo = Mongo.getInstance();
export default async function heroChallenge(channel: string, tags: ChatUserstate, commandName: string, debug: boolean = false, ...args: string[]): Promise<string> {
  const db = await mongo.db;
  const channelQuery = await db.collection('channels').findOne({ id: Number(tags['room-id']) });
  if (!channelQuery || !channelQuery.hc || !channelQuery.hc.hero_id || !channelQuery.hc.time) throw new CustomError('Couldn\'t get hero challenge stats');
  return new Promise((resolve, reject) => {
    const req = request('https://api.stratz.com/graphql', {
      headers: {
        accept: '*/*',
        'accept-language': 'en-GB,en;q=0.9',
        authorization: 'null',
        'content-type': 'application/json',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'sec-gpc': '1',
      },
      method: 'POST',
    }, (res) => {
      let body = '';
      res.on('data', (data) => {
        body += data.toString();
      });
      res.on('end', async () => {
        try {
          const matches = JSON.parse(body).data.player.matches.filter((match: { endDateTime: number; }) => match.endDateTime * 1000 > channelQuery.hc.time);
          if (channelQuery?.hc?.hero_id && channelQuery?.hc?.time) {
            const hero = await db.collection('heroes').findOne({ $or: [{ custom: false }, { custom: { $exists: false } }], id: channelQuery.hc.hero_id });
            const counters = { win: 0, lose: 0 };
            for (let i = 0; i < matches.length; i += 1) {
              if (matches[i].players[0].isVictory) counters.win += 1;
              else counters.lose += 1;
            }
            resolve(`Played ${matches.length} games as ${hero.localized_name}. W ${counters.win} - L ${counters.lose}`);
          }
        } catch (err) {
          reject(new CustomError('Couldn\'t get hero challenge stats'));
        }
        // console.log(JSON.parse(body).data.player.matches);
      });
      res.on('error', () => reject(new CustomError('Couldn\'t get hero challenge stats')));
    });
    req.end('{"operationName":"PlayerMatchesSummary","variables":{"steamId":26771994,"request":{"heroIds":[16],"skip":0,"take":100}},"query":"query PlayerMatchesSummary($request: PlayerMatchesRequestType!, $steamId: Long!) {\\n  player(steamAccountId: $steamId) {\\n    steamAccountId\\n    matches(request: $request) {\\n      ...MatchRowSummary\\n      players(steamAccountId: $steamId) {\\n        ...MatchRowSummaryPlayer\\n        __typename\\n      }\\n      __typename\\n    }\\n    __typename\\n  }\\n}\\n\\nfragment MatchRowBase on MatchType {\\n  id\\n  rank\\n  lobbyType\\n  gameMode\\n  endDateTime\\n  durationSeconds\\n  allPlayers: players {\\n    partyId\\n    __typename\\n  }\\n  league {\\n    id\\n    displayName\\n    __typename\\n  }\\n  __typename\\n}\\n\\nfragment MatchRowBasePlayer on MatchPlayerType {\\n  steamAccountId\\n  heroId\\n  role\\n  lane\\n  level\\n  isVictory\\n  isRadiant\\n  partyId\\n  __typename\\n}\\n\\nfragment MatchRowSummary on MatchType {\\n  ...MatchRowBase\\n  analysisOutcome\\n  __typename\\n}\\n\\nfragment MatchRowSummaryPlayer on MatchPlayerType {\\n  ...MatchRowBasePlayer\\n  imp\\n  award\\n  kills\\n  deaths\\n  assists\\n  item0Id\\n  item1Id\\n  item2Id\\n  item3Id\\n  item4Id\\n  item5Id\\n  __typename\\n}\\n"}');
  });
}