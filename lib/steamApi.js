'use strict'

const fetch = require('node-fetch')
const querystring = require('querystring')
const CustomError = require('./CustomError')

const baseURI = 'http://api.steampowered.com'

const GetAPI = async (endpoint, parameters) => {
	parameters.key = process.env.STEAM_WEBAPI_KEY
	return await (await fetch(`${baseURI}/${endpoint}?${querystring.stringify(parameters)}`)).json()
}
const GetMatchDetails = async parameters => {
	try {
		let json = await GetAPI('IDOTA2Match_570/GetMatchDetails/v1', parameters)
		if (json.result && json.result.game_mode) {
			return {
				game_mode: json.result.game_mode,
				players: json.result.players.map(player => ({ account_id: player.account_id, hero_id: player.hero_id })),
				radiant_win: json.result.radiant_win,
				match_id: json.result.match_id.toString(),
				createdAt: new Date(),
				lobby_type: json.result.lobby_type
			}
		}
	}
	catch (exception) { }
	return Promise.reject(new CustomError('Game details wasn\'t found'))
}
const GetRealTimeStats = async parameters => {
	try {
		let json = await (await GetAPI('IDOTA2MatchStats_570/GetRealtimeStats/v1', parameters)).json()
		if (json.match && json.match.game_mode) {
			json.players = []
			json.teams.forEach(team => {
				if (team.players) {
					team.players.forEach(player => {
						json.players.push({
							'account_id': player.accountid,
							'hero_id': player.heroid,
							'team_id': player.team
						})
					})
				}
			})
			return {
				game_mode: json.match.game_mode,
				players: json.players,
				server_steam_id: server_steam_id.toString(),
				createdAt: new Date(),
				league_id: json.match.league_id
			}
		}
	} catch (exception) { }
	return Promise.reject(new CustomError('Game wasn\'t found'))
}
module.exports = {
	GetMatchDetails,
	GetRealTimeStats
}