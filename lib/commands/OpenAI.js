'use strict'
const { db: mongoDb } = require('../mongo')
const Command = require('./Command')
const CustomError = require('../CustomError')
const util = require('../util')
const SteamID = require('@node-steam/id').ID
let command = {
	name: 'Account', channels: ['24811779', '62525740', '25199180', '26954716'], aliases: ['leaderboard', 'lb'],
	function: async (channel, userstate) => {
		let accounts = mongoDb().collection('channels').findOne({ id: userstate['room-id'] }, { projection: { accounts: 1, _id: 0 } })
		accounts = (await accounts)
		if (!accounts || !accounts.accounts || !accounts.accounts.length) {
			return Promise.reject(new CustomError('No accounts connected to ' + channel.substring(1)))
		} else {
			accounts = accounts.accounts
		}
		let games = await getWonGames()
		let game = games.findIndex(game => game.player_steam_ids && Object.keys(game.player_steam_ids).some(player => accounts.find(account => new SteamID(player).getAccountID() == account)))
		if (game > -1) {
			return `Streamer is currently #${game + 1} on the leaderboard`
		} else {
			return Promise.reject(new CustomError('Streamer didn\'t win against OpenAI'))
		}
	}
}
const getWonGames = async (skip = 0) => {
	let games = (await util.fetch('https://arena.openai.com/api/leaderboard?per_page=20&skip=' + skip).then(res => res.json())).games
	let lastGame = games[games.length - 1]
	if (lastGame && lastGame.score && lastGame.score[0]) {
		games = games.concat(await getWonGames(skip + 100))
	}
	return games.filter(game => game.score && game.score[0])
}
module.exports = [new Command(command)]
