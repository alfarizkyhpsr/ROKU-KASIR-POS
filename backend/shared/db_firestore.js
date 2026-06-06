const { Firestore } = require('@google-cloud/firestore');

let fsInstance = null;

function ambilFirestore() {
  if (!fsInstance) {
    fsInstance = new Firestore({
      projectId: process.env.FIRESTORE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
      databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
    });
  }
  return fsInstance;
}

module.exports = { ambilFirestore };
