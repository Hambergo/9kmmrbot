const CustomError = require('../../CustomError')
const { isValidDelayValue } = require('../../helpers/modHelper')

/* Handles the requested delay command.
 * Routes the command based on the number and content of the arguments. */
async function handleDelayCommand(db, user, channel, args) {
	if (!args || args.length == 0) {
		return showCurrentDelay(db, channel)
	}

	switch (args[0]) {
		case 'on':
			return setDelayState(db, channel, true)
		case 'off':
			return setDelayState(db, channel, false)
		case 'set':
			return setDelayValue(db, channel, Number(args[1]))
		default:
			return Promise.reject()
	}
}

/* Returns the delay currently set in the channel */
async function showCurrentDelay(db, channel) {
	let delayedChannel = await db.collection('settings').findOne({ id: channel.id, name: 'Delayed Channel', delayed: true })
	return `Showing games ${(delayedChannel && delayedChannel.delay ? `with ${delayedChannel.delay} seconds delay` : 'live')}`
}

/* Sets the delay state (on/off) for a channel */
async function setDelayState(db, channel, isDelayed) {
	await db.collection('settings').updateOne({ id: channel.id, name: 'Delayed Channel' }, { $set: { delayed: !!isDelayed } }, { upsert: true })
	return `Turned delay ${isDelayed ? 'on' : 'off'}`
}

/* Sets the delay value for the channel (in seconds) */
async function setDelayValue(db, channel, value) {
	if (!isValidDelayValue(value)) {
		return Promise.reject(new CustomError('Please provide a number between 30 and 600 that\'s divisible by 30'))
	}

	await db.collection('settings').updateOne({ id: channel.id, name: 'Delayed Channel' }, { $set: { delay: value } }, { upsert: true })
	return `Set delay to ${value}`
}

module.exports = { handleDelayCommand }
