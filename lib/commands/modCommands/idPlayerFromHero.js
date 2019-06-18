const { findGameFromChannel } = require('../../util')
const { findPlayerByHeroName } = require('../../helpers/modHelper')
const CustomError = require('../../CustomError')

// Identifies the player playing a given hero on stream
async function idPlayerFromHero(db, channel, args) {
	const heroName = args.join(' ') // The hero name might have been separated by spaces

	const game = await findGameFromChannel(channel.id)
	const heroes = await db.collection('heroes').find({ id: { $in: game.players.map(p => p.hero_id.toString()) } }).toArray()

	const result = findPlayerByHeroName(heroName, game, heroes)

	if (!result) {
		return Promise.reject(new CustomError(`Hero wasn't found in the game.`))
	}

	return `${result.hero.localized_name}: ${result.player.account_id}`
}

module.exports = { idPlayerFromHero }
