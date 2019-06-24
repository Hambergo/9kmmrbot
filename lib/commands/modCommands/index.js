/* Re-exports all sub-commands */

const { listAccounts, addAccount, deleteAccount } = require('./linkedAccounts')
const { addNotablePlayer, deleteNotablePlayer } = require('./notablePlayer')
const { handleDelayCommand } = require('./delay')
const { handleCooldownCommand } = require('./cooldown')
const { toggleIncludeSelf } = require('./toggleIncludeSelf')
const { toggleChannelEmotes } = require('./toggleChannelEmotes')
const { idPlayerFromHero } = require('./idPlayerFromHero')
const { addChannelModerator, deleteChannelModerator } = require('./channelModerator')

module.exports = {
	listAccounts,
	addAccount,
	deleteAccount,
	addNotablePlayer,
	deleteNotablePlayer,
	handleDelayCommand,
	handleCooldownCommand,
	toggleIncludeSelf,
	toggleChannelEmotes,
	idPlayerFromHero,
	addChannelModerator,
	deleteChannelModerator,
}
