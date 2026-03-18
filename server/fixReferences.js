const admin = require('firebase-admin');
const serviceAccount = require("./thefish.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Recursively finds and replaces all DocumentReference fields in an object
 * that point to the old database with references to the new database
 */
function fixReferences(data, newProjectId) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => fixReferences(item, newProjectId));
  }

  // Handle objects
  const fixed = {};
  for (const [key, value] of Object.entries(data)) {
    // Check if it's a DocumentReference
    if (value && typeof value === 'object' && value.constructor.name === 'DocumentReference') {
      // Extract the path (e.g., "associations/GMUe0Hd56WJ7U0HQ3qpa")
      const path = value.path;
      console.log(`   🔧 Fixing reference: ${key} -> ${path}`);
      // Create a new reference in the current (new) database
      fixed[key] = db.doc(path);
    } 
    // Recursively handle nested objects
    else if (value && typeof value === 'object' && !value.toDate) {
      fixed[key] = fixReferences(value, newProjectId);
    }
    // Keep other values as-is
    else {
      fixed[key] = value;
    }
  }
  return fixed;
}

/**
 * Fix references in a single collection
 */
async function fixCollection(collectionName) {
  console.log(`\n📂 Processing collection: ${collectionName}`);
  
  const snapshot = await db.collection(collectionName).get();
  console.log(`   Found ${snapshot.size} documents`);
  
  let updatedCount = 0;
  let skippedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Check if any field is a DocumentReference
    const hasReferences = Object.values(data).some(
      val => val && typeof val === 'object' && val.constructor.name === 'DocumentReference'
    );

    if (!hasReferences) {
      skippedCount++;
      continue;
    }

    console.log(`\n   📄 Updating document: ${doc.id}`);
    const fixedData = fixReferences(data, 'thefishranger-f971a');
    
    try {
      await db.collection(collectionName).doc(doc.id).set(fixedData);
      updatedCount++;
      console.log(`   ✅ Updated successfully`);
    } catch (error) {
      console.error(`   ❌ Error updating ${doc.id}:`, error.message);
    }
  }

  console.log(`\n✅ Collection ${collectionName} complete:`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
}

/**
 * Main function to fix all collections
 */
async function fixAllReferences() {
  console.log('🚀 Starting reference fix...\n');
  
  const collections = [
    'associations',
    'association_clubs',
    'fisheries',
    'users',
    'ssr_controls'
  ];

  for (const collectionName of collections) {
    try {
      await fixCollection(collectionName);
    } catch (error) {
      console.error(`❌ Error processing ${collectionName}:`, error.message);
    }
  }

  console.log('\n\n✅ All collections processed!');
  console.log('📝 Restart your app to see the changes.');
}

// Run the fix
fixAllReferences()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
