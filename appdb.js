"use strict";
/* maximum difference of timestamp with current time to accept a message*/
/* to make testing easier, it set to a high value*/
const MAX_TIME_DIFFERENCE = 30000000000;//300000; //5 minutes

const dhive = require("@hiveio/dhive");
global.dhive = dhive;
const stlibjs = require('./client/stlib.js');
const stlib = stlibjs.stlib;

const Database = require('better-sqlite3');
const db = new Database(":memory:", { verbose: console.log }); //options.readonly options.fileMustExist options.timeout options.verbose

//["w", "username", "idofchannel", "json", timestamp,  "keyType", "signature"]
db.exec(`create TABLE IF NOT EXISTS msg (
location varchar(64) not null, 
timestamp bigint not null, 
username varchar(32) not null, 
json varchar(2048) not null, 

keytype varchar(10) not null,
signature varchar(130) not null,
PRIMARY KEY(username, location, json, timestamp)
);`);
db.exec(`CREATE INDEX index1 ON msg (timestamp);`);
db.exec(`CREATE INDEX index2 ON msg (location,timestamp);`);

const DB_SELECT_BY_TIMESTAMP = db.prepare("SELECT * FROM msg WHERE timestamp BETWEEN ? and ? ORDER BY timestamp DESC LIMIT MIN(?,1000)");
const DB_SELECT_BY_LOCATION_TIMESTAMP = db.prepare("SELECT * FROM msg WHERE location = ? AND timestamp BETWEEN ? and ? ORDER BY timestamp DESC LIMIT MIN(?,1000)");
const DB_NEW_MSG = db.prepare("INSERT OR IGNORE INTO msg (username, location, json, timestamp, keytype, signature) VALUES (?, ?, ?, ?, ?, ?)");




/*["r", "idofchannel", fromTimeStamp, toTimeStamp, <limit>]  optional limit*/
async function readData(d) {
	var limit = 1000;
	if(d.length > 4) limit = Math.min(1000, Math.max(0,d[4]));
	var arr;
	if(d[1] === null) arr = DB_SELECT_BY_TIMESTAMP.all(d[2], d[3], limit);
	else arr = DB_SELECT_BY_LOCATION_TIMESTAMP.all(d[1], d[2], d[3], limit);
	for(var i = 0; i < arr.length; i++) {
		var a = arr[i];
		arr[i] = ["w", a.username, a.location, a.json, a.timestamp, a.keytype, a.signature];
	}
	return arr;
}
/*["h", "idofchannel", fromTimeStamp, toTimeStamp, <limit>]*/
async function hashData(d) {
	//TODO: create SQL table for hashes so that they are computed
	//just once
	var hash = dhive.cryptoUtils.sha256(JSON.stringify(readData(d)));
	return [arr.length, new dhive.HexBuffer(hash).toString("base64")];
}
/*
write    who          where       what     when      ["p"|"m"]      
["w", "username", "idofchannel", "json", timestamp,  "keyType", "signature"]
*/
async function writeData(d) {
	//var who=d[1], where=d[2], what=d[3], when=d[4];
	//var keyType = d[5], signature = d[6];
	var when=d[4];
	var ti = stlib.utcTime();
	if(Math.abs(when-ti) > MAX_TIME_DIFFERENCE) { //5mins
		return 'timestamp too different from now';
	}
	
	var accountData = await stlib.accountData([d[1]]);
	var data = accountData[d[1]];
	if(accountData === undefined || data === undefined) {
		return 'account not retrieved ' + d[1];
	}
	
	if(stlib.verifyWithAccountData(d, data)){
		console.log("valid message received");
		var info = DB_NEW_MSG.run(d[1],d[2],d[3],d[4],d[5],d[6]);
		console.log(info);
		if(info.changes === 1) return true;
		else {
			return 'failed to add message to DB.';
		}
	}
	return 'unreachable';
}
const methods = {
	"r": readData,
	"h": hashData,
	"w": writeData
};

if (typeof module !== 'undefined') {
	module.exports.methods = methods;
}










