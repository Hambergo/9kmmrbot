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

/* Given a hero name, returns info about the hero and the player playing it */
function findPlayerByHeroName(heroName, game, heroes) {
	const hero = heroes.find(h => h.localized_name.toLowerCase() == heroName)
	if (!hero) {
		return null;
	}

	const player = game.players.find(p => p.hero_id == hero.id)

	return { hero, player }
}

module.exports = {
	canInvokeModCommands,
	isValidDelayValue,
	isValidCooldownValue,
	findPlayerByHeroName
}
