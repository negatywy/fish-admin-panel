const express = require('express');
const bodyParser = require('body-parser');
const { createUsersWithPattern } = require('./createUsers');
const { deleteUsers } = require('./deleteUsers');

const app = express();
app.use(bodyParser.json());

const cors = require('cors');
app.use(cors());

app.post('/api/create-users', async (req, res) => {
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

app.post("/api/delete-user", async (req, res) => {
  const { email } = req.body;

  try {
    await deleteUsers(email);
    res.json({ success: true, email });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
