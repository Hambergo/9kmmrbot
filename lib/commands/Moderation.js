'use strict'

const { db: mongoDb } = require('../mongo')
const Command = require('./Command')
const CustomError = require('../CustomError')
const { twitchClient } = require('../../index')
const util = require('../util')

let command = {
	name: 'Moderation', aliases: ['9kmmrbot'],
	function: async (channel, userstate, message) => {
		let channels = mongoDb().collection('channels').findOne({ id: userstate['room-id'] }, { projection: { _id: 0 } })
		let isGlobalMod = await mongoDb().collection('settings').countDocuments({ name: 'Global Mod', id: userstate['user-id'] })
		channels = await channels
		let mods = (channels ? (channels.mods ? channels.mods : []) : [])

		if (userstate['room-id'] != userstate['user-id'] && (!mods || !mods.some(mod => mod == userstate['user-id'])) && !isGlobalMod) {
			return Promise.reject()
		}
		let split = message.split(' ')
		if (split.length == 1) {
			return Promise.reject()
		}
		if (split.length == 2 && split[1].toLowerCase() == 'listacc') {
			let accounts = channels.accounts
			if (!accounts || !accounts.length) {
				return Promise.reject(new CustomError('No accounts connected to ' + channel.substring(1)))
			}
			return `Accounts linked to ${channel.substring(1)}: ${accounts.join(', ')}`
		} else if (split[1].toLowerCase() == 'addacc') {
			const syntax = 'Wrong syntax: !9kmmrbot addacc id'

			if (split.length != 3) {
				return Promise.reject(new CustomError(syntax))
			}

			let steamId = util.returnAccountId(split[2])

			if (isNaN(steamId)) {
				return Promise.reject(new CustomError(syntax))
			}
			
			return addAccount(userstate.username, channels, steamId)
		} else if (split[1].toLowerCase() == 'delacc') {
			const syntax = 'Wrong syntax: !9kmmrbot delacc id'

			if (split.length != 3) {
				return Promise.reject(new CustomError(syntax))
			}

			let steamId = util.returnAccountId(split[2])

			if (isNaN(steamId)) {
				return Promise.reject(new CustomError(syntax))
			}
			
			return deleteAccount(userstate.username, channels, steamId)
		} else if (split[1].toLowerCase() == 'addnp') {
			if (split.length > 3) {
				let id = util.returnAccountId(split[2])
				if (isNaN(id)) {
					return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot addnp id'))
				} else {
					id = id.toString()
					await mongoDb().collection('notable players').updateOne({ id, channel: userstate['room-id'] }, { $set: { id, channel: userstate['room-id'], name: split.slice(3).join(' '), lastChanged: new Date(), lastChangedBy: userstate['user-id'], enabled: true } }, { upsert: true })
					return `${userstate.username} successfully added ${id} to ${channel.substring(1)} local notable players`
				}
			} else {
				return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot addnp id nickname'))
			}
		} else if (split[1].toLowerCase() == 'delnp') {
			if (split.length == 3) {
				let id = util.returnAccountId(split[2])
				if (isNaN(id)) {
					return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot delnp id'))
				} else {
					id = id.toString()
					await mongoDb().collection('notable players').updateOne({ id, channel: userstate['room-id'] }, { $set: { id, channel: userstate['room-id'], lastChanged: new Date(), lastChangedBy: userstate['user-id'], enabled: false } })
					return `${userstate.username} successfully removed ${id} from ${channel.substring(1)} local notable players`
				}
			} else {
				return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot delnp id'))
			}
		} else if (split.length == 2 && split[1].toLowerCase() == 'delay') {
			let delayedChannel = mongoDb().collection('settings').findOne({ id: userstate['room-id'], name: 'Delayed Channel', delayed: true }, { projection: { _id: 0 } })
			let delay = await delayedChannel
			return 'Showing games ' + (delay ? `in ${delay.delay} seconds delay` : 'live')
		} else if (split[1].toLowerCase() == 'delay' && split.length > 2) {
			if (split[2].toLowerCase() == 'on') {
				await mongoDb().collection('settings').updateOne({ id: userstate['room-id'], name: 'Delayed Channel' }, { $set: { delayed: true } }, { upsert: true })
				return 'Turned delay on'
			} else if (split[2].toLowerCase() == 'off') {
				await mongoDb().collection('settings').updateOne({ id: userstate['room-id'], name: 'Delayed Channel' }, { $set: { delayed: false } }, { upsert: true })
				return 'Turned delay off'
			} else if (split[2].toLowerCase() == 'set' && split.length == 4) {
				let tempNumber = Number(split[3])
				if (!isNaN(tempNumber) && tempNumber > 0 && tempNumber <= 600 && tempNumber % 30 == 0) {
					await mongoDb().collection('settings').updateOne({ id: userstate['room-id'], name: 'Delayed Channel' }, { $set: { delay: tempNumber } }, { upsert: true })
					return 'Set delay to ' + tempNumber
				} else {
					return Promise.reject(new CustomError('Please provide a number between 30 and 600 that\'s divisible by 30'))
				}
			}
		} else if (split[1].toLowerCase() == 'cd' && split.length == 2) {
			return 'Minimum cooldown on command is: ' + (channels && channels.cooldown ? channels.cooldown : 30)
		} else if (split[1].toLowerCase() == 'cd' && split.length > 2) {
			if (split[2].toLowerCase() == 'set' && split.length == 4) {
				let tempNumber = Number(split[3])
				if (!isNaN(tempNumber) && tempNumber >= 30 && tempNumber <= 300) {
					if (tempNumber == 30) {
						mongoDb().collection('channels').updateOne({ id: userstate['room-id'] }, { $unset: { cooldown: '' } })
					} else {
						mongoDb().collection('channels').updateOne({ id: userstate['room-id'] }, { $set: { cooldown: tempNumber } })
					}
					return 'Changed minimum cooldown to ' + Math.max(30, tempNumber)
				} else {
					return Promise.reject(new CustomError('Please provide a number between 30 and 300'))
				}
			} else {
				return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot cd set <seconds>'))
			}
		} else if (split.length > 1 && split[1].toLowerCase() == 'toggleself') {
			let includeSelf = mongoDb().collection('settings').findOne({ id: userstate['room-id'], name: 'Include Self Channel' }, { projection: { _id: 0 } })
			if (await includeSelf) {
				mongoDb().collection('settings').deleteOne({ id: userstate['room-id'], name: 'Include Self Channel' })
				return 'Successfully toggled showing streamer as a notable player off'
			} else {
				mongoDb().collection('settings').insertOne({ id: userstate['room-id'], name: 'Include Self Channel' })
				return 'Successfully toggled showing streamer as a notable player on'
			}
		} else if (split[1].toLowerCase() == 'toggleemotes') {
			let emote = mongoDb().collection('settings').findOne({ id: userstate['room-id'], name: 'emotes Channel' })
			emote = await emote
			if (emote) {
				mongoDb().collection('settings').deleteOne({ id: userstate['room-id'], name: 'emotes Channel' })
				return 'Successfully toggled hero emotes off'
			} else {
				mongoDb().collection('settings').insertOne({ id: userstate['room-id'], name: 'emotes Channel' })
				return 'Successfully toggled hero emotes on'
			}
		} else if (split.length > 2 && split[1].toLowerCase() == 'id') {
			let tempHero = split.slice(2).join(' ')
			let game = await util.findGameFromChannel(userstate['room-id'])
			let heroes = mongoDb().collection('heroes').find({ id: { $in: game.players.map(player => player.hero_id.toString()) } }).toArray()
			heroes = await heroes
			let hero = heroes.find(hero => hero.localized_name.toLowerCase() == tempHero.toLowerCase())
			if (!hero) {
				return Promise.reject('Hero wasn\'t found in the game')
			}
			let player = game.players.find(player => player.hero_id == hero.id)
			if (!player) {
				return Promise.reject('Hero wasn\'t found in the game')
			}
			return `${hero.localized_name}: ${player.account_id}`
		} else {
			if (userstate['room-id'] != userstate['user-id'] && !isGlobalMod) {
				return Promise.reject()
			}
			if (split.length > 2 && split[1].toLowerCase() == 'addmod') {
				if ((/^[a-zA-Z0-9][\w]{0,24}$/).test(split[2])) {
					return util.fetch('https://api.twitch.tv/kraken/users?login=' + split[2], { headers: util.twitchAPIHeaders }).then(res => res.json()).then(async json => {
						if (json.users && json.users.length && json.users.some(value => value.name.toLowerCase() == split[2].toLowerCase())) {
							if (mods.find(mod => mod == json.users.find(value => value.name.toLowerCase() == split[2].toLowerCase())._id)) {
								return Promise.reject(new CustomError('Mod already exists'))
							}
							else {
								await mongoDb().collection('channels').updateOne({ id: userstate['room-id'] }, { $addToSet: { mods: json.users.find(value => value.name.toLowerCase() == split[2].toLowerCase())._id }, $setOnInsert: { count: 0 } }, { upsert: true })
								return `Successfully added ${split[2]} to ${channel.substring(1)} 9kmmrbot mods`
							}
						} else {
							return Promise.reject(new CustomError('Not a user on twitch'))
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
			} else if (split.length > 2 && split[1].toLowerCase() == 'delmod') {
				if ((/^[a-zA-Z0-9][\w]{0,24}$/).test(split[2])) {
					return util.fetch('https://api.twitch.tv/kraken/users?login=' + split[2], { headers: util.twitchAPIHeaders }).then(res => res.json()).then(async json => {
						if (json.users && json.users.length && json.users.some(value => value.name.toLowerCase() == split[2].toLowerCase())) {
							if (mods.find(mod => mod == json.users.find(value => value.name.toLowerCase() == split[2].toLowerCase())._id)) {
								await mongoDb().collection('channels').updateOne({ id: userstate['room-id'] }, { $pull: { mods: json.users.find(value => value.name.toLowerCase() == split[2].toLowerCase())._id }, $setOnInsert: { count: 0 } }, { upsert: true })
								return `Successfully removed ${split[2]} to ${channel.substring(1)} 9kmmrbot mods`
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
							return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot addglobalnp id'))
						} else {
							id = id.toString()
							await mongoDb().collection('notable players').updateOne({ id, channel: '' }, { $set: { id, name: split.slice(3).join(' '), lastChanged: new Date(), lastChangedBy: userstate['user-id'], enabled: true } }, { upsert: true })
							return `${userstate.username} successfully added ${id} to global notable players`
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
							await mongoDb().collection('notable players').updateOne({ id, channel: '' }, { $set: { id, lastChanged: new Date(), lastChangedBy: userstate['user-id'], enabled: false } })
							return `${userstate.username} successfully removed ${id} from global notable players`
						}
					} else {
						return Promise.reject(new CustomError('Wrong syntax: !9kmmrbot delglobalnp id'))
					}
				} else if (split[1] == 'join' && split.length == 3) {
					if ((/^[a-zA-Z0-9][\w]{0,24}$/).test(split[2])) {
						return util.fetch('https://api.twitch.tv/kraken/users?login=' + split[2], { headers: util.twitchAPIHeaders }).then(res => res.json()).then(async json => {
							if (json.users && json.users.length && json.users.some(value => value.name.toLowerCase() == split[2].toLowerCase())) {
								await mongoDb().collection('channels').updateOne({ id: json.users.find(value => value.name.toLowerCase() == split[2].toLowerCase())._id }, { $set: { name: split[2].toLowerCase() }, $setOnInsert: { count: 0 } }, { upsert: true })
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
								await mongoDb().collection('channels').updateOne({ id: json.users.find(value => value.name.toLowerCase() == split[2].toLowerCase())._id }, { $unset: { name: '' } }, { upsert: true })
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
						let heroExists = await mongoDb().collection('heroes').findOne({ custom: false, localized_name: { $regex: hero, $options: 'i' } })
						if (heroExists) {
							await mongoDb().collection('heroes').updateOne({ custom: true, localized_name: localized_name.map(emote => emote.id).join(' ') }, { $set: { custom: true, localized_name: localized_name.map(emote => emote.id).join(' '), id: heroExists.id, emoteset: localized_name.map(emote => emote.emoteset).join(' ') } }, { upsert: true })
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
						let customHero = await mongoDb().collection('heroes').findOne({ custom: true, localized_name: { $regex: localized_name.join(' '), $options: 'i' } })
						if (customHero) {
							await mongoDb().collection('heroes').deleteOne(customHero)
							return `Emote ${emotes.join(' ')} removed from database`
						} else {
							return Promise.reject(new CustomError(`Emote ${emotes.join(' ')} not found in database`))
						}
					}
					else if (split[2] == 'list') {
						let heroes = await mongoDb().collection('heroes').find().toArray()
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
}

/* Adds Steam ID to the channel's list of linked accounts. */
async function addAccount(username, channel, steamId) {
	/* Check if there are already 10 accounts linked to this channel,
	 * or if the account has already been linked. */
	if (channel.accounts.length > 10) {
		return Promise.reject(new CustomError('Can\'t add more than 10 accounts for a stream'))
	}

	if (channel.accounts.some(account => account == steamId)) {
		return Promise.reject(new CustomError(`Account ${steamId} is already connected to ${channel.name}`))
	}

	// All good, link the account to the channel.
	await mongoDb().collection('channels').updateOne({ id: channel.id }, { $addToSet: { accounts: steamId } })
	return `${username} successfully added ${steamId} to ${channel.name} accounts`
}

/* Removes a Steam ID from the channel's list of linked accounts */
async function deleteAccount(username, channel, steamId) {
	// Check that the Steam account is linked to the channel before attempting to remove it.
	if (!channel.accounts.some(account => account == steamId)) {
		return Promise.reject(new CustomError(`Account ${steamId} is not linked to ${channel.name}`))
	}

	await mongoDb().collection('channels').updateOne({ id: channel.id }, { $pull: { accounts: steamId } })
	return `${username} successfully removed ${steamId} from ${channel.name} accounts`
}

module.exports = [new Command(command)]
