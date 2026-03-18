const admin = require('firebase-admin');
const serviceAccount = require("./thefish.json");
const fs = require('fs');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function exportRawData() {
  console.log('📥 Exporting raw data from associations...\n');
  
  const ids = ['GMUe0Hd56WJ7U0HQ3qpa', 'hpAlqBYPhqCdlSJVc9RG'];
  
  for (const id of ids) {
    const doc = await db.collection('associations').doc(id).get();
    
    // Get the raw data as returned by Firestore
    const data = doc.data();
    
    console.log(`\n📄 Document: ${id}`);
    console.log('================================');
    console.log(JSON.stringify(data, null, 2));
    console.log('================================\n');
    
    // Save to file for inspection
    fs.writeFileSync(`association_${id}_raw.json`, JSON.stringify(data, null, 2));
    console.log(`✓ Saved to association_${id}_raw.json`);
  }
  
  console.log('\n✅ Export complete');
  process.exit(0);
}

exportRawData().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
