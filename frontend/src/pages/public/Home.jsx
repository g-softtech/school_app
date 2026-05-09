import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiArrowRight, FiAward, FiBook, FiUsers, FiBarChart2, FiCheckCircle, FiCpu, FiMessageSquare, FiCreditCard, FiStar } from 'react-icons/fi';

// African education images via Unsplash (free, no auth needed)
const IMG = {
  hero:      'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1400&q=80', // African students in class
  about:     'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80',  // Teacher at board
  students:  'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&q=80',  // Students studying
  campus:    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',  // School building
};

const DEFAULT_STATS = [
  { value: '2,500+', label: 'Students Enrolled'   },
  { value: '120+',   label: 'Qualified Teachers'  },
  { value: '98%',    label: 'Pass Rate (2024)'    },
  { value: '15+',    label: 'Years of Excellence' },
];

const FEATURES = [
  { icon: FiBarChart2,    title: 'Smart Analytics',      desc: 'Real-time performance tracking and insights for every student, class, and subject.' },
  { icon: FiBook,         title: 'Digital Learning',     desc: 'Lesson notes, assignments and resources accessible anytime, anywhere.' },
  { icon: FiCpu,          title: 'AI-Powered Tools',     desc: 'AI lesson generators and smart assistants to support teachers and students.' },
  { icon: FiMessageSquare,title: 'Seamless Communication',desc: 'Instant messaging between teachers, students and parents in one place.' },
  { icon: FiCreditCard,   title: 'Cashless Payments',    desc: 'Secure fee payments via Paystack with instant receipts and tracking.' },
  { icon: FiAward,        title: 'Result Management',    desc: 'Automated grading, result slips, and shareable academic reports.' },
];

const TESTIMONIALS = [
  {
    name: 'Mrs. Adaeze Okonkwo',
    role: 'Parent — JSS 2 Student',
    text: "Since our school adopted SmartSchool, I can track my daughter's results and pay fees from my phone. It's been life-changing for our family.",
    avatar: 'AO',
  },
  {
    name: 'Mr. Emeka Nwosu',
    role: 'Mathematics Teacher',
    text: 'The AI lesson generator saves me hours every week. I now focus on teaching while the system handles documentation and grading.',
    avatar: 'EN',
  },
  {
    name: 'Chidi Okafor',
    role: 'SS3 Student',
    text: 'I can see my results, download lesson notes, and chat with my teacher all in one place. Best school system ever!',
    avatar: 'CO',
  },
];

function SectionLabel({ children }) {
  return (
    <span className="inline-block bg-primary-500/10 text-primary-600 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
      {children}
    </span>
  );
}

export default function Home() {
  const [stats, setStats] = useState(DEFAULT_STATS);

  useEffect(() => {
    api.get('/contact/stats')
      .then((res) => {
        const d = res.data.data;
        if (d) {
          setStats([
            { value: d.students > 0 ? `${d.students.toLocaleString()}+` : '2,500+', label: 'Students Enrolled'   },
            { value: d.teachers > 0 ? `${d.teachers}+`                 : '120+',   label: 'Qualified Teachers'  },
            { value: d.passRate  > 0 ? `${d.passRate}%`                : '98%',    label: 'Pass Rate'           },
            { value: `${d.yearsOfExcellence}+`,                                    label: 'Years of Excellence' },
          ]);
        }
      })
      .catch(() => {}); // silently use defaults if API fails
  }, []);

  return (
    <div className="pt-16 lg:pt-20">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* BG image */}
        <div className="absolute inset-0">
          <img src={IMG.hero} alt="Students in classroom" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary-900/92 via-secondary-900/75 to-secondary-900/30" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary-500/20 border border-primary-500/30 text-primary-300 text-xs font-semibold px-4 py-2 rounded-full mb-6">
              <span className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" />
              2026 Smart School Platform
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Shaping Africa's
              <span className="text-primary-400 block">Educational Future</span>
            </h1>
            <p className="text-lg text-secondary-300 leading-relaxed mb-8 max-w-xl">
              A complete digital school ecosystem — managing academics, communication, payments and learning in one powerful platform built for African schools.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/admissions" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-400 text-white font-semibold px-7 py-3.5 rounded-xl transition-all duration-200 shadow-xl hover:shadow-primary-500/30 text-sm">
                Apply for Admission <FiArrowRight size={16} />
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-7 py-3.5 rounded-xl border border-white/20 transition-all duration-200 text-sm backdrop-blur-sm">
                Access Portal <FiArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 60L1440 60L1440 20C1200 60 960 0 720 20C480 40 240 0 0 20L0 60Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────── */}
      <section className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center p-6 rounded-2xl border border-secondary-100 hover:border-primary-200 hover:shadow-card-md transition-all duration-300">
                <p className="text-3xl lg:text-4xl font-bold text-primary-500 mb-1">{s.value}</p>
                <p className="text-sm text-secondary-500 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT SNIPPET ────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div className="relative">
              <img
                src={IMG.about}
                alt="Teacher in classroom"
                className="w-full rounded-3xl object-cover shadow-card-lg"
                style={{ height: '460px' }}
              />
              {/* Floating badge */}
              <div className="absolute -bottom-5 -right-5 bg-primary-500 text-white px-6 py-4 rounded-2xl shadow-xl text-center hidden sm:block">
                <p className="text-2xl font-bold">15+</p>
                <p className="text-xs font-medium opacity-90">Years of Excellence</p>
              </div>
            </div>
            <div>
              <SectionLabel>About Our School</SectionLabel>
              <h2 className="text-3xl lg:text-4xl font-bold text-secondary-800 leading-tight mb-5">
                Nurturing Excellence in Every Student
              </h2>
              <p className="text-secondary-600 leading-relaxed mb-5">
                Founded on the principles of academic excellence, character development, and technological innovation, SmartSchool has been at the forefront of quality education across Africa for over 15 years.
              </p>
              <p className="text-secondary-600 leading-relaxed mb-8">
                We combine world-class curriculum with cutting-edge digital tools to create an environment where every student can thrive — academically, socially, and personally.
              </p>
              <ul className="space-y-3 mb-8">
                {['WAEC & NECO Accredited','AI-powered learning support','Experienced, qualified teachers','Safe and inclusive environment'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-secondary-700 text-sm">
                    <FiCheckCircle className="text-primary-500 flex-shrink-0" size={16} />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to="/about" className="inline-flex items-center gap-2 bg-secondary-800 hover:bg-secondary-700 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 text-sm">
                Learn More About Us <FiArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section className="py-20 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <SectionLabel>Platform Features</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-bold text-secondary-800 mb-4">
              Everything a Modern School Needs
            </h2>
            <p className="text-secondary-500 max-w-xl mx-auto">
              One platform that handles every aspect of school management — from admissions to results, payments to communication.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-secondary-100 hover:border-primary-200 hover:shadow-card-md transition-all duration-300 group">
                <div className="w-12 h-12 bg-primary-50 group-hover:bg-primary-500 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300">
                  <f.icon size={22} className="text-primary-500 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="font-bold text-secondary-800 mb-2">{f.title}</h3>
                <p className="text-sm text-secondary-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STUDENTS PHOTO STRIP ─────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <SectionLabel>Student Life</SectionLabel>
              <h2 className="text-3xl lg:text-4xl font-bold text-secondary-800 leading-tight mb-5">
                A Thriving Community of Learners
              </h2>
              <p className="text-secondary-600 leading-relaxed mb-5">
                Our students don't just learn — they grow into confident, curious, and capable leaders. With access to digital tools and dedicated teachers, every day is an opportunity to excel.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { num: '40+', label: 'Subjects Offered' },
                  { num: '100%', label: 'Digital Result Access' },
                  { num: '3', label: 'Academic Terms' },
                  { num: '24/7', label: 'Portal Access' },
                ].map((s) => (
                  <div key={s.label} className="bg-surface rounded-2xl p-4 border border-secondary-100">
                    <p className="text-2xl font-bold text-primary-500">{s.num}</p>
                    <p className="text-xs text-secondary-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <Link to="/academics" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-500 font-semibold text-sm transition-colors">
                Explore Academics <FiArrowRight size={15} />
              </Link>
            </div>
            <div className="relative">
              <img
                src={IMG.students}
                alt="Students studying"
                className="w-full rounded-3xl object-cover shadow-card-lg"
                style={{ height: '420px' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      <section className="py-20 bg-secondary-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <SectionLabel>Testimonials</SectionLabel>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              What Our Community Says
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-secondary-800 rounded-2xl p-6 border border-secondary-700 hover:border-primary-500/40 transition-all duration-300">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <FiStar key={i} size={14} className="text-primary-400 fill-primary-400" />)}
                </div>
                <p className="text-secondary-300 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t.name}</p>
                    <p className="text-secondary-400 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────── */}
      <section className="py-20 bg-primary-500 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-5">
            Ready to Join SmartSchool?
          </h2>
          <p className="text-white/80 mb-8 text-lg">
            Apply now for the 2025/2026 academic session or log in to your portal to continue your journey.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/admissions" className="inline-flex items-center gap-2 bg-white text-primary-600 hover:bg-secondary-50 font-bold px-8 py-4 rounded-xl transition-all duration-200 shadow-xl text-sm">
              Apply for Admission <FiArrowRight size={16} />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 bg-secondary-900/30 hover:bg-secondary-900/50 text-white font-bold px-8 py-4 rounded-xl border border-white/30 transition-all duration-200 text-sm backdrop-blur-sm">
              Access Your Portal <FiArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
