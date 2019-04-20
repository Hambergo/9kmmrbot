'use strict'
const mongo = require('mongodb').MongoClient
let db
module.exports.connect = () => mongo.connect(process.env.MONGODB_URL, { reconnectTries: 10000, useNewUrlParser: true, bufferMaxEntries: 0 }).then(mongoClient => db = mongoClient.db())
module.exports.db = () => db