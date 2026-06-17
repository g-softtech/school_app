const Attendance = require('../../models/Attendance');
const { getRedisClient } = require('../../config/redis');
const mongoose = require('mongoose');

// @desc    Get attendance for a specific class and date
// @route   GET /api/attendance
// @access  Private (Admin/Teacher)
exports.getAttendance = async (req, res) => {
  try {
    const { classId, date, term, session } = req.query;

    if (!classId || !date) {
      return res.status(400).json({ success: false, message: 'Class ID and date are required' });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ success: false, message: 'Invalid class ID' });
    }

    const queryTerm = term || (req.user && req.user.term);
    const querySession = session || (req.user && req.user.session);

    if (!queryTerm || !querySession) {
      return res.status(400).json({ success: false, message: 'Term and session are required' });
    }

    const queryDate = new Date(date);
    if (isNaN(queryDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }
    queryDate.setUTCHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      classId,
      date: queryDate,
      term: queryTerm,
      session: querySession
    }).populate('records.studentId', 'userId admissionNumber status');

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Save (upsert) attendance for a class
// @route   POST /api/attendance
// @access  Private (Admin/Teacher)
exports.saveAttendance = async (req, res) => {
  try {
    const { classId, date, term, session, records } = req.body;

    if (!classId || !date || !records || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ success: false, message: 'Invalid class ID' });
    }

    const queryTerm = term || (req.user && req.user.term);
    const querySession = session || (req.user && req.user.session);

    if (!queryTerm || !querySession) {
      return res.status(400).json({ success: false, message: 'Term and session are required' });
    }

    const queryDate = new Date(date);
    if (isNaN(queryDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }
    queryDate.setUTCHours(0, 0, 0, 0);

    // Validate records
    const studentIds = [];
    for (let r of records) {
      if (!r.studentId || !mongoose.Types.ObjectId.isValid(r.studentId)) {
        return res.status(400).json({ success: false, message: 'Invalid student ID in records' });
      }
      studentIds.push(r.studentId);
    }
    
    if (new Set(studentIds).size !== studentIds.length) {
      return res.status(400).json({ success: false, message: 'Duplicate student IDs found in records' });
    }

    let attendance = await Attendance.findOne({
      classId,
      date: queryDate,
      term: queryTerm,
      session: querySession
    });

    // Capture previous student IDs in case any were removed in this update
    const previousStudentIds = attendance ? attendance.records.map(r => r.studentId.toString()) : [];

    if (attendance) {
      // Update existing
      attendance.records = records;
      attendance.recordedBy = req.user._id; // record last modifier
      await attendance.save();
    } else {
      // Create new
      attendance = await Attendance.create({
        classId,
        date: queryDate,
        term: queryTerm,
        session: querySession,
        recordedBy: req.user._id,
        records
      });
    }

    // Cache Invalidation
    try {
      const redis = getRedisClient();
      // Invalidate both new studentIds and any previous ones that may have been removed
      const allIdsToInvalidate = new Set([
        ...studentIds.map(id => id.toString()),
        ...previousStudentIds
      ]);

      if (allIdsToInvalidate.size > 0) {
        const pipeline = redis.pipeline();
        allIdsToInvalidate.forEach(id => {
          pipeline.del(`attendance:stats:${querySession}:${queryTerm}:${id}`);
        });
        await pipeline.exec();
      }
    } catch (err) {
      console.warn('[REDIS] Failed to invalidate cache on attendance update:', err.message);
    }

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};
