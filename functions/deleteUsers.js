const admin = require("firebase-admin");

async function deleteUsers(emails) {
  const results = [];

  for (const email of emails) {
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().deleteUser(userRecord.uid);
      await db.collection("users").doc(userRecord.uid).delete();

      results.push({ success: true, email });
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        results.push({ success: false, email, message: "User does not exist" });
      } else {
        console.error("Error deleting user:", err);
        results.push({ success: false, email, message: err.message });
      }
    }
  }

  return results; // 🔹 always an array
}

module.exports = { deleteUsers };
