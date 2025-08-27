const express = require('express');
const bodyParser = require('body-parser');
const { createUsersWithPattern } = require('./createUsers');
const { deleteUsers } = require('./deleteUsers');

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

app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
