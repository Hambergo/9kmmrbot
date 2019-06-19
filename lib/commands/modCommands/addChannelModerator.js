const { fetch, twitchAPIHeaders } = require('../../util')
const CustomError = require('../../CustomError')

/* Adds a user as a 9kmmrbot moderator to the channel */
const addChannelModerator = async function addChannelModerator(db, channel, args) {
	if (!args[0]) {
		return Promise.reject(new CustomError('USAGE: !9kmmrbot addmod <username>'))
	}

	const userToMod = args[0].toLowerCase()

	let users
	// TODO (#14) Migrate to Helix
	try {
		const userResponse = await fetch(
			`https://api.twitch.tv/kraken/users?login=${userToMod}`,
			{ headers: twitchAPIHeaders }
		); // Need semi-colon here to prevent malicious code execution on next line
		({ users } = await userResponse.json())
	} catch (e) {
		console.log(`Error looking up user from API: ${e}`)
		return Promise.reject(new CustomError(`Unable to query the Twitch API at this time.`))
	}

	let userInfo
	if (!users || users.length === 0 || !(userInfo = users.find(u => u.name.toLowerCase() === userToMod))) {
		return Promise.reject(new CustomError(`Unable to find a user with name ${userToMod}.`))
	}

	if (channel.mods && channel.mods.includes(userInfo._id)) {
		return Promise.reject(new CustomError(`${userInfo.name} is already a mod in this channel.`))
	}

	await db.collection('channels')
		.updateOne(
			{ id: channel.id },
			{ $addToSet: { mods: userInfo._id }, $setOnInsert: { count: 0 } },
			{ upsert: true }
		)

	return `Successfully added ${userInfo.name} to ${channel.name} 9kmmrbot mods`
}

module.exports = { addChannelModerator }
