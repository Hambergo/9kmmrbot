'use strict'
const Command = require('./Command')
const querystring = require('querystring')
const util = require('../util')
const { db: mongoDb } = require('../mongo')
const CustomError = require('../CustomError')
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
		let stream = await util.fetch('https://api.twitch.tv/kraken/streams/' + userstate['room-id'], { headers: util.twitchAPIHeaders }).then(res => res.json())
		if (!stream || !stream.stream || !stream.stream.created_at) {
			return Promise.reject(new CustomError('Stream not live'))
		}
		let videos = await util.fetch(`https://api.twitch.tv/kraken/channels/${userstate['room-id']}/videos?${querystring.stringify({ 'broadcast_type': 'archive' })}`, { headers: util.twitchAPIHeaders }).then(res => res.json())
		let stream_start = new Date(stream.stream.created_at).valueOf() / 1000 - 600
		if (videos && videos.videos && videos.videos.length) {
			let temp = Date.now()
			for (let video of videos.videos) {
				let videoStart = new Date(video.created_at).valueOf()
				if (videoStart + video.length * 1000 + 1800000 > temp) {
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