const SETTING_SHOW_EMOTES = 'emotes Channel'

// Toggles whether the streamer should appear in the list of notable players or not.
async function toggleChannelEmotes(db, channel) {
	const emote = await db.collection('settings').findOne({ id: channel.id, name: SETTING_SHOW_EMOTES })

	if (emote) {
		db.collection('settings').deleteOne({ id: channel.id, name: SETTING_SHOW_EMOTES })
		return 'Responses will not use channel hero emotes.'
	} else {
		db.collection('settings').insertOne({ id: channel.id, name: SETTING_SHOW_EMOTES })
		return 'Responses will use channel hero emotes.'
	}
}

module.exports = { toggleChannelEmotes }
