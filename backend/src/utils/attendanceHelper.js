const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const { getRedisClient } = require('../config/redis');

const ATTENDANCE_STATUS_PRIORITY = {
  present: 3,
  late: 2,
  absent: 1
};

async function getStudentAttendanceStats(studentId, term, session) {
  const cacheKey = `attendance:stats:${session}:${term}:${studentId}`;

  try {
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn(`[REDIS] Error reading cache for ${cacheKey}. Falling back to DB.`, err.message);
  }

  const priorityBranches = Object.keys(ATTENDANCE_STATUS_PRIORITY).map(key => ({
    case: { $eq: ['$records.status', key] },
    then: ATTENDANCE_STATUS_PRIORITY[key]
  }));

  const stats = await Attendance.aggregate([
    { $match: { term, session, 'records.studentId': new mongoose.Types.ObjectId(studentId) } },
    
    // Filter array BEFORE unwind to eliminate class-size multiplication penalty
    { $project: {
        date: 1,
        records: {
          $filter: {
            input: '$records',
            as: 'record',
            cond: { $eq: ['$$record.studentId', new mongoose.Types.ObjectId(studentId)] }
          }
        }
    }},
    { $unwind: '$records' },
    
    // Explicit priority mapping for deterministic status rules
    { $addFields: {
        statusPriority: {
          $switch: {
            branches: priorityBranches,
            default: 0
          }
        }
    }},
    
    // Sort to ensure $first captures the highest priority status string
    { $sort: { statusPriority: -1 } },
    
    // Group by date, extracting the highest numeric priority and its status
    { $group: {
        _id: '$date',
        bestStatus: { $first: '$records.status' },
        bestPriority: { $first: '$statusPriority' }
    }},
    
    // Calculate final totals based on resolved status
    { $group: {
        _id: null,
        presentDays: { $sum: { $cond: [ { $eq: ['$bestStatus', 'present'] }, 1, 0 ] } },
        lateDays: { $sum: { $cond: [ { $eq: ['$bestStatus', 'late'] }, 1, 0 ] } },
        absentDays: { $sum: { $cond: [ { $eq: ['$bestStatus', 'absent'] }, 1, 0 ] } },
        unknownDays: { $sum: { $cond: [ { $eq: ['$bestPriority', 0] }, 1, 0 ] } }
    }}
  ]);

  const presentDays = stats.length > 0 ? stats[0].presentDays : 0;
  const lateDays = stats.length > 0 ? stats[0].lateDays : 0;
  const absentDays = stats.length > 0 ? stats[0].absentDays : 0;
  const unknownDays = stats.length > 0 ? stats[0].unknownDays : 0;
  
  if (unknownDays > 0) {
    console.warn(JSON.stringify({
      event: 'ATTENDANCE_UNKNOWN_STATUS_DETECTED',
      studentId: studentId.toString(),
      term,
      session,
      count: unknownDays
    }));
  }

  // Calculate percentage only from explicitly classified days
  const validDays = presentDays + lateDays + absentDays;
  const percentage = validDays > 0 ? Number((((presentDays + lateDays) / validDays) * 100).toFixed(1)) : 0;

  const result = {
    presentDays,
    absentDays,
    lateDays,
    unknownDays,
    validDays,
    attendancePercentage: percentage
  };

  try {
    // Save to cache with 24h TTL asynchronously
    const redis = getRedisClient();
    redis.set(cacheKey, JSON.stringify(result), 'EX', 86400).catch(err => {
      console.warn(`[REDIS] Error saving cache for ${cacheKey}.`, err.message);
    });
  } catch (err) {
    // Ignore synchronous errors
  }

  return result;
}

module.exports = { getStudentAttendanceStats };
