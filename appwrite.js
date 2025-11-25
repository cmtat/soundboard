// Import Appwrite from a CDN so it works in the browser without a bundler.
import {
  Client,
  Account,
  Databases,
  Storage,
  ID,
  Permission,
  Role,
  Query,
} from "https://esm.run/appwrite@21.4.0";

const client = new Client().setEndpoint("https://nyc.cloud.appwrite.io/v1").setProject("soundboard");
const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);

export { client, account, databases, storage, ID, Permission, Role, Query };
