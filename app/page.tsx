"use client";

import Image from 'next/image';
import Link from 'next/link';
import WinnerTicker from './components/WinnerTicker';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-hidden relative font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('/bg-pattern.png')] bg-repeat opacity-5 animate-pulse"></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#D4AF37] rounded-full blur-[150px] opacity-20 animate-pulse delay-700"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#FFD700] rounded-full blur-[150px] opacity-10 animate-pulse"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center px-4 md:px-8 py-6 border-b border-[#D4AF37]/10 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-2 md:gap-4">
          <Image src="/logo.png" alt="HBET Logo" width={40} height={40} className="object-contain md:w-[50px] md:h-[50px]" />
          <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-[#FFD700] to-[#D4AF37] bg-clip-text text-transparent italic tracking-tighter">
            HBET
          </h1>
        </div>
        <div className="flex gap-2 md:gap-4">
          {user ? (
            <Link href="/dashboard" className="px-6 md:px-8 py-2 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black text-xs md:text-sm rounded-full shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:scale-105 transition-all flex items-center gap-2">
              <span>🏰</span> لوحة التحكم
            </Link>
          ) : (
            <>
              <Link href="/login" className="px-3 md:px-6 py-2 text-xs md:text-sm font-bold text-[#D4AF37] hover:text-[#FFD700] transition-colors">
                تسجيل دخول
              </Link>
              <Link href="/register" className="px-4 md:px-6 py-2 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black text-[10px] md:text-sm rounded-full shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:scale-105 transition-all">
                سجل الآن
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col lg:flex-row items-center justify-between px-8 lg:px-20 py-16 gap-12">
        <div className="flex-1 space-y-8 text-center lg:text-right">
          <div className="inline-block px-4 py-1 border border-[#D4AF37]/30 rounded-full bg-[#D4AF37]/5 text-[#D4AF37] text-xs font-bold uppercase tracking-widest animate-bounce">
            القوة، الحظ، والمجد
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-pharaoh font-black leading-tight">
            العب مع <span className="bg-gradient-to-r from-[#FFD700] to-[#D4AF37] bg-clip-text text-transparent">الملوك</span><br />
            واربح كالأسطورة
          </h2>
          <p className="text-lg lg:text-xl text-gray-400 max-w-2xl mx-auto lg:ml-0 leading-relaxed font-light">
            استعد لأكبر تجربة مراهنات وألعاب اجتماعية في الشرق الأوسط. انضم إلى مملكة HBET حيث تجتمع متعة اللعب مع أصدقائك بفرص الربح الحقيقية والمكافآت الفرعونية العظمى.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center lg:justify-end gap-4 md:gap-6 pt-4">
            <Link href="/dashboard" className="group relative px-6 md:px-10 py-3 md:py-4 bg-transparent border-2 border-[#D4AF37] text-[#D4AF37] font-black rounded-xl overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.1)] transition-all hover:text-black text-sm md:text-base">
              <div className="absolute inset-0 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative z-10 text-center block">استكشف الألعاب</span>
            </Link>
            <Link href="/register" className="px-6 md:px-10 py-3 md:py-4 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] text-black font-black rounded-xl shadow-[0_10px_30px_rgba(212,175,55,0.3)] hover:shadow-[0_15px_40px_rgba(212,175,55,0.5)] transform hover:-translate-y-1 transition-all text-sm md:text-base text-center block">
              ابدأ رحلة الثراء الآن
            </Link>
          </div>

          <div className="flex items-center justify-center lg:justify-end gap-8 pt-8 opacity-60">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">50K+</span>
              <span className="text-[10px] uppercase tracking-tighter">لاعب نشط</span>
            </div>
            <div className="w-px h-10 bg-[#D4AF37]/20"></div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold">$2M+</span>
              <span className="text-[10px] uppercase tracking-tighter">إجمالي الجوائز</span>
            </div>
          </div>
        </div>

        <div className="flex-1 relative group w-full max-w-2xl px-4 md:px-0">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#FFD700] to-[#D4AF37] rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative bg-[#0a0a0a] rounded-3xl border border-[#D4AF37]/20 overflow-hidden shadow-2xl">
            <Image 
              src="/hero.png" 
              alt="HBET Hero Image" 
              width={800} 
              height={800} 
              className="w-full h-auto object-cover transform scale-100 group-hover:scale-105 transition-transform duration-700" 
            />
          </div>
          {/* Floating Card UI Element - Now Dynamic */}
          <div className="absolute -top-4 -right-4 md:-top-6 md:-right-6 bg-black/80 backdrop-blur-xl border border-[#D4AF37]/30 p-2 md:p-4 rounded-xl md:rounded-2xl shadow-2xl scale-75 md:scale-100">
            <WinnerTicker />
          </div>
        </div>
      </section>

      {/* Features Bar */}
      <section className="relative z-10 bg-black/40 border-y border-[#D4AF37]/10 py-10 px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <FeatureItem icon="🛡️" title="أمان كامل" desc="تشفير ملكي لبياناتك وأموالك" />
          <FeatureItem icon="⚡" title="سحب فوري" desc="استلم أرباحك في ثوانٍ معدودة" />
          <FeatureItem icon="🤝" title="ألعاب اجتماعية" desc="العب وتنافس مع أصدقائك" />
          <FeatureItem icon="💎" title="مكافآت فرعونية" desc="هدايا يومية لكل الملوك" />
        </div>
      </section>
    </main>
  );
}

function FeatureItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center text-center space-y-2 group">
      <div className="text-3xl mb-2 group-hover:scale-125 transition-transform duration-300">{icon}</div>
      <h3 className="font-bold text-[#FFD700]">{title}</h3>
      <p className="text-xs text-gray-500">{desc}</p>
    </div>
  );
}
