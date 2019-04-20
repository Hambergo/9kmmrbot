'use strict'
const Command = require('./Command')
const util = require('../util')
const { db: mongoDb } = require('../mongo')
const CustomError = require('../CustomError')
let command = {
	name: 'Medal', aliases: ['medal'],
	function: async (channel, userstate) => {
		let accounts = mongoDb().collection('channels').findOne({ id: userstate['room-id'] }, { projection: { accounts: 1, _id: 0 } })
		accounts = (await accounts)
		if (!accounts || !accounts.accounts || !accounts.accounts.length) {
			return Promise.reject(new CustomError('No accounts connected to ' + channel.substring(1)))
		} else {
			accounts = accounts.accounts
		}
		let lobby_id = await util.findGameFromChannel(userstate['room-id']).catch(() => ({ lobby_id: 0 })).then(game => game.lobby_id ? game.lobby_id : 0)
		let cards = await util.getCards(accounts, lobby_id)
		let medals = await util.getMedals([cards.reduce((best, card) => {
			if (!card) {
				return best
			}
			if (card.rank_tier > best.rank_tier || card.rank_tier == best.rank_tier && card.leaderboard_rank > 0 && card.leaderboard_rank < best.leaderboard_rank) {
				return card
			} else {
				return best
			}
		}, { rank_tier: -10, leaderboard_rank: 0 })])
		if (medals && medals.length)
			return medals[0]
		return 'Unknown'
	}
}
let command2 = {
	name: 'Game Medals', aliases: ['gm', 'gamemedals'],
	function: async (_channel, userstate) => {
		let game = await util.findGameFromChannel(userstate['room-id'])
		if (game && game.players && game.players.length) {
			let cards = await util.getCards(game.players.map(player => player.account_id), game.lobby_id)
			let medals = await util.getMedals(cards)
			let heroes = mongoDb().collection('heroes').find({ id: { $in: game.players.map(player => player.hero_id.toString()) } }).toArray()
			let emoteChannel = mongoDb().collection('settings').findOne({ id: userstate['room-id'], name: 'emotes Channel' })
			emoteChannel = await emoteChannel
			heroes = await heroes
			for (let i = 0; i < medals.length; i++) {
				let heroname = util.getHeroName(game, i, heroes, emoteChannel)
				medals[i] = `${heroname}: ${medals[i]}`
			}
			return medals.join(', ')
		}
	}
}
module.exports = [new Command(command), new Command(command2)]