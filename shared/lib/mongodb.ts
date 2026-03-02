import "server-only";
import { MongoClient, type Db } from "mongodb";
import { env } from "@/shared/lib/env";

if (!env.MONGODB_URI) {
  throw new Error("MONGODB_URI is not set in environment");
}

type GlobalWithMongo = typeof globalThis & {
  __mongo?: { client: MongoClient; promise?: Promise<MongoClient> };
};

const g = globalThis as GlobalWithMongo;

if (!g.__mongo) {
  g.__mongo = {
    client: new MongoClient(env.MONGODB_URI, { maxPoolSize: 10 }),
    promise: undefined,
  };
}

export async function getClient(): Promise<MongoClient> {
  if (!g.__mongo) throw new Error("Mongo client not initialized");
  const state = g.__mongo;
  if (!state.promise) {
    state.promise = state.client.connect().then(() => state.client).catch((err) => {
      // Allow future attempts to retry
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
