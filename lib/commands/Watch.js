'use strict'
const Command = require('./Command')
const util = require('../util')
let command = {
	name: 'Watch', channels: ['62525740'], aliases: ['watch'],
	function: (_channel, userstate) => {
		return util.findGameFromChannel(userstate['room-id']).then(game => `watch_server ${game.server_steam_id}`)
	}
}
module.exports = [new Command(command)]