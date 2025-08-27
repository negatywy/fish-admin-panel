const admin = require('firebase-admin');
const crypto = require('crypto');
function generateRandomPassword(length = 12) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

const prefixMap = {
  "GMUe0Hd56WJ7U0HQ3qpa": "MAZSSR_", // Okręg Mazowiecki
  "hpAlqBYPhqCdlSJVc9RG": "TBGA_"    // Okręg Tarnobrzeg
};

async function createUsersWithPattern(
    basePattern,
    emailIds,
    appVersion,
    associationId,
    associationName
  ) {
    const db = admin.firestore();
    const domain = "ranger.pl";
    const createdUsers = [];

    const enforcedPrefix = prefixMap[associationId] || "TEST_";

    for (const emailId of emailIds) {
      const email = `${enforcedPrefix}${emailId}@${domain}`;

      // check for duplicate in Firestore "users"
      const existingUser = await db
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (!existingUser.empty) {
        console.warn(`⚠️ Skipping duplicate: ${email}`);
        createdUsers.push({ email, skipped: true });
        continue;
      }

      const password = generateRandomPassword();

      try {
        // create Firebase Auth user
        const userRecord = await admin.auth().createUser({
          email,
          password,
        });

        // prepare Firestore user data
        const userData = {
          app_version: appVersion,
          association_id: db.doc(`/associations/${associationId}`),
          association_name: associationName,
          created_time: admin.firestore.Timestamp.now(),
          email,
          roles: ["ranger"],
          uid: userRecord.uid,
        };

        await db.collection("users").doc(userRecord.uid).set(userData);

        const createdUser = { email, password, uid: userRecord.uid };
        console.log(`✅ User created: ${email} with UID: ${userRecord.uid}`);
        createdUsers.push(createdUser);
      } catch (error) {
        console.error(`❌ Error creating user ${email}:`, error);
        createdUsers.push({ email, error: error.message });
      }
    }

    return createdUsers;
}

module.exports = { createUsersWithPattern };
