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
  const { basePattern, emailId, appVersion, associationId, associationName } = req.body;

  try {
    const user = await createUsersWithPattern(
      basePattern,
      emailId,
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

app.post("/delete-user", async (req, res) => {
  const { email } = req.body;

  try {
    await deleteUsers(email);
    res.json({ success: true, email });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

exports.api = functions.https.onRequest(app);
