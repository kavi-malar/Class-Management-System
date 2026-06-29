/**
 * ProjectorInventory Model — v3
 *
 * A SINGLE document that tracks the institution's projector pool.
 * Only one document exists (singleton pattern — upsert on seed).
 *
 * totalProjectors   : total projectors owned
 * availableProjectors: how many are currently free (not checked out)
 *
 * When CR checks out a projector → availableProjectors--
 *   AND RoomAllocation.projectorPresent = true for that room
 * When CR returns a projector   → availableProjectors++
 *   AND RoomAllocation.projectorPresent = false for that room
 */
const mongoose = require('mongoose');

const projectorInventorySchema = new mongoose.Schema({
  totalProjectors:     { type: Number, default: 10 },
  availableProjectors: { type: Number, default: 10 }
}, { timestamps: true });

module.exports = mongoose.model('ProjectorInventory', projectorInventorySchema);
