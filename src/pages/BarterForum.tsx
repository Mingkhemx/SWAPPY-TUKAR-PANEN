import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Search, MapPin, Handshake, Leaf, Loader2, ArrowRightLeft, Clock, Filter, AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const CATEGORIES = ["padi", "jagung", "sayuran", "buah", "rempah", "lainnya"];
const CATEGORY_IMAGES: Record<string, string> = {
  padi: "/assets/padi.jpg",
  jagung: "/assets/jagung.jpg",
  sayuran: "/assets/sayuran.jpg",
  buah: "/assets/buah.jpg",
  rempah: "/assets/rempah.jpg",
  lainnya: "/logo/logo.png"
};
const SORTS = [
  { value: "newest", label: "Terbaru" },
  { value: "popular", label: "Terpopuler" }
];
const UNITS = ["kg", "gram", "karung", "buah", "ikat", "liter", "ml", "dus", "bungkus"];
const INDONESIAN_LOCATIONS = [
  "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Jambi", "Sumatera Selatan",
  "Lampung", "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta", "Jawa Timur",
  "Banten", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Kalimantan Barat",
  "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Sulawesi Utara",
  "Sulawesi Tengah", "Sulawesi Selatan", "Gorontalo", "Maluku", "Papua"
];

const barterSchema = z.object({
  offeredCommodity: z.string().min(2, "Nama komoditas wajib diisi"),
  offeredQuantityValue: z.string().min(1, "Nilai kuantitas wajib diisi"),
  offeredQuantityUnit: z.string().min(1, "Satuan wajib dipilih"),
  wantedCommodity: z.string().min(2, "Nama komoditas wajib diisi"),
  wantedQuantityValue: z.string().min(1, "Nilai kuantitas wajib diisi"),
  wantedQuantityUnit: z.string().min(1, "Satuan wajib dipilih"),
  category: z.string().min(1, "Kategori wajib dipilih"),
  location: z.string().min(2, "Lokasi wajib diisi"),
  description: z.string().optional(),
  photoUrl: z.string().optional(),
});

export default function BarterForum() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [barters, setBarters] = useState<any[]>([]);
  const [params, setParams] = useState({ sort: "newest" });
  const [isCreating, setIsCreating] = useState(false);
  const [negotiatingId, setNegotiatingId] = useState<number | null>(null);

  const fetchBarters = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("barters")
        .select("*, user:users(*)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Transform the data for our UI
      const transformed = (data || []).map(b => ({
        ...b,
        user: b.user
      }));
      
      setBarters(transformed);
    } catch (error: any) {
      console.error("Error fetching barters:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBarters();
  }, []);

  const form = useForm<z.infer<typeof barterSchema>>({
    resolver: zodResolver(barterSchema),
    defaultValues: {
      offeredCommodity: "",
      offeredQuantityValue: "",
      offeredQuantityUnit: "kg",
      wantedCommodity: "",
      wantedQuantityValue: "",
      wantedQuantityUnit: "kg",
      category: "",
      location: user?.location || "",
      description: "",
      photoUrl: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof barterSchema>) => {
    if (!user) return;
    
    setIsCreating(true);
    try {
      const { error } = await supabase
        .from("barters")
        .insert([{
          user_id: user.id,
          offered_commodity: data.offeredCommodity,
          offered_quantity: `${data.offeredQuantityValue} ${data.offeredQuantityUnit}`,
          wanted_commodity: data.wantedCommodity,
          wanted_quantity: `${data.wantedQuantityValue} ${data.wantedQuantityUnit}`,
          category: data.category,
          location: data.location,
          description: data.description,
          photo_url: data.photoUrl,
          status: "open"
        }]);
      
      if (error) throw error;
      
      toast({ title: "Berhasil!", description: "Penawaran barter berhasil dibuat." });
      setIsCreateOpen(false);
      form.reset();
      fetchBarters();
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message || "Gagal membuat penawaran", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  // Saat klik "Negosiasi Sekarang": buat conversation lalu arahkan ke chat
  const handleNegotiate = async (barter: any) => {
    if (!user) { setLocation("/login"); return; }
    setNegotiatingId(barter.id);
    try {
      // Gunakan RPC function yang bypass RLS (security definer)
      const { data: convId, error } = await supabase.rpc("create_conversation", {
        p_barter_id: barter.id,
        p_user_id: user.id,
        p_owner_id: barter.user_id,
      });

      if (error) throw error;

      setLocation(`/chat?convId=${convId}`);
    } catch (err: any) {
      toast({ title: "Gagal memulai chat", description: err.message, variant: "destructive" });
    } finally {
      setNegotiatingId(null);
    }
  };

  const handleCategoryChange = (val: string) => {
    setParams(p => ({ ...p, category: val === "all" ? undefined : val }));
  };

  const handleSortChange = (val: "newest" | "popular") => {
    setParams(p => ({ ...p, sort: val }));
  };

  return (
    <div className="container mx-auto px-4 py-8 pb-96 min-h-[150dvh] max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="font-poppins text-3xl font-bold text-foreground mb-2">Forum Barter</h1>
          <p className="text-muted-foreground">Temukan hasil panen yang Anda butuhkan dan tawarkan apa yang Anda miliki.</p>
        </div>
        
        {user ? (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0 shadow-sm" size="lg">
                <Leaf className="mr-2 h-5 w-5" /> Buat Penawaran
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-background">
              <DialogHeader>
                <DialogTitle className="font-poppins text-xl">Buat Penawaran Barter</DialogTitle>
                <DialogDescription>
                  Berikan rincian jelas tentang apa yang Anda tawarkan dan apa yang Anda cari.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/50 p-4 rounded-lg border border-border">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-primary font-medium border-b border-border pb-2">
                        <ArrowRightLeft className="h-4 w-4" /> <span>Saya Menawarkan</span>
                      </div>
                      <FormField
                        control={form.control}
                        name="offeredCommodity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Komoditas</FormLabel>
                            <FormControl><Input placeholder="Mis. Beras Rojolele" {...field} className="bg-background" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name="offeredQuantityValue"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Jumlah</FormLabel>
                              <FormControl><Input type="number" placeholder="50" {...field} className="bg-background" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="offeredQuantityUnit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Satuan</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Satuan" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {UNITS.map((u) => (
                                    <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-accent-foreground font-medium border-b border-border pb-2">
                        <Search className="h-4 w-4" /> <span>Saya Mencari</span>
                      </div>
                      <FormField
                        control={form.control}
                        name="wantedCommodity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Komoditas</FormLabel>
                            <FormControl><Input placeholder="Mis. Pupuk Urea" {...field} className="bg-background" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name="wantedQuantityValue"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Jumlah</FormLabel>
                              <FormControl><Input type="number" placeholder="2" {...field} className="bg-background" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="wantedQuantityUnit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Satuan</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Satuan" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {UNITS.map((u) => (
                                    <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kategori (Penawaran)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Pilih kategori" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Lokasi Pengambilan</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between bg-background",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value
                                    ? field.value
                                    : "Pilih lokasi"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0">
                              <Command>
                                <CommandInput placeholder="Cari lokasi di Indonesia..." className="h-9" />
                                <CommandList>
                                  <CommandEmpty>Lokasi tidak ditemukan</CommandEmpty>
                                  <CommandGroup>
                                    {INDONESIAN_LOCATIONS.map((location) => (
                                      <CommandItem
                                        value={location}
                                        key={location}
                                        onSelect={(currentValue) => {
                                          field.onChange(currentValue === field.value ? "" : currentValue);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === location ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {location}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catatan Tambahan (Opsional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Mis. Kualitas premium, panen minggu lalu..." className="resize-none bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Batal</Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Terbitkan Penawaran
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        ) : (
          <Link href="/login">
            <Button className="shrink-0 shadow-sm" size="lg">
              <Leaf className="mr-2 h-5 w-5" /> Masuk untuk Buat Penawaran
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-full md:w-auto">
          <Filter className="h-4 w-4" /> Filter:
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1 md:justify-end">
          <div className="w-full sm:w-[200px]">
            <Select value={params.category || "all"} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-full sm:w-[200px]">
            <Select value={params.sort || "newest"} onValueChange={(val: any) => handleSortChange(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-border">
              <Skeleton className="h-48 w-full rounded-none" />
              <CardHeader><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
              <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
            </Card>
          ))
        ) : barters.length > 0 ? (
          barters.map((barter: any) => (
            <Card key={barter.id} className="overflow-hidden border-border flex flex-col hover-elevate transition-all duration-200">
              <div className="h-48 relative overflow-hidden bg-muted group">
                {barter.photo_url ? (
                  <img src={barter.photo_url} alt={barter.offered_commodity} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <img 
                    src={CATEGORY_IMAGES[barter.category]} 
                    alt={barter.category} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  />
                )}
                <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                  <Badge className="bg-primary text-primary-foreground shadow-sm">{barter.status}</Badge>
                  <Badge variant="outline" className="bg-white/80 backdrop-blur text-foreground border-border shadow-sm capitalize">
                    {barter.category}
                  </Badge>
                </div>
              </div>
              
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 border border-border shadow-sm">
                      <AvatarImage src={barter.user?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{(barter.user?.name || 'U').charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold leading-none">{barter.user?.name || 'Petani'}</span>
                      <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {barter.location}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                    <Clock className="h-3 w-3" /> {new Date(barter.created_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 pt-2">
                <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-4 rounded-xl border border-border shadow-inner flex flex-col relative overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border border-border rounded-full p-2 z-10 shadow-sm text-primary">
                    <ArrowRightLeft className="h-4 w-4" />
                  </div>
                  
                  <div className="flex justify-between relative z-0">
                    <div className="w-[45%]">
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Ada</span>
                      <strong className="block text-sm font-semibold text-primary truncate" title={barter.offered_commodity}>
                        {barter.offered_commodity}
                      </strong>
                      <span className="text-xs font-medium text-foreground/80 bg-background/80 px-2 py-0.5 rounded border border-border/50 inline-block mt-1">
                        {barter.offered_quantity}
                      </span>
                    </div>
                    
                    <div className="w-[45%] text-right">
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Cari</span>
                      <strong className="block text-sm font-semibold text-accent-foreground truncate" title={barter.wanted_commodity}>
                        {barter.wanted_commodity}
                      </strong>
                      <span className="text-xs font-medium text-foreground/80 bg-background/80 px-2 py-0.5 rounded border border-border/50 inline-block mt-1">
                        {barter.wanted_quantity}
                      </span>
                    </div>
                  </div>
                </div>
                
                {barter.description && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2 italic">"{barter.description}"</p>
                )}
              </CardContent>
              
              <CardFooter className="pt-0">
                <Button
                  className="w-full"
                  variant={barter.status === "open" ? "default" : "secondary"}
                  disabled={barter.status !== "open" || barter.user_id === user?.id || negotiatingId === barter.id}
                  onClick={() => handleNegotiate(barter)}
                >
                  {negotiatingId === barter.id ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memulai Chat...</>
                  ) : barter.user_id === user?.id ? "Penawaran Anda" :
                    barter.status !== "open" ? "Tidak Tersedia" :
                    <><Handshake className="mr-2 h-4 w-4" /> Negosiasi Sekarang</>}
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center bg-card rounded-xl border border-dashed border-border">
            <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="font-poppins text-xl font-medium text-foreground mb-2">Tidak ada penawaran ditemukan</h3>
            <p className="text-muted-foreground max-w-md">Coba ubah filter pencarian Anda atau jadilah yang pertama membuat penawaran baru di kategori ini.</p>
            {user && (
              <Button onClick={() => setIsCreateOpen(true)} className="mt-6" variant="outline">
                Buat Penawaran Baru
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
