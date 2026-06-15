import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { MapPin, Star, Package, History, LogOut, CheckCircle2, ArrowRightLeft, Loader2, Check, ChevronsUpDown, Clock, Handshake, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";

const CATEGORY_IMAGES: Record<string, string> = {
  padi: "/assets/padi.jpg",
  jagung: "/assets/jagung.jpg",
  sayuran: "/assets/sayuran.jpg",
  buah: "/assets/buah.jpg",
  rempah: "/assets/rempah.jpg",
  lainnya: "/logo/logo.png"
};

const INDONESIAN_LOCATIONS = [
  "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Jambi", "Sumatera Selatan",
  "Lampung", "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta", "Jawa Timur",
  "Banten", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Kalimantan Barat",
  "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Sulawesi Utara",
  "Sulawesi Tengah", "Sulawesi Selatan", "Gorontalo", "Maluku", "Papua"
];

const profileSchema = z.object({
  name: z.string().min(3, "Nama harus minimal 3 karakter"),
  location: z.string().min(2, "Lokasi harus dipilih"),
  phone: z.string().optional(),
  bio: z.string().optional(),
});

export default function Profile() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeBarters, setActiveBarters] = useState<any[]>([]);
  const [completedBarters, setCompletedBarters] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      location: "",
      phone: "",
      bio: "",
    },
  });

  // Reset form when user data is available
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || "",
        location: user.location || "",
        phone: user.phone || "",
        bio: user.bio || "",
      });
    }
  }, [user, form]);

  // Fetch user's barter data + riwayat barter yang diikuti
  useEffect(() => {
    if (!user) return;
    const fetchBarterData = async () => {
      setIsLoadingData(true);
      try {
        // 1. Fetch barter yang user buat sendiri
        const { data: myBarters, error: err1 } = await supabase
          .from("barters")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (err1) throw err1;
        const allMyBarters = myBarters || [];
        setActiveBarters(allMyBarters.filter((b: any) => b.status === "open" || b.status === "negotiating"));

        // 2. Fetch conversations yang user ikuti dan sudah completed
        const { data: convs, error: err2 } = await supabase
          .from("conversations")
          .select("id, barter_id, status, created_at, barter:barters(*, user:users(name, avatar_url))")
          .eq("status", "completed");
        if (err2) throw err2;

        // Filter: hanya percakapan yang user ikuti (cek via participants)
        const { data: myParticipations } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", user.id);
        const myConvIds = new Set((myParticipations || []).map((p: any) => p.conversation_id));
        const completedConvs = (convs || []).filter((c: any) => myConvIds.has(c.id));

        // 3. Gabungkan barter completed milik sendiri + barter dari conversations yang diikuti
        const ownCompleted = allMyBarters.filter((b: any) => b.status === "completed");
        const participantCompleted = completedConvs
          .filter((c: any) => c.barter && c.barter.user_id !== user.id)
          .map((c: any) => ({
            ...c.barter,
            _source: "participant", // penanda bahwa ini barter milik orang lain
          }));

        // Deduplicate by barter id
        const seen = new Set<number>();
        const merged: any[] = [];
        for (const b of [...ownCompleted, ...participantCompleted]) {
          if (!seen.has(b.id)) {
            seen.add(b.id);
            merged.push({ ...b, _source: b._source || "owner" });
          }
        }
        // Sort by created_at terbaru
        merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setCompletedBarters(merged);
      } catch (err: any) {
        console.error("Error fetching barter data:", err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchBarterData();
  }, [user]);

  const onSubmit = async (data: z.infer<typeof profileSchema>) => {
    if (!user) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({
          name: data.name,
          location: data.location,
          phone: data.phone || null,
          bio: data.bio || null,
        })
        .eq("id", user.id);
      
      if (error) throw error;
      
      toast({ title: "Profil Diperbarui", description: "Perubahan berhasil disimpan." });
      setIsEditing(false);
    } catch (error: any) {
      toast({ 
        title: "Gagal Memperbarui Profil", 
        description: error.message || "Terjadi kesalahan", 
        variant: "destructive" 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 pb-96 min-h-[150dvh] max-w-5xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Profile Sidebar */}
        <div className="md:col-span-1">
          <Card className="border-border shadow-sm overflow-hidden sticky top-24">
            <div className="h-24 bg-gradient-to-r from-primary/80 to-primary"></div>
            <CardContent className="pt-0 relative px-6 pb-6 text-center">
              <Avatar className="h-24 w-24 border-4 border-card absolute -top-12 left-1/2 -translate-x-1/2 shadow-sm">
                <AvatarImage src={user.avatarUrl || ''} />
                <AvatarFallback className="text-2xl bg-secondary text-secondary-foreground">{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              
              <div className="pt-16 pb-4">
                <h2 className="font-poppins text-2xl font-bold">{user.name}</h2>
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm mt-1">
                  <MapPin className="h-4 w-4" /> {user.location}
                </div>
                
                <div className="flex items-center justify-center gap-4 mt-4 text-sm font-medium">
                  <div className="flex items-center gap-1 bg-accent/20 text-accent-foreground px-3 py-1 rounded-full">
                    <Star className="h-4 w-4 fill-accent text-accent" />
                    <span>{user.rating || "Baru"}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full">
                    <HandshakeIcon className="h-4 w-4" />
                    <span>{user.totalBarters || 0} Barter</span>
                  </div>
                </div>
              </div>
              
              {user.bio && (
                <p className="text-sm text-muted-foreground italic mb-6">"{user.bio}"</p>
              )}
              
              <Button 
                variant="outline" 
                className="w-full mb-2" 
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Batal Edit" : "Edit Profil"}
              </Button>
              <Button 
                variant="destructive" 
                className="w-full" 
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" /> Keluar Akun
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2">
          {isEditing ? (
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="font-poppins text-xl">Edit Profil</CardTitle>
                <CardDescription>Perbarui informasi profil Anda.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="location" render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Lokasi</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
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
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Nomor Telepon</FormLabel><FormControl><Input placeholder="081234567890" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="bio" render={({ field }) => (
                      <FormItem><FormLabel>Bio</FormLabel><FormControl><Textarea className="resize-none" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Simpan Perubahan"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="offers" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted">
              <TabsTrigger value="offers" className="data-[state=active]:bg-background"><Package className="mr-2 h-4 w-4 hidden sm:block" /> Penawaran Saya</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-background"><History className="mr-2 h-4 w-4 hidden sm:block" /> Riwayat</TabsTrigger>
            </TabsList>
              
              <TabsContent value="offers" className="space-y-4">
                <h3 className="font-poppins text-xl font-semibold mb-4">Penawaran Aktif Anda</h3>
                {isLoadingData ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : activeBarters.length > 0 ? (
                  <div className="space-y-4">
                    {activeBarters.map((barter: any) => (
                      <Card key={barter.id} className="border-border shadow-sm hover-elevate transition-all">
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            <div className="h-20 w-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                              <img
                                src={barter.photo_url || CATEGORY_IMAGES[barter.category] || "/logo/logo.png"}
                                alt={barter.offered_commodity}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">{barter.status === "negotiating" ? "Negosiasi" : "Terbuka"}</Badge>
                                <Badge variant="outline" className="text-[10px] capitalize">{barter.category}</Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold text-primary truncate">{barter.offered_commodity}</span>
                                <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="font-semibold text-amber-600 truncate">{barter.wanted_commodity}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>{barter.offered_quantity}</span>
                                <span>↔</span>
                                <span>{barter.wanted_quantity}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                                <Clock className="h-3 w-3" /> {new Date(barter.created_at).toLocaleDateString("id-ID")}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed bg-muted/30">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                      <Package className="h-12 w-12 mb-4 opacity-20" />
                      <p>Anda belum memiliki penawaran aktif.</p>
                      <Link href="/barter">
                        <Button className="mt-4" variant="outline">Buat Penawaran</Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="history" className="space-y-4">
                <h3 className="font-poppins text-xl font-semibold mb-4">Riwayat Barter Selesai</h3>
                {isLoadingData ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : completedBarters.length > 0 ? (
                  <div className="space-y-4">
                    {completedBarters.map((barter: any) => (
                      <Card key={barter.id} className="border-border shadow-sm opacity-80">
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            <div className="h-20 w-20 rounded-lg overflow-hidden shrink-0 bg-muted grayscale-[30%]">
                              <img
                                src={barter.photo_url || CATEGORY_IMAGES[barter.category] || "/logo/logo.png"}
                                alt={barter.offered_commodity}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">Selesai</Badge>
                                <Badge variant="outline" className="text-[10px] capitalize">{barter.category}</Badge>
                                {barter._source === "participant" && (
                                  <Badge variant="secondary" className="text-[10px]">Ikut Barter</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold text-primary truncate">{barter.offered_commodity}</span>
                                <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="font-semibold text-amber-600 truncate">{barter.wanted_commodity}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span>{barter.offered_quantity}</span>
                                <span>↔</span>
                                <span>{barter.wanted_quantity}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                <Clock className="h-3 w-3" /> {new Date(barter.created_at).toLocaleDateString("id-ID")}
                                {barter.user?.name && (
                                  <span className="ml-2">Oleh: {barter.user.name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed bg-muted/30">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                      <History className="h-12 w-12 mb-4 opacity-20" />
                      <p>Belum ada riwayat barter yang diselesaikan.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple icon wrapper
function HandshakeIcon(props: any) {
  return <ArrowRightLeft {...props} />;
}
