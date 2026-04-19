// Lives at: backend/src/utils/generateAdmissionNumber.js
// Generates a unique admission number in the format: SS/2026/0001

const Student = require('../models/Student');

const generateAdmissionNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `SS/${year}/`;

  // Find the last student created this year
  const lastStudent = await Student.findOne(
    { admissionNumber: { $regex: `^${prefix}` } },
    { admissionNumber: 1 },
    { sort: { admissionNumber: -1 } }
  );

  let nextNumber = 1;

  if (lastStudent) {
    // Extract the sequence number from the end of the admission number
    const parts = lastStudent.admissionNumber.split('/');
    const lastSeq = parseInt(parts[2], 10);
    nextNumber = lastSeq + 1;
  }

  // Pad to 4 digits: 0001, 0002 ... 9999
  const padded = String(nextNumber).padStart(4, '0');
  return `${prefix}${padded}`;
};

module.exports = generateAdmissionNumber;