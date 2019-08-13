const util = require('../../util')
const CustomError = require('../../CustomError')
const { GetUserInfoByLogin } = require('../../twitchApi')
const { twitchClient } = require('../../../index')

// Joins a specified channel by name
const joinChannel = async function joinChannel(db, args) {
	if (!args[0]) {
		return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot join channelName'))
	}

	const channelToJoin = args[0].toLowerCase()
	const { id, login } = await GetUserInfoByLogin(channelToJoin) || {}

	if (!id || !login) {
		return Promise.reject(new CustomError(`Unable to find a user with name ${channelToJoin}.`))
	}
	
	await db.collection('channels')
		.updateOne(
			{ id: id },
			{ $set: { name: login }, $setOnInsert: { count: 0 } },
			{ upsert: true }
		)

	try {
		await twitchClient.join(login)
		return `Joined ${login}.`
	} catch(err) {
		return Promise.reject(`Unable to join ${join}.`)
	}
}

// Leaves a specified channel by name
const partChannel = async function partChannel(db, args) {
	if (!args[0]) {
		return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot part channelName'))
	}

	const channelToJoin = args[0].toLowerCase()
	const { id, login } = await GetUserInfoByLogin(channelToJoin) || {}

	if (!id || !login) {
		return Promise.reject(new CustomError(`Unable to find a user with name ${channelToJoin}.`))
	}
	
	// TODO: this is really weird... Why are we removing the `name` field to signal a parted channel?
	// The better way to do this is to set a new property on the document, something like `active`.
	await db.collection('channels')
		.updateOne(
			{ id: id },
			{ $unset: { name: '' } },
			{ upsert: true }
		)

	try {
		await twitchClient.part(login)
		return `Parted ${login}.`
	} catch(err) {
		return Promise.reject(`Unable to part ${join}.`)
	}
}

module.exports = { joinChannel, partChannel }
