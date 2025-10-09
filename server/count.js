import admin from "firebase-admin";
import fs from "fs";

// Wczytanie pliku JSON z kluczem serwisowym
const serviceAccount = JSON.parse(fs.readFileSync("./thefish.json", "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function countUniqueAssociations(searchTerm = "Rzeka Odra") {
  const snapshot = await db
    .collection("fishings")
    .where("fishery_name", "==", searchTerm)
    .get();

  const unique = new Set();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.association_name) unique.add(data.association_name);
  });

  console.log("Liczba różnych association_name:", unique.size);
  console.log("Okręgi, gdzie występuje nazwa", searchTerm, ":", unique);
}

countUniqueAssociations();
