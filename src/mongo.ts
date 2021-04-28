import { Db, MongoClient } from 'mongodb';

export default class Mongo {
  private static instance: Mongo;

  public db: Promise<Db>;

  private client: Promise<MongoClient>;

  private connect(): Promise<Db> {
    return this.client.then((client) => client.db()).catch(() => this.connect());
  }

  private constructor() {
    this.client = MongoClient.connect(process.env.MONGO_URL as string, { useUnifiedTopology: true });
    this.db = this.connect();
  }

  public static getInstance(): Mongo {
    if (!Mongo.instance) Mongo.instance = new Mongo();
    return Mongo.instance;
  }

  public exit(): Promise<boolean> {
    return new Promise((resolve) => {
      this.client.then((client) => setTimeout(() => {
        client.close().then(() => {
          console.log('Manually disconnected from mongo');
          resolve(true);
        });
      }, 3000));
    });
  }
}
