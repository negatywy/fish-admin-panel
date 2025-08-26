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

async function createUsersWithPattern(basePattern, emailId, appVersion, associationId, associationName) {
    const domain = "ranger.pl";
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

        createdUser = { email, password, uid: userRecord.uid };
        console.log(`User created: ${email} with UID: ${userRecord.uid}`);
        return createdUser;
    } catch (error) {
        console.error(`Error creating user ${email}:`, error);
        throw error;
    }
  }

module.exports = { createUsersWithPattern };
