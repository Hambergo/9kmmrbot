'use strict'

const Dota = require('./lib/dota')
const Twitch = require('./lib/twitch')
const CustomError = require('./lib/CustomError')
const mongo = require('./lib/mongo')
const fs = require('fs')
const twitchApi = require('./lib/twitchApi')

let dotaClient, mongoDb

mongo.connect().then(c => {
	mongoDb = c
	initTwitchClient()

	dotaClient = new Dota(process.env.STEAM_USERNAME, process.env.STEAM_PASSWORD)
	module.exports.dotaClient = dotaClient

	getGamesAndRpsInterval = setInterval(intervalGetGamesAndRps, 30000)
})

/* Initialize the Twitch client used across the application.
 * SIDE EFFECT: Adds the client to this module's exports */
const initTwitchClient = () => {
	twitchApi.GetChannelInfo().then((info) => {
		let twitchClient = new Twitch(info.login, process.env.TWITCH_AUTH)
		twitchClient.channelId = info.id
		twitchClient.channelName = info.display_name

		module.exports.twitchClient = twitchClient

		let commands = [].concat(...fs.readdirSync('./lib/commands/').filter(file => file != 'Command.js').map(file => require(`./lib/commands/${file}`)))
		twitchClient.AddCommand(commands)

		twitchClient.on('connected', () => {
			return mongoDb.collection('channels').find({ name: { $exists: true, $ne: '' } }, { projection: { id: 1, name: 1, count: 1, _id: 0 } }).sort({ count: -1 }).toArray().then(results => {
				if (results) {
					initialJoinTwitchChannels(twitchClient, results.map(result => result.name))
				}
			})
		})

		twitchClient.on('command', (name, room_id, channel, response) => {
			response.then(txt => {
				mongoDb.collection('channels').updateOne({ id: room_id }, { $inc: { count: 1 } })
				return txt
			}).catch(err => {
				if (err) {
					if (err instanceof CustomError) {
						return err.message
					}
					else {
						console.log(err)
						let temp = { message: err.message, name: err.name, createdAt: new Date() }
						mongoDb.collection('errors').insertOne(temp)
					}
				}
			}).then(txt => {
				if (txt) {
					console.log(`<${channel.substring(1)}> ${txt}`)
					if (process.env.NODE_ENV == 'production') {
						twitchClient.say(channel, txt)
							.catch(e => console.log(`Tried to say "${txt}" in ${channel}, but failed: ${e}`))
					}
				}
			})
		})
	})
}


/* Joins a list of Twitch channels, along with our own channel */
const initialJoinTwitchChannels = (twitchClient, channels) => {
	channels.unshift(twitchClient.channelName)
	console.log(`Joining ${channels.length} channels, including ${twitchClient.channelName} (self).`)
	twitchClient.joinQueue(channels)
}

const intervalGetGamesAndRps = () => {
	return mongoDb.collection('channels').find({ name: { $exists: true, $ne: '' }, accounts: { $exists: true, $type: 'array' } }, { projection: { name: 1, accounts: 1, _id: 0 } }).toArray().then(channels => {
		let accounts = new Set()
		if (channels) {
			channels.forEach(channel => channel.accounts.forEach(account => accounts.add(account)))
			if (!accounts.size) return
			return dotaClient.requestRichPresence([...accounts]).then(rps => {
				let lobby_ids = new Set()
				let now = new Date()
				if (!rps.length) return
				rps.forEach(rp => rp.createdAt = now)
				mongoDb.collection('rps').insertMany(rps)
				rps.filter(rp => rp.WatchableGameID).forEach(rp => lobby_ids.add(rp.WatchableGameID))
				return dotaClient.requestSourceTVGames({ start_game: 90, lobby_ids: [...lobby_ids] }).then(matches => {
					let now = new Date()
					matches = matches.map(match => {
						let item = {
							average_mmr: match.average_mmr,
							game_mode: match.game_mode,
							league_id: match.league_id,
							lobby_id: match.lobby_id,
							lobby_type: match.lobby_type,
							players: match.players,
							server_steam_id: match.server_steam_id,
							weekend_tourney_bracket_round: match.weekend_tourney_bracket_round,
							weekend_tourney_skill_level: match.weekend_tourney_skill_level,
							createdAt: now
						}
						if (item.players) {
							item.players = item.players.map(player => ({
								account_id: player.account_id,
								hero_id: player.hero_id
							}))
						}
						return item
					})
					return mongoDb.collection('games').insertMany(matches)
				}).then(async () => {
					let games = await mongoDb.collection('games').aggregate([{ $match: { createdAt: { $gte: new Date(new Date() - 900000) } } }, { $group: { _id: '$createdAt', matches: { $addToSet: '$$ROOT' } } }, { $sort: { _id: -1 } }, { $limit: 2 }]).toArray()
					if (games.length == 2) {
						let endedGames = games[1].matches.filter(game => !game.players.some(p => p.hero_id == 0) && !games[0].matches.some(g => g.lobby_id == game.lobby_id)).map(game => ({ players: game.players.map(player => ({ account_id: player.account_id, hero_id: player.hero_id })), lobby_id: game.lobby_id, game_mode: game.game_mode, createdAt: game.createdAt }))
						if (endedGames.length) {
							mongoDb.collection('last games').bulkWrite(endedGames.map(game => ({ updateOne: { 'filter': { lobby_id: game.lobby_id }, 'update': { players: game.players, createdAt: game.createdAt, game_mode: game.game_mode, lobby_id: game.lobby_id }, 'upsert': true } })))
						}
						if (!games[0].matches.some(game => game.players && game.players.some(player => player.account_id == 107018903)) && games[1].matches.some(game => game.players && game.players.some(player => player.account_id == 107018903 && player.hero_id == 27))) {
							await mongoDb.collection('fun').updateOne({ name: 'Last Shaman Game' }, { $set: { date: new Date(games[0]._id) } })
						}
					}
				}).catch(() => { })
			}).catch(() => { })
		}
	}).catch(() => { })
}
let getGamesAndRpsInterval
process.on('SIGTERM', () => {
	clearInterval(getGamesAndRpsInterval)
	dotaClient.exit()
	process.exit(0)
})
module.exports.twitchClient = {}
module.exports.dotaClient = {}
