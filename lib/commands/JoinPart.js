'use strict'

const { db: mongoDb } = require('../mongo')
const Command = require('./Command')
const { twitchClient } = require('../../index')

const self_channel_id = process.env.SELF_TWITCH_CHANNEL_ID || 116840182
const self_channel_id_str = self_channel_id.toString()

let joinCommand = {
	name: 'Join Channel', channels: [self_channel_id_str], aliases: ['join'],
	function: async (_channel, userstate) => {
		await mongoDb().collection('channels').updateOne({ id: userstate['user-id'] }, { $set: { name: userstate.username } }, { upsert: true })
		twitchClient.join(userstate.username).catch(() => '')
		return 'Joined ' + userstate.username
	}
}

let partCommand = {
	name: 'Part Channel', channels: [self_channel_id_str], aliases: ['part'],
	function: async (_channel, userstate) => {
		await mongoDb().collection('channels').updateOne({ id: userstate['user-id'] }, { $unset: { name: '' } }, { upsert: true })
		twitchClient.part(userstate.username).catch(() => '')
		return 'Parted ' + userstate.username
	}
}

module.exports = [new Command(joinCommand), new Command(partCommand)]
