'use strict'
const twitch = require('twitch-js')
const { db: mongoDb } = require('./mongo')
const async = require('async')
class Twitch extends twitch.client {
	constructor(username, password) {
		super({
			options: {
				debug: false
			},
			connection: {
				reconnect: true
			},
			identity: {
				username: username,
				password: password
			}
		})
		this.connect()
		let queue = async.queue((task, callback) => {
			this.join(task).then(() => callback()).catch(() => callback())
		}, 2)
		this.joinQueue = (channels) => {
			queue.push(channels)
		}
		const removeCooldown = (channel, command) => {
			clearTimeout(this._commandsCooldown[channel][command])
			delete this._commandsCooldown[channel][command]
		}
		const isCommandOffCooldown = async (channel, username, command) => {
			command = command.toLowerCase()
			if (!this._commandsCooldown[channel]) {
				this._commandsCooldown[channel] = {}
			}
			let cd = await getCD(channel, command)
			let isGlobalMod = await mongoDb().collection('settings').countDocuments({ name: 'Global Mod', id: username })
			if (isGlobalMod) {
				if (this._commandsCooldown[channel][command]) {
					removeCooldown(channel, command)
				}
				this._commandsCooldown[channel][command] = setTimeout(removeCooldown, cd, channel, command)
				return true
			}
			if (this._commandsCooldown[channel][command]) {
				return false
			}
			this._commandsCooldown[channel][command] = setTimeout(removeCooldown, cd, channel, command)
			return true
		}
		const getCD = async (channel, command) => {
			let chan = mongoDb().collection('channels').findOne({ id: channel })
			let cd = 30000
			switch (command) {
				case 'Moderation':
					cd = 2000
					break
				case 'Join Channel':
				case 'Part Channel':
					cd = 10000
					break
				case 'Recent Games':
				case 'Shared Games':
				case 'Score':
					cd = 60000
					break
			}
			let customCooldown = await chan
			if (customCooldown && customCooldown.cooldown && command != 'Moderation' && customCooldown.cooldown * 1000 > cd) {
				cd = customCooldown.cooldown * 1000
			}
			return cd
		}
		this._commandPrefix = '!'
		this._commands = []
		this._commandsCooldown = {}
		this.on('chat', async (channel, userstate, message, self) => {
			if (self || !message.startsWith(this._commandPrefix)) {
				return
			}
			let split = message.split(' ')
			if (!split.length)
				return
			let command = this._commands.find(command => {
				if (Array.isArray(command.channels) && command.channels.length && !command.channels.includes(userstate['room-id']))
					return false
				if (!command.aliases || !command.aliases.includes(split[0].substring(1).toLowerCase()))
					return false
				if (!command.name)
					return false
				if (!command.function)
					return false
				return true
			})
			if (command) {
				if (await isCommandOffCooldown(userstate['room-id'], userstate['user-id'], command.name))
					this.emit('command', command.name, userstate['room-id'], channel, command.function(channel, userstate, message))
			}
			else {
				if (userstate['room-id'] == '48686270') {
					let waga = mongoDb().collection('settings').findOne({ id: userstate['room-id'], name: 'Waga Commands' })
					let wagaCommand = mongoDb().collection('slembot').findOne({ name: split[0].substring(1).toLowerCase() })
					waga = await waga
					wagaCommand = await wagaCommand
					if (waga && waga.on && wagaCommand && (wagaCommand.isPublic || userstate.mod || userstate['room-id'] == userstate['user-id'])) {
						this.emit('command', 'Slembot Custom Commands', userstate['room-id'], channel, Promise.resolve('» ' + wagaCommand.message))
					}
				}
			}
		})
		this.AddCommand = commands => {
			for (let command of commands)
				if (command && command.aliases && command.name && command.function)
					this._commands.push(command)
		}
	}
}
module.exports = Twitch