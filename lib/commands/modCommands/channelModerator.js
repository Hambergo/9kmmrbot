const { fetch, twitchAPIHeaders } = require('../../util')
const CustomError = require('../../CustomError')
const { GetUserInfoByLogin } = require('../../twitchApi')

/* Adds a user as a 9kmmrbot moderator to the channel */
const addChannelModerator = async function addChannelModerator(db, channel, args) {
	if (!args[0]) {
		return Promise.reject(new CustomError('USAGE: !9kmmrbot addmod <username>'))
	}

	const userToMod = args[0].toLowerCase()
	const { id, login } = await GetUserInfoByLogin(userToMod)

	if (!id || !login) {
		return Promise.reject(new CustomError(`Unable to find a user with name ${userToMod}.`))
	}

	if (channel.mods && channel.mods.includes(id)) {
		return Promise.reject(new CustomError(`${login} is already a mod in this channel.`))
	}

	await db.collection('channels')
		.updateOne(
			{ id: channel.id },
			{ $addToSet: { mods: id }, $setOnInsert: { count: 0 } },
			{ upsert: true }
		)

	return `Successfully added ${login} to ${channel.name} 9kmmrbot mods`
}

module.exports = { addChannelModerator }
