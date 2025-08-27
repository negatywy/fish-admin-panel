const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const express = require('express');
const { createUsersWithPattern } = require('./createUsers');
const { deleteUsers } = require('./deleteUsers');

const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.post('/create-users', async (req, res) => {
  const { basePattern, emailIds, appVersion, associationId, associationName } = req.body;

  try {
    const user = await createUsersWithPattern(
      basePattern,
      emailIds,
      appVersion,
      associationId,
      associationName
    );
    res.json({ success: true, users: [user] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/delete-users", async (req, res) => {
  const { emails } = req.body; // must be an array
  if (!emails || !Array.isArray(emails)) {
    return res.status(400).json({ success: false, error: "emails must be an array" });
  }

  try {
    const results = await deleteUsers(emails);
    res.json({ success: true, results }); // 🔹 always returns array
  } catch (err) {
    console.error("Batch deletion error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

exports.api = functions.https.onRequest(app);
