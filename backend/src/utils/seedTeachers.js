require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const connectDB = require('../../config/db');
const User    = require('../models/User');
const Subject = require('../models/Subject');
const Class   = require('../models/Class');

const seed = async () => {
  await connectDB();
  console.log('\n🌱  Seeding teachers...\n');

  const teacherData = [
    { name: 'Mr Emeka Nwosu',    email: 'teacher1@smartschool.com', password: 'Teacher1234!', subjectCodes: ['MATH01', 'MATH04'] },
    { name: 'Mrs Ngozi Okafor',  email: 'teacher2@smartschool.com', password: 'Teacher1234!', subjectCodes: ['ENG01',  'ENG04']  },
    { name: 'Mr Bello Yusuf',    email: 'teacher3@smartschool.com', password: 'Teacher1234!', subjectCodes: ['BSC01',  'BIO04']  },
    { name: 'Mrs Amaka Eze',     email: 'teacher4@smartschool.com', password: 'Teacher1234!', subjectCodes: ['SST01',  'CHE04']  },
    { name: 'Mr Tunde Fashola',  email: 'teacher5@smartschool.com', password: 'Teacher1234!', subjectCodes: ['CIV01',  'PHY04']  },
  ];

  for (const t of teacherData) {
    // Create or find the User account
    let user = await User.findOne({ email: t.email });
    if (user) {
      console.log('⏭️   Teacher already exists:', user.email);
    } else {
      user = await User.create({
        name: t.name,
        email: t.email,
        password: t.password,
        role: 'teacher',
      });
      console.log('✅  Teacher created:', user.email);
    }

    // Assign teacher to their subjects
    for (const code of t.subjectCodes) {
      const subject = await Subject.findOneAndUpdate(
        { code },
        { teacherId: user._id },
        { new: true }
      );
      if (subject) {
        console.log('   📚 Assigned to subject:', subject.name, '(' + code + ')');
      } else {
        console.log('   ⚠️  Subject not found for code:', code);
      }
    }
  }

  // Assign class teachers to classes
  const teacher1 = await User.findOne({ email: 'teacher1@smartschool.com' });
  const teacher2 = await User.findOne({ email: 'teacher2@smartschool.com' });

  const jss1 = await Class.findOneAndUpdate(
    { name: 'JSS 1', section: 'A', academicYear: '2025/2026' },
    { classTeacherId: teacher1._id },
    { new: true }
  );
  if (jss1) console.log('\n✅  Class teacher set for JSS 1 A:', teacher1.name);

  const ss1 = await Class.findOneAndUpdate(
    { name: 'SS 1', section: 'A', academicYear: '2025/2026' },
    { classTeacherId: teacher2._id },
    { new: true }
  );
  if (ss1) console.log('✅  Class teacher set for SS 1 A:', teacher2.name);

  console.log('\n📊  Teacher seed complete. Credentials:\n');
  teacherData.forEach(function(t) {
    console.log('   ' + t.email + ' / Teacher1234!');
  });
  console.log('');

  process.exit(0);
};

seed().catch(function(err) {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});