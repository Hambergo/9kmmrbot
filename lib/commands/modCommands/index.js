/* Re-exports all sub-commands */

const { listAccounts, addAccount, deleteAccount } = require('./linkedAccounts')
const {
	addChannelNotablePlayer,
	deleteChannelNotablePlayer,
	addGlobalNotablePlayer,
	deleteGlobalNotablePlayer
} = require('./notablePlayer')
const { handleDelayCommand } = require('./delay')
const { handleCooldownCommand } = require('./cooldown')
const { toggleIncludeSelf } = require('./toggleIncludeSelf')
const { toggleChannelEmotes } = require('./toggleChannelEmotes')
const { idPlayerFromHero } = require('./idPlayerFromHero')
const { addChannelModerator, deleteChannelModerator } = require('./channelModerator')
const { joinChannel, partChannel } = require('./joinPart')

module.exports = {
	listAccounts,
	addAccount,
	deleteAccount,
	addChannelNotablePlayer,
	deleteChannelNotablePlayer,
	addGlobalNotablePlayer,
	deleteGlobalNotablePlayer,
	handleDelayCommand,
	handleCooldownCommand,
	toggleIncludeSelf,
	toggleChannelEmotes,
	idPlayerFromHero,
	addChannelModerator,
	deleteChannelModerator,
	joinChannel,
	partChannel,
}
