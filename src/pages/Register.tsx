import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const PROVINCES = [
  "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Jambi", "Sumatera Selatan", "Bengkulu", 
  "Lampung", "Kepulauan Bangka Belitung", "Kepulauan Riau", "DKI Jakarta", "Jawa Barat", 
  "Jawa Tengah", "DI Yogyakarta", "Jawa Timur", "Banten", "Bali", "Nusa Tenggara Barat", 
  "Nusa Tenggara Timur", "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan", 
  "Kalimantan Timur", "Kalimantan Utara", "Sulawesi Utara", 
  "Sulawesi Tengah", "Sulawesi Selatan", "Sulawesi Tenggara", "Gorontalo", "Sulawesi Barat", 
  "Maluku", "Maluku Utara", "Papua", "Papua Barat", "Papua Selatan", "Papua Tengah", "Papua Pegunungan"
];

const registerSchema = z.object({
  name: z.string().min(3, { message: "Nama lengkap minimal 3 karakter" }),
  email: z.string().email({ message: "Format email tidak valid" }),
  password: z.string().min(6, { message: "Password minimal 6 karakter" }),
  location: z.string().min(1, { message: "Provinsi wajib dipilih" }),
  phone: z.string().optional(),
  bio: z.string().optional(),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      location: "",
      phone: "",
      bio: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof registerSchema>) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            location: data.location,
            phone: data.phone,
            bio: data.bio,
          },
        },
      });

      if (error) throw error;

      // Cek apakah Supabase memerlukan konfirmasi email
      // Jika identities kosong, email sudah terdaftar sebelumnya
      if (authData.user && authData.user.identities?.length === 0) {
        toast({
          title: "Email sudah terdaftar",
          description: "Email ini sudah digunakan. Silakan login atau gunakan email lain.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Cek apakah perlu konfirmasi email (session null = perlu konfirmasi)
      if (!authData.session) {
        toast({
          title: "Pendaftaran berhasil",
          description: `Selamat bergabung, ${data.name}! Silakan cek email Anda untuk konfirmasi akun, lalu login.`,
        });
        setLocation("/login");
        return;
      }

      // Session langsung ada (email confirmation disabled di Supabase)
      toast({
        title: "Pendaftaran berhasil",
        description: `Selamat bergabung di SWAPPY, ${data.name}!`,
      });

      setLocation("/barter");
    } catch (err: any) {
      console.error("Register ERROR:", err);
      let errorMessage = "Terjadi kesalahan saat mendaftar";
      if (err?.message) {
        // Terjemahkan error Supabase yang umum
        if (err.message.includes("User already registered")) {
          errorMessage = "Email ini sudah terdaftar. Silakan login.";
        } else if (err.message.includes("Password should be at least")) {
          errorMessage = "Password minimal 6 karakter.";
        } else if (err.message.includes("Unable to validate email")) {
          errorMessage = "Format email tidak valid.";
        } else if (err.message.includes("rate limit")) {
          errorMessage = "Terlalu banyak percobaan. Coba lagi beberapa menit.";
        } else {
          errorMessage = err.message;
        }
      }
      toast({
        title: "Gagal mendaftar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)] px-4 py-12 bg-muted/30">
      <div className="w-full max-w-lg">
        <Card className="border-border shadow-md">
          <CardHeader className="space-y-4 text-center pb-6">
            <Link href="/" className="flex items-center justify-center gap-2">
              <img
                src="/logo/logo.png"
                alt="SWAPPY Logo"
                style={{ height: "64px" }}
                className="object-contain"
              />
            </Link>
            <CardTitle className="font-poppins text-2xl">Daftar Akun Baru</CardTitle>
            <CardDescription className="text-base">
              Bergabung dengan ribuan petani lainnya
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Lengkap</FormLabel>
                      <FormControl>
                        <Input placeholder="Budi Santoso" {...field} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="budi@contoh.com" type="email" {...field} className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nomor HP (Opsional)</FormLabel>
                        <FormControl>
                          <Input placeholder="08123456789" type="tel" {...field} className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input placeholder="Minimal 6 karakter" type="password" {...field} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provinsi</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Pilih provinsi tempat Anda bertani" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PROVINCES.map((prov) => (
                            <SelectItem key={prov} value={prov}>
                              {prov}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cerita Singkat (Opsional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Saya petani padi organik dari desa..." 
                          className="resize-none bg-background" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-medium mt-6" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    "Daftar Sekarang"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col border-t border-border pt-6 pb-6 text-center">
            <p className="text-sm text-muted-foreground">
              Sudah punya akun?{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">
                Masuk di sini
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
