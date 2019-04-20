'use strict'
class CustomError extends Error {
	constructor(...args) {
		super(...args)
		Error.captureStackTrace(this, CustomError)
	}
}
module.exports = CustomError