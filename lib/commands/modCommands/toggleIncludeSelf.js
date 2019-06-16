const SETTING_INCLUDE_SELF = 'Include Self Channel'

// Toggles whether the streamer should appear in the list of notable players or not.
async function toggleIncludeSelf(db, channel) {
	const includeSelf = await db.collection('settings').findOne({ id: channel.id, name: SETTING_INCLUDE_SELF })

	if (includeSelf) {
		db.collection('settings').deleteOne({ id: channel.id, name: SETTING_INCLUDE_SELF })
		return 'Streamer will not appear in in the list of notable players.'
	} else {
		db.collection('settings').insertOne({ id: channel.id, name: SETTING_INCLUDE_SELF })
		return 'Streamer will appear in the list of notable players.'
	}
}

module.exports = { toggleIncludeSelf }
