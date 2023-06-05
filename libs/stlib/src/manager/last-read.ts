import { UserStorage, LocalUserStorage } from './user-storage'

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
  storage: UserStorage = null
  
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
    this.updateStorage();
    return record;
  }
  updateStorage() {
    if(this.updated && this.storage) 
      this.storage.setItem("lastReadData", this.data);
  }
  load() {
    if(this.storage) {
      var data = this.storage.getItem("lastReadData");
      if(data != null) {
        this.data = data;
      }
    }
  }
  setStorageMethod(storage: UserStorage) {
    this.storage = storage;
    this.updateStorage();
  }
}

