# Benevia Server

REST API for **Benevia**, a social development events platform.

Live API: https://YOUR-SERVER-URL.onrender.com

## Tech Stack

- Express.js with TypeScript
- MongoDB (native driver)
- JWT verification using the BetterAuth JWKS endpoint (jose)

## Features

- Create, read, update and delete events
- Upcoming events only, with search, type filter and limit
- Join events and list joined events sorted by date
- JWT protected routes with owner-only update and delete
- Server side validation for event data and past dates

## Run locally

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the values
3. `npm run dev`