import "dotenv/config";
import dns from "node:dns";
import express, { Request, Response } from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI as string, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function validateEvent(body: any): string | null {
  const { title, description, eventType, thumbnail, location, eventDate } = body;
  if (!title || !description || !eventType || !thumbnail || !location || !eventDate) {
    return "All fields are required";
  }
  const date = new Date(eventDate);
  if (isNaN(date.getTime())) return "Invalid event date";
  if (date < startOfToday()) return "Event date cannot be in the past";
  return null;
}

async function run() {
  await client.connect();
  const db = client.db("beneviaDB");
  const eventsCollection = db.collection("events");
  const joinedCollection = db.collection("joinedEvents");
  console.log("MongoDB connected");

  // ---------- EVENTS ----------

  // Create event
  app.post("/events", async (req: Request, res: Response) => {
    const error = validateEvent(req.body);
    if (error) return res.status(400).send({ message: error });

    const { title, description, eventType, thumbnail, location, eventDate, creatorEmail, creatorName } = req.body;
    if (!creatorEmail) return res.status(400).send({ message: "Creator email is required" });

    const event = {
      title,
      description,
      eventType,
      thumbnail,
      location,
      eventDate: new Date(eventDate),
      creatorEmail,
      creatorName: creatorName || "",
      createdAt: new Date(),
    };
    const result = await eventsCollection.insertOne(event);
    res.status(201).send(result);
  });

  // Upcoming events (public). Query: ?limit=6&search=&type=
  app.get("/events", async (req: Request, res: Response) => {
    const { limit, search, type } = req.query;
    const query: any = { eventDate: { $gte: startOfToday() } };
    if (search) query.title = { $regex: String(search), $options: "i" };
    if (type && type !== "all") query.eventType = String(type);

    let cursor = eventsCollection.find(query).sort({ eventDate: 1 });
    if (limit) cursor = cursor.limit(Number(limit));
    res.send(await cursor.toArray());
  });

  // Events created by one user (manage events)
  app.get("/my-events", async (req: Request, res: Response) => {
    const email = String(req.query.email || "");
    if (!email) return res.status(400).send({ message: "Email is required" });
    const events = await eventsCollection
      .find({ creatorEmail: email })
      .sort({ eventDate: 1 })
      .toArray();
    res.send(events);
  });

  // Single event (public)
  app.get("/events/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid event id" });
    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!event) return res.status(404).send({ message: "Event not found" });
    res.send(event);
  });

  // Update event
  app.patch("/events/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid event id" });

    const error = validateEvent(req.body);
    if (error) return res.status(400).send({ message: error });

    const { title, description, eventType, thumbnail, location, eventDate } = req.body;
    const result = await eventsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title,
          description,
          eventType,
          thumbnail,
          location,
          eventDate: new Date(eventDate),
        },
      }
    );
    res.send(result);
  });

  // Delete event
  app.delete("/events/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid event id" });
    const result = await eventsCollection.deleteOne({ _id: new ObjectId(id) });
    await joinedCollection.deleteMany({ eventId: id });
    res.send(result);
  });

  // ---------- JOINED EVENTS ----------

  // Join an event
  app.post("/joined", async (req: Request, res: Response) => {
    const { eventId, userEmail, userName } = req.body;
    if (!eventId || !userEmail || !ObjectId.isValid(eventId)) {
      return res.status(400).send({ message: "Valid eventId and userEmail are required" });
    }

    const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });
    if (!event) return res.status(404).send({ message: "Event not found" });
    if (event.eventDate < startOfToday()) {
      return res.status(400).send({ message: "This event has already passed" });
    }

    const alreadyJoined = await joinedCollection.findOne({ eventId, userEmail });
    if (alreadyJoined) {
      return res.status(409).send({ message: "You have already joined this event" });
    }

    const result = await joinedCollection.insertOne({
      eventId,
      userEmail,
      userName: userName || "",
      title: event.title,
      thumbnail: event.thumbnail,
      location: event.location,
      eventType: event.eventType,
      eventDate: event.eventDate,
      joinedAt: new Date(),
    });
    res.status(201).send(result);
  });

  // Events joined by one user, sorted by event date
  app.get("/joined", async (req: Request, res: Response) => {
    const email = String(req.query.email || "");
    if (!email) return res.status(400).send({ message: "Email is required" });
    const joined = await joinedCollection
      .find({ userEmail: email })
      .sort({ eventDate: 1 })
      .toArray();
    res.send(joined);
  });
}
run().catch(console.error);

app.get("/", (req: Request, res: Response) => {
  res.send("Benevia server is running");
});

app.listen(port, () => console.log(`Server on ${port}`));