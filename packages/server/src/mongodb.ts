import "server-only";
import { MongoClient, type Db } from "mongodb";
import { env } from "./env";

type GlobalWithMongo = typeof globalThis & {
  __mongo?: { client: MongoClient; promise?: Promise<MongoClient> };
};

const g = globalThis as GlobalWithMongo;

function initClient() {
  if (!env.MONGODB_URI) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("MONGODB_URI is not set in environment");
    }
    return null;
  }

  if (!g.__mongo) {
    g.__mongo = {
      client: new MongoClient(env.MONGODB_URI, {
        maxPoolSize: 10,
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
      }),
      promise: undefined,
    };
  }
  return g.__mongo;
}

export async function getClient(): Promise<MongoClient> {
  const state = initClient();
  if (!state) throw new Error("Mongo client not initialized (missing URI)");

  if (!state.promise) {
    state.promise = state.client.connect().then(() => state.client).catch((err) => {
      state.promise = undefined;
      throw err;
    });
  }
  return state.promise;
}

export async function getDb(dbName?: string): Promise<Db> {
  const client = await getClient();
  return client.db(dbName);
}
