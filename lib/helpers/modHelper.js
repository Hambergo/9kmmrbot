/* Checks whether the user has privileges to invoke moderation commands in the channel */
function canInvokeModCommands(userId, isGlobalMod, channelId, channelMods) {
	if (isGlobalMod)
		return true

	if (channelId == userId)
		return true

	return channelMods && (channelMods.indexOf(userId) >= 0)
}

/* Checks whether the input value is a valid number of seconds for the delay setting */
function isValidDelayValue(value) {
	return !isNaN(value) && (value > 0) && (value <= 600) && (value % 30 == 0)
}

/* Checks whether the input value is a valid number of seconds for the cooldown setting */
function isValidCooldownValue(value) {
	return !isNaN(value) && (value >= 30) && (value <= 300)
}

module.exports = {
	canInvokeModCommands,
	isValidDelayValue,
	isValidCooldownValue,
}
