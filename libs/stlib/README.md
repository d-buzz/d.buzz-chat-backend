# stlib

Welcome, this document will guide you to quickly get used to library functionality.

## Webbrowser usage

Setup:
```js
<script src="/socket.io/socket.io.js"></script>
<script src="/dhive.js"></script>
<script src="/stlib.js"></script>
```

```js
const socket = io(location.origin.replace(/^http/, 'ws'), {transports:["websocket", "polling"]});
var client = new stlib.Client(socket);
client.onmessage = function(json) {
	//can unwrap it
    var msg = stlib.SignableMessage.fromJSON(json);
    //verify
    msg.verify().then((booleanResult)=>{
        ...
    });
};
```

## Reading messages:
```js
client.read("hive-1111111/0",0,stlib.utcTime(),(arrayOfMessages)=>{
	for(var msgJSON of arrayOfMessages) {
        var msg = stlib.SignableMessage.fromJSON(msgJSON);
        ...
    }
});
```

## Listen to incoming messages:
```js
client.join("hive-1111111/0"); //listen to community 
client.join("username"); //private/group messages
```

## Stop listening to incoming messages:
```js
client.leave("hive-1111111/0"); //listen to community 
client.leave("username"); //private/group messages
```
## Creating content messages:

```js
var textMsg = stlib.Content.text("hello");
var threadMsg = stlib.Content.thread("hello", "threadName");
```

Some content messages require a SignableMessage as a reference:
```js
var referenceMessage: SignableMessage = ...
var emoteMsg = stlib.Content.emote(":sunny:", signableMessage);
var quoteMsg = stlib.Content.quote("hello", signableMessage);
```

Quotes can address specific parts of text, by adding from, to indices:
```js
var quoteMsg = stlib.Content.quote("hello", signableMessage, 10, 20);
```

Content can be turned into a SignableMessage:
```js
var communityMessage = quoteMsg.forUser("user1", "hive-1111111/0");
var directMessage = quoteMsg.forUser("user1", ["user1", "user2"] );
var groupMessage = quoteMsg.forUser("user1", ["user1", "user2", "user3"] );
```

Creating, signing and broadcasting a new text message:
```js
var textMsg = stlib.Content.text("hello");
var msg = textMsg.forUser("username", "hive-1111111/0");
msg.signWithKeychain('Posting').then((x)=>{
	if(x !== null) {
        client.write(msg, (booleanResult)=>{
            ...
        });
    }
});
```

## Community settings

Community can be loaded with:

```js
var community = await stlib.Community.load("hive-1111111");
```

The property `communityData` contains objects retrieved from hive API. Community class encapsulates this with following methods:

```js
community.getTitle(); //user readable title of community
community.getAbout(); //about section
community.getDescription(); //description section
community.getRules(); //flag_text section
```

## Community Data Streams

The `community.getStreams();` function returns an ordered array of data streams: info sections, text channels, category names that are present in this community. 

```js
var streams = community.getStreams();
var stream = streams[0];
```

Each stream has a user-set displayable name, dataPath component, and read and write permission sets.
```js
stream.getName(); //eg 'Text', 'General', 'About'
stream.getPath(); //DataPath object
stream.getReadPermissions(); //PermissionSet object
stream.getWriteermissions(); //PermissionSet object
```

## Category

Category has a name and null data path. Possible read permission could be set to show this category for subset of users.
```js
stream.getName(); //eg. 'Info'
stream.hasPath(); //false
stream.getPath(); //null for category
stream.getPathType(); //null for category
stream.getReadPermissions();
```

## Text

Text message stream has name, datapath, read and write permission sets.
```js
stream.getName(); //eg. 'General'
stream.hasPath(); //true
stream.getPath(); //DataPath object
stream.getPathType(); //DataPath.TYPE_TEXT 
stream.getReadPermissions();
stream.getWritePermissions();

stream.getPath().getUser(); //eg. 'hive-1111111'
stream.getPath().getPath(); //eg. '0'
stream.getPath().toString(); //eg. 'hive-1111111/0'
```

## Info

Information stream had name, datapath and read permission set. Information streams can point to various information sources, such as about section of community, community rules, team member, permalinked posts and so on.
```js
stream.getName(); //eg. 'About'
stream.hasPath(); //true
stream.getPath().getUser(); //eg. 'hive-1111111'
stream.getPath().getPath(); //eg. 'about'
stream.getPath().toString(); //eg. 'hive-1111111/about'
```

## Editing Streams

You can edit the array returned from `community.getStreams()` or use:
```js
community.setStreams(streams: DataStream[]); 
community.addStream(streams: DataStream); 
```

## Saving Stream Changes

Work in progress. The following method creates a customJSON that is to be broadcasted to hive.

```js
var customJSON = community.updateStreamsCustomJSON();
```

Currently communities returns the following data as default. Since stream data is stored inside hive community settings object, if a front-end implementation does not support particular stream type, it can skip it, or show its name and state it is unsupported.

```js
[
 { community: "hive-1111111", name: "About", dataPath: "/about", … }
​ { community: "hive-1111111", name: "Posts", dataPath: "/created", … }
​ { community: "hive-1111111", name: "Text", dataPath: null, … }
 { community: "hive-1111111", name: "General", dataPath: "/0", … }
]
```



