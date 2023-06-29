import { UserStorage, LocalUserStorage, EncodedPublicStorage } from './user-storage'

export class LastReadRecord {
  timestamp: number
  number: number
  constructor(timestamp: number, number: number) {
    this.timestamp = timestamp;
    this.number = number;
  }
}
export interface LastReadMap {
  [key: string]: LastReadRecord;
}
export class LastRead {
  data: LastReadMap = {}
  updated: boolean = false
  updateShared: boolean = false
  storage: UserStorage = null
  sharedStorage: EncodedPublicStorage = null
  lastSyncTimestamp: number = 0
  
  lookup(conversation: string) {
    var record = this.data[conversation];
    return (record != null)?record:null;
  }
  store(conversation: string, timestamp: number = 0, number: number = 0): LastReadRecord {
    var record = this.lookup(conversation);
    if(record == null) {
      record = new LastReadRecord(timestamp, number);
      this.data[conversation] = record;        
    }
    else {
      record.timestamp = timestamp;
      record.number = number;
    }
    this.updated = true;
    if(this.sharedStorage != null) this.updateShared = true;
    this.updateStorage();
    return record;
  }
  updateStorage() {
    if(this.updated && this.storage) 
      this.storage.setItem("lastReadData", this.data);
  }
  async updateSharedStorage() {
    if(this.sharedStorage) {
      await this.sharedStorage.setItem("lastReadData", this.data);
      if(this.storage) this.storage.setItem("lastReadData", this.data);
    }
  }
  loadData(data: any): boolean {
    var updated = false;
    if(data != null) {
      for(var conversation in data) {
        if(this.data[conversation] == null || this.data[conversation].timestamp < data[conversation].timestamp) {
          this.data[conversation] = data[conversation];
          updated = true;
        }
      }
    }
    return updated;
  }
  async load() {
    if(this.storage) {
      var data = await this.storage.getItem("lastReadData");
      this.loadData(data);
    }
  }
  async sync(): Promise<boolean> {
    if(this.sharedStorage == null) return false;
    var update = this.updateShared;
    var updated = false;
    try {
        var timestamp = await this.sharedStorage.getTimestamp("lastReadData");
        if(timestamp > this.lastSyncTimestamp) {
            this.lastSyncTimestamp = timestamp;
            var data = await this.sharedStorage.getItem("lastReadData");
            updated = this.loadData(data);
        }
    }
    catch(e) { console.log(e); }

    try {
        if(update) this.updateSharedStorage();
    }
    catch(e) { console.log(e); }
    this.updateShared = false;
    return updated;
  }
  setStorageMethod(storage: UserStorage) {
    this.storage = storage;
  }
  async setSharedStorage(storage: EncodedPublicStorage) {
    this.sharedStorage = storage;
  }
}

