const admin = require('firebase-admin');
const crypto = require('crypto');

function generateRandomPassword(length = 12) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

const prefixMap = {
  "GMUe0Hd56WJ7U0HQ3qpa": "MAZSSR_", // Okręg Mazowiecki
  "hpAlqBYPhqCdlSJVc9RG": "TBGSSR_"    // Okręg Tarnobrzeg
};

/**
 * Find the highest number used for a given prefix in "users" collection
 */
async function getHighestNumberForPrefix(prefix) {
  const snapshot = await db
    .collection("users")
    .where("email", ">=", prefix)
    .where("email", "<", prefix + "\uf8ff") // range query for prefix
    .get();

  let highest = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.email) {
      const match = data.email.match(new RegExp(`^${prefix}(\\d+)@`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > highest) highest = num;
      }
    }
  });

  return highest;
}

async function createUsersWithPattern(
    count,
    appVersion,
    associationId,
    associationName
  ) {
    const db = admin.firestore();
    const domain = "ranger.pl";
    const enforcedPrefix = prefixMap[associationId] || "MAZSSR_";

    // find the last number already used
  let startNum = await getHighestNumberForPrefix(enforcedPrefix);
  console.log(`ℹ️ Highest existing number for ${enforcedPrefix} is ${startNum}`);

  for (let i = 1; i <= count; i++) {
    const nextNum = startNum + i;
    const email = `${enforcedPrefix}${String(nextNum).padStart(3, "0")}@${domain}`;

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
