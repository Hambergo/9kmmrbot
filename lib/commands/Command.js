'use strict'
class Command {
	constructor(command) {
		if (command) {
			if (command.name)
				this._name = command.name
			if (Array.isArray(command.channels))
				this._channels = command.channels
			if (Array.isArray(command.aliases))
				this._aliases = command.aliases
			if (command.function && typeof (command.function) == 'function')
				this._function = command.function
		}
	}
	get name() {
		return this._name
	}
	get channels() {
		return this._channels
	}
	get aliases() {
		return this._aliases
	}
	get function() {
		return this._function
	}
}
module.exports = Command