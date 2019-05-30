'use strict'

/* This module contains functions that wrap common Twitch API requests.
 *
 * When adding to this file, prefer the Helix endpoints rather than the
 * deperecated Kraken endpoints. 
 *
 * API reference: https://dev.twitch.tv/docs/api/
 */

const fetch = require('node-fetch')
const querystring = require('querystring')

const helixBaseURI = 'https://api.twitch.tv/helix'

/* All Twitch API requests require this header */
const twitchAPIHeaders = { 'Authorization': 'Bearer ' + 'rk23w7wa5uh1apv0vlq942o67f53ua' }//process.env.TWITCH_AUTH }

const GetAPI = async (endpoint, parameters) => {
	return (await fetch(`${helixBaseURI}/${endpoint}?${querystring.stringify(parameters)}`, { headers: twitchAPIHeaders })).json()
}

const GetUsers = async parameters => {
	return await GetAPI('users', parameters)
}

const GetStreams = async parameters => {
	return await GetAPI('streams', parameters)
}

const GetVidoes = async parameters => {
	return await GetAPI('videos', parameters)
}

const GetUserInfoByLogin = async login => {
	let user = await GetUsers({ login })
	return user.data[0]
}

/* Returns information about the bot's channel */
const GetChannelInfo = async () => {
	let user = await GetUsers()
	return user.data[0]
}

/* Returns information about the live stream of user_id, returns undefined if the user isn't live */
const GetStreamInfo = async user_id => {
	let stream = await GetStreams({ user_id })
	return stream.data[0]
}

/* Returns information about the 20 latest archived vods of user_id */
const GetVodsInfo = async user_id => {
	let videos = await GetVidoes({ user_id, type: 'archive' })
	return videos.data
}

module.exports = {
	GetChannelInfo,
	GetStreamInfo,
	GetVodsInfo,
	GetUserInfoByLogin
}
