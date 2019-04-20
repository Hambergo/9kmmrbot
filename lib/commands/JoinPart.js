'use strict'
const { db: mongoDb } = require('../mongo')
const Command = require('./Command')
const { twitchClient } = require('../../index')
let command = {
	name: 'Join Channel', channels: ['116840182'], aliases: ['join'],
	function: async (_channel, userstate) => {
		await mongoDb().collection('channels').updateOne({ id: userstate['user-id'] }, { $set: { name: userstate.username } }, { upsert: true })
		twitchClient.join(userstate.username).catch(() => '')
		return 'Joined ' + userstate.username
	}
}
let command2 = {
	name: 'Part Channel', channels: ['116840182'], aliases: ['part'],
	function: async (_channel, userstate) => {
		await mongoDb().collection('channels').updateOne({ id: userstate['user-id'] }, { $unset: { name: '' } }, { upsert: true })
		twitchClient.part(userstate.username).catch(() => '')
		return 'Parted ' + userstate.username
	}
}
module.exports = [new Command(command), new Command(command2)]