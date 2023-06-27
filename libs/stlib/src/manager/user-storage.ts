import { Utils } from '../utils'
declare var window: any;

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
  async getItem(name: string): Promise<any> {
    try {
      //var text = "..."; //load
      //text = Utils.decodeTextWithKey(text, this.storageKey);
      //return text;
      /*var result = await stuploader.Uploader.list(this.user, {name: '#', mime: 'json-preferences/octet-stream'});
      if(result.success) {
        if(result.result.length > 0) {
            var id = result.result[0].id;
            stuploader.Uploader.downloadWithKeychain(this.user, , stlib.utcTime()).then(console.log)
        }
      }*/
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
    //store
    var upload = stuploader.Upload.create(this.user, name+':-1', 'json-preferences/octet-stream');
    var bytes = new TextEncoder().encode(text);
    upload.setData(bytes);
    var signature = await upload.signWithKey(this.storageKey);
    if(signature == null) return;
    upload = await upload.upload();
  }
}
