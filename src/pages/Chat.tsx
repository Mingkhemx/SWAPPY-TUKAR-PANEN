import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, ArrowRightLeft, Leaf, Loader2, Camera, ImagePlus, Handshake, CheckCircle2, XCircle, Trophy, X, Archive, ArchiveRestore, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface DealProposal {
  id: string;
  conversation_id: string;
  proposer_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  offered_commodity?: string;
  offered_quantity?: string;
  wanted_commodity?: string;
  wanted_quantity?: string;
  note?: string;
  created_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'deal';
  photo_url?: string;
  deal_proposal_id?: string;
  deal_proposal?: DealProposal;
  created_at: string;
  sender?: { name: string; avatar_url?: string };
}

interface Conversation {
  id: string;
  barter_id: string;
  last_message?: string;
  last_message_at?: string;
  status: string;
  is_archived: boolean;
  created_at: string;
  participants?: Participant[];
  barter?: { offered_commodity: string; offered_quantity: string; wanted_commodity: string; wanted_quantity: string; user_id: string };
}

interface Participant {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

export default function Chat() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showDealDialog, setShowDealDialog] = useState(false);
  const [isSendingDeal, setIsSendingDeal] = useState(false);
  const [isRespondingDeal, setIsRespondingDeal] = useState<string | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [negoForm, setNegoForm] = useState({ offeredQty: '', wantedQty: '', note: '' });
  const [showArchived, setShowArchived] = useState(false);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ── ambil daftar percakapan ──────────────────────────────────────────────
  const fetchConversations = async (targetConvId?: string) => {
    if (!user) return;
    setIsLoadingConvs(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          barter:barters(offered_commodity, offered_quantity, wanted_commodity, wanted_quantity, user_id),
          participants:conversation_participants_with_users(user_id, name, email, avatar_url)
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      const shaped = (data || []).map((c: any) => ({
        ...c,
        participants: (c.participants || []).map((p: any) => ({
          id: p.user_id,
          name: p.name,
          email: p.email,
          avatar_url: p.avatar_url,
        })),
      }));
      setConversations(shaped);

      if (targetConvId) {
        setActiveConvId(targetConvId);
      } else if (shaped.length > 0 && !activeConvId) {
        setActiveConvId(shaped[0].id);
      }
    } catch (err: any) {
      console.error('fetchConversations error:', err);
    } finally {
      setIsLoadingConvs(false);
    }
  };

  // ── ambil pesan aktif ────────────────────────────────────────────────────
  const fetchMessages = async (convId: string) => {
    setIsLoadingMsgs(true);
    try {
      // Ambil pesan dulu tanpa join deal_proposals
      const { data: msgData, error: msgErr } = await supabase
        .from('messages')
        .select('*, sender:users(id, name, avatar_url)')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (msgErr) throw msgErr;

      // Coba join deal_proposals secara terpisah jika ada pesan tipe 'deal'
      const msgs = msgData || [];
      const dealMsgIds = msgs.filter((m: any) => m.type === 'deal' && m.deal_proposal_id).map((m: any) => m.deal_proposal_id);

      let dealMap: Record<string, any> = {};
      if (dealMsgIds.length > 0) {
        const { data: deals } = await supabase
          .from('deal_proposals')
          .select('*')
          .in('id', dealMsgIds);
        (deals || []).forEach((d: any) => { dealMap[d.id] = d; });
      }

      const enriched = msgs.map((m: any) => ({
        ...m,
        deal_proposal: m.deal_proposal_id ? dealMap[m.deal_proposal_id] || null : null,
      }));

      setMessages(enriched);
    } catch (err: any) {
      console.error('fetchMessages error:', err);
    } finally {
      setIsLoadingMsgs(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convIdFromUrl = params.get('convId');
    fetchConversations(convIdFromUrl || undefined);
    if (convIdFromUrl) {
      window.history.replaceState({}, '', '/chat');
    }
  }, [user]);

  useEffect(() => {
    if (activeConvId) fetchMessages(activeConvId);
  }, [activeConvId]);

  useEffect(() => {
    if (!activeConvId) return;
    const channel = supabase
      .channel(`messages:${activeConvId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvId}` }, () => fetchMessages(activeConvId))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deal_proposals' }, () => fetchMessages(activeConvId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── kirim teks ───────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!content.trim() || !activeConvId || !user) return;
    setIsSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: activeConvId,
        sender_id: user.id,
        content: content.trim(),
        type: 'text',
      });
      if (error) throw error;
      await supabase.from('conversations').update({ last_message: content.trim(), last_message_at: new Date().toISOString() }).eq('id', activeConvId);
      setContent('');
      fetchConversations();
    } catch (err: any) {
      toast({ title: 'Gagal kirim', description: err.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  // ── upload & kirim foto ──────────────────────────────────────────────────
  const handlePhotoUpload = async (file: File) => {
    if (!activeConvId || !user) return;
    setIsUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('chat-images').upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      const { error: msgErr } = await supabase.from('messages').insert({
        conversation_id: activeConvId,
        sender_id: user.id,
        content: '📷 Foto',
        type: 'image',
        photo_url: photoUrl,
      });
      if (msgErr) throw msgErr;
      await supabase.from('conversations').update({ last_message: '📷 Foto', last_message_at: new Date().toISOString() }).eq('id', activeConvId);
      fetchConversations();
    } catch (err: any) {
      toast({ title: 'Gagal upload foto', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // ── kirim deal proposal (negosiasi kuantitas) ───────────────────────────
  const sendDealProposal = async () => {
    if (!activeConvId || !user) return;
    if (!negoForm.offeredQty.trim() || !negoForm.wantedQty.trim()) {
      toast({ title: 'Lengkapi jumlah', description: 'Isi jumlah yang kamu tawarkan dan minta.', variant: 'destructive' });
      return;
    }
    setIsSendingDeal(true);
    try {
      const { data: proposal, error: dealErr } = await supabase
        .from('deal_proposals')
        .insert({
          conversation_id: activeConvId,
          proposer_id: user.id,
          status: 'pending',
          offered_commodity: activeConv?.barter?.offered_commodity,
          offered_quantity: negoForm.offeredQty.trim(),
          wanted_commodity: activeConv?.barter?.wanted_commodity,
          wanted_quantity: negoForm.wantedQty.trim(),
          note: negoForm.note.trim() || null,
        })
        .select().single();
      if (dealErr) throw dealErr;

      const summary = `${activeConv?.barter?.offered_commodity} ${negoForm.offeredQty} ↔ ${activeConv?.barter?.wanted_commodity} ${negoForm.wantedQty}`;
      const { error: msgErr } = await supabase.from('messages').insert({
        conversation_id: activeConvId,
        sender_id: user.id,
        content: `🤝 Nego: ${summary}`,
        type: 'deal',
        deal_proposal_id: proposal.id,
      });
      if (msgErr) throw msgErr;
      await supabase.from('conversations').update({ last_message: `🤝 Nego: ${summary}`, last_message_at: new Date().toISOString() }).eq('id', activeConvId);

      setShowDealDialog(false);
      setNegoForm({ offeredQty: '', wantedQty: '', note: '' });
      fetchConversations();
      toast({ title: '🤝 Negosiasi terkirim!' });
    } catch (err: any) {
      toast({ title: 'Gagal kirim nego', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingDeal(false);
    }
  };

  // ── respon deal proposal ─────────────────────────────────────────────────
  const respondDeal = async (proposalId: string, accept: boolean) => {
    setIsRespondingDeal(proposalId);
    try {
      const newStatus = accept ? 'accepted' : 'rejected';
      const { error } = await supabase.from('deal_proposals').update({ status: newStatus }).eq('id', proposalId);
      if (error) throw error;

      if (accept) {
        toast({ title: '🎉 Deal diterima!', description: 'Klik "Selesaikan Barter" untuk menyelesaikan.' });
      } else {
        toast({ title: 'Deal ditolak', description: 'Negosiasi dapat dilanjutkan.' });
      }
      fetchMessages(activeConvId!);
      fetchConversations();
    } catch (err: any) {
      toast({ title: 'Gagal merespon deal', description: err.message, variant: 'destructive' });
    } finally {
      setIsRespondingDeal(null);
    }
  };

  // ── selesaikan barter ────────────────────────────────────────────────────
  const completeBarter = async () => {
    if (!activeConv?.barter_id) return;
    try {
      // Step 1: Update barter status
      const { error: barterErr } = await supabase.from('barters').update({ status: 'completed' }).eq('id', activeConv.barter_id);
      if (barterErr) throw barterErr;

      // Step 2: Update conversation status (pisah dari is_archived supaya kalau kolom belum ada, status tetap ke-update)
      const { error: convErr } = await supabase.from('conversations').update({ status: 'completed' }).eq('id', activeConvId);
      if (convErr) throw convErr;

      // Step 3: Coba arsipkan (kalau gagal, gak masalah - bukan halangan)
      try {
        await supabase.from('conversations').update({ is_archived: true }).eq('id', activeConvId);
      } catch {
        // Kolom is_archived mungkin belum ada, skip saja
      }

      // Step 4: Kirim pesan sistem ke chat bahwa barter selesai
      await supabase.from('messages').insert({
        conversation_id: activeConvId,
        sender_id: user!.id,
        content: '✅ Barter telah diselesaikan. Percakapan ini sekarang terkunci.',
        type: 'text',
      });

      setShowCompleteDialog(false);
      toast({ title: '✅ Barter selesai!', description: 'Chat telah terkunci.' });
      fetchMessages(activeConvId!);
      fetchConversations();
    } catch (err: any) {
      toast({ title: 'Gagal menyelesaikan', description: err.message, variant: 'destructive' });
    }
  };

  // ── arsipkan percakapan ──────────────────────────────────────────────────
  const archiveConversation = async (convId: string) => {
    setIsArchiving(convId);
    try {
      const { error } = await supabase.from('conversations').update({ is_archived: true }).eq('id', convId);
      if (error) {
        // Kolom is_archived mungkin belum ada di database
        if (error.message?.includes('is_archived') || error.message?.includes('schema cache')) {
          toast({ title: 'Fitur arsip belum tersedia', description: 'Jalankan migration SQL di Supabase terlebih dahulu untuk mengaktifkan arsip.', variant: 'destructive' });
        } else {
          throw error;
        }
        return;
      }
      toast({ title: 'Diarsipkan', description: 'Percakapan dipindahkan ke arsip.' });
      if (activeConvId === convId) setActiveConvId(null);
      fetchConversations();
    } catch (err: any) {
      toast({ title: 'Gagal mengarsipkan', description: err.message, variant: 'destructive' });
    } finally {
      setIsArchiving(null);
    }
  };

  // ── keluarkan dari arsip ─────────────────────────────────────────────────
  const unarchiveConversation = async (convId: string) => {
    setIsArchiving(convId);
    try {
      const { error } = await supabase.from('conversations').update({ is_archived: false }).eq('id', convId);
      if (error) {
        if (error.message?.includes('is_archived') || error.message?.includes('schema cache')) {
          toast({ title: 'Fitur arsip belum tersedia', description: 'Jalankan migration SQL di Supabase terlebih dahulu untuk mengaktifkan arsip.', variant: 'destructive' });
        } else {
          throw error;
        }
        return;
      }
      toast({ title: 'Dikeluarkan dari arsip', description: 'Percakapan dikembalikan ke daftar aktif.' });
      fetchConversations();
    } catch (err: any) {
      toast({ title: 'Gagal mengeluarkan dari arsip', description: err.message, variant: 'destructive' });
    } finally {
      setIsArchiving(null);
    }
  };

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try { return format(new Date(dateStr), 'HH:mm'); } catch { return ''; }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const otherParticipant = activeConv?.participants?.find(p => p.id !== user?.id);
  const isBarterOwner = activeConv?.barter?.user_id === user?.id;
  const isDealAccepted = messages.some(m => m.type === 'deal' && m.deal_proposal?.status === 'accepted');
  const hasPendingDeal = messages.some(m => m.type === 'deal' && m.deal_proposal?.status === 'pending');
  const isConvCompleted = activeConv?.status === 'completed';
  const isConvArchived = activeConv?.is_archived === true;

  // Pisahkan percakapan aktif dan yang diarsipkan
  const activeConvs = conversations.filter(c => !c.is_archived);
  const archivedConvs = conversations.filter(c => c.is_archived);

  // Helper: render satu item percakapan di sidebar
  const renderConvItem = (conv: Conversation, isArchivedSection: boolean) => {
    const partner = conv.participants?.find(p => p.id !== user?.id);
    const isActive = conv.id === activeConvId;
    return (
      <div
        key={conv.id}
        className={`p-4 cursor-pointer transition-colors hover:bg-muted group ${isActive ? 'bg-muted border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'} ${isArchivedSection ? 'opacity-80' : ''}`}
        onClick={() => setActiveConvId(conv.id)}
      >
        <div className="flex items-center gap-3">
          <Avatar className={`h-12 w-12 border border-border ${isArchivedSection ? 'grayscale-[30%]' : ''}`}>
            <AvatarImage src={partner?.avatar_url || ''} />
            <AvatarFallback className="bg-primary/10 text-primary">{partner?.name?.charAt(0) ?? '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline mb-1">
              <h4 className="font-medium text-sm truncate">{partner?.name || partner?.email?.split('@')[0] || 'Petani'}</h4>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTime(conv.last_message_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground truncate flex-1">{conv.last_message || 'Belum ada pesan'}</p>
              {conv.status === 'completed' && <Badge variant="secondary" className="text-[9px] shrink-0">Selesai</Badge>}
            </div>
          </div>
          {/* Tombol Arsip/Keluarkan Arsip */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              if (isArchivedSection) unarchiveConversation(conv.id);
              else archiveConversation(conv.id);
            }}
            disabled={isArchiving === conv.id}
          >
            {isArchiving === conv.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isArchivedSection ? (
              <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Archive className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] max-w-7xl mx-auto w-full bg-background border-x border-border">

      {/* ── Sidebar ── */}
      <div className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-border bg-sidebar ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border bg-card">
          <h2 className="font-poppins font-semibold text-lg">Pesan</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoadingConvs ? (
            <div className="p-8 text-center flex flex-col items-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3" />
              <p>Memuat percakapan...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
              <Leaf className="h-12 w-12 opacity-20 mb-4" />
              <p>Belum ada percakapan.</p>
              <Button variant="link" onClick={() => window.location.href = '/barter'}>Cari Penawaran</Button>
            </div>
          ) : (
            <div>
              {/* ── Percakapan Aktif ── */}
              {activeConvs.length > 0 && (
                <div className="divide-y divide-border">
                  {activeConvs.map(conv => renderConvItem(conv, false))}
                </div>
              )}
              {activeConvs.length === 0 && archivedConvs.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Leaf className="h-10 w-10 opacity-20 mx-auto mb-3" />
                  <p className="text-sm">Belum ada percakapan aktif.</p>
                </div>
              )}

              {/* ── Arsip (WhatsApp-style collapsible) ── */}
              {archivedConvs.length > 0 && (
                <div className="mt-2">
                  <button
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                    onClick={() => setShowArchived(!showArchived)}
                  >
                    {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Archive className="h-4 w-4" />
                    <span>Arsip</span>
                    <Badge variant="secondary" className="text-[10px] ml-1">{archivedConvs.length}</Badge>
                  </button>
                  {showArchived && (
                    <div className="divide-y divide-border border-t border-border bg-muted/30">
                      {archivedConvs.map(conv => renderConvItem(conv, true))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Area Chat ── */}
      <div className={`flex-1 flex flex-col bg-card ${!activeConvId ? 'hidden md:flex' : 'flex'}`}>
        {activeConvId && activeConv ? (
          <>
            {/* Header */}
            <div className="h-16 px-4 border-b border-border flex items-center gap-3 bg-card shadow-sm z-10">
              <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setActiveConvId(null)}>
                <ArrowRightLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-10 w-10 border border-border">
                <AvatarImage src={otherParticipant?.avatar_url || ''} />
                <AvatarFallback className="bg-primary/10 text-primary">{otherParticipant?.name?.charAt(0) ?? '?'}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-medium text-sm leading-none">{otherParticipant?.name ?? 'Petani'}</h3>
                {activeConv.barter && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Barter: {activeConv.barter.offered_commodity} ↔ {activeConv.barter.wanted_commodity}
                  </p>
                )}
              </div>
              {/* Tombol Selesai - hanya pembuat penawaran yang bisa menyelesaikan */}
              {isBarterOwner && isDealAccepted && !isConvCompleted && (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md" onClick={() => setShowCompleteDialog(true)}>
                  <Trophy className="h-4 w-4" /> Selesaikan Barter
                </Button>
              )}
              {/* Badge buat user bukan pemilik: deal diterima tapi menunggu pemilik selesaikan */}
              {!isBarterOwner && isDealAccepted && !isConvCompleted && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">⏳ Menunggu pemilik selesaikan</Badge>
              )}
              {isConvCompleted && !isConvArchived && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">✅ Selesai</Badge>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => archiveConversation(activeConvId!)}
                    disabled={isArchiving === activeConvId}
                    title="Arsipkan"
                  >
                    {isArchiving === activeConvId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                  </Button>
                </div>
              )}
              {isConvArchived && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[9px]">📦 Diarsipkan</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => unarchiveConversation(activeConvId!)}
                    disabled={isArchiving === activeConvId}
                  >
                    {isArchiving === activeConvId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                    Keluarkan
                  </Button>
                </div>
              )}
            </div>

            {/* Pesan */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
              {isLoadingMsgs ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm">Belum ada pesan. Mulai percakapan!</p>
                </div>
              ) : (
                <>
                  {/* ── Kartu Barter Selesai (muncul di atas pesan kalau udah completed) ── */}
                  {isConvCompleted && (
                    <div className="flex justify-center my-4">
                      <div className="w-full max-w-sm rounded-2xl border-2 border-emerald-400 bg-emerald-50 shadow-lg overflow-hidden">
                        <div className="px-5 py-3 flex items-center gap-3 bg-emerald-600">
                          <Trophy className="h-5 w-5 text-white" />
                          <span className="font-semibold text-white text-sm">Barter Selesai</span>
                          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-white/25 text-white">✅ Done</span>
                        </div>
                        <div className="px-5 py-4 text-center space-y-2">
                          <p className="text-sm text-emerald-800 font-medium">Pertukaran berhasil diselesaikan!</p>
                          {activeConv?.barter && (
                            <div className="flex items-center gap-2 bg-white rounded-xl p-3 border border-emerald-200 shadow-sm">
                              <div className="flex-1 text-center">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Ditukar</p>
                                <p className="font-semibold text-sm text-primary">{activeConv.barter.offered_commodity}</p>
                                <p className="text-sm font-bold text-foreground">{activeConv.barter.offered_quantity}</p>
                              </div>
                              <ArrowRightLeft className="h-5 w-5 text-emerald-500 shrink-0" />
                              <div className="flex-1 text-center">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Dengan</p>
                                <p className="font-semibold text-sm text-amber-600">{activeConv.barter.wanted_commodity}</p>
                                <p className="text-sm font-bold text-foreground">{activeConv.barter.wanted_quantity}</p>
                              </div>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                            <Lock className="h-3 w-3" /> Percakapan terkunci
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* ── Daftar pesan ── */}
                  {messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;

                  // ── Deal Card ──
                  if (msg.type === 'deal' && msg.deal_proposal) {
                    const deal = msg.deal_proposal;
                    const isPending = deal.status === 'pending';
                    const isAccepted = deal.status === 'accepted';
                    const canRespond = !isMe && isPending;

                    return (
                      <div key={msg.id} className="flex justify-center my-4">
                        <div className={`w-full max-w-sm rounded-2xl border-2 shadow-lg overflow-hidden ${isAccepted ? 'border-emerald-400 bg-emerald-50' : deal.status === 'rejected' ? 'border-red-200 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                          {/* Header */}
                          <div className={`px-5 py-3 flex items-center gap-3 ${isAccepted ? 'bg-emerald-500' : deal.status === 'rejected' ? 'bg-red-400' : 'bg-amber-400'}`}>
                            <Handshake className="h-5 w-5 text-white" />
                            <span className="font-semibold text-white text-sm">Penawaran Negosiasi</span>
                            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-white/25 text-white">
                              {isPending ? '⏳ Menunggu' : isAccepted ? '✅ Diterima' : '❌ Ditolak'}
                            </span>
                          </div>
                          {/* Isi nego */}
                          <div className="px-5 py-4 space-y-3">
                            <p className="text-xs text-center text-muted-foreground">
                              <span className="font-semibold text-foreground">{isMe ? 'Kamu' : otherParticipant?.name}</span> mengajukan:
                            </p>
                            {/* Kuantitas */}
                            <div className="flex items-center gap-2 bg-white rounded-xl p-3 border border-border shadow-sm">
                              <div className="flex-1 text-center">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Menawarkan</p>
                                <p className="font-semibold text-sm text-primary">{deal.offered_commodity}</p>
                                <p className="text-lg font-bold text-foreground">{deal.offered_quantity}</p>
                              </div>
                              <ArrowRightLeft className="h-5 w-5 text-muted-foreground shrink-0" />
                              <div className="flex-1 text-center">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Meminta</p>
                                <p className="font-semibold text-sm text-amber-600">{deal.wanted_commodity}</p>
                                <p className="text-lg font-bold text-foreground">{deal.wanted_quantity}</p>
                              </div>
                            </div>
                            {deal.note && (
                              <p className="text-xs text-muted-foreground italic text-center bg-white rounded-lg p-2 border border-border">
                                "{deal.note}"
                              </p>
                            )}
                            <p className="text-[10px] text-center text-muted-foreground">{formatTime(msg.created_at)}</p>
                            {canRespond && (
                              <div className="flex gap-3 pt-1">
                                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2" size="sm"
                                  disabled={!!isRespondingDeal} onClick={() => respondDeal(deal.id, true)}>
                                  {isRespondingDeal === deal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                  Setuju
                                </Button>
                                <Button variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2" size="sm"
                                  disabled={!!isRespondingDeal} onClick={() => respondDeal(deal.id, false)}>
                                  <XCircle className="h-4 w-4" /> Tolak
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ── Foto ──
                  if (msg.type === 'image' && msg.photo_url) {
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex gap-2 max-w-[70%]">
                          {!isMe && (
                            <Avatar className="h-8 w-8 shrink-0 mt-auto border border-border">
                              <AvatarImage src={(msg.sender as any)?.avatar_url || ''} />
                              <AvatarFallback className="text-[10px]">{(msg.sender as any)?.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                          )}
                          <div>
                            <div
                              className={`rounded-2xl overflow-hidden cursor-pointer shadow-sm ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                              onClick={() => setPreviewImg(msg.photo_url!)}
                            >
                              <img src={msg.photo_url} alt="foto" className="max-w-full max-h-64 object-cover hover:opacity-90 transition-opacity" />
                            </div>
                            <span className={`text-[10px] block mt-1 ${isMe ? 'text-right text-muted-foreground' : 'text-muted-foreground'}`}>
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ── Teks biasa ──
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className="flex gap-2 max-w-[80%]">
                        {!isMe && (
                          <Avatar className="h-8 w-8 shrink-0 mt-auto border border-border">
                            <AvatarImage src={(msg.sender as any)?.avatar_url || ''} />
                            <AvatarFallback className="text-[10px]">{(msg.sender as any)?.name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={`rounded-2xl px-4 py-2 ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border text-foreground rounded-bl-sm shadow-sm'}`}>
                          <p className="text-sm break-words">{msg.content}</p>
                          <span className={`text-[10px] block mt-1 ${isMe ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'}`}>{formatTime(msg.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {!isConvCompleted ? (
              <div className="p-4 bg-card border-t border-border">
                {/* Action buttons */}
                <div className="flex gap-2 mb-3">
                  {/* Kamera */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs h-8 rounded-full"
                    disabled={isUploadingPhoto}
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    {isUploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    Kamera
                  </Button>
                  {/* Upload foto */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs h-8 rounded-full"
                    disabled={isUploadingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    Foto
                  </Button>
                  {/* Deal - selalu bisa ajukan, berkali-kali */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs h-8 rounded-full border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={() => setShowDealDialog(true)}
                  >
                    <Handshake className="h-3.5 w-3.5" />
                    Ajukan Deal
                  </Button>
                  {hasPendingDeal && (
                    <Badge variant="outline" className="text-xs h-8 px-3 rounded-full border-amber-300 text-amber-700">
                      ⏳ Menunggu respons
                    </Badge>
                  )}
                  {isDealAccepted && !isConvCompleted && (
                    <Badge className="text-xs h-8 px-3 rounded-full bg-emerald-100 text-emerald-800 border-emerald-200">
                      🎉 Deal diterima!
                    </Badge>
                  )}
                </div>
                {/* Text input */}
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Ketik pesan..."
                    className="rounded-full bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background h-12 px-4"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    autoComplete="off"
                    disabled={isSending}
                  />
                  <Button
                    size="icon"
                    className="rounded-full h-12 w-12 shrink-0 bg-primary hover:bg-primary/90 shadow-md"
                    onClick={sendMessage}
                    disabled={isSending || !content.trim()}
                  >
                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>

                {/* Hidden inputs */}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ''; }} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ''; }} />
              </div>
            ) : isConvCompleted ? (
              <div className="p-4 bg-emerald-50 border-t border-emerald-200">
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-emerald-700">
                    <Lock className="h-4 w-4" />
                    <p className="text-sm font-medium">Barter ini telah selesai</p>
                  </div>
                  {activeConv?.barter && (
                    <p className="text-xs text-emerald-600">
                      {activeConv.barter.offered_commodity} ↔ {activeConv.barter.wanted_commodity}
                    </p>
                  )}
                  {!isConvArchived && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-1 gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                      onClick={() => archiveConversation(activeConvId!)}
                      disabled={isArchiving === activeConvId}
                    >
                      {isArchiving === activeConvId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                      Arsipkan Percakapan
                    </Button>
                  )}
                  {isConvArchived && (
                    <p className="text-[10px] text-emerald-500">Percakapan ini ada di dalam arsip</p>
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
            <div className="h-20 w-20 bg-card rounded-full border border-border shadow-sm flex items-center justify-center mb-6">
              <Leaf className="h-10 w-10 text-primary/40" />
            </div>
            <h3 className="font-poppins text-xl font-medium text-foreground mb-2">Mulai Percakapan</h3>
            <p className="max-w-md text-center">Pilih percakapan di bilah samping atau mulai negosiasi baru dari halaman Forum Barter.</p>
          </div>
        )}
      </div>

      {/* ── Dialog: Negosiasi Kuantitas ── */}
      <Dialog open={showDealDialog} onOpenChange={setShowDealDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-amber-500" /> Ajukan Negosiasi
            </DialogTitle>
            <DialogDescription>
              Tentukan jumlah yang kamu tawarkan dan yang kamu minta dari <strong>{otherParticipant?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Menawarkan */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-primary">Saya Menawarkan</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground min-w-0 flex-1 truncate">{activeConv?.barter?.offered_commodity}</span>
                <Input
                  placeholder={`contoh: ${activeConv?.barter?.offered_quantity || '50 kg'}`}
                  className="w-32 text-center"
                  value={negoForm.offeredQty}
                  onChange={e => setNegoForm(f => ({ ...f, offeredQty: e.target.value }))}
                />
              </div>
            </div>

            {/* Meminta */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-700">Saya Meminta</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground min-w-0 flex-1 truncate">{activeConv?.barter?.wanted_commodity}</span>
                <Input
                  placeholder={`contoh: ${activeConv?.barter?.wanted_quantity || '2 karung'}`}
                  className="w-32 text-center"
                  value={negoForm.wantedQty}
                  onChange={e => setNegoForm(f => ({ ...f, wantedQty: e.target.value }))}
                />
              </div>
            </div>

            {/* Catatan */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Catatan (opsional)</label>
              <Input
                placeholder="Mis. Bisa antar ke lokasi saya..."
                className="mt-1"
                value={negoForm.note}
                onChange={e => setNegoForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowDealDialog(false)}>Batal</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white gap-2" onClick={sendDealProposal} disabled={isSendingDeal}>
              {isSendingDeal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Handshake className="h-4 w-4" />}
              Kirim Negosiasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Selesaikan Barter ── */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-emerald-500" /> Selesaikan Barter
            </DialogTitle>
            <DialogDescription>
              Konfirmasi bahwa barter ini telah berhasil diselesaikan. Penawaran akan ditandai sebagai selesai.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
            <p className="font-medium mb-1">Barter:</p>
            <p>{activeConv?.barter?.offered_commodity} ↔ {activeConv?.barter?.wanted_commodity}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Batal</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={completeBarter}>
              <Trophy className="h-4 w-4" /> Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Preview Foto Fullscreen ── */}
      {previewImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setPreviewImg(null)}>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20" onClick={() => setPreviewImg(null)}>
            <X className="h-6 w-6" />
          </Button>
          <img src={previewImg} alt="preview" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
