# Benevia Server

REST API for **Benevia**, a social development events platform.

**Live API(Render):** https://benevia-server.onrender.com/

**Client:** https://github.com/MoriamChowdhury/benevia-client

## Tech Stack

- Express.js with TypeScript
- MongoDB (native driver)
- JWT verification using the BetterAuth JWKS endpoint (jose)

## Features

- Create, read, update and delete events
- Upcoming events only, with search, type filter and limit
- Join and leave events, and list joined events sorted by date
- Participants count on every event
- JWT protected routes with owner-only update and delete
- Server side validation for event data and past dates

## API Routes

| Method | Route | Access |
|---|---|---|
| GET | `/events` | Public |
| GET | `/events/:id` | Public |
| POST | `/events` | Protected |
| PATCH | `/events/:id` | Owner only |
| DELETE | `/events/:id` | Owner only |
| GET | `/my-events` | Protected |
| POST | `/joined` | Protected |
| GET | `/joined` | Protected |
| GET | `/joined/:eventId` | Protected |
| DELETE | `/joined/:eventId` | Protected |
| GET | `/health` | Public |

## Run Locally

1. Run `npm install`
2. Copy `.env.example` to `.env` and fill in the values
3. Run `npm run dev`