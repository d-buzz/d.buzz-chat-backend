import { Utils } from '../utils'
declare var window: any;
declare var stuploader;

export interface UserStorage {
  getItem(name: string);
  setItem(name: string, value: any);
}
export class LocalUserStorage implements UserStorage {
  user: string

  constructor(user: string) {
    this.user = user;
  }
  async getItem(name: string): Promise<any> {
    try {
      if(window.localStorage) {
        var item = window.localStorage.getItem(this.user+'#'+name);
        if(item) return JSON.parse(item); 
      }
    }
    catch(e) { console.log(e); }
    return null;
  }
  async setItem(name: string, value: any = null) {
    try {
      if(window.localStorage) 
        window.localStorage.setItem(this.user+'#'+name, JSON.stringify(value));
    }
    catch(e) { console.log(e); }
  }
}
export class EncodedPublicStorage implements UserStorage {
  user: string
  storageKey: any
  storagePublicKey: string
  constructor(user: string, storageKey: any) {
    if(Utils.isGuest(user)) throw 'unsupported for guests';
    this.user = user;
    this.storageKey = (typeof storageKey === 'string')?
      Utils.dhive().PrivateKey.fromString(storageKey):storageKey;
    this.storagePublicKey = this.storageKey.createPublic('STM').toString();
  }
  async getTimestamp(name: string): Promise<number> {
    try {
      var result = await stuploader.Uploader.list(this.user, {name: '#'+name, mime: 'jsonlastread/octet-stream'});
      if(result != null && result.length > 0) 
        return result[0].created;
    }
    catch(e) {
      console.log(e);
    }
    return 0;
  }
  async getItem(name: string): Promise<any> {
    try {
      var result = await stuploader.Uploader.list(this.user, {name: '#'+name, mime: 'jsonlastread/octet-stream'});
      if(result != null && result.length > 0) {
        var id = result[0].id;    
        var buf = await stuploader.Uploader.downloadWithKey(this.user, id, Utils.utcTime(), this.storageKey);
        if(buf != null) {
          var text = new window.TextDecoder().decode(buf); 
          text = Utils.decodeTextWithKey(text, this.storageKey);
          return JSON.parse(text);
        }
      }
    }
    catch(e) {
      console.log(e);
    }
    return null;
  }
  async setItem(name: string, value: any = null) {
    if(!window.stuploader) return;
    var stuploader = window.stuploader;
    var text = JSON.stringify(value);
    text = Utils.encodeTextWithKey(text, this.storageKey, this.storagePublicKey);
    var upload = stuploader.Upload.create(this.user, '#'+name+':-1', 'jsonlastread/octet-stream');
    upload.shared = this.user;
    var bytes = new window.TextEncoder().encode(text);
    upload.setData(bytes);
    var signature = await upload.signWithKey(this.storageKey);
    if(signature == null) return;
    upload = await upload.upload();
  }
}
