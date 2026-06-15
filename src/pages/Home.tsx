import { Link } from "wouter";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Leaf, ShieldCheck, Handshake, Users, TrendingUp, ChevronDown, PackageSearch, MessageCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import heroImage from "@/assets/hero-paddy.png";
import { supabase } from "@/lib/supabase";

// Tipe data untuk statistik dashboard
type Stats = {
  totalBarters: number;
  totalFarmers: number;
  completedBarters: number;
  openBarters: number;
};

// Fallback stats (dipakai saat belum ada data dari backend)
const fallbackStats: Stats = {
  totalBarters: 0,
  totalFarmers: 0,
  completedBarters: 0,
  openBarters: 0,
};

// Fungsi ambil statistik dari Supabase
async function fetchStats(): Promise<Stats> {
  const [barterRes, farmerRes, completedRes, openRes] = await Promise.all([
    supabase.from("barters").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("barters").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("barters").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  return {
    totalBarters: barterRes.count ?? 0,
    totalFarmers: farmerRes.count ?? 0,
    completedBarters: completedRes.count ?? 0,
    openBarters: openRes.count ?? 0,
  };
}

// Kategori gambar untuk card penawaran
const CATEGORY_IMAGES: Record<string, string> = {
  padi: "/assets/padi.jpg",
  jagung: "/assets/jagung.jpg",
  sayuran: "/assets/sayuran.jpg",
  buah: "/assets/buah.jpg",
  rempah: "/assets/rempah.jpg",
  lainnya: "/logo/logo.png"
};

// Tipe data featured barter
type FeaturedBarter = {
  id: number;
  offered_commodity: string;
  offered_quantity: string;
  wanted_commodity: string;
  wanted_quantity: string;
  category: string;
  location: string;
  photo_url: string | null;
  user: {
    name: string;
    avatar_url: string | null;
  } | null;
};

// Fungsi ambil 3 penawaran terbaru (status open) dari Supabase
async function fetchFeatured(): Promise<FeaturedBarter[]> {
  const { data, error } = await supabase
    .from("barters")
    .select("*, user:users(*)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error || !data) return [];

  return data.map((b: any) => ({
    id: b.id,
    offered_commodity: b.offered_commodity,
    offered_quantity: b.offered_quantity,
    wanted_commodity: b.wanted_commodity,
    wanted_quantity: b.wanted_quantity,
    category: b.category,
    location: b.location,
    photo_url: b.photo_url,
    user: b.user ? { name: b.user.name, avatar_url: b.user.avatar_url } : null,
  }));
}

export default function Home() {
  const [stats, setStats] = useState<Stats>(fallbackStats);
  const [statsLoading, setStatsLoading] = useState(true);

  const [featured, setFeatured] = useState<FeaturedBarter[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);

  // Ambil stats awal + featured + subscribe realtime
  useEffect(() => {
    let mounted = true;

    // Initial fetch stats
    fetchStats().then((data) => {
      if (mounted) {
        setStats(data);
        setStatsLoading(false);
      }
    }).catch(() => {
      if (mounted) setStatsLoading(false);
    });

    // Initial fetch featured
    fetchFeatured().then((data) => {
      if (mounted) {
        setFeatured(data);
        setFeaturedLoading(false);
      }
    }).catch(() => {
      if (mounted) setFeaturedLoading(false);
    });

    // Subscribe realtime ke tabel barters & users
    const channel = supabase
      .channel("home-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "barters" }, () => {
        fetchStats().then((data) => { if (mounted) setStats(data); });
        fetchFeatured().then((data) => { if (mounted) setFeatured(data); });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        fetchStats().then((data) => { if (mounted) setStats(data); });
        fetchFeatured().then((data) => { if (mounted) setFeatured(data); });
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const contentList = [
    {
      title: "Lahan Digital Para Petani",
      description: "Kembalikan tradisi saling bantu. Tukar hasil panen Anda langsung dengan petani lain di seluruh Indonesia. Aman, mudah, dan tanpa perantara."
    },
    {
      title: "Sistem Barter Modern",
      description: "Dapatkan kebutuhan harian tanpa uang tunai. Pertukaran komoditas yang adil dan saling menguntungkan antar petani Nusantara."
    },
    {
      title: "Negosiasi Langsung & Aman",
      description: "Berkomunikasi dan bersepakat langsung dengan sesama petani melalui fitur chat terintegrasi. Transparan dan tanpa potongan biaya."
    }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % contentList.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section - naik ke balik navbar yang fixed */}
      <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden -mt-16">
        {/* Video background fullscreen */}
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover object-center"
            style={{ minHeight: "100vh" }}
          >
            <source src="/video/tani.mp4" type="video/mp4" />
            <img
              src={heroImage}
              alt="Lanskap Sawah Indonesia"
              className="w-full h-full object-cover object-center"
            />
          </video>
          {/* Overlay gelap merata supaya teks terbaca */}
          <div className="absolute inset-0 bg-black/45" />
        </div>
        
        <div className="container relative z-10 mx-auto px-4 text-center pt-24 pb-20">
          <Badge variant="outline" className="mb-6 bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 px-4 py-1.5 text-sm">
            Platform Barter Pertanian #1
          </Badge>
          <h1 className="font-poppins text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-2 tracking-tight max-w-5xl mx-auto leading-tight flex flex-col items-center" style={{ textShadow: "0px 4px 16px rgba(0,0,0,0.6)" }}>
            <span>SWAPPY</span>
            <div className="min-h-[2.4em] md:min-h-[1.2em] flex items-center justify-center mt-2 md:mt-4 w-full">
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentIndex}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="text-accent text-center block"
                >
                  {contentList[currentIndex].title}
                </motion.span>
              </AnimatePresence>
            </div>
          </h1>
          <div className="min-h-[140px] md:min-h-[80px] max-w-2xl mx-auto mb-10 flex items-start justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-lg md:text-xl text-white/90 text-center w-full"
                style={{ textShadow: "0px 2px 8px rgba(0,0,0,0.6)" }}
              >
                {contentList[currentIndex].description}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Scroll Indicator at bottom */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="flex flex-col items-center text-white/70 cursor-pointer hover:text-white"
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
          >
            <span className="text-xs mb-2 font-medium tracking-widest uppercase drop-shadow-md">Scroll</span>
            <ChevronDown className="h-6 w-6 drop-shadow-md" />
          </motion.div>
        </div>
      </section>

      {/* Mengapa SWAPPY - Full Screen */}
      <section className="relative w-full min-h-screen overflow-hidden bg-gradient-to-b from-orange-50 via-pink-50 to-green-50 flex flex-col -mt-16 pt-16">
        {/* Matahari sore - pojok kanan atas, dimentokin */}
        <div className="absolute -top-10 -right-10 md:-top-14 md:-right-14 pointer-events-none select-none" style={{ zIndex: 1 }}>
          <div className="relative">
            {/* Cahaya sore - glow effect luar */}
            <div className="absolute rounded-full" style={{
              background: 'radial-gradient(circle, rgba(255,200,100,0.25) 0%, transparent 60%)',
              width: '400px',
              height: '400px',
              top: '-80px',
              left: '-120px',
            }} />
            {/* Cahaya sore - glow effect dalam */}
            <div className="absolute rounded-full" style={{
              background: 'radial-gradient(circle, rgba(255,180,50,0.4) 0%, rgba(255,120,50,0.15) 40%, transparent 70%)',
              width: '300px',
              height: '300px',
              top: '-40px',
              left: '-80px',
            }} />
            <motion.img
              src="/effect/matahari.png"
              alt="Matahari"
              className="w-32 md:w-48 relative"
              animate={{ opacity: [0.9, 1, 0.9] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* Awan melayang kiri-kanan */}
        <div className="absolute top-0 left-0 right-0 pointer-events-none select-none" style={{ zIndex: 2 }}>
          {[
            { top: '2%', left: '5%', w: 'w-32 md:w-48', dur: 25, del: 0, op: 0.4 },
            { top: '8%', left: '35%', w: 'w-40 md:w-56', dur: 30, del: 3, op: 0.5 },
            { top: '3%', left: '65%', w: 'w-28 md:w-40', dur: 20, del: 7, op: 0.35 },
            { top: '12%', left: '80%', w: 'w-36 md:w-52', dur: 28, del: 5, op: 0.45 },
            { top: '6%', left: '15%', w: 'w-24 md:w-36', dur: 22, del: 10, op: 0.3 },
          ].map((cloud, i) => (
            <motion.img
              key={`cloud-${i}`}
              src="/effect/awan.png"
              alt=""
              className={`absolute ${cloud.w} object-contain`}
              style={{ top: cloud.top, left: cloud.left, opacity: cloud.op }}
              animate={{ x: [-40, 40, -30, 50, -40], y: [0, -5, 3, -3, 0] }}
              transition={{ duration: cloud.dur, repeat: Infinity, ease: "easeInOut", delay: cloud.del }}
            />
          ))}
        </div>

        {/* Burung terbang */}
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none select-none" style={{ zIndex: 3 }}>
          {[
            { top: '15%', startX: '-10%', endX: '110%', dur: 18, del: 0, size: 'text-2xl' },
            { top: '10%', startX: '110%', endX: '-10%', dur: 22, del: 4, size: 'text-xl' },
            { top: '20%', startX: '-5%', endX: '105%', dur: 16, del: 8, size: 'text-lg' },
            { top: '8%', startX: '105%', endX: '-5%', dur: 20, del: 12, size: 'text-3xl' },
            { top: '25%', startX: '-15%', endX: '115%', dur: 25, del: 6, size: 'text-xl' },
          ].map((bird, i) => (
            <motion.div
              key={`bird-${i}`}
              className={`absolute ${bird.size} text-gray-700`}
              style={{ top: bird.top }}
              animate={{
                left: [bird.startX, bird.endX],
                y: [0, -15, 5, -10, 0],
              }}
              transition={{ duration: bird.dur, repeat: Infinity, ease: "linear", delay: bird.del }}
            >
              <motion.svg
                viewBox="0 0 40 20"
                className="w-8 h-5"
                animate={{ rotateZ: [0, -10, 0, 10, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <path
                  d="M0 10 Q10 0 20 10 Q30 0 40 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </motion.svg>
            </motion.div>
          ))}
        </div>

        {/* Konten - flex-1 biar center di atas padi */}
        <div className="flex-1 flex items-center justify-center relative pt-8 pb-4" style={{ zIndex: 1 }}>
          <div className="container mx-auto px-4 text-center">
            <div className="mb-8">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="font-poppins text-3xl md:text-4xl font-bold text-foreground mb-3"
              >
                Mengapa SWAPPY?
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="text-muted-foreground max-w-xl mx-auto leading-relaxed"
              >
                Kami membangun platform yang memahami kebutuhan petani. Sederhana digunakan, namun kuat dampaknya.
              </motion.p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {[
                {
                  title: "Barter Mudah",
                  description: "Temukan kebutuhan Anda dan tawarkan apa yang Anda miliki. Sistem pencocokan cerdas kami membantu menemukan rekan barter.",
                  image: "/SWAPPY/barter.png",
                },
                {
                  title: "Negosiasi Langsung",
                  description: "Berkomunikasi langsung dengan petani lain. Diskusikan kuantitas dan kualitas tanpa pihak ketiga.",
                  image: "/SWAPPY/negosiasi.png",
                },
                {
                  title: "Chat Aman",
                  description: "Percakapan terintegrasi yang memudahkan kesepakatan harga dan logistik dengan rekan jejak jelas.",
                  image: "/SWAPPY/chataman.png",
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Card className="border-border shadow-sm hover-elevate transition-all h-full text-center">
                    <CardContent className="pt-7 pb-6 px-6">
                      <div className="mx-auto mb-4 h-16 w-16">
                        <img
                          src={feature.image}
                          alt={feature.title}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <h3 className="font-poppins text-lg font-bold mb-2 text-foreground">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Padi di bawah - fixed height container */}
        <div className="relative pointer-events-none select-none shrink-0" style={{ zIndex: 0, height: '180px' }}>
          {/* Baris belakang */}
          <div className="absolute bottom-10 left-0 right-0 flex items-end justify-start gap-0 overflow-hidden">
            {Array.from({ length: 22 }).map((_, i) => (
              <motion.img
                key={`back-${i}`}
                src="/effect/padi.png"
                alt=""
                className="h-20 md:h-28 w-auto object-contain flex-shrink-0 opacity-25"
                style={{ marginLeft: i > 0 ? `-${10 + (i % 3) * 3}px` : '0' }}
                animate={{ x: [0, 4, -2, 3, 0], rotateZ: [0, 2, -1, 1.5, 0] }}
                transition={{ duration: 5 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
              />
            ))}
          </div>
          {/* Baris tengah */}
          <div className="absolute bottom-4 left-0 right-0 flex items-end justify-start gap-0 overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.img
                key={`mid-${i}`}
                src="/effect/padi.png"
                alt=""
                className="h-24 md:h-32 w-auto object-contain flex-shrink-0 opacity-40"
                style={{ marginLeft: i > 0 ? `-${14 + (i % 4) * 4}px` : '0' }}
                animate={{ x: [0, 5, -3, 4, 0], rotateZ: [0, 3, -2, 2, 0] }}
                transition={{ duration: 4 + (i % 2), repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
              />
            ))}
          </div>
          {/* Baris depan */}
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-start gap-0 overflow-hidden">
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.img
                key={`front-${i}`}
                src="/effect/padi.png"
                alt=""
                className="h-28 md:h-36 w-auto object-contain flex-shrink-0 opacity-60"
                style={{ marginLeft: i > 0 ? `-${12 + (i % 5) * 3}px` : '0' }}
                animate={{ x: [0, 6, -4, 5, 0], rotateZ: [0, 4, -2, 3, 0] }}
                transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.25 }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Langkah-Langkah */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4">Cara Kerja</Badge>
            <h2 className="font-poppins text-3xl md:text-4xl font-bold text-foreground mb-4">Mulai Barter dalam 4 Langkah</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Prosesnya simpel. Tidak perlu ribet, cukup ikuti langkah berikut dan mulai tukar panen!</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              {
                step: 1,
                title: "Daftar Akun",
                description: "Buat akun gratis dan lengkapi profil Anda.",
                icon: Users,
                color: "from-blue-500 to-blue-600",
              },
              {
                step: 2,
                title: "Buat Penawaran",
                description: "Tawarkan hasil panen Anda dan tentukan komoditas yang dicari.",
                icon: PackageSearch,
                color: "from-amber-500 to-orange-500",
              },
              {
                step: 3,
                title: "Negosiasi",
                description: "Chat langsung dengan petani lain untuk sepakati detail.",
                icon: MessageCircle,
                color: "from-green-500 to-emerald-600",
              },
              {
                step: 4,
                title: "Selesaikan Barter",
                description: "Klik selesaikan dan barter tercatat di riwayat.",
                icon: CheckCircle2,
                color: "from-purple-500 to-violet-600",
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                className="relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                {/* Connector line between steps */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-8 -right-3 w-6 border-t-2 border-dashed border-primary/30 z-10" />
                )}
                <Card className="border-border shadow-sm hover-elevate transition-all h-full">
                  <CardContent className="pt-6 pb-5 px-4 text-center">
                    <div className={`mx-auto mb-3 h-14 w-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-md`}>
                      <step.icon className="h-6 w-6" />
                    </div>
                    <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold mb-2">
                      {step.step}
                    </div>
                    <h3 className="font-poppins text-base font-bold mb-1">{step.title}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">{step.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/barter">
              <Button size="lg" className="font-poppins text-base px-8 py-5 rounded-full shadow-lg">
                Mulai Barter Sekarang <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 divide-x divide-white/20">
            {[
              { icon: TrendingUp, value: stats.totalBarters, label: 'Total Transaksi Barter', delay: 0.1 },
              { icon: Users, value: stats.totalFarmers, label: 'Petani Bergabung', delay: 0.25 },
              { icon: Handshake, value: stats.completedBarters, label: 'Barter Berhasil', delay: 0.4 },
              { icon: Leaf, value: stats.openBarters, label: 'Penawaran Aktif', delay: 0.55 },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className="flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: stat.delay, ease: 'easeOut' }}
              >
                <motion.div
                  animate={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: stat.delay + 1 }}
                >
                  <stat.icon className="h-7 w-7 mb-2 text-accent" />
                </motion.div>
                {statsLoading ? (
                  <Skeleton className="h-10 w-20 mb-1 bg-white/20" />
                ) : (
                  <span className="font-poppins text-3xl lg:text-4xl font-bold mb-1">{stat.value}</span>
                )}
                <span className="text-xs text-white/80">{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Barters */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="font-poppins text-3xl font-bold text-foreground mb-2">Penawaran Populer</h2>
              <p className="text-muted-foreground">Komoditas yang sedang dicari saat ini.</p>
            </div>
            <Link href="/barter">
              <Button variant="ghost" className="hidden sm:flex text-primary hover:text-primary hover:bg-primary/10">
                Lihat Semua <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden border-border">
                  <Skeleton className="h-48 w-full rounded-none" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-10 w-full" />
                  </CardFooter>
                </Card>
              ))
            ) : featured.length > 0 ? (
              featured.map((barter) => (
                <Card key={barter.id} className="overflow-hidden border-border flex flex-col hover-elevate transition-shadow">
                  <div className="h-48 relative overflow-hidden bg-muted group">
                    {barter.photo_url ? (
                      <img src={barter.photo_url} alt={barter.offered_commodity} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <img src={CATEGORY_IMAGES[barter.category] || CATEGORY_IMAGES["lainnya"]} alt={barter.category} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    )}
                    <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground capitalize">{barter.category}</Badge>
                  </div>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={barter.user?.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">{(barter.user?.name || 'P').charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span>{barter.user?.name || 'Petani'}</span>
                      <span>&bull;</span>
                      <span>{barter.location}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="bg-muted p-4 rounded-lg flex items-center justify-between mb-4">
                      <div className="text-center flex-1">
                        <span className="block text-xs text-muted-foreground mb-1">Menawarkan</span>
                        <strong className="block text-sm font-semibold">{barter.offered_quantity}</strong>
                        <span className="text-sm">{barter.offered_commodity}</span>
                      </div>
                      <div className="px-2 text-primary">
                        <Handshake className="h-5 w-5" />
                      </div>
                      <div className="text-center flex-1">
                        <span className="block text-xs text-muted-foreground mb-1">Mencari</span>
                        <strong className="block text-sm font-semibold">{barter.wanted_quantity}</strong>
                        <span className="text-sm">{barter.wanted_commodity}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Link href={`/barter`} className="w-full">
                      <Button className="w-full">Negosiasi</Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center bg-muted/30 rounded-xl border border-dashed border-border">
                <Leaf className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-poppins text-lg font-medium text-foreground mb-2">Belum ada penawaran</h3>
                <p className="text-muted-foreground text-sm max-w-md">Jadilah yang pertama membuat penawaran barter di forum.</p>
                <Link href="/barter">
                  <Button className="mt-4">Buat Penawaran Pertama</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
