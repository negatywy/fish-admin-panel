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

async function createUsersWithPattern(basePattern, startNumber, endNumber, appVersion, associationId, associationName) {
  const domain = "ranger.pl";
  const createdUsers = []; 

  for (let i = startNumber; i <= endNumber; i++) {
    const emailId = String(i).padStart(4, '0');
    const email = `${basePattern}${emailId}@${domain}`;
    const password = generateRandomPassword();

    try {
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password
      });

      const userData = {
        app_version: appVersion,
        association_id: db.doc(`/associations/${associationId}`),
        association_name: associationName,
        created_time: admin.firestore.Timestamp.now(),
        email: email,
        roles: ["ranger"],
        uid: userRecord.uid
      };

      await db.collection('users').doc(userRecord.uid).set(userData);

      createdUsers.push({ email, password, uid: userRecord.uid });
      console.log(`User created: ${email} with UID: ${userRecord.uid}`);
    } catch (error) {
      console.error(`Error creating user ${email}:`, error);
    }
  }

  // Save users to CSV
//   try {
//     const csvContent = createdUsers.map(user => `${user.email},${user.password}`).join('\n');
//     const fileName = `created_users_${Date.now()}.csv`;
//     fs.writeFileSync(fileName, csvContent);
//     console.log(`Created users saved to ${fileName}`);
//   } catch (error) {
//     console.error('Error saving created users to CSV:', error);
//   }

  return createdUsers;
}

module.exports = { createUsersWithPattern };
