'use strict'
const { db: mongoDb } = require('../mongo')
const Command = require('./Command')
const CustomError = require('../CustomError')
const util = require('../util')
let command = {
	name: 'Last Game', aliases: ['lg', 'lastgame'],
	function: async (channel, userstate) => {
		let accounts = mongoDb().collection('channels').findOne({ id: userstate['room-id'] }, { projection: { accounts: 1, _id: 0 } })
		accounts = (await accounts)
		if (!accounts || !accounts.accounts || !accounts.accounts.length) {
			return Promise.reject(new CustomError('No accounts connected to ' + channel.substring(1)))
		} else {
			accounts = accounts.accounts
		}
		let game = await util.findGameFromChannel(userstate['room-id'], false, false)
		let temp = await mongoDb().collection('last games').find({ lobby_id: { $ne: game.lobby_id.toString() }, 'players.account_id': { $in: accounts } }).sort({ createdAt: -1 }).limit(1).toArray()
		if (temp && temp.length) {
			let arr = []
			let heroes = mongoDb().collection('heroes').find({ id: { $in: game.players.map(player => player.hero_id.toString()).concat(temp[0].players.map(player => player.hero_id.toString())) } }).toArray()
			let emoteChannel = mongoDb().collection('settings').findOne({ id: userstate['room-id'], name: 'emotes Channel' })
			emoteChannel = await emoteChannel
			heroes = await heroes
			game.players.forEach((player, i) => {
				let tempPlayer = temp[0].players.findIndex(p => p.account_id == player.account_id)
				if (tempPlayer != -1 && !accounts.includes(temp[0].players[tempPlayer].account_id)) {
					arr.push(`${util.getHeroName(game, i, heroes, emoteChannel)} played as ${util.getHeroName(temp[0], tempPlayer, heroes, emoteChannel)}`)
				}
			})
			if (arr.length == 0) {
				return 'Not playing with anyone from last game'
			} else {
				return arr.join(', ')
			}
		} else {
			return Promise.reject(new CustomError('Last match wasn\'t found'))
		}
	}
}
module.exports = [new Command(command)]