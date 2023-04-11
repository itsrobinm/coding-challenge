const express = require("express");
const moment = require("moment");
const app = express();
app.use(express.json());
const port = 3000;
app.listen(port, () => {});

const { MongoClient, ObjectId } = require("mongodb");

const DATE_FORMAT = "HH:mm:ss DD/MM/YYYY";

// Connection URL
const url = "mongodb://root:example@localhost:27017";
const client = new MongoClient(url);
// Database Name
const dbName = "todoList";

let db;
let tasksCollection;
let projectsCollection;

client
  .connect()
  .then(() => {
    console.log("DB Connection Successfull");
    db = client.db(dbName);
    tasksCollection = db.collection("tasks");
    projectsCollection = db.collection("projects");
  })
  .catch((err) => {
    console.error(err);
  });

//create a task. Date has to be specified in the format HH:mm:ss DD/MM/YYYY
app.post("/task/create", async (req, res) => {
  let taskName = req.body.taskName;
  let dueDate = req.body.dueDate;

  //perform validation on the date
  if (!moment(dueDate, DATE_FORMAT, true).isValid())
    return res.status(400).json({ message: "invalid due date format." });

  let id = await generateUniqueID();

  let newTask = await tasksCollection.insertOne({
    _id: id,
    taskName: taskName,
    dueDate: dueDate,
    startDate: "",
    doneDate: "",
    status: "",
    assocProjectID: "",
  });

  if (newTask) return res.status(201).json({ success: true });
});

//create a project. start and due dates have to be specified in the format HH:mm:ss DD/MM/YYYY
app.post("/project/create", async (req, res) => {
  let projectName = req.body.projectName;
  let startDate = req.body.startDate;
  let dueDate = req.body.dueDate;

  if (!moment(startDate, DATE_FORMAT, true).isValid())
    return res.status(400).json({ message: "invalid start date format." });

  if (!moment(dueDate, DATE_FORMAT, true).isValid())
    return res.status(400).json({ message: "invalid due date format." });

  let id = await generateUniqueID();

  let newProject = await projectsCollection.insertOne({
    _id: id,
    projectName: projectName,
    startDate: startDate,
    dueDate: dueDate,
    tasks: [],
  });

  if (newProject) return res.status(201).json({ success: true });
});

//assign a task to a project
app.post("/project/:id/assignTask", async (req, res) => {
  let id = req.params.id;
  let taskToAdd = req.body.task;

  //check the project exists
  let project = await projectsCollection.findOne({ _id: id });
  if (!project) return res.status(400).json({ message: "project not found" });

  //check the task exists
  let task = await tasksCollection.findOne({ _id: taskToAdd._id });
  if (!task) return res.status(400).json({ message: "task not found" });

  let tasksArr = project.tasks;

  //check the project doesn't aleady have this task
  if (tasksArr.some((item) => item._id === taskToAdd._id))
    return res
      .status(400)
      .json({ message: "project already contains this task" });

  tasksArr.push(taskToAdd);

  let update = {};
  update.tasks = tasksArr;

  let taskUpdate = {};
  taskUpdate.assocProjectID = id;

  let updateTaskResult = await updateTask(taskToAdd._id, taskUpdate);
  console.log(updateTaskResult.value);

  let updateProjectResult = await updateProject(id, update);

  if (updateProjectResult.value && updateTaskResult.value) {
    return res.json({ success: true });
  } else {
    return res.status(400).json({ message: "error adding task to project" });
  }
});

//edit a project
app.post("/project/:id/edit", async (req, res) => {
  let id = req.params.id;

  //check the project exists
  let project = await projectsCollection.findOne({ _id: id });
  if (!project) return res.status(400).json({ message: "project not found" });

  //make sure only certain fields can be changed
  let update = {};
  if (req.body.projectName) update.projectName = req.body.projectName;
  if (req.body.startDate) update.startDate = req.body.startDate;
  if (req.body.dueDate) update.dueDate = req.body.dueDate;

  //perform validtion on the dates, if supplied
  if (update.startDate) {
    if (!moment(update.startDate, DATE_FORMAT, true).isValid())
      return res.status(400).json({ message: "invalid start date format." });
  }

  if (update.dueDate) {
    if (!moment(update.dueDate, DATE_FORMAT, true).isValid())
      return res.status(400).json({ message: "invalid due date format." });
  }

  let updateProjectResult = await updateProject(id, update);

  if (updateProjectResult.value) {
    return res.json({ success: true });
  } else {
    return res.status(400).json({ message: "error updating project" });
  }
});

//sort projects by dates
app.post("/projects/sort/:field", async (req, res) => {
  let field = req.params.field;

  if (!(field === "startDate" || field == "dueDate"))
  return res.status(400).json({ message: "invalid sort criteria" });

  //match all fields with a value
  let result = await projectsCollection.find({ [field]: { $ne: "" } }).toArray();

    //sort the returned array
  result.sort((a, b) => parseDate(a[field]) - parseDate(b[field]));

  return res.json({ projects: result });
});

//edit a task
app.post("/task/:id/edit", async (req, res) => {
  let id = req.params.id;
  let update = {};

  //check task exists
  let task = await tasksCollection.findOne({ _id: id });
  if (!task) return res.status(400).json({ message: "task not found" });

  //make sure no extra fields can be injected
  if (req.body.taskName) update.taskName = req.body.taskName;
  if (req.body.startDate) update.startDate = req.body.startDate;
  if (req.body.dueDate) update.dueDate = req.body.dueDate;
  if (req.body.doneDate) update.doneDate = req.body.doneDate;
  if (req.body.status) update.status = req.body.status;

  //perform validtion on the dates, if supplied
  if (update.startDate) {
    if (!moment(update.startDate, DATE_FORMAT, true).isValid())
      return res.status(400).json({ message: "invalid start date format." });
  }

  if (update.dueDate) {
    if (!moment(update.dueDate, DATE_FORMAT, true).isValid())
      return res.status(400).json({ message: "invalid due date format." });
  }

  if (update.doneDate) {
    if (!moment(update.doneDate, DATE_FORMAT, true).isValid())
      return res.status(400).json({ message: "invalid done date format." });
  }

  let result = await updateTask(id, update);

  if (result.value) {
    return res.json({ success: true });
  } else {
    return res.status(400).json({ message: "task wasn't found" });
  }
});

//list all tasks
app.post("/tasks", async (req, res) => {
  let result = await tasksCollection.find({}).toArray();
  return res.json({ tasks: result });
});

//filter tasks by status
app.post("/tasks/status/:status", async (req, res) => {
  let status = req.params.status;
  let result = await tasksCollection.find({ status: status }).toArray();
  return res.json({ tasks: result });
});

//filter tasks by name
app.post("/tasks/name", async (req, res) => {
  let taskName = req.body.taskName;
  let regex = new RegExp(`${taskName}`, "i");
  let result = await tasksCollection
    .find({ taskName: { $regex: regex } })
    .toArray();
  return res.json({ tasks: result });
});

//sort tasks by dates
app.post("/tasks/sort/:field", async (req, res) => {
  let field = req.params.field;

  if (!(field === "dueDate" || field == "startDate" || field == "doneDate"))
    return res.status(400).json({ message: "invalid sort criteria" });

  //match all fields with a value
  let result = await tasksCollection.find({ [field]: { $ne: "" } }).toArray();

  //sort the returned array
  result.sort((a, b) => parseDate(a[field]) - parseDate(b[field]));

  return res.json({ tasks: result });
});

//delete a task. we must also check that this task is deleted from any project its associated with
app.post("/task/:id/delete", async (req, res) => {
  let id = req.params.id;
  let taskDelete = await tasksCollection.findOneAndDelete({ _id: id });

  if (!taskDelete.value)
    return res.status(400).json({ message: "error deleting this task" });

  //let projectsWithThisTask = projectsCollection.find({}).toArray();
  //let assocProjectID = taskDelete.value.assocProjectID;

  if (taskDelete.value.assocProjectID !== "") {
    let assocProjectID = taskDelete.value.assocProjectID;

    //first check, if the associated project still exists
    let project = await projectsCollection.findOne({ _id: assocProjectID });

    //delete the tasks in this project
    if (project) {
      projectsCollection.updateOne(
        { _id: assocProjectID },
        { $pull: { tasks: { _id: taskDelete.value._id } } }
      );
    }
  }

  if (taskDelete.value) {
    return res.json({ success: true });
  } else {
    return res.status(400).json({ message: "error deleting this task" });
  }
});

//delete a project. we must also deassociate tasks from this project
app.post("/project/:id/delete", async (req, res) => {
  let id = req.params.id;

  let projectDelete = await projectsCollection.findOneAndDelete({ _id: id });
  if (!projectDelete.value)
    return res.status(400).json({ message: "error deleting this project" });

  projectDelete.value.tasks.forEach(async (task, index) => {
    //console.log(task);
    let update = {};
    update.assocProjectID = "";
    await updateTask(task._id, update);
  });

  if (projectDelete.value) {
    return res.json({ success: true });
  } else {
    return res.status(400).json({ message: "error deleting this project" });
  }
});

//list all projects
app.post("/projects", async (req, res) => {
  let result = await projectsCollection.find({}).toArray();
  return res.json({ projects: result });
});

//filter projects by name
app.post("/projects/name", async (req, res) => {
  let projectName = req.body.projectName;
  console.log(projectName);
  let regex = new RegExp(`${projectName}`, "i");
  let result = await projectsCollection
    .find({ projectName: { $regex: regex } })
    .toArray();
  return res.json({ projects: result });
});

//change the status of a task
app.post("/task/:id/:operation", async (req, res) => {
  let id = req.params.id;
  let operation = req.params.operation;
  let update = {};

  //get the task to see it's current status
  let task = await tasksCollection.findOne({ _id: id });
  if (!task) return res.status(400).json({ message: "task not found" });

  if (operation === "start") {
    update.startDate = getCurrentDate();
    update.status = "to-do";

    //reset task from done to to-do should reset end date too
    if (task.status === "done") {
      update.doneDate = "";
    }
  } else if (operation === "finish") {
    //you shouldn't be able to finish a task if it's not started yet
    if (!task.startDate)
      return res
        .status(400)
        .json({ message: "you can't finish a task that hasn't been started" });

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
});

//update a task with a specified id
async function updateTask(id, update) {
  let result = await tasksCollection.findOneAndUpdate(
    { _id: id },
    { $set: update },
    {
      returnNewDocument: true,
      upsert: false,
    }
  );

  return result;
}

//update a project with a specified id
async function updateProject(id, update) {
  let result = await projectsCollection.findOneAndUpdate(
    { _id: id },
    { $set: update },
    {
      returnOriginal: false,
      upsert: false,
    }
  );

  return result;
}

//generate a unique ID for a document that doesn't already exist in the database
async function generateUniqueID() {
  let id;
  let found = true;

  while (found) {
    id = Math.random().toString(16).substring(2, 6);
    let result = await tasksCollection.findOne({ _id: id });
    if (!result) {
      found = false;
    }
  }

  return id;
}

//get the current date and format into unix timestamp form
function getCurrentDate() {
  
  return moment().format(DATE_FORMAT);
}

//parse a date in the format HH:mm:ss DD/MM/YYYY and convert it into unix timestamp form
function parseDate(date) {
  let ret = moment(date, DATE_FORMAT);
  return ret.unix().toString();
}
