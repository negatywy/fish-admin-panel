const admin = require('firebase-admin');
const serviceAccount = require('./thefish.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

(async () => {
  try {
    console.log('Checking database updates...\n');
    
    // Check users
    const usersSnapshot = await db.collection('users').limit(3).get();
    console.log('Sample users:');
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.association_id) {
        console.log(`  ${data.email} -> ${data.association_id.path}`);
      }
    });
    
    console.log('\nScript still running with PID 16480? This might indicate an issue.');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
