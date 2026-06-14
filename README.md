# Easy Consulting Local Backend

This backend mirrors the API routes used by the React frontend.

## Run Locally

```sh
cd backend
npm install
npm run dev
```

The API runs at:

```txt
http://127.0.0.1:5000
```

## Storage

By default, the server tries `MONGODB_URI` from `.env`. If MongoDB is not available, it falls back to `backend/data/db.json`, so the frontend can still run locally.

Create a `.env` from `.env.example` when you want MongoDB:

```sh
cp .env.example .env
```

For local MongoDB:

```txt
MONGODB_URI=mongodb://127.0.0.1:27017
DB_NAME=easy_consulting
```
