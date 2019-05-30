const util = require('../../util')
const CustomError = require('../../CustomError')

/* Adds a notable player to the channel's local list */
async function addNotablePlayer(db, user, channel, args) {
	const syntax = 'Wrong syntax: !9kmmrbot addnp id nickname'

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

	await db.collection('notable players').updateOne({ id: steamId, channel: channel.id }, { $set: { id: steamId, channel: channel.id, name: nickname, lastChanged: new Date(), lastChangedBy: user.id, enabled: true } }, { upsert: true })
	return `${user.name} successfully added ${steamId} to ${channel.name} local notable players`
}

/* Removes a notable player from the channel's local list */
async function deleteNotablePlayer(db, user, channel, args) {
	const syntax = 'Wrong syntax: !9kmmrbot delnp id'

	if (!args || !args[0]) {
		return Promise.reject(new CustomError(syntax))
	}

	let steamId = util.returnAccountId(args[0])

	if (!steamId || isNaN(steamId)) {
		return Promise.reject(new CustomError(syntax))
	}

	steamId = steamId.toString()

	await db.collection('notable players').updateOne({ id: steamId, channel: channel.id }, { $set: { lastChanged: new Date(), lastChangedBy: user.id, enabled: false } })
	return `${user.name} successfully removed ${steamId} from ${channel.name} local notable players`
}

module.exports = {
	addNotablePlayer,
	deleteNotablePlayer,
}
