const fs = require('fs');

const ctrlFile = 'src/modules/studentBill/studentBill.controller.js';
let ctrlContent = fs.readFileSync(ctrlFile, 'utf8');

const newLogic = `
    // BACKGROUND: Enqueue deterministic rebuild projection
    const { getRedisClient } = require('../../config/redis');
    const redis = getRedisClient();
    await redis.sadd('queue:bill_sync', bill._id.toString());
`;

ctrlContent = ctrlContent.replace(/\/\/ BACKGROUND: Trigger deterministic rebuild projection \(fire-and-forget\)[\s\S]*?\}\);/g, newLogic.trim());
fs.writeFileSync(ctrlFile, ctrlContent);

const serverFile = 'server.js';
let serverContent = fs.readFileSync(serverFile, 'utf8');

if (!serverContent.includes('syncWorker.start()')) {
  serverContent = serverContent.replace(/(app\.listen\([^\)]+\);)/, 
    "$1\n  require('./src/workers/syncWorker').start();"
  );
  fs.writeFileSync(serverFile, serverContent);
}

console.log('Success');
