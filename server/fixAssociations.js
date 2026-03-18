const admin = require('firebase-admin');
const serviceAccount = require("./thefish.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Recursively finds and replaces all DocumentReference fields
 */
function fixReferences(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => fixReferences(item));
  }

  const fixed = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && value.constructor.name === 'DocumentReference') {
      const path = value.path;
      console.log(`     🔧 Fixing reference: ${key} -> ${path}`);
      fixed[key] = db.doc(path);
    } 
    else if (value && typeof value === 'object' && !value.toDate) {
      fixed[key] = fixReferences(value);
    }
    else {
      fixed[key] = value;
    }
  }
  return fixed;
}

async function fixAssociationsCollection() {
  console.log('🚀 Fixing associations collection...\n');
  
  const snapshot = await db.collection('associations').get();
  console.log(`Found ${snapshot.size} documents\n`);
  
  for (const doc of snapshot.docs) {
    console.log(`📄 Processing: ${doc.id}`);
    const data = doc.data();
    
    // Check if any field is a DocumentReference
    const hasReferences = Object.entries(data).some(([key, val]) => {
      const isRef = val && typeof val === 'object' && val.constructor.name === 'DocumentReference';
      if (isRef) {
        console.log(`   Found reference in field: ${key}`);
      }
      return isRef;
    });

    if (!hasReferences) {
      console.log('   ✓ No references to fix\n');
      continue;
    }

    const fixedData = fixReferences(data);
    await db.collection('associations').doc(doc.id).set(fixedData);
    console.log('   ✅ Updated successfully\n');
  }

  console.log('✅ All associations fixed!');
  process.exit(0);
}

fixAssociationsCollection().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
