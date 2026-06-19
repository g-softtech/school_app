const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/school_db');
    console.log('Connected to DB');

    const adminDb = mongoose.connection.db.admin();
    
    // Check version
    const buildInfo = await adminDb.command({ buildInfo: 1 });
    console.log(`MongoDB Version: ${buildInfo.version}`);

    // Check replica set status
    try {
      const replSetStatus = await adminDb.command({ replSetGetStatus: 1 });
      console.log(`Replica Set Status: OK (Set Name: ${replSetStatus.set})`);
      console.log(`Transactions Supported: YES`);
    } catch (replError) {
      console.log(`Replica Set Status: NOT A REPLICA SET (${replError.message})`);
      console.log(`Transactions Supported: NO (MongoDB requires a replica set or sharded cluster for transactions)`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkMongo();
