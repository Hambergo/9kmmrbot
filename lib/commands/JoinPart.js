'use strict'

const { db: mongoDb } = require('../mongo')
const Command = require('./Command')
const { twitchClient } = require('../../index')

let joinCommand = {
	name: 'Join Channel', channels: [twitchClient.channelId], aliases: ['join'],
	function: async (_channel, userstate) => {
		await mongoDb().collection('channels').updateOne({ id: userstate['user-id'] }, { $set: { name: userstate.username } }, { upsert: true })
		twitchClient.join(userstate.username).catch(() => '')
		return 'Joined ' + userstate.username
	}
}

let partCommand = {
	name: 'Part Channel', channels: [twitchClient.channelId], aliases: ['part'],
	function: async (_channel, userstate) => {
		await mongoDb().collection('channels').updateOne({ id: userstate['user-id'] }, { $unset: { name: '' } }, { upsert: true })
		twitchClient.part(userstate.username).catch(() => '')
		return 'Parted ' + userstate.username
	}
}

module.exports = [new Command(joinCommand), new Command(partCommand)]
