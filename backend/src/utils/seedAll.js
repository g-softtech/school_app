require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../../config/db');
const User = require('../models/User');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');

const seed = async () => {
  await connectDB();
  console.log('\n🌱  Starting seed...\n');

  // ── 1. ADMIN ────────────────────────────────────────────────────────────────
  let admin = await User.findOne({ role: 'admin' });
  if (admin) {
    console.log('⏭️   Admin already exists:', admin.email);
  } else {
    admin = await User.create({
      name: 'School Admin',
      email: 'admin@smartschool.com',
      password: 'Admin1234!',
      role: 'admin',
    });
    console.log('✅  Admin created:', admin.email);
  }

  // ── 2. PARENTS ──────────────────────────────────────────────────────────────
  const parentData = [
    { name: 'Mr Chukwu Emmanuel',  email: 'parent1@smartschool.com', password: 'Parent1234!' },
    { name: 'Mrs Aisha Bello',     email: 'parent2@smartschool.com', password: 'Parent1234!' },
    { name: 'Mr Adebayo Tunde',    email: 'parent3@smartschool.com', password: 'Parent1234!' },
  ];

  const parents = [];
  for (const p of parentData) {
    let existing = await User.findOne({ email: p.email });
    if (existing) {
      console.log('⏭️   Parent already exists:', existing.email);
      parents.push(existing);
    } else {
      const created = await User.create({ ...p, role: 'parent' });
      parents.push(created);
      console.log('✅  Parent created:', created.email);
    }
  }

  // ── 3. CLASSES ──────────────────────────────────────────────────────────────
  const classData = [
    { name: 'JSS 1', section: 'A', academicYear: '2025/2026' },
    { name: 'JSS 2', section: 'A', academicYear: '2025/2026' },
    { name: 'JSS 3', section: 'A', academicYear: '2025/2026' },
    { name: 'SS 1',  section: 'A', academicYear: '2025/2026' },
    { name: 'SS 2',  section: 'A', academicYear: '2025/2026' },
    { name: 'SS 3',  section: 'A', academicYear: '2025/2026' },
  ];

  const classes = [];
  for (const c of classData) {
    let existing = await Class.findOne({ name: c.name, section: c.section, academicYear: c.academicYear });
    if (existing) {
      console.log('⏭️   Class already exists:', existing.name, existing.section);
      classes.push(existing);
    } else {
      const created = await Class.create(c);
      classes.push(created);
      console.log('✅  Class created:', created.name, created.section);
    }
  }

  // ── 4. SUBJECTS (linked to JSS 1 A as example) ──────────────────────────────
  const jss1 = classes[0];
  const ss1  = classes[3];

  const subjectData = [
    { name: 'Mathematics',       code: 'MATH01', classId: jss1._id },
    { name: 'English Language',  code: 'ENG01',  classId: jss1._id },
    { name: 'Basic Science',     code: 'BSC01',  classId: jss1._id },
    { name: 'Social Studies',    code: 'SST01',  classId: jss1._id },
    { name: 'Civic Education',   code: 'CIV01',  classId: jss1._id },
    { name: 'Mathematics',       code: 'MATH04', classId: ss1._id  },
    { name: 'English Language',  code: 'ENG04',  classId: ss1._id  },
    { name: 'Biology',           code: 'BIO04',  classId: ss1._id  },
    { name: 'Chemistry',         code: 'CHE04',  classId: ss1._id  },
    { name: 'Physics',           code: 'PHY04',  classId: ss1._id  },
  ];

  const subjects = [];
  for (const s of subjectData) {
    let existing = await Subject.findOne({ code: s.code });
    if (existing) {
      console.log('⏭️   Subject already exists:', existing.name, '(' + existing.code + ')');
      subjects.push(existing);
    } else {
      const created = await Subject.create(s);
      subjects.push(created);
      console.log('✅  Subject created:', created.name, '(' + created.code + ')');
    }
  }

  // ── 5. STUDENTS ─────────────────────────────────────────────────────────────
  const studentData = [
    { name: 'Emeka Chukwu',    email: 'emeka@smartschool.com',    password: 'Student1234!', gender: 'male',   dob: '2010-03-15', classId: jss1._id, parentIndex: 0 },
    { name: 'Amaka Chukwu',    email: 'amaka@smartschool.com',    password: 'Student1234!', gender: 'female', dob: '2011-07-22', classId: jss1._id, parentIndex: 0 },
    { name: 'Fatima Bello',    email: 'fatima@smartschool.com',   password: 'Student1234!', gender: 'female', dob: '2010-11-05', classId: jss1._id, parentIndex: 1 },
    { name: 'Yusuf Bello',     email: 'yusuf@smartschool.com',    password: 'Student1234!', gender: 'male',   dob: '2009-01-18', classId: jss1._id, parentIndex: 1 },
    { name: 'Tunde Adebayo',   email: 'tunde@smartschool.com',    password: 'Student1234!', gender: 'male',   dob: '2008-06-30', classId: ss1._id,  parentIndex: 2 },
    { name: 'Ngozi Okonkwo',   email: 'ngozi@smartschool.com',    password: 'Student1234!', gender: 'female', dob: '2008-09-14', classId: ss1._id,  parentIndex: 2 },
  ];

  // Get the last admission number to continue the sequence
  const year = new Date().getFullYear();
  const prefix = 'SS/' + year + '/';
  const lastStudent = await Student.findOne(
    { admissionNumber: { $regex: '^' + prefix } },
    { admissionNumber: 1 },
    { sort: { admissionNumber: -1 } }
  );
  let nextSeq = lastStudent ? parseInt(lastStudent.admissionNumber.split('/')[2], 10) + 1 : 1;

  for (const s of studentData) {
    const existingUser = await User.findOne({ email: s.email });
    if (existingUser) {
      console.log('⏭️   Student already exists:', s.email);
      continue;
    }

    const user = await User.create({
      name: s.name,
      email: s.email,
      password: s.password,
      role: 'student',
    });

    const admissionNumber = prefix + String(nextSeq).padStart(4, '0');
    nextSeq++;

    await Student.create({
      userId: user._id,
      admissionNumber,
      gender: s.gender,
      dateOfBirth: new Date(s.dob),
      classId: s.classId,
      parentId: parents[s.parentIndex]._id,
    });

    console.log('✅  Student created:', s.name, '|', admissionNumber);
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log('\n📊  Seed complete. Summary:');
  console.log('   Admin:    admin@smartschool.com     / Admin1234!');
  console.log('   Parents:  parent1@smartschool.com  / Parent1234!');
  console.log('             parent2@smartschool.com  / Parent1234!');
  console.log('             parent3@smartschool.com  / Parent1234!');
  console.log('   Students: emeka@smartschool.com    / Student1234!');
  console.log('             amaka@smartschool.com    / Student1234!');
  console.log('             fatima@smartschool.com   / Student1234!');
  console.log('             yusuf@smartschool.com    / Student1234!');
  console.log('             tunde@smartschool.com    / Student1234!');
  console.log('             ngozi@smartschool.com    / Student1234!');
  console.log('   Classes:  JSS 1A, JSS 2A, JSS 3A, SS 1A, SS 2A, SS 3A');
  console.log('   Subjects: 5 for JSS 1A, 5 for SS 1A\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});