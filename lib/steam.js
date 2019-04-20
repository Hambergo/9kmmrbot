'use strict'
const steam = require('steam')
const { db: mongoDb } = require('./mongo')
const events = require('events')
const CustomError = require('./CustomError')
const SteamID = require('@node-steam/id').ID
class Steam {
	constructor(username, password) {
		mongoDb().collection('servers').find({}).toArray().then(servers => {
			steam.servers = servers
		})
		this.steamClient = new steam.SteamClient()
		this.steamUser = new steam.SteamUser(this.steamClient)
		this.steamRichPresence = new steam.SteamRichPresence(this.steamClient, 570)
		this.steamClient.on('connected', () => {
			this.events.emit('steam connected', username)
			this.steamUser.logOn({ account_name: username, password: password })
		})
		this.steamClient.on('logOnResponse', logonResp => {
			this.events.emit('steam logon response', username, logonResp.eresult == steam.EResult.OK)
		})
		this.events = new events.EventEmitter()
		this.steamClient.on('loggedOff', () => this.events.emit('steam logged off', username))
		this.steamClient.on('error', () => {
			this.events.emit('steam error', username)
			this.steamClient.connect()
		})
		this.steamClient.connect()
	}
	requestRichPresence(steamIDList) {
		return new Promise((resolve, reject) => {
			if (this.steamClient.loggedOn) {
				this.steamRichPresence.once('info', data => {
					let rps = []
					for (let i = 0; i < data.rich_presence.length; i++) {
						let temp = data.rich_presence[i].rich_presence_kv
						if (temp.length == 0 || !temp) {
							continue
						}
						let steamid = data.rich_presence[i].steamid_user
						let object = {}
						object = generateRP(temp.toString())
						if (object.RP) {
							let rp = object.RP
							rp.steam_id = steamid
							if (rp.watching_server) {
								rp.watching_server = new SteamID(rp.watching_server).getSteamID64()
							}
							let party = ''
							let keys = Object.keys(rp).sort()
							keys.forEach(key => {
								if (key.startsWith('party')) {
									party += rp[key]
									delete rp[key]
								}
							})
							if (rp.BattleCup) {
								rp.BattleCup = generateObject(rp.BattleCup)
							}
							if (rp.lobby) {
								rp.lobby = generateObject(rp.lobby)
							}
							if (party) {
								rp.party = generateObject(party)
							}
							delete rp.steam_display
							delete rp.party
							delete rp.party2
							delete rp.EventPoints_22
							delete rp.EventTrophyLevel
							delete rp.num_params
							delete rp.steam_player_group
							delete rp.steam_player_group_size
							delete rp.BattleCup
							delete rp.lobby
							delete rp.watching_from_server
							if (rp.WatchableGameID == 0) {
								delete rp.WatchableGameID
							}
							rps.push(rp)
						}
					}
					resolve(rps)
				})
				this.steamRichPresence.request(steamIDList)
			} else {
				return reject(new CustomError('Game coordinator isn\'t up'))
			}
		})
	}
	exit() {
		this.steamClient.disconnect()
	}
}
const generateRP = txt => {
	let temp = {}
	txt.replace(/(?:^\x00([^\x00]*)\x00(.*)\x08$|\x01([^\x00]*)\x00([^\x00]*)\x00)/gm, (match, ...args) => {
		if (args[0]) {
			temp[args[0]] = generateRP(args[1])
		} else if (args[2]) {
			temp[args[2]] = args[3]
		}
	})
	return temp
}
const generateObject = txt => {
	let temp = {}
	txt.replace(/(?:(\w+): (\w+|"[^"]*"))|(?:(\w+) { ([^}]*) })/g, (match, ...args) => {
		if (args[0]) {
			if (temp[args[0]]) {
				temp[args[0]] = [].concat(temp[args[0]], [args[1].trim('"')])
			} else {
				temp[args[0]] = args[1].trim('"')
			}
		} else if (args[2]) {
			if (temp[args[2]]) {
				temp[args[2]] = [].concat(temp[args[2]], [generateObject(args[3])])
			} else {
				temp[args[2]] = generateObject(args[3])
			}
		}
	})
	return temp
}
module.exports = Steam