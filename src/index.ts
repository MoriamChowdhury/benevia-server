import "dotenv/config";
import dns from "node:dns";
import express, { Request, Response } from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import { AuthRequest, verifyToken } from "./middleware/verifyToken";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const clientUrl = (process.env.CLIENT_URL || "").replace(/\/$/, "");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: clientUrl, credentials: true }));
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
  if (String(title).trim().length < 5) {
    return "Title must be at least 5 characters long";
  }
  if (String(description).trim().length < 20) {
    return "Description must be at least 20 characters long";
  }
  try {
    new URL(String(thumbnail));
  } catch {
    return "Thumbnail must be a valid URL";
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

  // Create event (protected)
  app.post("/events", verifyToken, async (req: AuthRequest, res: Response) => {
    const error = validateEvent(req.body);
    if (error) {
      res.status(400).send({ message: error });
      return;
    }

    const { title, description, eventType, thumbnail, location, eventDate } = req.body;
    const event = {
      title,
      description,
      eventType,
      thumbnail,
      location,
      eventDate: new Date(eventDate),
      creatorEmail: req.user!.email,
      creatorName: req.user!.name,
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

  // Events created by the logged-in user (protected)
  app.get("/my-events", verifyToken, async (req: AuthRequest, res: Response) => {
    const events = await eventsCollection
      .find({ creatorEmail: req.user!.email })
      .sort({ eventDate: 1 })
      .toArray();
    res.send(events);
  });

  // Single event (public)
  app.get("/events/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) {
      res.status(400).send({ message: "Invalid event id" });
      return;
    }
    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!event) {
      res.status(404).send({ message: "Event not found" });
      return;
    }
    res.send(event);
  });

  // Update event (protected, owner only)
  app.patch("/events/:id", verifyToken, async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) {
      res.status(400).send({ message: "Invalid event id" });
      return;
    }

    const existing = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      res.status(404).send({ message: "Event not found" });
      return;
    }
    if (existing.creatorEmail !== req.user!.email) {
      res.status(403).send({ message: "You can only update your own events" });
      return;
    }

    const error = validateEvent(req.body);
    if (error) {
      res.status(400).send({ message: error });
      return;
    }

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

  // Delete event (protected, owner only)
  app.delete("/events/:id", verifyToken, async (req: AuthRequest, res: Response) => {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) {
      res.status(400).send({ message: "Invalid event id" });
      return;
    }

    const existing = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      res.status(404).send({ message: "Event not found" });
      return;
    }
    if (existing.creatorEmail !== req.user!.email) {
      res.status(403).send({ message: "You can only delete your own events" });
      return;
    }

    const result = await eventsCollection.deleteOne({ _id: new ObjectId(id) });
    await joinedCollection.deleteMany({ eventId: id });
    res.send(result);
  });

  // ---------- JOINED EVENTS ----------

  // Join an event (protected)
  app.post("/joined", verifyToken, async (req: AuthRequest, res: Response) => {
    const { eventId } = req.body;
    if (!eventId || !ObjectId.isValid(eventId)) {
      res.status(400).send({ message: "Valid eventId is required" });
      return;
    }

    const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });
    if (!event) {
      res.status(404).send({ message: "Event not found" });
      return;
    }
    if (event.eventDate < startOfToday()) {
      res.status(400).send({ message: "This event has already passed" });
      return;
    }

    const userEmail = req.user!.email;
    const alreadyJoined = await joinedCollection.findOne({ eventId, userEmail });
    if (alreadyJoined) {
      res.status(409).send({ message: "You have already joined this event" });
      return;
    }

    const result = await joinedCollection.insertOne({
      eventId,
      userEmail,
      userName: req.user!.name,
      title: event.title,
      thumbnail: event.thumbnail,
      location: event.location,
      eventType: event.eventType,
      eventDate: event.eventDate,
      joinedAt: new Date(),
    });
    res.status(201).send(result);
  });

  // Events joined by the logged-in user, sorted by event date (protected)
  app.get("/joined", verifyToken, async (req: AuthRequest, res: Response) => {
    const joined = await joinedCollection
      .find({ userEmail: req.user!.email })
      .sort({ eventDate: 1 })
      .toArray();
    res.send(joined);
  });
}
run().catch(console.error);

app.get("/", (req: Request, res: Response) => {
  res.send("Benevia server is running");
});

app.get("/health", (req: Request, res: Response) => {
  res.send({ status: "ok", time: new Date().toISOString() });
});
app.listen(port, () => console.log(`Server on ${port}`));