import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground py-12 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <img
                src="/logo/logo.png"
                alt="SWAPPY Logo"
                style={{ height: "52px" }}
                className="w-auto object-contain"
              />
            </Link>
            <p className="text-secondary-foreground/80 max-w-sm">
              Lahan digital para petani Indonesia. Platform barter komunitas yang memudahkan petani untuk saling bertukar hasil panen dengan aman dan mudah.
            </p>
          </div>
          
          <div>
            <h3 className="font-poppins font-semibold text-lg mb-4 text-white">Navigasi</h3>
            <ul className="space-y-2">
              <li><Link href="/" className="text-secondary-foreground/80 hover:text-white transition-colors">Beranda</Link></li>
              <li><Link href="/barter" className="text-secondary-foreground/80 hover:text-white transition-colors">Forum Barter</Link></li>
              <li><Link href="/login" className="text-secondary-foreground/80 hover:text-white transition-colors">Masuk Akun</Link></li>
              <li><Link href="/daftar" className="text-secondary-foreground/80 hover:text-white transition-colors">Daftar Baru</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-poppins font-semibold text-lg mb-4 text-white">Bantuan</h3>
            <ul className="space-y-2">
              <li><span className="text-secondary-foreground/80">FAQ</span></li>
              <li><span className="text-secondary-foreground/80">Panduan Barter</span></li>
              <li><span className="text-secondary-foreground/80">Keamanan</span></li>
              <li><span className="text-secondary-foreground/80">Hubungi Kami</span></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/10 mt-8 pt-8 text-center text-secondary-foreground/60 text-sm">
          <p>&copy; {new Date().getFullYear()} SWAPPY. Seluruh hak cipta dilindungi.</p>
        </div>
      </div>
    </footer>
  );
}
