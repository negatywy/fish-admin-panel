const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// Utility to generate a random password
function generatePassword(length = 12) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

// Callable function to create a new user
exports.createUserAccount = functions.https.onCall(async (data, context) => {
  const { email, displayName } = data;

  if (!email || !displayName) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Email and display name are required."
    );
  }

  const password = generatePassword(12);

  try {
    // Create user using Firebase Admin SDK
    const userRecord = await auth.createUser({
      email: email.includes("@") ? email : `${email}@ranger.pl`,
      password,
      displayName,
    });

    // Store additional user info in Firestore
    await db.collection("users").doc(userRecord.uid).set({
      app_version: "1.0.0",
      created_time: admin.firestore.FieldValue.serverTimestamp(),
      roles: ["ranger"],
      email: userRecord.email,
      display_name: userRecord.displayName,
    });

    return { message: "Użytkownik został dodany.", password };
  } catch (err) {
    throw new functions.https.HttpsError("internal", err.message);
  }
});
