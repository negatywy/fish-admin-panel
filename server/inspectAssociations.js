const admin = require('firebase-admin');
const serviceAccount = require("./thefish.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function inspectDocuments() {
  console.log('🔍 Inspecting specific association documents...\n');
  
  const ids = ['GMUe0Hd56WJ7U0HQ3qpa', 'hpAlqBYPhqCdlSJVc9RG'];
  
  for (const id of ids) {
    const doc = await db.collection('associations').doc(id).get();
    const data = doc.data();
    
    console.log(`\n📄 Document: ${id}`);
    console.log('Fields:', Object.keys(data));
    
    // Check each field
    for (const [key, value] of Object.entries(data)) {
      const type = value?.constructor?.name || typeof value;
      console.log(`  ${key}: ${type}`);
      
      if (type === 'DocumentReference') {
        console.log(`    ⚠️ Reference: ${value.path}`);
        console.log(`    Project ID in ref:`, value._path?.segments || 'unknown');
      }
    }
  }
  
  process.exit(0);
}

inspectDocuments().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
