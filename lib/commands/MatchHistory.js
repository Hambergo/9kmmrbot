'use strict'
const { db: mongoDb } = require('../mongo')
const Command = require('./Command')
const CustomError = require('../CustomError')
const util = require('../util')
let command = {
	name: 'Recent Games', channels: ['62525740'], aliases: ['recent'],
	function: async (_channel, userstate, message) => {
		let split = message.split(' ')
		if (split.length > 1) {
			let heroes = mongoDb().collection('heroes').find({ custom: false }).toArray()
			let id = util.returnAccountId(split[1])
			if (isNaN(id)) {
				heroes = await heroes
				let hero = heroes.find(hero => hero.localized_name.toLowerCase() == split[1].toLowerCase())
				let game = await util.findGameFromChannel(userstate['room-id'])
				if (hero && hero.id && game && game.players && game.players.some(player => player.hero_id == hero.id)) {
					id = game.players.find(player => player.hero_id == hero.id).account_id
				} else {
					return Promise.reject(new CustomError('Not a valid id or hero name'))
				}
			}
			let gameModes = mongoDb().collection('game modes').find({}).toArray()
			let games = await util.requestMatcHistory(id)
			gameModes = await gameModes
			heroes = await heroes
			let txt = games.map(match => `${match.match_id}: ${(match.lobby_type == 7 ? 'Ranked' : 'Unranked')} ${gameModes.find(mode => mode.id == match.game_mode).name} ${(match.winner ? 'won' : 'lost')} on ${heroes.find(hero => hero.id == match.hero_id).localized_name}`).join('\n')
			return util.postToPastebin(txt, id).then(res => `${id} recent matches: ${res}`).catch(() => Promise.reject(new CustomError('There was a problem posting to pastebin')))
		}
		return Promise.reject()
	}
}
let command2 = {
	name: 'Shared Games', channels: ['62525740'], aliases: ['shared'],
	function: async (channel, userstate, message) => {
		let channels = mongoDb().collection('channels').findOne({ id: userstate['room-id'] }, { projection: { _id: 0 } })
		let isGlobalMod = await mongoDb().collection('settings').countDocuments({ name: 'Global Mod', id: userstate['user-id'] })
		channels = await channels
		let mods = (channels ? (channels.mods ? channels.mods : []) : [])
		if (userstate['room-id'] != userstate['user-id'] && (!mods || !mods.some(mod => mod == userstate['user-id'])) && !isGlobalMod) {
			return Promise.reject()
		}
		let split = message.split(' ')
		if (split.length > 1) {
			let accounts = mongoDb().collection('channels').findOne({ id: userstate['room-id'] }, { projection: { accounts: 1, _id: 0 } })
			let game = util.findGameFromChannel(userstate['room-id'])
			accounts = await accounts
			if (!accounts || !accounts.accounts || !accounts.accounts.length) {
				return Promise.reject(new CustomError('No accounts connected to ' + channel.substring(1)))
			} else {
				accounts = accounts.accounts
			}
			game = await game
			let id1
			let id2
			if (game && game.players && game.players.length) {
				let heroes = mongoDb().collection('heroes').find({ custom: false }).toArray()
				if (split[1] > 0 && split[1] < game.players.length) {
					id2 = game.players[split[1]].account_id
				} else {
					heroes = await heroes
					let hero = heroes.find(hero => hero.localized_name.toLowerCase() == split.slice(1).join(' ').toLowerCase())
					if (hero && game && game.players && game.players.some(player => player.hero_id == hero.id)) {
						id2 = game.players.find(player => player.hero_id == hero.id).account_id
					} else {
						return Promise.reject(new CustomError('Invalid hero'))
					}
				}
				let p1 = game.players.find(player => accounts.includes(player.account_id))
				if (p1) {
					id1 = p1.account_id
				}
				if (id1 != id2) {
					let gameModes = mongoDb().collection('game modes').find({}).toArray()
					let games1 = util.requestMatcHistory(id1)
					let games2 = util.requestMatcHistory(id2)
					games1 = await games1
					games2 = await games2
					gameModes = await gameModes
					let games = games1.filter(game1 => games2.some(game2 => game1.match_id.toString() == game2.match_id.toString()))
					if (games.length) {
						heroes = await heroes
						let txt = games.map(match => `${match.match_id}: ${(match.lobby_type == 7 ? 'Ranked' : 'Unranked')} ${gameModes.find(mode => mode.id == match.game_mode).name} ${(match.winner ? 'won' : 'lost')} on ${heroes.find(hero => hero.id == match.hero_id).localized_name} ${match.winner == games2.find(game2 => game2.match_id.toString() == match.match_id.toString()).winner ? 'with' : 'against'} ${heroes.find(hero => hero.id == games2.find(game2 => game2.match_id.toString() == match.match_id.toString()).hero_id).localized_name}`).join('\n')
						return util.postToPastebin(txt, `${id1} shared with ${id2}`).then(res => `${id1} shared with ${id2}: ${res}`).catch(() => Promise.reject(new CustomError('There was a problem posting to pastebin')))
					} else {
						return Promise.reject(new CustomError('No shared games found'))
					}
				} else {
					return Promise.reject(new CustomError('Can\'t find shared games with the same account'))
				}
			}
		}
		return Promise.reject()
	}
}
module.exports = [new Command(command), new Command(command2)]