declare var window: any;

export interface UserStorage {
  getItem(name: string)
  setItem(name: string, value: any);
}
export class LocalUserStorage implements UserStorage {
  user: string

  constructor(user: string) {
    this.user = user;
  }
  getItem(name: string): any {
    try {
      if(window.localStorage) {
        var item = window.localStorage.getItem(this.user+'#'+name);
        if(item) return JSON.parse(item); 
      }
    }
    catch(e) { console.log(e); }
    return null;
  }
  setItem(name: string, value: any = null) {
    try {
      if(window.localStorage) 
        window.localStorage.setItem(this.user+'#'+name, JSON.stringify(value));
    }
    catch(e) { console.log(e); }
  }
}
export class EncodedPublicStorage implements UserStorage {
  user: string

  constructor(user: string) {
    this.user = user;
  }
  getItem(name: string): any {
    return null;
  }
  setItem(name: string, value: any = null) {

  }
}
