import "dotenv/config";
import dns from "node:dns";
import express, { Request, Response } from "express";
import cors from "cors";
import { MongoClient, ServerApiVersion } from "mongodb";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI as string, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  await client.connect();
  const db = client.db("beneviaDB");
  const eventsCollection = db.collection("events");
  const joinedCollection = db.collection("joinedEvents");
  console.log("MongoDB connected");

  // routes porer step e add hobe
}
run().catch(console.error);

app.get("/", (req: Request, res: Response) => {
  res.send("Benevia server is running");
});

app.listen(port, () => console.log(`Server on ${port}`));