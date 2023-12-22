const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

//middlewares
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);
app.use(express.json());
// app.use(cookieParser());
app.use(
  cookieParser({
    secure: process.env.NODE_ENV === "production",
    sameSite: "None",
  })
);

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "401, Your're not authorized" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "401, You're not authorized" });
    }
    req.decoded = decoded;

    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ddl1jzo.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("taskManagementDB");
    const taskCollection = database.collection("tasks");
    const userCollection = database.collection("users");

    // auth related endpoint
    app.post("/api/v1/auth/access-token", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      // console.log(token);
      res
        .cookie("token", token, {
          // secure: process.env.NODE_ENV === "production",
          // sameSite: "None",

          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });

    // user related endpoints
    app.get("/api/v1/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/v1/user", verifyToken, async (req, res) => {
      const queryEmail = req.query.email;
      if (queryEmail !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden" });
      }
      const query = { email: queryEmail };
      const user = await userCollection.findOne(query);
      res.send({ user });
    });

    app.post("/api/v1/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // end points for tasks
    app.get("/api/v1/user/tasks", async (req, res) => {
      const result = await taskCollection.find().toArray();
      res.send(result);
    });

    app.post("/api/v1/user/create-task", async (req, res) => {
      const newTask = req.body;
      const result = await taskCollection.insertOne(newTask);
      res.send(result);
    });

    app.put("/api/v1/user/update-task/:id", async (req, res) => {
      const taskId = req.params.id;
      const updatedTask = req.body;
      const { _id, ...taskToUpdate } = updatedTask;
      const filter = { _id: new ObjectId(taskId) };
      const result = await taskCollection.updateOne(filter, {
        $set: taskToUpdate,
      });
      res.send(result);
    });

    app.delete("/api/v1/user/delete-task/:id", async (req, res) => {
      const taskId = req.params.id;
      const query = { _id: new ObjectId(taskId) };
      const result = await taskCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`The server is running on port ${port}`);
});
