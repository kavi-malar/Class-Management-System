/**
 * activateAllClasses.js
 * ---------------------
 * Run this ONCE to mark every class as isActive: true.
 *
 * Usage:
 *   node backend/utils/activateAllClasses.js
 */

const path     = require('path');
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ClassSection = require('../models/ClassSection');

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/class_management_db';
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');

  const result = await ClassSection.updateMany({}, { isActive: true });
  console.log(`✅ Activated ${result.modifiedCount} class(es) (${result.matchedCount} total in DB)`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error('❌ Error:', err); process.exit(1); });
