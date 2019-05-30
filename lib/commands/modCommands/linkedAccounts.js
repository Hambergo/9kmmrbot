const util = require('../../util')
const CustomError = require('../../CustomError')

/* Lists all accounts linked to the specified channel */
async function listAccounts(channel) {
	if (!channel.accounts || channel.accounts.length < 1) {
		return Promise.reject(new CustomError(`No accounts connected to ${channel.name}`))
	}

	return `Accounts linked to ${channel.name}: ${channel.accounts.join(', ')}`
}

/* Adds Steam ID to the channel's list of linked accounts. */
async function addAccount(db, user, channel, args) {
	const syntax = 'Wrong syntax: !9kmmrbot addacc id'

	if (!args || !args[0]) {
		return Promise.reject(new CustomError(syntax))
	}

	const steamId = util.returnAccountId(args[0])

	if (!steamId || isNaN(steamId)) {
		return Promise.reject(new CustomError(syntax))
	}
	
	const successMessage = `${user.name} successfully added ${steamId} to ${channel.name} accounts`

	// If the channel has no linked accounts, create the field.
	if (!channel.accounts) {
		await db.collection('channels').updateOne({ id: channel.id }, { $set: { accounts: [steamId] } })
		return successMessage
	}

	/* Check if there are already 10 accounts linked to this channel,
	 * or if the account has already been linked. */
	if (channel.accounts.length > 10) {
		return Promise.reject(new CustomError('Can\'t add more than 10 accounts for a stream'))
	}

	if (channel.accounts.some(account => account == steamId)) {
		return Promise.reject(new CustomError(`Account ${steamId} is already connected to ${channel.name}`))
	}

	// All good, link the account to the channel.
	await db.collection('channels').updateOne({ id: channel.id }, { $addToSet: { accounts: steamId } })
	return successMessage
}

/* Removes a Steam ID from the channel's list of linked accounts */
async function deleteAccount(db, user, channel, args) {
	const syntax = 'Wrong syntax: !9kmmrbot delacc id'

	if (!args || !args[0]) {
		return Promise.reject(new CustomError(syntax))
	}

	const steamId = util.returnAccountId(args[0])

	if (!steamId || isNaN(steamId)) {
		return Promise.reject(new CustomError(syntax))
	}
	
	// Check that the Steam account is linked to the channel before attempting to remove it.
	if (!channel.accounts || !channel.accounts.some(account => account == steamId)) {
		return Promise.reject(new CustomError(`Account ${steamId} is not linked to ${channel.name}`))
	}

	await db.collection('channels').updateOne({ id: channel.id }, { $pull: { accounts: steamId } })
	return `${user.name} successfully removed ${steamId} from ${channel.name} accounts`
}

module.exports = {
	listAccounts,
	addAccount,
	deleteAccount,
}
