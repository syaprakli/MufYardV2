import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  CheckCircle2, 
  MessageSquare, 
  Bot, 
  Zap, 
  ShieldCheck, 
  LayoutDashboard
} from 'lucide-react';

interface SlideProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  features?: string[];
  color: string;
  image?: string;
}

const slides: SlideProps[] = [
  {
    title: "MufYardV2'ye Hoş Geldiniz",
    description: "Müfettişler için tasarlanmış, yapay zeka destekli en modern ve kapsamlı denetim yönetim platformu.",
    icon: <LayoutDashboard className="w-16 h-16" />,
    features: ["Hızlı ve Sezgisel Arayüz", "Gerçek Zamanlı Senkronizasyon", "Gelişmiş Güvenlik Katmanı"],
    color: "from-blue-600 to-indigo-700"
  },
  {
    title: "Verimlilik ve Takip",
    description: "Mevzuat ve görev yönetimi hiç bu kadar kolay olmamıştı. Her şey elinizin altında.",
    icon: <Zap className="w-16 h-16" />,
    features: ["Akıllı Mevzuat Tarayıcı", "Dinamik Görev Yönetimi", "Dosya ve Arşiv Sistemi"],
    color: "from-cyan-500 to-blue-600"
  },
  {
    title: "İş Birliği ve İletişim",
    description: "Ekibinizle anlık iletişim kurun, ortak çalışma alanlarında dosyalarınızı paylaşın.",
    icon: <MessageSquare className="w-16 h-16" />,
    features: ["Kurumsal Mesajlaşma", "Ortak Forum ve Paylaşım", "Anlık Bildirim Sistemi"],
    color: "from-purple-600 to-pink-600"
  },
  {
    title: "Yapay Zeka Gücü",
    description: "Karmaşık verileri saniyeler içinde analiz edin ve otomatik raporlar oluşturun.",
    icon: <Bot className="w-16 h-16" />,
    features: ["AI Denetim Asistanı", "Akıllı Rapor Editörü", "Kapsamlı Bilgi Bankası"],
    color: "from-emerald-500 to-teal-600"
  },
  {
    title: "Hadi Başlayalım!",
    description: "Artık MufYardV2'nin tüm gücünü keşfetmeye hazırsınız. Ayarlardan profilinizi düzenlemeyi unutmayın.",
    icon: <ShieldCheck className="w-16 h-16" />,
    features: ["Kişiselleştirilmiş Deneyim", "7/24 Teknik Destek", "Sürekli Güncellenen İçerik"],
    color: "from-amber-500 to-orange-600"
  }
];

export const IntroPresentation: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleClose();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const slide = slides[currentSlide];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0f172a]/95 backdrop-blur-md overflow-hidden p-4">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={handleClose}
        className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors z-[10000]"
      >
        <X className="w-6 h-6" />
      </motion.button>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -50, scale: 0.95 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative max-w-4xl w-full aspect-[16/10] md:aspect-[16/9] glass-panel rounded-[2rem] overflow-hidden flex flex-col md:flex-row shadow-2xl border-white/10"
        >
          {/* Background Gradient Layer */}
          <div className={`absolute inset-0 bg-gradient-to-br ${slide.color} opacity-10`} />
          
          {/* Left Side - Visual/Icon */}
          <div className={`w-full md:w-5/12 bg-gradient-to-br ${slide.color} flex items-center justify-center p-12 relative overflow-hidden`}>
             <motion.div
               initial={{ rotate: -10, scale: 0.5, opacity: 0 }}
               animate={{ rotate: 0, scale: 1, opacity: 1 }}
               transition={{ delay: 0.2, type: "spring" }}
               className="text-white relative z-10"
             >
               {slide.icon}
             </motion.div>
             
             {/* Decorative circles */}
             <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl" />
             <div className="absolute bottom-0 right-0 w-48 h-48 bg-black/20 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
          </div>

          {/* Right Side - Content */}
          <div className="w-full md:w-7/12 p-8 md:p-12 flex flex-col justify-center relative bg-slate-900/40">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                {slide.title}
              </h2>
              <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                {slide.description}
              </p>

              <div className="space-y-4 mb-10">
                {slide.features?.map((feature, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 + (idx * 0.1) }}
                    className="flex items-center gap-3 text-slate-200"
                  >
                    <div className={`p-1 rounded-full bg-gradient-to-br ${slide.color}`}>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-medium">{feature}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Navigation */}
            <div className="mt-auto flex items-center justify-between">
              <div className="flex gap-2">
                {slides.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentSlide ? 'w-8 bg-blue-500' : 'w-2 bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-3">
                {currentSlide > 0 && (
                  <button
                    onClick={prevSlide}
                    className="p-3 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}
                <button
                  onClick={nextSlide}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white transition-all transform hover:scale-105 active:scale-95 bg-gradient-to-r ${slide.color} shadow-lg`}
                >
                  {currentSlide === slides.length - 1 ? 'Başlayalım' : 'Devam Et'}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default IntroPresentation;
