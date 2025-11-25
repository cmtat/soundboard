// Import Appwrite from a CDN so it works in the browser without a bundler.
import { Client, Account, Databases } from "https://esm.run/appwrite@21.4.0";

const client = new Client().setEndpoint("https://nyc.cloud.appwrite.io/v1").setProject("soundboard");
const account = new Account(client);
const databases = new Databases(client);

export { client, account, databases };
