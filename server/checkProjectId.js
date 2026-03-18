const admin = require('firebase-admin');
const serviceAccount = require("./thefish.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkInternalProjectId() {
  console.log('🔍 Checking internal project ID in references...\n');
  console.log(`Expected project ID: ${serviceAccount.project_id}\n`);
  
  // Check one doc from each collection
  const checks = [
    { collection: 'users', field: 'association_id' },
    { collection: 'fisheries', field: 'association_id' },
    { collection: 'association_clubs', field: 'association' },
    { collection: 'ssr_controls', field: 'association_id' }
  ];
  
  for (const check of checks) {
    const snapshot = await db.collection(check.collection).limit(1).get();
    
    if (snapshot.empty) {
      console.log(`   ⚠️  ${check.collection}: No documents found`);
      continue;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    const ref = data[check.field];
    
    if (!ref) {
      console.log(`   ⚠️  ${check.collection}: No ${check.field} field`);
      continue;
    }
    
    console.log(`📂 ${check.collection} (doc: ${doc.id})`);
    console.log(`   Field: ${check.field}`);
    console.log(`   Path: ${ref.path}`);
    console.log(`   Firestore instance: ${ref.firestore._settings?.projectId || 'unknown'}`);
    console.log(`   Database ID: ${ref._path?.segments[0] || 'unknown'}`);
    console.log();
  }
  
  process.exit(0);
}

checkInternalProjectId().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
