const admin = require('firebase-admin');
const serviceAccount = require("./thefish.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function findReferences() {
  console.log('🔍 Searching for documents with references to associations...\n');
  
  const collections = ['users', 'fisheries', 'association_clubs', 'ssr_controls'];
  
  for (const collectionName of collections) {
    console.log(`\n📂 Checking ${collectionName}...`);
    
    const snapshot = await db.collection(collectionName).limit(5).get();
    
    let foundRefs = false;
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Check for association_id field
      if (data.association_id) {
        const type = data.association_id.constructor.name;
        if (type === 'DocumentReference') {
          console.log(`   Doc ${doc.id}: association_id -> ${data.association_id.path}`);
          foundRefs = true;
        }
      }
      
      // Check for other reference fields
      Object.entries(data).forEach(([key, value]) => {
        if (value && value.constructor && value.constructor.name === 'DocumentReference') {
          if (key !== 'association_id') {
            console.log(`   Doc ${doc.id}: ${key} -> ${value.path}`);
            foundRefs = true;
          }
        }
      });
    });
    
    if (!foundRefs) {
      console.log('   ✓ No references in first 5 docs');
    }
  }
  
  console.log('\n✅ Search complete');
  process.exit(0);
}

findReferences().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
