require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const cors = require("cors");
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = Number(process.env.PORT || 5000);
const dbFile = path.join(__dirname, "data", "db.json");

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const collections = ["services", "reviews", "orders", "admins"];
let mongoDb = null;

function makeId(prefix) {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}

function canUseObjectId(id) {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
}

function mongoFilterById(id) {
  return canUseObjectId(id) ? { _id: new ObjectId(id) } : { _id: id };
}

async function readJsonDb() {
  const raw = await fs.readFile(dbFile, "utf8");
  return JSON.parse(raw);
}

async function writeJsonDb(data) {
  await fs.writeFile(dbFile, `${JSON.stringify(data, null, 2)}\n`);
}

async function list(collection, filter = {}) {
  if (mongoDb) {
    return mongoDb.collection(collection).find(filter).toArray();
  }

  const data = await readJsonDb();
  return (data[collection] || []).filter((item) =>
    Object.entries(filter).every(([key, value]) => item[key] === value)
  );
}

async function insert(collection, document, prefix) {
  if (mongoDb) {
    const result = await mongoDb.collection(collection).insertOne(document);
    return { ...document, _id: result.insertedId };
  }

  const data = await readJsonDb();
  const record = { _id: makeId(prefix), ...document };
  data[collection].push(record);
  await writeJsonDb(data);
  return record;
}

async function updateById(collection, id, patch) {
  if (mongoDb) {
    const result = await mongoDb
      .collection(collection)
      .updateOne(mongoFilterById(id), { $set: patch });
    return result.modifiedCount > 0 || result.matchedCount > 0;
  }

  const data = await readJsonDb();
  const index = data[collection].findIndex((item) => String(item._id) === String(id));
  if (index === -1) return false;
  data[collection][index] = { ...data[collection][index], ...patch };
  await writeJsonDb(data);
  return true;
}

async function deleteById(collection, id) {
  if (mongoDb) {
    const result = await mongoDb.collection(collection).deleteOne(mongoFilterById(id));
    return result.deletedCount > 0;
  }

  const data = await readJsonDb();
  const before = data[collection].length;
  data[collection] = data[collection].filter((item) => String(item._id) !== String(id));
  await writeJsonDb(data);
  return data[collection].length !== before;
}

app.get("/", (req, res) => {
  res.json({
    name: "Easy Consulting API",
    storage: mongoDb ? "mongodb" : "local-json",
    endpoints: collections
  });
});

app.get("/services", async (req, res, next) => {
  try {
    res.json(await list("services"));
  } catch (error) {
    next(error);
  }
});

app.post("/addService", async (req, res, next) => {
  try {
    res.json(await insert("services", req.body, "service"));
  } catch (error) {
    next(error);
  }
});

app.patch("/updateService/:id", async (req, res, next) => {
  try {
    res.json({ modified: await updateById("services", req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

app.delete("/delete/:id", async (req, res, next) => {
  try {
    res.json({ deleted: await deleteById("services", req.params.id) });
  } catch (error) {
    next(error);
  }
});

app.get("/reviews", async (req, res, next) => {
  try {
    res.json(await list("reviews"));
  } catch (error) {
    next(error);
  }
});

app.get("/userReview", async (req, res, next) => {
  try {
    res.json(await list("reviews", { email: req.query.email }));
  } catch (error) {
    next(error);
  }
});

app.get("/userReview/:id", async (req, res, next) => {
  try {
    const reviews = await list("reviews");
    res.json(reviews.filter((review) => String(review._id) === String(req.params.id)));
  } catch (error) {
    next(error);
  }
});

app.post("/addReview", async (req, res, next) => {
  try {
    res.json(await insert("reviews", req.body, "review"));
  } catch (error) {
    next(error);
  }
});

app.patch("/updateReview/:id", async (req, res, next) => {
  try {
    res.json({ modified: await updateById("reviews", req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

app.delete("/deleteReview/:id", async (req, res, next) => {
  try {
    res.json({ deleted: await deleteById("reviews", req.params.id) });
  } catch (error) {
    next(error);
  }
});

app.get("/orders", async (req, res, next) => {
  try {
    res.json(await list("orders"));
  } catch (error) {
    next(error);
  }
});

app.get("/bookingList", async (req, res, next) => {
  try {
    res.json(await list("orders", { email: req.query.email }));
  } catch (error) {
    next(error);
  }
});

app.post("/addOrder", async (req, res, next) => {
  try {
    res.json(await insert("orders", req.body, "order"));
  } catch (error) {
    next(error);
  }
});

app.patch("/statusUpdate/:id", async (req, res, next) => {
  try {
    res.json({ modified: await updateById("orders", req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

app.delete("/deleteOrder/:id", async (req, res, next) => {
  try {
    res.json({ deleted: await deleteById("orders", req.params.id) });
  } catch (error) {
    next(error);
  }
});

app.get("/admin", async (req, res, next) => {
  try {
    res.json(await list("admins", { email: req.query.email }));
  } catch (error) {
    next(error);
  }
});

app.post("/addAdmin", async (req, res, next) => {
  try {
    const existing = await list("admins", { email: req.body.email });
    if (existing.length > 0) return res.json(existing[0]);
    res.json(await insert("admins", req.body, "admin"));
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message });
});

async function connectMongo() {
  if (!process.env.MONGODB_URI) return;

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  mongoDb = client.db(process.env.DB_NAME || "easy_consulting");

  const jsonData = await readJsonDb();
  for (const collection of collections) {
    const count = await mongoDb.collection(collection).countDocuments();
    if (count === 0 && jsonData[collection]?.length) {
      await mongoDb.collection(collection).insertMany(jsonData[collection]);
    }
  }
}

connectMongo()
  .catch((error) => {
    console.warn(`MongoDB unavailable, using local JSON storage: ${error.message}`);
  })
  .finally(() => {
    app.listen(port, "127.0.0.1", () => {
      console.log(`Easy Consulting API running at http://127.0.0.1:${port}`);
      console.log(`Storage: ${mongoDb ? "MongoDB" : "local JSON file"}`);
    });
  });
