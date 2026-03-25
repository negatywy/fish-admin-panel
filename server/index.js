const express = require('express');
const bodyParser = require('body-parser');
const { createUsersWithPattern } = require('./createUsers');
const { deleteUsers } = require('./deleteUsers');
const admin = require('firebase-admin');

const app = express();
app.use(bodyParser.json());

const cors = require('cors');
app.use(cors());

app.post('/create-users', async (req, res) => {
  const { basePattern, emailIds, appVersion, associationId, associationName } = req.body;

  try {
    const users = await createUsersWithPattern(
      basePattern,
      emailIds,
      appVersion,
      associationId,
      associationName
    );
    res.json({ success: true, users });
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

app.post("/log-admin-action", async (req, res) => {
  const { action, admin: adminEmail, user } = req.body;
  
  if (!action || !adminEmail || !user) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    const db = admin.firestore();
    await db.collection("user_mngmnt_logs").add({
      action,
      admin: adminEmail,
      user,
      date: admin.firestore.Timestamp.now(),
      ip: req.ip || req.connection.remoteAddress || "unknown"
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error logging admin action:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
