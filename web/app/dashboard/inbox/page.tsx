"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import { Archive, ArrowLeft, Check, CheckCheck, FileAudio, FileImage, FileText, Loader2, MapPin, MessageSquare, Paperclip, Pin, Plus, Reply, Search, Send, Users, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch, apiUpload, getAccessToken, apiUrl } from "@/lib/api";

interface Chat {
  accountJid: string;
  jid: string;
  name: string | null;
  isGroup: boolean;
  unreadCount: number;
  lastMessageId: string | null;
  lastMessageText: string | null;
  lastMessageType: string | null;
  lastMessageAt: string | null;
  isArchived: boolean;
  isPinned: boolean;
  mutedUntil: string | null;
  labels: string[];
  updatedAt: string;
}

interface Message {
  accountJid: string;
  chatJid: string;
  messageId: string;
  participantJid: string | null;
  participantName: string | null;
  fromMe: boolean;
  messageType: string;
  text: string | null;
  caption: string | null;
  mimeType: string | null;
  fileName: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  quotedMessageId: string | null;
  status: string;
  sentAt: string;
}

interface Contact {
  accountJid: string;
  jid: string;
  name: string | null;
  notify: string | null;
  verifiedName: string | null;
  phonebookName: string | null;
  updatedAt: string;
}

interface SessionState {
  status: string;
  accountJid: string | null;
  phoneNumber: string | null;
  lastError: string | null;
}

interface WhatsAppAccount {
  accountJid: string;
  phoneNumber: string | null;
  lastConnectedAt: string | null;
  isActive: boolean;
}

interface SearchResult {
  chats: Chat[];
  messages: Message[];
  contacts: Contact[];
}

interface GroupMembers {
  jid: string;
  subject: string;
  participants: Array<{ jid: string; name: string | null; admin: string | null }>;
}

type InboxTab = "chats" | "contacts" | "groups";
type ChatFilter = "all" | "unread" | "pinned";

function titleFor(chat: Pick<Chat, "name" | "jid">) {
  return chat.name || chat.jid.split("@")[0];
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function previewFor(message: Pick<Message, "messageType" | "text" | "caption" | "fileName"> | null | undefined) {
  if (!message) return "No messages yet";
  if (message.text) return message.text;
  if (message.caption) return message.caption;
  if (message.fileName) return message.fileName;
  if (message.messageType === "image") return "Photo";
  if (message.messageType === "audio") return "Audio message";
  if (message.messageType === "video") return "Video";
  if (message.messageType === "location") return "Location";
  if (message.messageType === "document") return "Document";
  return message.messageType === "unknown" ? "Message" : message.messageType;
}

function messageIcon(type: string) {
  if (type === "image" || type === "video") return <FileImage className="h-4 w-4" />;
  if (type === "audio") return <FileAudio className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function accountPath(path: string, accountJid: string | null): string {
  if (!accountJid) return path;
  return `${path}${path.includes("?") ? "&" : "?"}accountJid=${encodeURIComponent(accountJid)}`;
}

function accountTitle(account: WhatsAppAccount): string {
  if (account.accountJid === "legacy") return "Previous chats · before separation";
  return account.phoneNumber ?? account.accountJid;
}

export default function InboxPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [selectedAccountJid, setSelectedAccountJid] = useState<string | null>(null);
  const [importingContacts, setImportingContacts] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [activeJid, setActiveJid] = useState<string | null>(null);
  const [tab, setTab] = useState<InboxTab>("chats");
  const [chatFilter, setChatFilter] = useState<ChatFilter>("all");
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult>({ chats: [], messages: [], contacts: [] });
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [composer, setComposer] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [members, setMembers] = useState<GroupMembers | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [groupSubject, setGroupSubject] = useState("");
  const [groupParticipants, setGroupParticipants] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [openingChat, setOpeningChat] = useState(false);
  const [contactImportCountryCode, setContactImportCountryCode] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contactsInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeJidRef = useRef<string | null>(null);
  const accountJidRef = useRef<string | null>(null);
  const archivedRef = useRef(false);

  const connected = session?.status === "connected" && session.accountJid === selectedAccountJid;
  const selectedAccount = accounts.find((account) => account.accountJid === selectedAccountJid) ?? null;
  const activeChat = chats.find((chat) => chat.jid === activeJid) ?? null;

  const loadChats = useCallback(async (showArchived: boolean, accountJid = selectedAccountJid) => {
    if (!accountJid) {
      setChats([]);
      return;
    }
    const result = await apiFetch<{ chats: Chat[] }>(accountPath(`/dashboard/whatsapp/chats?archived=${showArchived}`, accountJid));
    setChats(result.chats);
  }, [selectedAccountJid]);

  const loadContacts = useCallback(async (accountJid = selectedAccountJid) => {
    if (!accountJid) {
      setContacts([]);
      return;
    }
    const result = await apiFetch<{ contacts: Contact[] }>(accountPath("/dashboard/whatsapp/contacts", accountJid));
    setContacts(result.contacts);
  }, [selectedAccountJid]);

  const loadMessages = useCallback(async (jid: string, accountJid = selectedAccountJid) => {
    if (!accountJid) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    try {
      const result = await apiFetch<{ messages: Message[] }>(accountPath(`/dashboard/whatsapp/chats/${encodeURIComponent(jid)}/messages?limit=50`, accountJid));
      setMessages(result.messages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load this conversation.");
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, [selectedAccountJid]);

  const loadAccounts = useCallback(async () => {
    const result = await apiFetch<{ accounts: WhatsAppAccount[] }>("/dashboard/whatsapp/accounts");
    setAccounts(result.accounts);
    return result.accounts;
  }, []);

  const appendMessage = useCallback((message: Message) => {
    setMessages((current) => {
      if (current.some((item) => item.accountJid === message.accountJid && item.messageId === message.messageId && item.chatJid === message.chatJid)) return current;
      return [...current, message].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
    });
  }, []);

  useEffect(() => {
    activeJidRef.current = activeJid;
  }, [activeJid]);

  useEffect(() => {
    accountJidRef.current = selectedAccountJid;
  }, [selectedAccountJid]);

  useEffect(() => {
    archivedRef.current = archived;
    void loadChats(archived, selectedAccountJid).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load chats."));
  }, [archived, selectedAccountJid, loadChats]);

  useEffect(() => {
    setChats([]);
    setContacts([]);
    setActiveJid(null);
    activeJidRef.current = null;
    setMessages([]);
    setReplyTo(null);
    setMembers(null);
    setSearchResults({ chats: [], messages: [], contacts: [] });
    if (selectedAccountJid) {
      void loadContacts(selectedAccountJid).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load contacts."));
    } else {
      setContacts([]);
    }
  }, [selectedAccountJid, loadContacts]);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    async function bootstrap() {
      try {
        const [sessionResult, accountsResult] = await Promise.all([
          apiFetch<{ session: SessionState }>("/dashboard/whatsapp/session"),
          apiFetch<{ accounts: WhatsAppAccount[]; activeAccountJid: string | null }>("/dashboard/whatsapp/accounts")
        ]);
        if (!cancelled) {
          setSession(sessionResult.session);
          setAccounts(accountsResult.accounts);
          setSelectedAccountJid(sessionResult.session.accountJid ?? accountsResult.activeAccountJid ?? accountsResult.accounts[0]?.accountJid ?? null);
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load WhatsApp status.");
      } finally {
        if (!cancelled) setLoading(false);
      }

      const token = await getAccessToken();
      if (!token || cancelled) return;
      socket = io(apiUrl, { auth: { token }, transports: ["websocket", "polling"] });
      socketRef.current = socket;
      socket.on("session:state", (state: SessionState) => setSession(state));
      socket.on("whatsapp:chat", (chat: Chat) => {
        if (chat.accountJid !== accountJidRef.current) return;
        setChats((current) => {
          const next = current.filter((item) => item.jid !== chat.jid);
          if (chat.isArchived === archivedRef.current) next.push(chat);
          return next.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || Date.parse(b.lastMessageAt ?? b.updatedAt) - Date.parse(a.lastMessageAt ?? a.updatedAt));
        });
      });
      socket.on("whatsapp:message", (message: Message) => {
        if (message.accountJid !== accountJidRef.current) return;
        if (activeJidRef.current === message.chatJid) appendMessage(message);
        void loadChats(archivedRef.current, accountJidRef.current);
      });
    }

    void bootstrap();
    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [appendMessage, loadChats]);

  useEffect(() => {
    const term = query.trim();
    if (!term || !selectedAccountJid) {
      setSearchResults({ chats: [], messages: [], contacts: [] });
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      apiFetch<SearchResult>(accountPath(`/dashboard/whatsapp/search?q=${encodeURIComponent(term)}`, selectedAccountJid))
        .then((result) => { if (!cancelled) setSearchResults(result); })
        .catch((error) => { if (!cancelled) toast.error(error instanceof Error ? error.message : "Search failed."); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [query, selectedAccountJid]);

  useEffect(() => {
    if (!session?.accountJid) return;
    setSelectedAccountJid(session.accountJid);
    void loadAccounts().catch((error) => toast.error(error instanceof Error ? error.message : "Could not refresh linked accounts."));
  }, [session?.accountJid, loadAccounts]);

  const openChat = useCallback(async (jid: string, name?: string | null) => {
    activeJidRef.current = jid;
    setActiveJid(jid);
    setReplyTo(null);
    setMembers(null);
    await loadMessages(jid, selectedAccountJid);
    if (connected) {
      try {
        const result = await apiFetch<{ chat: Chat }>(accountPath(`/dashboard/whatsapp/chats/${encodeURIComponent(jid)}`, selectedAccountJid), {
          method: "PATCH",
          body: JSON.stringify({ action: "mark_read" })
        });
        setChats((current) => current.map((chat) => chat.jid === jid ? result.chat : chat));
      } catch {
        // Keep reading available while WhatsApp is reconnecting.
      }
    }
    if (name) setChats((current) => current.map((chat) => chat.jid === jid ? { ...chat, name } : chat));
  }, [loadMessages, selectedAccountJid, connected]);

  async function openContact(contact: Contact) {
    try {
      await apiFetch("/dashboard/whatsapp/chats/open", {
        method: "POST",
        body: JSON.stringify({ jid: contact.jid, accountJid: selectedAccountJid, name: contact.name || contact.notify })
      });
      await loadChats(archived, selectedAccountJid);
      await openChat(contact.jid, contact.name || contact.notify);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the contact.");
    }
  }

  async function startChat(event: FormEvent) {
    event.preventDefault();
    const phone = newChatPhone.trim();
    if (!phone) return;
    setOpeningChat(true);
    try {
      const result = await apiFetch<{ jid: string }>("/dashboard/whatsapp/chats/open", {
        method: "POST",
        body: JSON.stringify({ jid: phone, accountJid: selectedAccountJid, name: newChatName.trim() || undefined })
      });
      await loadChats(archived, selectedAccountJid);
      setNewChatOpen(false);
      setNewChatPhone("");
      const name = newChatName.trim();
      setNewChatName("");
      await openChat(result.jid, name || null);
      toast.success("Conversation opened");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open this conversation.");
    } finally {
      setOpeningChat(false);
    }
  }

  async function modifyChat(action: string, options: Record<string, unknown> = {}) {
    if (!activeJid) return;
    try {
      const result = await apiFetch<{ chat: Chat }>(accountPath(`/dashboard/whatsapp/chats/${encodeURIComponent(activeJid)}`, selectedAccountJid), {
        method: "PATCH",
        body: JSON.stringify({ action, ...options })
      });
      setChats((current) => {
        const filtered = current.filter((chat) => chat.jid !== activeJid);
        if (result.chat.isArchived === archived) filtered.unshift(result.chat);
        return filtered;
      });
      toast.success(action === "labels" ? "Labels saved" : "Chat updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the chat.");
    }
  }

  async function submitText(event: FormEvent) {
    event.preventDefault();
    if (!activeJid || !connected || !composer.trim()) return;
    setSending(true);
    try {
      const result = await apiFetch<{ message: Message }>(accountPath(`/dashboard/whatsapp/chats/${encodeURIComponent(activeJid)}/messages`, selectedAccountJid), {
        method: "POST",
        body: JSON.stringify({ text: composer.trim(), quotedMessageId: replyTo?.messageId })
      });
      appendMessage(result.message);
      setComposer("");
      setReplyTo(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  }

  async function sendFile(file: File) {
    if (!activeJid || !connected) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Files must be 8 MB or smaller.");
      return;
    }
    const mediaType = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "document";
    const params = new URLSearchParams({ mediaType, mimeType: file.type || "application/octet-stream", fileName: file.name });
    if (selectedAccountJid) params.set("accountJid", selectedAccountJid);
    if (composer.trim()) params.set("caption", composer.trim());
    if (replyTo) params.set("quotedMessageId", replyTo.messageId);
    setSending(true);
    try {
      const result = await apiUpload<{ message: Message }>(`/dashboard/whatsapp/chats/${encodeURIComponent(activeJid)}/media?${params}`, file);
      appendMessage(result.message);
      setComposer("");
      setReplyTo(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the file.");
    } finally {
      setSending(false);
    }
  }

  async function importPhoneContacts(file: File) {
    if (!selectedAccountJid) {
      toast.error("Connect WhatsApp before importing contacts.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("vCard files must be 5 MB or smaller.");
      return;
    }
    const params = new URLSearchParams({ accountJid: selectedAccountJid });
    if (contactImportCountryCode.trim()) params.set("countryCode", contactImportCountryCode.trim());
    setImportingContacts(true);
    try {
      const result = await apiUpload<{ imported: number; skipped: number }>(`/dashboard/whatsapp/contacts/import?${params}`, file);
      await Promise.all([loadContacts(selectedAccountJid), loadChats(archived, selectedAccountJid)]);
      toast.success(`Imported ${result.imported} phone contacts${result.skipped ? `; skipped ${result.skipped} entries` : ""}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import this vCard file.");
    } finally {
      setImportingContacts(false);
    }
  }

  async function shareLocation() {
    if (!activeJid || !connected) return;
    if (!navigator.geolocation) {
      toast.error("Location sharing is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      setSending(true);
      try {
        const result = await apiFetch<{ message: Message }>(accountPath(`/dashboard/whatsapp/chats/${encodeURIComponent(activeJid)}/location`, selectedAccountJid), {
          method: "POST",
          body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude })
        });
        appendMessage(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not share location.");
      } finally {
        setSending(false);
      }
    }, () => toast.error("Allow location access to share your location."), { enableHighAccuracy: true, timeout: 10000 });
  }

  async function react(message: Message, emoji: string) {
    if (!activeJid || !connected) return;
    try {
      const result = await apiFetch<{ message: Message }>(accountPath(`/dashboard/whatsapp/chats/${encodeURIComponent(activeJid)}/reactions`, selectedAccountJid), {
        method: "POST",
        body: JSON.stringify({ messageId: message.messageId, reaction: emoji })
      });
      appendMessage(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reaction.");
    }
  }

  async function showGroupMembers() {
    if (!activeJid || !connected) return;
    try {
      const result = await apiFetch<GroupMembers>(`/dashboard/whatsapp/groups/${encodeURIComponent(activeJid)}/members`);
      setMembers(result);
      setMembersOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load group members.");
    }
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    const participants = groupParticipants.split(/[\n,;]/).map((number) => number.trim()).filter(Boolean);
    setCreatingGroup(true);
    try {
      const result = await apiFetch<{ group: { jid: string; subject: string } }>("/dashboard/whatsapp/groups", {
        method: "POST",
        body: JSON.stringify({ subject: groupSubject, participants })
      });
      await loadChats(archived);
      setGroupFormOpen(false);
      setGroupSubject("");
      setGroupParticipants("");
      setTab("groups");
      await openChat(result.group.jid, result.group.subject);
      toast.success("Group created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create group.");
    } finally {
      setCreatingGroup(false);
    }
  }

  const visibleChats = useMemo(() => {
    let next = tab === "groups" ? chats.filter((chat) => chat.isGroup) : chats.filter((chat) => !chat.isGroup);
    if (tab !== "groups") {
      if (chatFilter === "unread") next = next.filter((chat) => chat.unreadCount > 0);
      if (chatFilter === "pinned") next = next.filter((chat) => chat.isPinned);
    }
    return next;
  }, [chats, tab, chatFilter]);

  const searchedChats = searchResults.chats;
  const visibleContacts = query.trim() ? searchResults.contacts : contacts;
  const headerTitle = activeChat ? titleFor(activeChat) : "Choose a conversation";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">Inbox</h1><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{chats.length}</span></div>
          <p className="mt-1 text-sm text-muted-foreground">Your WhatsApp conversations, all in one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {accounts.length > 0 && <label className="sr-only" htmlFor="inbox-account">WhatsApp number and chat history</label>}
          {accounts.length > 0 && <select id="inbox-account" aria-label="WhatsApp number and chat history" value={selectedAccountJid ?? ""} onChange={(event) => setSelectedAccountJid(event.target.value || null)} className="h-9 max-w-[220px] rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {accounts.map((account) => <option key={account.accountJid} value={account.accountJid}>{accountTitle(account)}{account.isActive ? " · connected" : " · history"}</option>)}
          </select>}
          <Badge variant={connected ? "success" : "secondary"} className="capitalize" aria-live="polite">{connected ? "Connected" : session?.status === "connected" && selectedAccountJid ? "Read-only history" : session?.status ?? "Checking connection"}</Badge>
          {!connected && <Button asChild size="sm" variant="outline"><Link href="/dashboard/whatsapp">{session?.status === "connected" ? "Switch number" : "Connect WhatsApp"}</Link></Button>}
        </div>
      </div>

      {!connected && !loading && (
        <Card className="flex items-center justify-between gap-4 border-amber-500/20 bg-amber-500/5 p-4 text-sm">
          <span className="text-muted-foreground">{selectedAccountJid === "legacy" ? "This is older history saved before account separation. Its original WhatsApp number could not be identified, so chats from different numbers may already be mixed here. It is preserved as a read-only archive." : session?.status === "connected" && selectedAccount ? `You are viewing history for ${accountTitle(selectedAccount)}. Reconnect this number in WhatsApp settings to send from it.` : "Your WhatsApp session is disconnected. Saved conversations remain readable; connect to send messages or sync new ones."}</span>
          <Link href="/dashboard/whatsapp"><Button size="sm">{session?.status === "connected" ? "Switch number" : "Connect"}</Button></Link>
        </Card>
      )}

      <Card className="grid min-h-[min(740px,calc(100dvh-220px))] overflow-hidden border-border/80 shadow-sm md:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <aside aria-label="Conversations and contacts" className={`${activeJid ? "hidden md:flex" : "flex"} min-h-[560px] min-w-0 flex-col border-r border-border md:min-h-0`}>
          <div className="space-y-3 border-b border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div><div className="font-semibold">Messages</div><div className="mt-0.5 text-xs text-muted-foreground">{chats.filter((chat) => chat.unreadCount > 0).length} unread · {chats.length} total</div></div>
              <div className="flex items-center gap-1.5">
                <Button type="button" size="sm" onClick={() => setNewChatOpen(true)} disabled={!selectedAccountJid} aria-label="Start a chat with a phone number"><MessageSquare className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">New chat</span><span className="sm:hidden">New</span></Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setGroupFormOpen(true)} disabled={!connected} title={!connected ? "Connect WhatsApp before creating a group" : undefined} aria-label="Create WhatsApp group"><Plus className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Group</span></Button>
              </div>
            </div>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search chats, contacts, and messages" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats and messages" className="h-10 pl-9 pr-9" />
              {query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear search"><X className="h-4 w-4" /></button>}
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Conversation type">
              {(["chats", "groups", "contacts"] as InboxTab[]).map((value) => (
                <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`min-h-9 rounded-lg px-3 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                  {value}
                </button>
              ))}
              {tab !== "contacts" && <button type="button" aria-pressed={archived} onClick={() => setArchived((value) => !value)} className="ml-auto min-h-9 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{archived ? "Inbox" : "Archived"}</button>}
            </div>
            {tab !== "contacts" && <div className="flex items-center gap-1.5" role="group" aria-label="Filter chats">
              {(["all", "unread", "pinned"] as ChatFilter[]).map((filter) => <button key={filter} type="button" aria-pressed={chatFilter === filter} onClick={() => setChatFilter(filter)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${chatFilter === filter ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:bg-muted"}`}>{filter}{filter === "unread" && <span className="ml-1.5 opacity-70">{chats.filter((chat) => chat.unreadCount > 0).length}</span>}</button>)}
            </div>}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "contacts" && !query.trim() && <div className="space-y-3 border-b border-border bg-muted/20 p-3">
              <div className="text-sm font-medium">Phone contact names</div>
              <p className="text-xs leading-5 text-muted-foreground">Your browser cannot read your phone’s address book automatically. Import a .vcf contact export to match your saved names to WhatsApp numbers.</p>
              <div className="flex flex-wrap gap-2">
                <Input aria-label="Country calling code for local-format contacts" type="tel" inputMode="tel" value={contactImportCountryCode} onChange={(event) => setContactImportCountryCode(event.target.value)} placeholder="Country code, e.g. +964" className="h-9 min-w-0 flex-1" />
                <input ref={contactsInputRef} type="file" accept=".vcf,text/vcard,text/x-vcard" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importPhoneContacts(file); }} />
                <Button type="button" size="sm" variant="outline" disabled={!selectedAccountJid || importingContacts} onClick={() => contactsInputRef.current?.click()}>{importingContacts ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Import .vcf</Button>
              </div>
            </div>}
            {loading ? (
              <div className="space-y-3 p-4" role="status" aria-label="Loading conversations">{[0, 1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted/50" />)}</div>
            ) : query.trim() ? (
              <div className="space-y-3 p-3">
                {!!searchedChats.length && <div><div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">Chats</div>{searchedChats.map((chat) => <ChatRow key={chat.jid} chat={chat} active={activeJid === chat.jid} onClick={() => void openChat(chat.jid, chat.name)} />)}</div>}
                {!!searchResults.messages.length && <div><div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">Messages</div>{searchResults.messages.map((message) => <button key={`${message.chatJid}:${message.messageId}`} type="button" onClick={() => void openChat(message.chatJid)} className="mb-1 block w-full rounded-xl px-3 py-2 text-left hover:bg-muted/60"><div className="truncate text-xs font-medium">{message.chatJid}</div><div className="truncate text-sm text-muted-foreground">{previewFor(message)}</div></button>)}</div>}
                {!!searchResults.contacts.length && <div><div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">Contacts</div>{searchResults.contacts.map((contact) => <ContactRow key={contact.jid} contact={contact} onClick={() => void openContact(contact)} />)}</div>}
                {!searchedChats.length && !searchResults.messages.length && !searchResults.contacts.length && <p className="p-5 text-center text-sm text-muted-foreground">No matches found.</p>}
              </div>
            ) : tab === "contacts" ? (
              visibleContacts.length ? visibleContacts.map((contact) => <ContactRow key={contact.jid} contact={contact} onClick={() => void openContact(contact)} />) : <EmptyList text="Contacts appear after WhatsApp syncs them or after you import a .vcf file." />
            ) : (
              visibleChats.length ? visibleChats.map((chat) => <ChatRow key={chat.jid} chat={chat} active={activeJid === chat.jid} onClick={() => void openChat(chat.jid, chat.name)} />) : <EmptyList text={tab === "groups" ? "No groups found." : chatFilter !== "all" ? `No ${chatFilter} conversations.` : "No chats found. Connect WhatsApp and wait for your chat history to sync."} />
            )}
          </div>
        </aside>

        <section aria-label="Selected conversation" className={`${activeJid ? "flex" : "hidden md:flex"} min-h-[560px] min-w-0 flex-col md:min-h-0`}>
          {activeJid ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={() => { setActiveJid(null); activeJidRef.current = null; }} aria-label="Back to conversations"><ArrowLeft className="h-4 w-4" /></Button>
                  <ChatAvatar chat={activeChat} className="h-11 w-11" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{headerTitle}</div>
                    <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"><span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />{activeChat?.isGroup ? `${activeChat.unreadCount ? `${activeChat.unreadCount} unread · ` : ""}WhatsApp group` : activeJid}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {activeChat?.isGroup && <Button type="button" variant="ghost" size="sm" onClick={() => void showGroupMembers()} disabled={!connected} aria-label="View group members"><Users className="mr-1.5 h-4 w-4" /><span className="hidden sm:inline">Members</span></Button>}
                  <Button type="button" variant="ghost" size="icon" disabled={!connected} title={activeChat?.isPinned ? "Unpin chat" : "Pin chat"} aria-label={activeChat?.isPinned ? "Unpin chat" : "Pin chat"} aria-pressed={!!activeChat?.isPinned} onClick={() => void modifyChat(activeChat?.isPinned ? "unpin" : "pin")}><Pin className={`h-4 w-4 ${activeChat?.isPinned ? "text-primary" : ""}`} /></Button>
                  <Button type="button" variant="ghost" size="icon" disabled={!connected} title={activeChat?.mutedUntil ? "Unmute chat" : "Mute for 8 hours"} aria-label={activeChat?.mutedUntil ? "Unmute chat" : "Mute for 8 hours"} aria-pressed={!!activeChat?.mutedUntil} onClick={() => void modifyChat(activeChat?.mutedUntil ? "unmute" : "mute", { durationMinutes: 480 })}><VolumeX className={`h-4 w-4 ${activeChat?.mutedUntil ? "text-primary" : ""}`} /></Button>
                  <Button type="button" variant="ghost" size="icon" disabled={!connected} title={activeChat?.isArchived ? "Unarchive chat" : "Archive chat"} aria-label={activeChat?.isArchived ? "Unarchive chat" : "Archive chat"} onClick={() => void modifyChat(activeChat?.isArchived ? "unarchive" : "archive")}><Archive className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" disabled={!connected} title="Mark unread" aria-label="Mark unread" onClick={() => void modifyChat("mark_unread")}><CheckCheck className="h-4 w-4" /></Button>
                </div>
              </header>

              {membersOpen && members && (
                <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between"><div className="font-medium">{members.subject} · {members.participants.length} members</div><button type="button" onClick={() => setMembersOpen(false)} aria-label="Close members"><X className="h-4 w-4" /></button></div>
                  <div className="flex flex-wrap gap-2">{members.participants.map((member) => <Badge key={member.jid} variant="secondary">{member.name || member.jid.split("@")[0]}{member.admin ? ` · ${member.admin}` : ""}</Badge>)}</div>
                </div>
              )}

              {!!activeChat?.labels.length && <div className="flex flex-wrap items-center gap-2 border-b border-border/30 px-4 py-2">{activeChat.labels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}</div>}
              <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto bg-[radial-gradient(ellipse_at_top,_hsl(var(--muted))_0%,_hsl(var(--background))_70%)] px-3 py-4 sm:px-6" role="log" aria-live="polite" aria-relevant="additions text" aria-label={`Messages with ${headerTitle}`}>
                <div className="space-y-3">
                  {messagesLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : messages.length ? messages.map((message) => (
                    <MessageBubble key={`${message.chatJid}:${message.messageId}`} message={message} messages={messages} onReply={() => setReplyTo(message)} onReact={(emoji) => void react(message, emoji)} />
                  )) : <div className="py-12 text-center text-sm text-muted-foreground">No messages stored for this chat yet.</div>}
                </div>
              </div>

              {!connected && <div className="border-t border-border/40 bg-amber-500/5 px-4 py-2 text-center text-xs text-muted-foreground">Reconnect WhatsApp to send messages and sync incoming ones.</div>}
              {activeChat && <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2 sm:px-4">
                <Input aria-label="New conversation label" value={labelDraft} onChange={(event) => setLabelDraft(event.target.value)} placeholder="Add a label" className="h-9 max-w-48" onKeyDown={(event) => { if (event.key === "Enter" && labelDraft.trim()) { void modifyChat("labels", { labels: [...new Set([...(activeChat.labels ?? []), labelDraft.trim()])] }); setLabelDraft(""); } }} />
                <Button type="button" size="sm" variant="outline" onClick={() => { if (!labelDraft.trim()) return; void modifyChat("labels", { labels: [...new Set([...(activeChat.labels ?? []), labelDraft.trim()])] }); setLabelDraft(""); }}>Add label</Button>
                {activeChat.labels.length > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => void modifyChat("labels", { labels: [] })}>Clear labels</Button>}
              </div>}

              <form onSubmit={submitText} className="border-t border-border bg-card p-3 sm:p-4">
                {replyTo && <div className="mb-2 flex items-center justify-between rounded-lg border-l-2 border-primary bg-muted/40 px-3 py-2 text-xs"><div className="min-w-0"><div className="font-medium">Replying to {replyTo.fromMe ? "you" : replyTo.participantName || replyTo.participantJid?.split("@")[0] || "contact"}</div><div className="truncate text-muted-foreground">{previewFor(replyTo)}</div></div><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="h-4 w-4" /></button></div>}
                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,audio/*,application/pdf,text/plain,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void sendFile(file); }} />
                  <Button type="button" variant="ghost" size="icon" disabled={!connected || sending} onClick={() => fileInputRef.current?.click()} title="Attach photo, audio, or document" aria-label="Attach a photo, audio file, or document"><Paperclip className="h-5 w-5" /></Button>
                  <Button type="button" variant="ghost" size="icon" disabled={!connected || sending} onClick={() => void shareLocation()} title="Share location" aria-label="Share your current location"><MapPin className="h-5 w-5" /></Button>
                  <textarea aria-label="Message text" value={composer} onChange={(event) => setComposer(event.target.value)} disabled={!connected || sending} placeholder={connected ? "Write a message…" : "Connect WhatsApp to send a message"} rows={1} className="max-h-32 min-h-10 flex-1 resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
                  <Button type="submit" size="icon" disabled={!connected || !composer.trim() || sending} aria-label="Send message">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                </div>
              </form>
            </>
          ) : (
            <div className="relative flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden bg-[radial-gradient(ellipse_at_top,_hsl(var(--muted))_0%,_hsl(var(--background))_70%)] px-6 text-center text-muted-foreground">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-border bg-card text-primary shadow-sm"><MessageSquare className="h-7 w-7" /></div>
              <div className="text-lg font-semibold text-foreground">Select a conversation</div>
              <p className="max-w-sm text-sm">Your messages will appear here. Open a chat to reply, share files, or manage the conversation.</p>
              {session?.status === "connected" && <p className="text-xs">Chat history syncs from your linked device while it is connected.</p>}
            </div>
          )}
        </section>
      </Card>

      <Dialog open={groupFormOpen} onOpenChange={setGroupFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create WhatsApp group</DialogTitle>
            <DialogDescription>Add participant phone numbers with country codes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createGroup} className="space-y-4">
            <Input aria-label="Group name" value={groupSubject} onChange={(event) => setGroupSubject(event.target.value)} placeholder="Group name" required maxLength={100} />
            <textarea aria-label="Group participant phone numbers" value={groupParticipants} onChange={(event) => setGroupParticipants(event.target.value)} placeholder={"+15551234567\n+447700900123"} rows={4} required className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setGroupFormOpen(false)}>Cancel</Button><Button type="submit" disabled={creatingGroup || !connected}>{creatingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}Create group</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Start a chat</DialogTitle>
            <DialogDescription>Enter a WhatsApp number with its country code. You can add a display name too.</DialogDescription>
          </DialogHeader>
          <form onSubmit={startChat} className="space-y-4">
            <Input aria-label="WhatsApp phone number with country code" type="tel" inputMode="tel" autoComplete="tel" value={newChatPhone} onChange={(event) => setNewChatPhone(event.target.value)} placeholder="+1 555 555 0100" required />
            <Input aria-label="Contact display name (optional)" value={newChatName} onChange={(event) => setNewChatName(event.target.value)} placeholder="Name (optional)" maxLength={120} />
            {!connected && <p className="text-xs leading-5 text-muted-foreground">You can open the conversation now. Connect WhatsApp before sending messages.</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setNewChatOpen(false)}>Cancel</Button><Button type="submit" disabled={openingChat}>{openingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}Open chat</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChatAvatar({ chat, className = "h-11 w-11" }: { chat: Chat | null; className?: string }) {
  const title = chat ? titleFor(chat) : "Conversation";
  const tone = chat ? Math.abs([...chat.jid].reduce((value, character) => value + character.charCodeAt(0), 0)) % 5 : 0;
  const colors = ["bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300", "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"];
  return <div aria-hidden="true" className={`relative grid shrink-0 place-items-center rounded-full text-sm font-semibold ${className} ${colors[tone]}`}>{chat?.isGroup ? <Users className="h-5 w-5" /> : title.slice(0, 1).toUpperCase()}<span className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/5 dark:ring-white/10" /></div>;
}

function ChatRow({ chat, active, onClick }: { chat: Chat; active: boolean; onClick: () => void }) {
  const preview = chat.lastMessageText || "No messages yet";
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`relative flex min-h-[76px] w-full items-center gap-3 border-b border-border/50 px-3 py-3 text-left transition-colors hover:bg-muted/60 ${active ? "bg-primary/[0.07]" : ""}`}>
      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" />}
      <ChatAvatar chat={chat} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2"><div className={`truncate text-sm ${chat.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium"}`}>{titleFor(chat)}</div><span className={`shrink-0 text-[10px] ${chat.unreadCount > 0 ? "font-medium text-primary" : "text-muted-foreground"}`}>{formatTime(chat.lastMessageAt)}</span></div>
        <div className="mt-1 flex items-center justify-between gap-2"><div className={`truncate text-xs ${chat.unreadCount > 0 ? "font-medium text-foreground/75" : "text-muted-foreground"}`}>{preview}</div>{chat.unreadCount > 0 && <span className="grid min-h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</span>}</div>
        {(chat.isPinned || chat.mutedUntil || chat.labels.length > 0) && <div className="mt-1.5 flex min-w-0 items-center gap-1.5">{chat.isPinned && <Pin className="h-3 w-3 shrink-0 fill-current text-primary/70" />}{chat.mutedUntil && <VolumeX className="h-3 w-3 shrink-0 text-muted-foreground" />}{chat.labels.slice(0, 2).map((label) => <span key={label} className="max-w-24 truncate rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{label}</span>)}</div>}
      </div>
    </button>
  );
}

function ContactRow({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const displayName = contact.phonebookName || contact.name || contact.notify || contact.verifiedName || contact.jid.split("@")[0];
  return (
    <button type="button" onClick={onClick} className="flex min-h-[68px] w-full items-center gap-3 border-b border-border/60 px-3 py-3 text-left hover:bg-muted/70">
      <div aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">{displayName.slice(0, 1).toUpperCase()}</div>
      <div className="min-w-0"><div className="truncate text-sm font-medium">{displayName}</div><div className="truncate text-xs text-muted-foreground">{contact.jid}</div></div>
    </button>
  );
}

function EmptyList({ text }: { text: string }) {
  return <div className="px-5 py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function MessageBubble({ message, messages, onReply, onReact }: { message: Message; messages: Message[]; onReply: () => void; onReact: (emoji: string) => void }) {
  const quoted = message.quotedMessageId ? messages.find((item) => item.messageId === message.quotedMessageId) : undefined;
  const isMedia = ["image", "audio", "video", "document", "sticker"].includes(message.messageType);
  return (
    <div className={`group flex ${message.fromMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] sm:max-w-[75%] ${message.fromMe ? "items-end" : "items-start"}`}>
        {message.participantJid && message.chatJid.endsWith("@g.us") && <div className="mb-1 px-2 text-[10px] text-muted-foreground">{message.participantName || message.participantJid.split("@")[0]}</div>}
        <div className={`rounded-2xl px-3 py-2 shadow-sm ${message.fromMe ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border/40 bg-card text-foreground"}`}>
          {quoted && <div className={`mb-2 rounded-md border-l-2 px-2 py-1 text-xs ${message.fromMe ? "border-primary-foreground/60 bg-primary-foreground/10" : "border-primary bg-muted/70"}`}><div className="font-medium">{quoted.fromMe ? "You" : quoted.participantName || quoted.participantJid?.split("@")[0] || "Reply"}</div><div className="line-clamp-2 opacity-80">{previewFor(quoted)}</div></div>}
          {isMedia && <div className={`mb-1 flex items-center gap-2 rounded-lg p-2 text-xs ${message.fromMe ? "bg-primary-foreground/10" : "bg-muted/70"}`}>{message.messageType === "location" ? <MapPin className="h-4 w-4" /> : messageIcon(message.messageType)}<span className="truncate">{message.fileName || message.messageType}</span></div>}
          {message.messageType === "location" && message.latitude !== null && message.longitude !== null ? <a href={`https://maps.google.com/?q=${message.latitude},${message.longitude}`} target="_blank" rel="noreferrer" className="text-sm underline">{message.locationName || `${message.latitude.toFixed(5)}, ${message.longitude.toFixed(5)}`}</a> : (message.text || message.caption) ? <p className="whitespace-pre-wrap break-words text-sm">{message.text || message.caption}</p> : <p className="text-sm opacity-80">{previewFor(message)}</p>}
          <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${message.fromMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}><span>{formatTime(message.sentAt)}</span>{message.fromMe && (message.status === "read" ? <CheckCheck className="h-3.5 w-3.5 text-sky-300" /> : message.status === "delivered" ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />)}</div>
        </div>
        <div className="mt-1 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <button type="button" onClick={onReply} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted" aria-label="Reply to message"><Reply className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onReact("👍")} className="rounded-md px-1.5 py-1 text-xs hover:bg-muted" aria-label="React with thumbs up">👍</button>
          <button type="button" onClick={() => onReact("❤️")} className="rounded-md px-1.5 py-1 text-xs hover:bg-muted" aria-label="React with heart">❤️</button>
        </div>
      </div>
    </div>
  );
}
