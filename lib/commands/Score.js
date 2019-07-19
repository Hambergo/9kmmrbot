'use strict'
const Command = require('./Command')
const util = require('../util')
const { db: mongoDb } = require('../mongo')
const CustomError = require('../CustomError')
const twitchApi = require('../twitchApi')
let command = {
	name: 'Score', aliases: ['score', 'wl', 'record'],
	function: async (channel, userstate) => {
		let accounts = mongoDb().collection('channels').findOne({ id: userstate['room-id'] }, { projection: { accounts: 1, _id: 0 } })
		accounts = (await accounts)
		if (!accounts || !accounts.accounts || !accounts.accounts.length) {
			return Promise.reject(new CustomError('No accounts connected to ' + channel.substring(1)))
		} else {
			accounts = accounts.accounts
		}
		let stream = await twitchApi.GetStreamInfo(userstate['room-id'])
		if (!stream || stream.type != 'live' || !stream.started_at) {
			return Promise.reject(new CustomError('Stream not live'))
		}
		let videos = await twitchApi.GetVodsInfo(userstate['room-id'])
		let stream_start = new Date(stream.started_at).valueOf() / 1000 - 600
		if (videos && videos.length) {
			let temp = Date.now()
			for (let video of videos) {
				let videoStart = new Date(video.created_at).valueOf()
				let h = video.duration.search('h')
				let m = video.duration.search('m')
				let s = video.duration.search('s')
				let duration = (h > 0 ? 3600 * parseInt(video.duration.substring(0, h)) : 0) + (m > h ? 60 * parseInt(video.duration.substring(h + 1, m)) : 0) + (s == video.duration.length - 1 ? parseInt(video.duration.substring(m + 1, s)) : 0)
				if (videoStart + (duration + 1800) * 1000 > temp) {
					temp = videoStart
				} else {
					break
				}
			}
			if (temp != stream_start) {
				stream_start = temp / 1000 - 600
			}
		}
		let winCounter = 0
		let loseCounter = 0
		let gameDetails = mongoDb().collection('game details').find({ 'players.account_id': { $in: accounts }, createdAt: { $gte: stream_start } }).toArray()
		let lastGames = mongoDb().collection('last games').find({ 'players.account_id': { $in: accounts }, createdAt: { $gte: stream_start }, lobby_type: { $in: [0, 1, 7] }, game_mode: { $in: [1, 2, 3, 4, 5, 8, 12, 16, 17, 18, 19, 20, 22, 23] } }).toArray()
		gameDetails = await gameDetails
		lastGames = await lastGames
		try {
			let gamesToRequest = lastGames.filter(game => game.match_id && !gameDetails.some(detail => detail.match_id.toString() == game.match_id.toString()))
			for (let game of gamesToRequest) {
				let detail = await steamApi.GetMatchDetails({ match_id: game.match_id.toString() })
				for (let i = 0; i < game.players.length; i++) {
					let player = detail.players.find(player => player.hero_id == game.players[i].hero_id)
					if (player) {
						player.account_id = game.players[i].account_id
					}
				}
				gameDetails.push(detail)
				await mongoDb().collection('game details').insertOne(detail)
			}
		} catch (e) { }
		for (let detail of gameDetails) {
			let playerIndex = detail.players.findIndex(player => accounts.some(account => player.account_id == account))
			if (playerIndex != -1) {
				if ((playerIndex < detail.players.length / 2) ^ detail.radiant_win) {
					loseCounter++
				} else {
					winCounter++
				}
			}
		}
		return `W ${winCounter} - L ${loseCounter}`
	}
}
module.exports = [new Command(command)]