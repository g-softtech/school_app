const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'schoolDB',
    });

    console.log('✅  MongoDB connected: ' + conn.connection.host);
    console.log('✅  Database: ' + conn.connection.name);

    mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => console.log('✅  MongoDB reconnected'));
  } catch (error) {
    console.error('❌  MongoDB connection error: ' + error.message);
    process.exit(1);
  }
};

module.exports = connectDB;