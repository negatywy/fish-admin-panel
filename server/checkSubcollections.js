const admin = require('firebase-admin');
const serviceAccount = require("./thefish.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkSubcollections() {
  console.log('🔍 Checking for subcollections in associations...\n');
  
  const ids = ['GMUe0Hd56WJ7U0HQ3qpa', 'hpAlqBYPhqCdlSJVc9RG'];
  
  for (const id of ids) {
    const docRef = db.collection('associations').doc(id);
    
    console.log(`\n📄 Document: associations/${id}`);
    
    // List all subcollections
    const subcollections = await docRef.listCollections();
    
    if (subcollections.length === 0) {
      console.log('   ✓ No subcollections found');
    } else {
      console.log(`   Found ${subcollections.length} subcollection(s):`);
      
      for (const subcol of subcollections) {
        console.log(`   📁 Subcollection: ${subcol.id}`);
        
        const subSnapshot = await subcol.limit(3).get();
        console.log(`      Documents: ${subSnapshot.size}`);
        
        // Check for references in subcollection documents
        subSnapshot.forEach(subDoc => {
          const data = subDoc.data();
          Object.entries(data).forEach(([key, value]) => {
            if (value && value.constructor && value.constructor.name === 'DocumentReference') {
              console.log(`      ⚠️  Doc ${subDoc.id}, field ${key} -> ${value.path}`);
            }
          });
        });
      }
    }
  }
  
  console.log('\n✅ Check complete');
  process.exit(0);
}

checkSubcollections().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
