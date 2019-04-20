'use strict'
const { db: mongoDb } = require('../mongo')
const Command = require('./Command')
const CustomError = require('../CustomError')
let command = {
	name: 'Account', channels: ['24811779', '62525740', '25199180', '26954716'], aliases: ['account'],
	function: async (channel, userstate) => {
		let accounts = mongoDb().collection('channels').findOne({ id: userstate['room-id'] }, { projection: { accounts: 1, _id: 0 } })
		accounts = (await accounts)
		if (!accounts || !accounts.accounts || !accounts.accounts.length) {
			return Promise.reject(new CustomError('No accounts connected to ' + channel.substring(1)))
		} else {
			accounts = accounts.accounts
		}
		let rps = mongoDb().collection('rps').aggregate([{ $group: { _id: '$createdAt', rps: { $addToSet: '$$ROOT' } } }, { $sort: { _id: -1 } }, { $limit: 1 }]).toArray()
		rps = await rps
		if (rps && rps.length) {
			rps = rps[0].rps
			const index = accounts.findIndex(account => rps && rps.find(rp => rp.account_id == account))
			if (index != -1) {
				return `Playing on account #${index + 1}. dotabuff: https://www.dotabuff.com/players/${accounts[index]}`
			}
		}
		return Promise.reject(new CustomError(channel.substring(1) + ' isn\'t playing on any account'))
	}
}
module.exports = [new Command(command)]
