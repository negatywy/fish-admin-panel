const admin = require("firebase-admin");

async function deleteUsers(email) {
  try {
    const db = admin.firestore();
    const userRecord = await admin.auth().getUserByEmail(email);

    await admin.auth().deleteUser(userRecord.uid);
    await db.collection("users").doc(userRecord.uid).delete();

    return { success: true, email, message: "User deleted successfully" };
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      // User does not exist
      return { success: false, email, message: "User does not exist" };
    }
    console.error("Error deleting user:", err);
    return { success: false, email, message: err.message };
  }
}

module.exports = { deleteUsers };
