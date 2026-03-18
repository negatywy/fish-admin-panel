const admin = require('firebase-admin');
const serviceAccount = require("./thefish.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

function deepInspect(obj, path = '') {
  const findings = [];
  
  if (!obj || typeof obj !== 'object') {
    return findings;
  }
  
  if (obj.constructor.name === 'DocumentReference') {
    findings.push({
      path: path,
      refPath: obj.path,
      type: 'DocumentReference'
    });
    return findings;
  }
  
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      findings.push(...deepInspect(item, `${path}[${idx}]`));
    });
  } else {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      findings.push(...deepInspect(value, newPath));
    }
  }
  
  return findings;
}

async function deepInspectDocuments() {
  console.log('🔍 Deep inspection for nested references...\n');
  
  const ids = ['GMUe0Hd56WJ7U0HQ3qpa', 'hpAlqBYPhqCdlSJVc9RG'];
  
  for (const id of ids) {
    const doc = await db.collection('associations').doc(id).get();
    const data = doc.data();
    
    console.log(`\n📄 Document: ${id}`);
    const refs = deepInspect(data);
    
    if (refs.length > 0) {
      console.log(`   ⚠️ Found ${refs.length} nested reference(s):`);
      refs.forEach(ref => {
        console.log(`      ${ref.path} -> ${ref.refPath}`);
      });
    } else {
      console.log('   ✓ No nested references found');
    }
  }
  
  process.exit(0);
}

deepInspectDocuments().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
