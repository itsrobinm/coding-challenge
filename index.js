// express boilerplate
const express = require("express");
const moment = require("moment");
const app = express();
app.use(express.json());
const port = 3000;
app.listen(port, () => {});

const { MongoClient, ObjectId } = require("mongodb");
// or as an es module:
// import { MongoClient } from 'mongodb'

// Connection URL
const url = "mongodb://root:example@localhost:27017";
const client = new MongoClient(url);
// Database Name
const dbName = "todoList";

let db;
let collection;

client
  .connect()
  .then(() => {
    console.log("DB Connection Successfull");
    db = client.db(dbName);
    collection = db.collection("tasks");
  })
  .catch((err) => {
    console.error(err);
  });

app.get("/", async (req, res) => {
  return res.send("home route get");
});

app.post("/", async (req, res) => {
  let ret = getCurrentDate();
  return res.send(ret);
});

//create a task
app.post("/task/create", async (req, res) => {
  let taskName = req.body.taskName;
  let dueDate = req.body.dueDate;

  let id = await generateUniqueID();

  let newTask = await collection.insertOne({
    _id: id,
    taskName: taskName,
    dueDate: dueDate,
    startDate: "",
    doneDate: "",
    status: "",
  });

  if (newTask) return res.status(201).json({ success: true });
});

//edit a task
app.post("/task/:id/edit", async (req, res) => {
  let id = req.params.id;
  let update = {};

  //make sure no extra fields can be injected
  if (req.body.taskName) update.taskName = req.body.taskName;
  if (req.body.startDate) update.startDate = req.body.startDate;
  if (req.body.dueDate) update.dueDate = req.body.dueDate;
  if (req.body.doneDate) update.doneDate = req.body.doneDate;
  if (req.body.status) update.status = req.body.status;

  let result = await updateTask(id, update);

  if (result.value) {
    return res.json({ success: true });
  } else {
    return res.status(400).json({ message: "task wasn't found" });
  }
});

//list all tasks
app.post("/tasks", async (req, res) => {
  let result = await collection.find({}).toArray();
  return res.json({ tasks: result });
});

//filter tasks by status
app.post("/tasks/status/:status", async (req, res) => {
  let status = req.params.status;
  let result = await collection.find({ status: status }).toArray();
  return res.json({ tasks: result });
});

//filter tasks by name
app.post("/tasks/name", async (req, res) => {
  let taskName = req.body.taskName;
  let regex = new RegExp(`${taskName}`, 'i');
  let result = await collection.find({ taskName: { $regex: regex } }).toArray();
  return res.json({ tasks: result });
});

//sort tasks by dates




//delete a task
app.post("/task/:id/delete", async (req, res) => {
  //console.log('delete route')
  let id = req.params.id;
  let result = await collection.findOneAndDelete({ _id: id });

  if (result.value) {
    return res.json({ success: true });
  } else {
    return res.status(400).json({ message: "task wasn't found" });
  }
});

//change the status of a task
app.post("/task/:id/:operation", async (req, res) => {
  let id = req.params.id;
  let operation = req.params.operation;
  let update = {};

  //get the task to see it's current status
  let task = await collection.findOne({ _id: id });

  if (!task) return res.status(400).json({ message: "task not found" });

  if (operation === "start") {
    update.startDate = getCurrentDate();
    update.status = "to-do";

    //reset task from done to to-do should reset end date too
    if (task.status === "done") {
      update.doneDate = "";
    }
  } else if (operation === "finish") {
    update.doneDate = getCurrentDate();
    update.status = "done";
  } else {
    return res.status(400).json({ message: "invalid operation" });
  }

  let result = await updateTask(id, update);
  if (result.value) {
    return res.json({ success: true });
  } else {
    return res.status(400).json({ message: "task wasn't found" });
  }

  //return res.send(operation);
});

async function updateTask(id, update) {
  let result = await collection.findOneAndUpdate(
    { _id: id },
    { $set: update },
    {
      returnOriginal: false,
      upsert: false,
    }
  );

  return result;
}

async function generateUniqueID() {
  let id;
  let found = true;

  while (found) {
    id = Math.random().toString(16).substring(2, 6);
    //id = '8A22';
    let result = await collection.findOne({ _id: id });
    if (!result) {
      found = false;
    }
  }

  return id;
}

function getCurrentDate() {
  const formattedDate = moment().utc().format("HH:mm:ss DD/MM/YYYY");
  return formattedDate;
}
