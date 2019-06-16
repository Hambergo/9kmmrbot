const { CustomError } = require('../../CustomError')
const { isValidCooldownValue } = require('../../helpers/modHelper')

/* Handles the requested cooldown command.
 * Routes the command based on the number and content of the arguments. */
async function handleCooldownCommand(db, user, channel, args) {
	if (!args || args.length == 0) {
		return showCurrentCooldown(channel)
	}

	switch (args[0]) {
		case 'set':
			return setCooldownValue(db, channel, Number(args[1]))
		default:
			return Promise.reject()
	}
}

/* Returns the cooldown for commands in the channel */
async function showCurrentCooldown(channel) {
	return `Minimum cooldown on commands is ${channel.cooldown || 30} seconds.`
}

/* Sets the cooldown value for the channel (in seconds) */
async function setCooldownValue(db, channel, value) {
	if (!isValidCooldownValue(value)) {
		// FIXME: Figure out why this message isn't being shown?
		return Promise.reject(new CustomError('Please provide a number between 30 and 300'))
	}

	await db.collection('channels').updateOne({ id: channel.id }, { $set: { cooldown: value } })
	return `Changed minimum cooldown to ${value} seconds.`
}

module.exports = { handleCooldownCommand }
