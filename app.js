"use strict";
process.env.NODE_ENV = 'production';
const appdb = require('./appdb.js');

const WebSocket = require('ws');
const express = require('express');
const fs = require('fs');
const PORT = process.env.PORT || 3000;
var STATIC_ROOT = __dirname + '/client/';

var app = express();
app.disable('x-powered-by');
app.disable('query parser');


/*test file*/
app.get('/stlib.js', (req, res) => {
	res.set('Content-Type', 'text/html');
	res.send(fs.readFileSync(STATIC_ROOT + "stlib.js"));
});
app.get('/dhive.js', (req, res) => {
	res.set('Content-Type', 'text/html');
	res.send(fs.readFileSync(STATIC_ROOT + "dhive.js"));
});
app.get('/', function (req, res) {
	res.set('Content-Type', 'text/html');
  	res.send(fs.readFileSync(STATIC_ROOT + "test.html"));
});

function isChanAlive() {
	this.isAlive = true;
}
class Global {
	constructor() {
		this.nodeChans = [];
		this.clientChans = [];
	}
	addNode(url) {
		try {
			var chan = new WebSocket(url);
			chan.on('pong', isChanAlive);
			chan.onopen = ()=>{
				console.log("connected to node " + url);
			};
			chan.on("message", data => {
				this.handleMessage(chan, data);
			});
			var t = this;
			chan.on('close', function() {
		 	 	console.log('disconnected node');
				t.removeChan(chan);
			});
			this.nodeChans.push(chan);
		}
		catch(e) {
			console.log(e);
		}
	}
	handleMessage(chan, data) {
		try {
			console.log("chan message " + data);
			var r = JSON.parse(data);
			var rC =  r[0];
			var json = r[1];
			var msgType = json[0];
			
			var fn = appdb.methods[msgType];
			if(fn !== undefined) {
				fn(json).then((result)=>{
					if(rC >= 0) {
						chan.send(JSON.stringify([rC, result]));
					}	
					if(msgType === "w") {
						this.sendAllExcept(JSON.stringify([-1, json]), chan); 
					}
				}).catch((e)=>{
					console.log(e);
				});
			}
			else console.log("unknown message " + msgType);
		}
		catch(e) {
			console.log(e);
		}
	}
	addChan(chan) {
		//chan.send('hello chan');
		console.log("New Chan");
		chan.isAlive = true;
  		chan.on('pong', isChanAlive);
		chan.accountData = null;
			
		chan.on("message", data => {
			this.handleMessage(chan, data);
		});
		var t = this;
		chan.on('close', function() {
	 	 	console.log('disconnected');
			t.removeChan(chan);
		});
		this.clientChans.push(chan);
	}
	sendAllExcept(msg, chan) {
		var i = 0;
        for(var a of this.nodeChans) 
        	if(a != chan) {
        		a.send(msg); i++;
        	}
        for(var a of this.clientChans) 
        	if(a != chan) { 
        		a.send(msg); i++;
        	}
        console.log("broadcast " + msg  + " x " + i);
	}
	removeChan(chan) {
		var num = this.clientChans.length+this.nodeChans.length;
		var i = this.clientChans.indexOf(chan);
		if(i !== -1) this.clientChans.splice(i, 1);
		i = this.nodeChans.indexOf(chan);
		if(i !== -1) this.nodeChans.splice(i, 1);
		if(num-1 != this.clientChans.length+this.nodeChans.length) {
			console.log("Error removing chan " + (num-1) + " != " + this.clientChans.length+this.nodeChans.length);
		}
	}
}

const gl = new Global();
const server = app.listen(PORT, () => console.log(`Listening on ${PORT}`));
const wss = new WebSocket.Server({ noServer:true });

server.on("upgrade", (request, socket, head) => {
	if(request.url === "/api") {
		wss.handleUpgrade(request, socket, head, ws0 => {
		   wss.emit("connection", ws0, request);
		});
	}
	else { socket.destroy(); }
});

const interval = setInterval(function() {
  wss.clients.forEach(function each(ws) {
    if(ws.isAlive === false) {
    	console.log("timeout ");
    	return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', function close() {
  clearInterval(interval);
});

wss.on("connection", ws => { gl.addChan(ws); });

/*function exitHandler(options, exitCode) {
	//gl.exit();
	db.close();
}
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
*/
console.log("Node started.");
try {
	const args = process.argv.slice(2);
	for(var i = 0; i < args.length; i++) {
		var url = args[i];
		gl.addNode(url);
	}
}
catch(e) { console.log(e); }







