'use strict'

const db = require('../mongo').db()
const Command = require('./Command')
const CustomError = require('../CustomError')
const { twitchClient } = require('../../index')
const util = require('../util')
const { canInvokeModCommands, canInvokeGlobalModCommands } = require('../helpers/modHelper')

// Command handlers for the various sub-commands
const {
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
} = require('./modCommands')

let command = {
	name: 'Moderation', aliases: ['9kmmrbot'],
	function: async (roomName, userstate, message) => {
		// The passed-in room name starts with '#', remove it.
		const channelName = roomName.substring(1)

		const channelId = userstate['room-id']
		const userId = userstate['user-id']
		const username = userstate['username']

		const channel = await db.collection('channels').findOne({ id: channelId })
		if (!channel)
			return Promise.reject()

		const isGlobalMod = await db.collection('settings').countDocuments({ name: 'Global Mod', id: userId })

		const mods = channel.mods ? channel.mods : []

		if (!canInvokeModCommands(userId, isGlobalMod, channelId, mods))
			return Promise.reject()

		let args = message.toLowerCase().split(' ')
		args.shift()

		const user = {
			id: userId,
			name: username,
			isGlobalMod,
		}

		return handleCommand(user, channel, args)

		if (split.length > 2 && split[1].toLowerCase() == 'delmod') {
			if ((/^[a-zA-Z0-9][\w]{0,24}$/).test(split[2])) {
				return util.fetch('https://api.twitch.tv/kraken/users?login=' + split[2], { headers: util.twitchAPIHeaders }).then(res => res.json()).then(async json => {
					if (json.users && json.users.length && json.users.some(value => value.name.toLowerCase() == split[2].toLowerCase())) {
						if (mods.find(mod => mod == json.users.find(value => value.name.toLowerCase() == split[2].toLowerCase())._id)) {
							await db.collection('channels').updateOne({ id: channelId }, { $pull: { mods: json.users.find(value => value.name.toLowerCase() == split[2].toLowerCase())._id }, $setOnInsert: { count: 0 } }, { upsert: true })
							return `Successfully removed ${split[2]} to ${channelName} 9kmmrbot mods`
						}
						else {
							return Promise.reject(new CustomError('Mod doesn\'t exist'))
						}
					} else {
						Promise.reject(new CustomError('Not a user on twitch'))
					}
				}).catch(err => {
					if (err instanceof CustomError) {
						return err
					} else {
						return Promise.reject(new CustomError('Not a user on twitch'))
					}
				})
			} else {
				return Promise.reject(new CustomError('Not a valid twitch username'))
			}
		} else {
			if (!isGlobalMod) {
				return Promise.reject()
			}
			if (split[1].toLowerCase() == 'addglobalnp') {
				if (split.length > 3) {
					let id = util.returnAccountId(split[2])
					if (isNaN(id)) {
						return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot addglobalnp id nickname'))
					} else {
						id = id.toString()
						await db.collection('notable players').updateOne({ id, channel: '' }, { $set: { id, name: split.slice(3).join(' '), lastChanged: new Date(), lastChangedBy: userId, enabled: true } }, { upsert: true })
						return `${username} successfully added ${id} to global notable players`
					}
				} else {
					return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot addglobalnp id nickname'))
				}
			} else if (split[1].toLowerCase() == 'delglobalnp') {
				if (split.length == 3) {
					let id = util.returnAccountId(split[2])
					if (isNaN(id)) {
						return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot delglobalnp id'))
					} else {
						id = id.toString()
						await db.collection('notable players').updateOne({ id, channel: '' }, { $set: { id, lastChanged: new Date(), lastChangedBy: userId, enabled: false } })
						return `${username} successfully removed ${id} from global notable players`
					}
				} else {
					return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot delglobalnp id'))
				}
			} else if (split[1] == 'join' && split.length == 3) {
				if ((/^[a-zA-Z0-9][\w]{0,24}$/).test(split[2])) {
					return util.fetch('https://api.twitch.tv/kraken/users?login=' + split[2], { headers: util.twitchAPIHeaders }).then(res => res.json()).then(async json => {
						if (json.users && json.users.length && json.users.some(value => value.name.toLowerCase() == split[2].toLowerCase())) {
							await db.collection('channels').updateOne({ id: json.users.find(value => value.name.toLowerCase() == split[2].toLowerCase())._id }, { $set: { name: split[2].toLowerCase() }, $setOnInsert: { count: 0 } }, { upsert: true })
							twitchClient.join(split[2].toLowerCase()).catch(() => '')
							return 'Joined ' + split[2]
						} else {
							return Promise.reject(new CustomError('Not a user on twitch'))
						}
					}).catch(() => Promise.reject(new CustomError('Not a user on twitch')))
				} else {
					return Promise.reject(new CustomError('Not a valid twitch username'))
				}
			} else if (split[1] == 'part' && split.length == 3) {
				if ((/^[a-zA-Z0-9][\w]{0,24}$/).test(split[2])) {
					return util.fetch('https://api.twitch.tv/kraken/users?login=' + split[2], { headers: util.twitchAPIHeaders }).then(res => res.json()).then(async json => {
						if (json.users && json.users.length && json.users.some(value => value.name.toLowerCase() == split[2].toLowerCase())) {
							await db.collection('channels').updateOne({ id: json.users.find(value => value.name.toLowerCase() == split[2].toLowerCase())._id }, { $unset: { name: '' } }, { upsert: true })
							twitchClient.part(split[2].toLowerCase()).catch(() => '')
							return 'Parted ' + split[2]
						} else {
							return Promise.reject(new CustomError('Not a user on twitch'))
						}
					}).catch(() => Promise.reject(new CustomError('Not a user on twitch')))
				} else {
					return Promise.reject(new CustomError('Not a valid twitch username'))
				}
			} else if (split[1] == 'emotes') {
				if (split.length <= 2) {
					return
				}
				if (split[2] == 'add') {
					if (split.length <= 4) {
						return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot emotes add emotes,hero'))
					}
					let temp = split.slice(3).join(' ').split(',')
					if (temp.length != 2) {
						return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot emotes add emotes,hero'))
					}
					let emotes = temp[0].split(' ')
					let hero = temp[1].trim()
					let emotesetsKeys = Object.keys(twitchClient.emotesets)
					let localized_name = []
					for (let i = 0; i < emotes.length; i++) {
						if (!emotesetsKeys.some(key => {
							let temp = twitchClient.emotesets[key].find(emote => emote.code == emotes[i])
							if (temp) {
								localized_name.push({ id: temp.id, emoteset: key })
							}
							return temp
						})) {
							return Promise.reject(new CustomError(`Emote ${emotes[i]} not found on the bot`))
						}
					}
					if (localized_name.length == 0) {
						return Promise.reject(new CustomError('No emote found'))
					}
					let heroExists = await db.collection('heroes').findOne({ custom: false, localized_name: { $regex: hero, $options: 'i' } })
					if (heroExists) {
						await db.collection('heroes').updateOne({ custom: true, localized_name: localized_name.map(emote => emote.id).join(' ') }, { $set: { custom: true, localized_name: localized_name.map(emote => emote.id).join(' '), id: heroExists.id, emoteset: localized_name.map(emote => emote.emoteset).join(' ') } }, { upsert: true })
						return `Emotes ${emotes.join(' ')} added as custom emote for hero ${hero}`
					} else {
						return Promise.reject(new CustomError(`Hero ${hero} doesn't exist`))
					}
				} else if (split[2] == 'del' && split.length > 3) {
					let emotes = split.slice(3).join(' ').split(' ')
					let emotesetsKeys = Object.keys(twitchClient.emotesets)
					let localized_name = []
					for (let i = 0; i < emotes.length; i++) {
						if (!emotesetsKeys.some(key => {
							let temp = twitchClient.emotesets[key].find(emote => emote.code == emotes[i])
							if (temp) {
								localized_name.push(temp.id)
							}
							return temp
						})) {
							return Promise.reject(new CustomError(`Emote ${emotes[i]} not found in subs emotes`))
						}
					}
					let customHero = await db.collection('heroes').findOne({ custom: true, localized_name: { $regex: localized_name.join(' '), $options: 'i' } })
					if (customHero) {
						await db.collection('heroes').deleteOne(customHero)
						return `Emote ${emotes.join(' ')} removed from database`
					} else {
						return Promise.reject(new CustomError(`Emote ${emotes.join(' ')} not found in database`))
					}
				}
				else if (split[2] == 'list') {
					let heroes = await db.collection('heroes').find().toArray()
					let arr = []
					heroes.forEach(hero => {
						if (!hero.custom) {
							return
						}
						let localized_name_split = hero.localized_name.split(' ')
						let emoteset_split = hero.emoteset.split(' ')
						let temp = []
						for (let i = 0; i < localized_name_split.length; i++) {
							if (!twitchClient || !twitchClient.emotesets || !twitchClient.emotesets[emoteset_split[i]] || !twitchClient.emotesets[emoteset_split[i]].some(emote => emote.id == localized_name_split[i])) {
								return
							} else {
								temp.push(twitchClient.emotesets[emoteset_split[i]].find(emote => emote.id == localized_name_split[i]).code)
							}
						}
						arr.push({ hero: heroes.find(h => h.id == hero.id && !h.custom).localized_name, emotes: temp.join(' ') })
						return
					})
					return arr.reduce((prev, curr) => {
						let hero = prev.find(hero => hero.name == curr.hero)
						if (!hero) {
							let temp = { name: curr.hero, emotes: [] }
							prev.push(temp)
							hero = temp
						}
						hero.emotes.push(curr.emotes)
						return prev
					}, []).map(item => `${item.name}: ${item.emotes.join(' , ')}`).join(' . ')
				}
			}
		}
	}
}

/* Routes the invoked command to the appropriate handler */
async function handleCommand(user, channel, args) {
	if (!args || args.length < 1)
		return Promise.reject()

	let command = args.shift()

	switch (command) {
		case 'listacc':
			return listAccounts(channel)
		case 'addacc':
			return addAccount(db, user, channel, args)
		case 'delacc':
			return deleteAccount(db, user, channel, args)
		case 'addnp':
			return addNotablePlayer(db, user, channel, args)
		case 'delnp':
			return deleteNotablePlayer(db, user, channel, args)
		case 'delay':
			return handleDelayCommand(db, user, channel, args)
		case 'cd':
			return handleCooldownCommand(db, user, channel, args)
		case 'toggleself':
			return toggleIncludeSelf(db, channel)
		case 'toggleemotes':
			return toggleChannelEmotes(db, channel)
		case 'id':
			return idPlayerFromHero(db, channel, args)
		default:
			return handleChannelLevelGlobalModCmd(command, user, channel, args)
	}
}

/* Handles channel-level commands that require Global Mod access */
async function handleChannelLevelGlobalModCmd(command, user, channel, args) {
	if (!canInvokeGlobalModCommands(user.id, user.isGlobalMod, channel.id)) {
		return Promise.reject()
	}

	switch (command) {
		case 'addmod':
			return addChannelModerator(db, channel, args)
		default:
			return Promise.reject()
	}
}

module.exports = [new Command(command)]
