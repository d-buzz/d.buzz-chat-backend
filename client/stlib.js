"use strict";
/*["w", "idofchannel", "username", timestamp, "json", "keyType", "signature"]*/

class WebChan {
	constructor(ws) {
		if(typeof ws === "string") ws = new WebSocket(ws);
		this.ws = ws;
		this.ws.onmessage = this._onmessage.bind(this);
		this.eC = 0; //errorCounter
		this.rC = 0; //requestCounter
		this.timeout = 60000;
		this.requests = {};
		this.onmessage = null;
	}
	_onmessage(msg) {
		var data = msg.data;
		console.log("received " + data + " " + this.rC + " ");
		var r = JSON.parse(data);
		if(r[0] === -1) {
			if(this.onmessage != null) this.onmessage(r[1]);
		}
		else {
			var cb = this.requests[r[0]];
			if(cb !== undefined) {
				delete this.requests[r[0]];
				clearTimeout(cb[1]);
				cb[0](r[1]);
			}
		}
	}
	send(msg,callback=null,rC=-1) {
		var chan = this.ws;
		if(chan == null || chan.readyState != 1 || chan.bufferedAmount >= 4096) return false;
		if(rC === -1) rC = this.rC++;
		var r = [rC,msg];
		console.log("chanSend " + msg + " " + callback + " " + r);
		try {
			chan.send(JSON.stringify(r));
			if(callback != null) {
				this.requests[r[0]] = [callback];
				if(this.timeout > 0) { 
					var t = setTimeout(()=>{
						var cb = this.requests[r[0]];
						if(cb === undefined) return;		
						if(cb[0] === callback) callback(null);
						else console.log("stlib: warning removing callback");
						delete this.requests[r[0]];
					}, this.timeout);
					this.requests[r[0]].push(t);
				}
			}
			return true;
		}
		catch(e) {
			console.log(e);
			this.eC++;
		}	
		return false;
	}
}
var stlib = {
	nodeURL: null,
	cl: null,
	chan: null,
	onmessage: null,
	open: function() {
		var chan = stlib.chan;
		if(chan == null || chan.ws.readyState > 2) {
			chan = new WebChan(stlib.nodeURL);
			chan.ws.pingTimeout = null;
			stlib.chan = chan;
			chan.onmessage = function(a) {
				if(stlib.onmessage !== null) stlib.onmessage(a);
			};
			chan.ws.onopen = function() {
				if(chan.ws.pingTimeout === null) chan.ws.pingTimeout = setTimeout(() => {
					chan.ws.terminate();
				}, 30000 + 10000);
			};
			chan.ws.onping = function() {
				clearTimeout(chan.ws.pingTimeout);
				chan.ws.pingTimeout = setTimeout(() => {
					chan.ws.terminate();
				}, 30000 + 10000);
			};
			chan.ws.onclose = function() {
				clearTimeout(chan.ws.pingTimeout);
			};
		}
	},
	read: function(location, from, to, callback) {
		stlib.write(["r", location, from, to], callback);
	},
	write: function(signedMessage, callback=null) {
		if(signedMessage == null) return;
		//["w","idofchannel","username","json",timestamp,"keyType","signature"]
		stlib.open();
		var chan = stlib.chan;
		if(stlib.chan.ws.readyState === 0) { 
			stlib.chan.ws.onopen = function() {
				chan.send(signedMessage, callback);
				if(chan.ws.pingTimeout === null) chan.ws.pingTimeout = setTimeout(() => {
					console.log("ping timeout close");
					chan.ws.terminate();
				}, 30000 + 10000);
			};
		}
		else stlib.chan.send(signedMessage, callback);
	},
	getClient() {
		if(stlib.cl == null) stlib.cl = new dhive.Client(["https://api.hive.blog", "https://api.hivekings.com", "https://anyx.io", "https://api.openhive.network"]);
		return stlib.cl;
	},
	hexToBytes: function(hex) {
		for (var bytes = [], c = 0; c < hex.length; c += 2)
		    bytes.push(parseInt(hex.substr(c, 2), 16));
		return bytes;
	},
	signatureFromHex: function(s) {
		//var r = parseInt(s.substring(0,2), 16)-31;
		//return new dhive.Signature(stlib.hexToBytes(s.substring(2)), r); 
		return dhive.Signature.fromString(s); 
	},
	utcTime: function() {
		//TODO can retrieve time from eg. getDynamicGlobalProperties
		return new Date().getTime();
	},
	accountData: async function(usernames) {
		var a = await stlib.getClient().database.getAccounts(usernames);
		var obj = {};
		for(var i = 0; i < a.length; i++) {
			obj[a[i].name] = a[i];
		}
		return obj;
	},
	newSignableMessage: function(user,where,json) {
		return ["w", user, where, JSON.stringify(json), stlib.utcTime()];
	},
	signWithKeychain: function(msg, keyType, fn) {
		if(msg.length != 5) throw 'Message has invalid format.';
		var str = JSON.stringify(msg);
		hive_keychain.requestSignBuffer(msg[1], str, keyType, (x)=>{
			if(x.success) {
				var a = JSON.parse(str);
				a.push(keyType.toLowerCase().charAt(0));
				a.push(x.result);
				fn(a, null);
			}
			else fn(null, x);
		});
	},
	verifyWithAccountData: function(m, data) {
		if(m.length != 7) return false;
		var keyType = m[5];
		var keys = null;
		switch(keyType) {
			case "p":
				keys = data.posting.key_auths;
				break;
			case "m":
				keys = [[data.memo_key]];
				break;
		}
		if(keys != null) {
			var hash = dhive.cryptoUtils.sha256(JSON.stringify([m[0],m[1],m[2],m[3],m[4]]));
			var s = stlib.signatureFromHex(m[6]);
			for(var i = 0; i < keys.length; i++) {
				var key = dhive.PublicKey.fromString(keys[i][0]);
				if(key.verify(hash, s)) {
					return true;
				}
			}
		}
		return false;
	},
	verify: async function(m) {
		if(m.length != 7) return false;
		var x = await stlib.accountData([m[1]]);
		
		var keyType = m[5];
		var data = x[m[1]];
		var keys = null;
		switch(keyType) {
			case "p":
				keys = data.posting.key_auths;
				break;
			case "m":
				keys = [[data.memo_key]];
				break;
		}
		if(keys != null) {
			var hash = dhive.cryptoUtils.sha256(JSON.stringify([m[0],m[1],m[2],m[3],m[4]]));
			var s = stlib.signatureFromHex(m[6]);
			for(var i = 0; i < keys.length; i++) {
				var key = dhive.PublicKey.fromString(keys[i][0]);
				if(key.verify(hash, s)) {
					return true;
				}
			}
		}
		return false;
	}
};

if (typeof module !== 'undefined') {
	module.exports.stlib = stlib;
}


