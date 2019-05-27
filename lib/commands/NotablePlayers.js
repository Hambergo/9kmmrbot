'use strict'
const { db: mongoDb } = require('../mongo')
const Command = require('./Command')
const util = require('../util')
let command = {
	name: 'Notable Players', aliases: ['np', 'notableplayers', 'notable'],
	function: (_channel, userstate) => {
		return util.findGameFromChannel(userstate['room-id']).then(game => returnNotablePlayersText(game, userstate['room-id'], false))
	}
}
let command2 = {
	name: 'Debug Notable Players', aliases: ['npdebug'],
	function: async (_channel, userstate) => {
		let channels = mongoDb().collection('channels').findOne({ id: userstate['room-id'] }, { projection: { _id: 0 } })
		let isGlobalMod = await mongoDb().collection('settings').countDocuments({ name: 'Global Mod', id: userstate['user-id'] })
		channels = await channels
		let mods = (channels ? (channels.mods ? channels.mods : []) : [])
		if (userstate['room-id'] != userstate['user-id'] && (!mods || !mods.some(mod => mod == userstate['user-id'])) && !isGlobalMod) {
			return Promise.reject()
		}
		return util.findGameFromChannel(userstate['room-id']).then(game => returnNotablePlayersText(game, userstate['room-id'], true))
	}
}
const returnNotablePlayersText = async (game, roomid, debug = false) => {
	let accounts = mongoDb().collection('channels').findOne({ id: roomid }, { projection: { accounts: 1, _id: 0 } })
	let notablePlayers = mongoDb().collection('notable players').find({ channel: { $in: ['', roomid.toString()] }, id: { $in: game.players.map(player => player.account_id.toString()) }, enabled: true }).sort({ id: 1, channel: -1 }).toArray()
	let heroes = mongoDb().collection('heroes').find({ id: { $in: game.players.map(player => player.hero_id.toString()) } }).sort({ custom: 1, id: 1 }).toArray()
	let settings = mongoDb().collection('settings').find({ id: roomid }).toArray()
	let gameMode = mongoDb().collection('game modes').findOne({ id: game.game_mode.toString() })
	accounts = (await accounts)
	if (!accounts) {
		accounts = []
	} else {
		accounts = accounts.accounts
	}
	notablePlayers = (await notablePlayers)
	heroes = await heroes
	settings = await settings
	gameMode = await gameMode
	let includeSelf = settings.some(setting => setting.name == 'Include Self Channel')
	let emoteChannel = settings.some(setting => setting.name == 'emotes Channel')
	let txt = ''
	txt = gameMode ? gameMode.name : 'Unknown'
	if (game.weekend_tourney_skill_level) {
		txt = `Battle Cup T${game.weekend_tourney_skill_level} ${['', 'Finals', 'Semi Finals', 'Quarter Finals'][game.weekend_tourney_bracket_round]}`
	}
	if (game.average_mmr) {
		txt += ` [${game.average_mmr} avg MMR]`
	}
	if (gameMode.name == 'Custom Game') {
		let rps = mongoDb().collection('rps').aggregate([{ $match: { createdAt: { $gte: new Date(new Date() - 900000) } } }, { $group: { _id: '$createdAt', rps: { $addToSet: '$$ROOT' } } }, { $sort: { _id: -1 } }, { $limit: 1 }]).toArray()
		rps = await rps
		if (rps && rps.length) {
			rps = rps[0].rps
			let rp = rps.find(rp => accounts.some(account => rp.account_id == account) && rp.status == '#DOTA_RP_GAME_IN_PROGRESS_CUSTOM' && rp.param0)
			if (rp) {
				txt = rp.param0
			}
		}
	}
	txt += ': '
	let arr = []
	if (game.players) {
		game.players.filter(player => includeSelf || !accounts || !accounts.includes(player.account_id)).forEach(player => {
			let np = notablePlayers.find(p => p.id == player.account_id)
			if (np && np.name || debug) {
				let name = (np && np.name ? np.name : '')
				let heroname = util.getHeroName(game, game.players.findIndex(p => p.account_id == player.account_id), heroes, emoteChannel)
				arr.push(`${name}(${debug ? player.account_id + ', ' : ''}${heroname})`)
			}
		})
	}
	if (arr.length) {
		txt += arr.join(', ')
	} else {
		txt += 'No other notable player found'
	}
	return txt
}
module.exports = [new Command(command), new Command(command2)]