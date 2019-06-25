const util = require('../../util')
const CustomError = require('../../CustomError')

const CHANNEL_ADD_NP_SYNTAX = 'Wrong syntax: !9kmmrbot addnp id nickname'
const CHANNEL_DEL_NP_SYNTAX = 'Wrong syntax: !9kmmrbot delnp id'
const GLOBAL_ADD_NP_SYNTAX = 'Wrong syntax: !9kmmrbot addglobalnp id nickname'
const GLOBAL_DEL_NP_SYNTAX = 'Wrong syntax: !9kmmrbot delglobalnp id'

/* Adds a notable player either to a channel's list or the global list */
const addNotablePlayer = async function addNotablePlayer(db, user, channel, args, isGlobalNP) {
	const syntax = isGlobalNP ? GLOBAL_ADD_NP_SYNTAX : CHANNEL_ADD_NP_SYNTAX

	if (!args || args.length < 2) {
		return Promise.reject(new CustomError(syntax))
	}

	let steamId = util.returnAccountId(args[0])

	if (!steamId || isNaN(steamId)) {
		return Promise.reject(new CustomError(syntax))
	}

	steamId = steamId.toString()

	// The nickname might have been multiple words, join them back together.
	const nickname = args.slice(1).join(' ')

	const channelIdToUpdate = isGlobalNP ? '' : channel.id

	await db.collection('notable players').updateOne({ id: steamId, channel: channelIdToUpdate }, { $set: { id: steamId, channel: channelIdToUpdate, name: nickname, lastChanged: new Date(), lastChangedBy: user.id, enabled: true } }, { upsert: true })
	return `${user.name} successfully added ${steamId} to ${isGlobalNP ? 'global' : channel.name} notable players`
}

/* Adds a notable player to the channel's local list */
const addChannelNotablePlayer = async function addChannelNotablePlayer(db, user, channel, args) {
	return addNotablePlayer(db, user, channel, args, false)
}

/* Adds a notable player to the global list */
const addGlobalNotablePlayer = async function addGlobalNotablePlayer(db, user, channel, args) {
	return addNotablePlayer(db, user, channel, args, true)
}

/* Removes a notable player, either from the channel's local list or the global list */
const deleteNotablePlayer = async function(db, user, channel, args, isGlobalNP) {
	const syntax = isGlobalNP ? GLOBAL_DEL_NP_SYNTAX : CHANNEL_DEL_NP_SYNTAX

	if (!args || !args[0]) {
		return Promise.reject(new CustomError(syntax))
	}

	let steamId = util.returnAccountId(args[0])

	if (!steamId || isNaN(steamId)) {
		return Promise.reject(new CustomError(syntax))
	}

	steamId = steamId.toString()

	const channelIdToUpdate = isGlobalNP ? '' : channel.id

	await db.collection('notable players').updateOne({ id: steamId, channel: channelIdToUpdate }, { $set: { lastChanged: new Date(), lastChangedBy: user.id, enabled: false } })
	return `${user.name} successfully removed ${steamId} from ${isGlobalNP ? 'global' : channel.name} notable players`
}

/* Removes a notable player from the channel's local list */
const deleteChannelNotablePlayer = async function deleteChannelNotablePlayer(db, user, channel, args) {
	return deleteNotablePlayer(db, user, channel, args, false)
}

/* Removes a notable player from the global list */
const deleteGlobalNotablePlayer = async function deleteGlobalNotablePlayer(db, user, channel, args) {
	return deleteNotablePlayer(db, user, channel, args, true)
}

module.exports = {
	addChannelNotablePlayer,
	deleteChannelNotablePlayer,
	addGlobalNotablePlayer,
	deleteGlobalNotablePlayer,
}
