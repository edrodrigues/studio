
import { db } from './src/lib/firebase-server';
import 'dotenv/config';

async function listProjects() {
  try {
    const projectsSnapshot = await db.collection('projects').get();
    if (projectsSnapshot.empty) {
      console.log('No projects found.');
      return;
    }

    console.log('Projects:');
    projectsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ID: ${doc.id}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Synced to File Search: ${data.isSyncedToFileSearch}`);
      console.log(`  File Search Store ID: ${data.fileSearchStoreId}`);
      console.log('---');
    });
  } catch (error) {
    console.error('Error listing projects:', error);
  }
}

listProjects();
