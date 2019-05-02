/* Checks whether the user has privileges to invoke moderation commands in the channel */
function canInvokeModCommands(userId, isGlobalMod, channelId, channelMods) {
	if (isGlobalMod)
		return true

	if (channelId == userId)
		return true

	return channelMods && (channelMods.indexOf(userId) >= 0)
}

module.exports = {
	canInvokeModCommands,
}
