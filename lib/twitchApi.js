'use strict'

/* This module contains functions that wrap common Twitch API requests.
 *
 * When adding to this file, prefer the Helix endpoints rather than the
 * deperecated Kraken endpoints. 
 *
 * API reference: https://dev.twitch.tv/docs/api/
 */

const fetch = require('node-fetch')

const helixBaseURI = 'https://api.twitch.tv/helix'

/* All Twitch API v5 requests require this header */
const twitchAPIHeaders = { 'Authorization': 'Bearer ' + process.env.TWITCH_AUTH }

/* Returns information about the bot's channel */
async function GetChannelInfo() {
	let channel_info = await fetch(`${helixBaseURI}/users`, { headers: twitchAPIHeaders })
	channel_info = JSON.parse(await channel_info.text())

	return channel_info.data[0]
}

module.exports = {
	GetChannelInfo,
}
