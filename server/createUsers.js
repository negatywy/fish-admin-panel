const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');

var serviceAccount = require("./thefish.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

function generateRandomPassword(length = 12) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

const prefixMap = {
  "GMUe0Hd56WJ7U0HQ3qpa": "MAZSSR_", // Okręg Mazowiecki
  "hpAlqBYPhqCdlSJVc9RG": "TBGSSR_"  // Okręg Tarnobrzeg
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
      const email = `${enforcedPrefix}${emailId}@${domain}`.toLowerCase(); // Firebase Auth converts to lowercase

      // Check for duplicate in Firebase Auth first
      let authUser = null;
      try {
        authUser = await admin.auth().getUserByEmail(email);
      } catch (error) {
        // User doesn't exist in Auth, which is fine
        if (error.code !== 'auth/user-not-found') {
          console.error(`❌ Error checking Auth for ${email}:`, error);
          createdUsers.push({ email, error: error.message });
          continue;
        }
      }

      // check for duplicate in Firestore "users"
      const existingUser = await db
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      // If user exists in both Auth and Firestore, skip
      if (authUser && !existingUser.empty) {
        console.warn(`⚠️ Skipping duplicate (Auth + Firestore): ${email}`);
        createdUsers.push({ email, skipped: true });
        continue;
      }

      // If user exists in Auth but NOT in Firestore, create Firestore doc
      if (authUser && existingUser.empty) {
        console.log(`🔧 Repairing: ${email} exists in Auth but not Firestore, creating Firestore doc...`);
        try {
          const userData = {
            app_version: appVersion,
            association_id: db.doc(`/associations/${associationId}`),
            association_name: associationName,
            created_time: admin.firestore.Timestamp.now(),
            email,
            roles: ["ranger"],
            uid: authUser.uid,
          };

          await db.collection("users").doc(authUser.uid).set(userData);
          
          // Note: we can't retrieve the password for existing Auth users
          console.log(`✅ Firestore doc created for existing Auth user: ${email}`);
          createdUsers.push({ email, password: "[existing user - password not available]", uid: authUser.uid, repaired: true });
          continue;
        } catch (error) {
          console.error(`❌ Error creating Firestore doc for ${email}:`, error);
          createdUsers.push({ email, error: error.message });
          continue;
        }
      }

      // If user exists in Firestore but NOT in Auth (shouldn't happen, but handle it)
      if (!authUser && !existingUser.empty) {
        console.warn(`⚠️ Skipping: ${email} exists in Firestore but not Auth (orphaned document)`);
        createdUsers.push({ email, skipped: true });
        continue;
      }

      // User doesn't exist in either, create new
      const password = generateRandomPassword();

      try {
        console.log(`📝 Creating new user: ${email}`);
        
        // create Firebase Auth user
        const userRecord = await admin.auth().createUser({
          email,
          password,
        });
        console.log(`✓ Auth user created: ${email} with UID: ${userRecord.uid}`);

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

        console.log(`✓ Writing to Firestore: users/${userRecord.uid}`);
        await db.collection("users").doc(userRecord.uid).set(userData);
        console.log(`✓ Firestore write complete for: ${email}`);

        const createdUser = { email, password, uid: userRecord.uid };
        console.log(`✅ User created successfully: ${email} with UID: ${userRecord.uid}`);
        createdUsers.push(createdUser);
      } catch (error) {
        console.error(`❌ Error creating user ${email}:`, error);
        console.error(`❌ Error details:`, error.code, error.message);
        createdUsers.push({ email, error: error.message });
      }
    }

    return createdUsers;
}

module.exports = { createUsersWithPattern };
