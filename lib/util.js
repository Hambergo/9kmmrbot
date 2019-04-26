const CustomError = require('./CustomError')
const { db: mongoDb } = require('./mongo')
const { dotaClient, twitchClient } = require('../index')
const querystring = require('querystring')
const fetch = require('node-fetch')
const SteamID = require('@node-steam/id').ID
const PastebinAPI = require('pastebin-js')

const pastebin = new PastebinAPI({ 'api_dev_key': process.env.PASTEBIN_API_DEV_KEY, 'api_user_name': process.env.PASTEBIN_API_USERNAME, 'api_user_password': process.env.PASTEBIN_API_PASSWORD })

const findGameFromChannel = async (roomid, allowSpectating = true, allowCustomGame = true) => {
	let channel = mongoDb().collection('channels').findOne({ id: roomid }, { projection: { name: 1, accounts: 1, _id: 0 } })
	let index = mongoDb().collection('settings').findOne({ id: roomid, name: 'Delayed Channel', delayed: true }, { projection: { _id: 0 } })
	let accounts = (await channel)
	if (!accounts || !accounts.accounts || !accounts.accounts.length) {
		return Promise.reject(new CustomError('No accounts connected to ' + (accounts && accounts.name ? accounts.name : 'Unknown')))
	} else {
		accounts = accounts.accounts
	}
	index = await index
	if (index) {
		index = index.delay / 30
	} else {
		index = 0
	}
	let games = mongoDb().collection('games').aggregate([{ $group: { _id: '$createdAt', matches: { $addToSet: '$$ROOT' } } }, { $sort: { _id: -1 } }, { $skip: index }, { $limit: 1 }]).toArray()
	games = await games
	if (games && games.length) {
		games = games[0].matches
		let game = games.find(match => (allowCustomGame || match.game_mode != 15 && match.game_mode != 19) && match.players && match.players.some(player => accounts.includes(player.account_id)))
		if (game) {
			if (game.lobby_type == 1) {
				let dac = await mongoDb().collection('dac').findOne({ server_steam_id: game.server_steam_id.toString() })
				if (dac && dac.players && dac.players.some(player => accounts.find(account => player.account_id == account))) {
					game.players.sort((player1, player2) => dac.players.findIndex(p => p.account_id == player1.account_id) - dac.players.findIndex(p => p.account_id == player2.account_id))
				}
				else {
					let tempGame = await requestApiLiveGame(game.server_steam_id)
					if (game.players) {
						game.players.sort((player1, player2) => tempGame.players.findIndex(p => p.account_id == player1.account_id) - tempGame.players.findIndex(p => p.account_id == player2.account_id))
						if (!tempGame.players.some(player => player.hero_id == 0)) {
							await mongoDb().collection('dac').updateOne({ server_steam_id: game.server_steam_id }, { $set: { players: tempGame.players.map(player => ({ account_id: player.account_id, hero_id: player.hero_id })), game_mode: tempGame.game_mode, createdAt: tempGame.createdAt } }, { upsert: true })
						}
					}
				}
			}
			return game
		} else if (allowSpectating) {
			let rps = mongoDb().collection('rps').aggregate([{ $group: { _id: '$createdAt', rps: { $addToSet: '$$ROOT' } } }, { $sort: { _id: -1 } }, { $skip: index }, { $limit: 1 }]).toArray()
			rps = await rps
			if (rps && rps.length) {
				rps = rps[0].rps
				let rp = rps.find(rp => accounts.some(account => rp.account_id == account) && ((rp.status == '#DOTA_RP_SPECTATING' || rp.status == '#DOTA_RP_FINDING_MATCH' || rp.status == '#DOTA_RP_WATCHING_TOURNAMENT') && rp.watching_server || ((rp.status == '#DOTA_RP_SPECTATING' || rp.status == '#DOTA_RP_WATCHING_TOURNAMENT' || rp.status == '#DOTA_RP_CASTING') && rp.WatchableGameID)))
				if (rp) {
					let game = games.find(match => rp.WatchableGameID ? (rp.WatchableGameID == match.lobby_id && match.lobby_id) : match.server_steam_id == rp.watching_server)
					if (!game || game.lobby_type == 1) {
						let server_steam_id = rp.watch_server || (game && game.server_steam_id)
						if (server_steam_id) {
							let dac = await mongoDb().collection('dac').findOne({ server_steam_id: server_steam_id.toString() })
							let tempGame
							if (!dac) {
								tempGame = await requestApiLiveGame(server_steam_id)
								if (!tempGame.players.some(player => player.hero_id == 0)) {
									await mongoDb().collection('dac').updateOne({ server_steam_id: server_steam_id }, { $set: { players: tempGame.players.map(player => ({ account_id: player.account_id, hero_id: player.hero_id })), game_mode: tempGame.game_mode, createdAt: tempGame.createdAt } }, { upsert: true })
								}
							} else {
								tempGame = dac
							}
							return {
								game_mode: tempGame.game_mode,
								players: tempGame.players.map(player => ({ account_id: player.account_id, hero_id: player.hero_id })),
								average_mmr: 0,
								lobby_type: 0,
								server_steam_id: tempGame.server_steam_id,
								weekend_tourney_skill_level: 0,
								weekend_tourney_bracket_round: 0,
								league_id: tempGame.league_id
							}
						}
					}
					if (game)
						return game
				}
			}
		}
	}
	let rps = mongoDb().collection('rps').aggregate([{ $group: { _id: '$createdAt', rps: { $addToSet: '$$ROOT' } } }, { $sort: { _id: -1 } }, { $skip: index }, { $limit: 1 }]).toArray()
	rps = await rps
	if (rps && rps.length) {
		rps = rps[0].rps
		let account = accounts.find(account => rps && rps.some(rp => rp.account_id == account && rp.CustomGameMode == '1613886175' && rp.status == '#DOTA_RP_GAME_IN_PROGRESS_CUSTOM'))
		if (account) {
			let server_steam_id = await dotaClient.requestServerSteamId(dotaClient.toSteamID(account).toString())
			let dac = await mongoDb().collection('dac').findOne({ server_steam_id: server_steam_id.toString() })
			if (dac && dac.players && dac.players.some(player => player.account_id == account)) {
				return dac
			}
			let game = await requestApiLiveGame(server_steam_id)
			if (game.players.some(player => player.account_id == account) && !game.players.some(player => player.team_id == 5)) {
				let rp = rps.find(rp => rp.account_id == account && rp.CustomGameMode == '1613886175' && rp.status == '#DOTA_RP_GAME_IN_PROGRESS_CUSTOM')
				game.custom_game_mode = rp.CustomGameMode
				return mongoDb().collection('dac').updateOne({ server_steam_id: game.server_steam_id.toString() }, { $set: { custom_game_mode: rp.CustomGameMode, players: game.players.map(player => ({ account_id: player.account_id, hero_id: player.hero_id })), lobby_id: rp.WatchableGameID, server_steam_id: server_steam_id.toString(), game_mode: game.game_mode, createdAt: game.createdAt } }, { upsert: true }), game
			}
		}
	}
	return Promise.reject(new CustomError('Game wasn\'t found'))
}
const wait = time => new Promise(resolve => setTimeout(resolve, time || 0))
const retry = (cont, fn, delay) => fn().catch(err => cont > 0 ? wait(delay).then(() => retry(cont - 1, fn, delay)) : Promise.reject(err))
const getSteamAPIURL = (inter, method, version, parameters) => {
	if (!parameters) {
		parameters = {}
	}
	parameters.key = process.env.STEAM_WEBAPI_KEY || ''
	return `https://api.steampowered.com/${inter}/${method}/${version}?${querystring.stringify(parameters)}`
}
const requestApiLiveGame = server_steam_id => {
	return retry(2, () => {
		return fetch(getSteamAPIURL('IDOTA2MatchStats_570', 'GetRealtimeStats', 'v1', { 'server_steam_id': server_steam_id.toString() }), {
			':authority': 'api.steampowered.com',
			':method': 'GET',
			':scheme': 'https',
			'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
			'accept-encoding': 'gzip, deflate, br',
			'accept-language': 'en-US,en;q=0.9',
			'cache-control': 'no-cache',
			'dnt': 1,
			'pragma': 'no-cache',
			'upgrade-insecure-requests': 1,
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'
		}).then(res => res.json()).then(json => {
			if (json.match && json.match.game_mode) {
				json.players = []
				json.teams.forEach(team => {
					if (team.players) {
						team.players.forEach(player => {
							json.players.push({
								'account_id': player.accountid,
								'hero_id': player.heroid,
								'team_id': player.team
							})
						})
					}
				})
				let obj = {
					game_mode: json.match.game_mode,
					players: json.players,
					server_steam_id: server_steam_id.toString(),
					createdAt: new Date(),
					league_id: json.match.league_id
				}
				return obj
			}
			else {
				return Promise.reject(new CustomError('Game wasn\'t found'))
			}
		}).catch(() => Promise.reject(new CustomError('Game wasn\'t found')))
	}, 1000)
}

const getHeroName = (game, i, heroes, emoteChannel) => {
	if (game.custom_game_mode == '1613886175' && game.game_mode == 15) {
		return 'Top Left,Top,Top Right,Right,Bottom Right,Bottom,Bottom Left,Left'.split(',')[i]
	}
	let temp = heroes.filter(hero => hero.id == game.players[i].hero_id && (!hero.custom || emoteChannel))
	temp = temp.filter(hero => !hero.custom || hero.localized_name.split(' ').every((emote, i) => twitchClient.emotesets && twitchClient.emotesets[hero.emoteset.split(' ')[i]] && twitchClient.emotesets[hero.emoteset.split(' ')[i]].some(e => e.id == emote)))
	let heroname = 'Unknown'
	if (temp.length > 1) {
		let rand = parseInt(Math.random() * (temp.length - 1)) + 1
		if (temp[rand].custom) {
			let arr = []
			let localized_name_split = temp[rand].localized_name.split(' ')
			for (let i = 0; i < localized_name_split.length; i++) {
				arr.push(twitchClient.emotesets[temp[rand].emoteset.split(' ')[i]].find(e => e.id == localized_name_split[i]).code)
			}
			heroname = arr.join(' ')
			heroname = ` ${heroname} `
		}
		else {
			temp[rand].localized_name
		}
	} else if (temp.length == 1) {
		heroname = temp[0].localized_name
	}
	if ((heroname == 'Unknown' || heroname == 'Not Picked') && game.lobby_type != 1 && i < 10) {
		heroname = 'Blue,Teal,Purple,Yellow,Orange,Pink,Gray,Light Blue,Green,Brown'.split(',')[i]
	}
	return heroname
}
const getMedal = (card, medals) => {
	if (!card || isNaN(card.rank_tier)) {
		return 'Unknown'
	}
	let medal = medals.find(medal => medal.rank_tier == card.rank_tier)
	if (card.leaderboard_rank > 0) {
		return '#' + card.leaderboard_rank
	}
	if (medal) {
		return medal.name
	} else {
		return 'Unknown'
	}
}
const getMedals = async cards => {
	let medals = await mongoDb().collection('medals').find({ rank_tier: { $in: cards.map(card => card.rank_tier) } }).toArray()
	for (let i = 0; i < cards.length; i++) {
		cards[i] = getMedal(cards[i], medals)
	}
	return cards
}
const getCards = async (accounts, lobby_id) => {
	let cards = mongoDb().collection('cards').find({ id: { $in: accounts } }).sort({ lobby_id: -1 }).toArray()
	cards = await cards
	let arr = []
	let promises = []
	for (let i = 0; i < accounts.length; i++) {
		let card = cards.find(card => card.id == accounts[i])
		if (card && card.lobby_id == lobby_id) {
			arr[i] = card.card
		}
		else {
			promises.push(retry(10, () => dotaClient.timeoutProfileCard(accounts[i]), 0).then(card => {
				arr[i] = card
				mongoDb().collection('cards').updateOne({ id: accounts[i], lobby_id }, { $set: { id: accounts[i], lobby_id, createdAt: new Date(), card: { rank_tier: card.rank_tier, leaderboard_rank: card.leaderboard_rank, account_id: card.account_id } } }, { upsert: true })
			}).catch(() => ({ card: { rank_tier: -10, leaderboard_rank: 0 } })))
		}
	}
	return await Promise.all(promises).then(() => arr)
}
const twitchAPIHeaders = {
	'Client-ID': process.env.TWITCH_CLIENT_ID,
	'Accept': 'application/vnd.twitchtv.v5+json',
	'Authorization': 'OAuth ' + process.env.TWITCH_AUTH
}
const returnAccountId = str => {
	try {
		return new SteamID(str).getAccountID()
	} catch (e) {
		return parseInt(str)
	}
}
const requestMatcHistory = async (id, timestamp) => {
	let arr = []
	do {
		let matches = await retry(5, () => dotaClient.requestMatchHistory({ account_id: id, matches_requested: 20, start_at_match_id: arr.length ? arr[arr.length - 1].match_id.toString() - 1 : 0 }), 0)
		if (matches.matches && timestamp) {
			matches.matches = matches.matches.filter(match => match.start_time > timestamp)
		}
		arr = arr.concat(matches.matches)
		if (matches.matches.length < 20) {
			break
		}
	} while (true)
	return arr
}
const postToPastebin = (text, title) => {
	return pastebin.createPaste(text, title, null, 3, '1H')
}
module.exports.findGameFromChannel = findGameFromChannel
module.exports.twitchAPIHeaders = twitchAPIHeaders
module.exports.getCards = getCards
module.exports.getMedals = getMedals
module.exports.returnAccountId = returnAccountId
module.exports.fetch = fetch
module.exports.getHeroName = getHeroName
module.exports.requestMatcHistory = requestMatcHistory
module.exports.postToPastebin = postToPastebin
