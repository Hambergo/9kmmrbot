'use strict'
const Command = require('./Command')
const { db: mongoDb } = require('../mongo')
let command = {
	name: 'Slembot Moderation', channels: ['48686270'], aliases: ['slembot'],
	function: async (_channel, userstate, message) => {
		if (userstate['user-id'] != userstate['room-id'] && userstate['user-type'] != 'mod') {
			return Promise.reject()
		}
		let waga = mongoDb().collection('settings').findOne({ id: userstate['room-id'], name: 'Waga Commands' })
		let split = message.split(' ')
		if (split.length > 2) {
			split[1] = split[1].toLowerCase()
			split[2] = split[2].toLowerCase()
			if (split[2].startsWith('!')) {
				split[2] = split[2].substring(1)
			}
			if (split[1] == 'add' || split[1] == 'update' || split[1] == 'edit') {
				await mongoDb().collection('slembot').updateOne({ name: split[2] }, { $set: { message: split.slice(3).join(' ') } }, { upsert: true })
				if ((await waga).on) {
					return `Successfully ${split[1] == 'add' ? 'added' : 'updated'} command: !${split[2]}`
				}
			} else if (split[1] == 'del' || split[1] == 'delete' || split[1] == 'remove') {
				await mongoDb().collection('slembot').deleteOne({ name: split[2] })
				if ((await waga).on) {
					return 'Successfully removed command: !' + split[2]
				}
			} else if (split[1] == 'toggle') {
				let command = await mongoDb().collection('slembot').findOne({ name: split[2] })
				if (command) {
					await mongoDb().collection('slembot').updateOne({ name: split[2] }, { $set: { isPublic: !command.isPublic } })
					if ((await waga).on) {
						return `${split[2]} is now ${(!command.isPublic ? 'Public' : 'Non-public')}`
					}
				}
			}
		} else if (split.length == 2) {
			if (split[1] == 'on') {
				await mongoDb().collection('settings').updateOne({ id: userstate['room-id'], name: 'Waga Commands' }, { $set: { on: true } }, { upsert: true })
				return 'Turned running slembot commands on'
			} else if (split[1] == 'off') {
				await mongoDb().collection('settings').updateOne({ id: userstate['room-id'], name: 'Waga Commands' }, { $set: { on: false } }, { upsert: true })
				return 'Turned running slembot commands off'
			}
		}
	}
}
module.exports = [new Command(command)]