'use strict'
const dota2 = require('dota2')
const Steam = require('./steam')
const CustomError = require('./CustomError')
class Dota extends Steam {
	constructor(username, password) {
		super(username, password)
		this.dota2Client = new dota2.Dota2Client(this.steamClient, false, false)
		this.timeoutMatchDetails = match_id => {
			return promiseTimeout(new Promise((resolve, reject) => {
				if (this.dota2Client._gcReady && this.steamClient.loggedOn) {
					this.dota2Client.requestMatchDetails(match_id, (err, details) => {
						if (err) {
							reject(err)
						} else {
							resolve(details)
						}
					})
				} else {
					reject(new CustomError('Game coordinator isn\'t up'))
				}
			}), 1000, 'Error getting game details')
		}
		this.timeoutMatchHistory = options => {
			return promiseTimeout(new Promise((resolve, reject) => {
				if (this.dota2Client._gcReady && this.steamClient.loggedOn) {
					this.dota2Client.requestPlayerMatchHistory(options.account_id, options, (err, history) => {
						if (err) {
							reject(err)
						} else {
							if (history.matches.length) {
								resolve(history)
							}
							else {
								reject(new CustomError('Error getting games history'))
							}
						}
					})
				} else {
					reject(new CustomError('Game coordinator isn\'t up'))
				}
			}), 1000, 'Error getting games history')
		}
		this.timeoutProfileCard = account_id => {
			let res = promiseTimeout(new Promise((resolve, reject) => {
				if (this.dota2Client._gcReady && this.steamClient.loggedOn) {
					this.dota2Client.requestProfileCard(account_id, (err, card) => {
						if (err) {
							reject(err)
						} else {
							resolve(card)
						}
					})
				} else {
					reject(new CustomError('Game coordinator isn\'t up'))
				}
			}), 1000, 'Error getting medal')
			return res
		}
		this.timeoutSpectateFriendGame = steam_id => {
			return promiseTimeout(new Promise((resolve, reject) => {
				if (this.dota2Client._gcReady && this.steamClient.loggedOn) {
					this.dota2Client.requestServerSteamId(steam_id)
					this.dota2Client.once('spectateFriendGameData', response => resolve(response.server_steamid))
				} else {
					reject(new CustomError('Game coordinator isn\'t up'))
				}
			}), 1000, 'Error getting server steamid')
		}
		this.dota2Client.on('ready', () => this.events.emit('dota gc connected', username))
		this.dota2Client.on('unready', () => this.events.emit('dota gc disconnected', username))
		this.steamClient.on('logOnResponse', () => {
			this.launch()
		})
	}
	launch() {
		this.dota2Client.launch()
	}
	exit() {
		this.dota2Client.exit()
		super.exit()
	}
	requestMatchHistory(options) {
		return this.timeoutMatchHistory(options)
	}
	requestProfileCard(account_id) {
		return this.timeoutProfileCard(account_id)
	}
	requestMatchDetails(match_id) {
		return this.timeoutMatchDetails(match_id)
	}
	requestSourceTVGames(options) {
		return new Promise((resolve, reject) => {
			if (!this.dota2Client._gcReady || !this.steamClient.loggedOn) {
				reject(new CustomError('Game coordinator isn\'t up'))
			}
			if (!options) {
				options = {}
			}
			var { start_game = 0, lobby_ids = [], league_id = 0 } = options
			let count = 0
			let games = []
			const callbackNotSpecificGames = data => {
				if (!data.specific_games) {
					games = games.concat(data.game_list.filter(game => game.players && game.players.length > 0).map(game => ({
						server_steam_id: game.server_steam_id.toString(),
						lobby_id: game.lobby_id.toString(),
						lobby_type: game.lobby_type,
						delay: game.delay,
						game_mode: game.game_mode,
						average_mmr: game.average_mmr,
						players: game.players,
						league_id: game.league_id,
						weekend_tourney_skill_level: game.weekend_tourney_skill_level,
						weekend_tourney_bracket_round: game.weekend_tourney_bracket_round,
						specific_games: data.specific_games
					})))
					if (data.league_id == 0 && start_game == data.start_game) {
						this.dota2Client.removeListener('sourceTVGamesData', callbackNotSpecificGames)
						if (lobby_ids.length) {
							this.dota2Client.on('sourceTVGamesData', callbackSpecificGames)
							while (lobby_ids.length > 0) {
								count++
								this.dota2Client.requestSourceTVGames({ lobby_ids: lobby_ids.splice(0, 20), start_game })
							}
						} else {
							resolve(games.filter((game, index) => games.findIndex(g => g.lobby_id == game.lobby_id) == index))
						}
					}
				}
			}
			const callbackSpecificGames = data => {
				if (data.specific_games) {
					games = games.concat(data.game_list.filter(game => game.players && game.players.length > 0).map(game => ({
						server_steam_id: game.server_steam_id.toString(),
						lobby_id: game.lobby_id.toString(),
						lobby_type: game.lobby_type,
						delay: game.delay,
						game_mode: game.game_mode,
						average_mmr: game.average_mmr,
						players: game.players,
						league_id: game.league_id,
						weekend_tourney_skill_level: game.weekend_tourney_skill_level,
						weekend_tourney_bracket_round: game.weekend_tourney_bracket_round,
						specific_games: data.specific_games
					})))
					count--
					if (!count) {
						this.dota2Client.removeListener('sourceTVGamesData', callbackSpecificGames)
						resolve(games.filter((game, index) => games.findIndex(g => g.lobby_id == game.lobby_id) == index))
					}
				}
			}
			this.dota2Client.on('sourceTVGamesData', callbackNotSpecificGames)
			if (league_id) {
				this.dota2Client.requestSourceTVGames({ league_id })
			}
			this.dota2Client.requestSourceTVGames({ start_game, lobby_ids })
		})
	}
	requestRichPresence(accountIDList) {
		return super.requestRichPresence(accountIDList.map(accountId => this.dota2Client.ToSteamID(accountId))).then(rps => {
			let obj = []
			rps.forEach(rp => {
				rp.account_id = this.dota2Client.ToAccountID(rp.steam_id)
				obj.push(rp)
			})
			return obj
		}).catch(() => [])
	}
	requestServerSteamId(steam_id) {
		return this.timeoutSpectateFriendGame(steam_id)
	}
	toSteamID(account_id) {
		return this.dota2Client.ToSteamID(account_id)
	}
	toAccountID(steam_id) {
		return this.dota2Client.ToAccountID(steam_id)
	}
}
dota2.Dota2Client.prototype.requestServerSteamId = function (steam_id) {
	this.sendToGC(dota2.schema.lookupEnum('EDOTAGCMsg').values.k_EMsgGCSpectateFriendGame, dota2.schema.lookupType('CMsgSpectateFriendGame').encode({ steam_id: steam_id, live: false }).finish())
}
let handlers = dota2.Dota2Client.prototype._handlers
handlers[dota2.schema.lookupEnum('EDOTAGCMsg').values.k_EMsgGCSpectateFriendGameResponse] = function onSpectateFriendGameResponse(message) {
	let spectateFriendGameResponse = dota2.schema.lookupType('CMsgSpectateFriendGameResponse').decode(message)
	this.emit('spectateFriendGameData', spectateFriendGameResponse)
}
const promiseTimeout = (promise, ms, reason) => {
	return new Promise((resolve, reject) => {
		let timeoutCleared = false
		let timeoutId = setTimeout(() => {
			timeoutCleared = true
			reject(new CustomError(reason))
		}, ms)
		promise.then(result => {
			if (!timeoutCleared) {
				clearTimeout(timeoutId)
				resolve(result)
			}
		}).catch(err => {
			if (!timeoutCleared) {
				clearTimeout(timeoutId)
				reject(err)
			}
		})
	})
}
module.exports = Dota