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
		for (let i = 0; i < accounts.length; i++) {
			let games = await util.requestMatcHistory(accounts[i], stream_start).catch(() => [])
			games.forEach(game => {
				if (game.game_mode != 21 && game.hasOwnProperty('winner')) {
					if (game.winner) {
						winCounter++
					} else {
						loseCounter++
					}
				}
			})
		}
		return `W ${winCounter} - L ${loseCounter}`
	}
}
module.exports = [new Command(command)]