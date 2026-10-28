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
import { apiFetch, apiUpload, getAccessToken, apiUrl } from "@/lib/api";

interface Chat {
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
  chatJid: string;
  messageId: string;
  participantJid: string | null;
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
  jid: string;
  name: string | null;
  notify: string | null;
  verifiedName: string | null;
  updatedAt: string;
}

interface SessionState {
  status: string;
  phoneNumber: string | null;
  lastError: string | null;
}

interface SearchResult {
  chats: Chat[];
  messages: Message[];
  contacts: Contact[];
}

interface GroupMembers {
  jid: string;
  subject: string;
  participants: Array<{ jid: string; admin: string | null }>;
}

type InboxTab = "chats" | "contacts" | "groups";

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

export default function InboxPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [activeJid, setActiveJid] = useState<string | null>(null);
  const [tab, setTab] = useState<InboxTab>("chats");
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeJidRef = useRef<string | null>(null);
  const archivedRef = useRef(false);

  const connected = session?.status === "connected";
  const activeChat = chats.find((chat) => chat.jid === activeJid) ?? null;

  const loadChats = useCallback(async (showArchived: boolean) => {
    const result = await apiFetch<{ chats: Chat[] }>(`/dashboard/whatsapp/chats?archived=${showArchived}`);
    setChats(result.chats);
  }, []);

  const loadContacts = useCallback(async () => {
    const result = await apiFetch<{ contacts: Contact[] }>("/dashboard/whatsapp/contacts");
    setContacts(result.contacts);
  }, []);

  const loadMessages = useCallback(async (jid: string) => {
    setMessagesLoading(true);
    try {
      const result = await apiFetch<{ messages: Message[] }>(`/dashboard/whatsapp/chats/${encodeURIComponent(jid)}/messages?limit=50`);
      setMessages(result.messages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load this conversation.");
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const appendMessage = useCallback((message: Message) => {
    setMessages((current) => {
      if (current.some((item) => item.messageId === message.messageId && item.chatJid === message.chatJid)) return current;
      return [...current, message].sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
    });
  }, []);

  useEffect(() => {
    activeJidRef.current = activeJid;
  }, [activeJid]);

  useEffect(() => {
    archivedRef.current = archived;
    void loadChats(archived).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load chats."));
  }, [archived, loadChats]);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    async function bootstrap() {
      try {
        const [sessionResult] = await Promise.all([
          apiFetch<{ session: SessionState }>("/dashboard/whatsapp/session"),
          loadContacts()
        ]);
        if (!cancelled) setSession(sessionResult.session);
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
        setChats((current) => {
          const next = current.filter((item) => item.jid !== chat.jid);
          if (chat.isArchived === archivedRef.current) next.push(chat);
          return next.sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || Date.parse(b.lastMessageAt ?? b.updatedAt) - Date.parse(a.lastMessageAt ?? a.updatedAt));
        });
      });
      socket.on("whatsapp:message", (message: Message) => {
        if (activeJidRef.current === message.chatJid) appendMessage(message);
        void loadChats(archivedRef.current);
      });
    }

    void bootstrap();
    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [appendMessage, loadChats, loadContacts]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setSearchResults({ chats: [], messages: [], contacts: [] });
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      apiFetch<SearchResult>(`/dashboard/whatsapp/search?q=${encodeURIComponent(term)}`)
        .then((result) => { if (!cancelled) setSearchResults(result); })
        .catch((error) => { if (!cancelled) toast.error(error instanceof Error ? error.message : "Search failed."); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [query]);

  const openChat = useCallback(async (jid: string, name?: string | null) => {
    activeJidRef.current = jid;
    setActiveJid(jid);
    setReplyTo(null);
    setMembers(null);
    await loadMessages(jid);
    if (session?.status === "connected") {
      try {
        const result = await apiFetch<{ chat: Chat }>(`/dashboard/whatsapp/chats/${encodeURIComponent(jid)}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "mark_read" })
        });
        setChats((current) => current.map((chat) => chat.jid === jid ? result.chat : chat));
      } catch {
        // Keep reading available while WhatsApp is reconnecting.
      }
    }
    if (name) setChats((current) => current.map((chat) => chat.jid === jid ? { ...chat, name } : chat));
  }, [loadMessages, session?.status]);

  async function openContact(contact: Contact) {
    try {
      await apiFetch("/dashboard/whatsapp/chats/open", {
        method: "POST",
        body: JSON.stringify({ jid: contact.jid, name: contact.name || contact.notify })
      });
      await loadChats(archived);
      await openChat(contact.jid, contact.name || contact.notify);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the contact.");
    }
  }

  async function modifyChat(action: string, options: Record<string, unknown> = {}) {
    if (!activeJid) return;
    try {
      const result = await apiFetch<{ chat: Chat }>(`/dashboard/whatsapp/chats/${encodeURIComponent(activeJid)}`, {
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
    if (!activeJid || !composer.trim()) return;
    setSending(true);
    try {
      const result = await apiFetch<{ message: Message }>(`/dashboard/whatsapp/chats/${encodeURIComponent(activeJid)}/messages`, {
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
    if (!activeJid) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Files must be 8 MB or smaller.");
      return;
    }
    const mediaType = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "document";
    const params = new URLSearchParams({ mediaType, mimeType: file.type || "application/octet-stream", fileName: file.name });
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

  async function shareLocation() {
    if (!activeJid) return;
    if (!navigator.geolocation) {
      toast.error("Location sharing is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      setSending(true);
      try {
        const result = await apiFetch<{ message: Message }>(`/dashboard/whatsapp/chats/${encodeURIComponent(activeJid)}/location`, {
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
    if (!activeJid) return;
    try {
      const result = await apiFetch<{ message: Message }>(`/dashboard/whatsapp/chats/${encodeURIComponent(activeJid)}/reactions`, {
        method: "POST",
        body: JSON.stringify({ messageId: message.messageId, reaction: emoji })
      });
      appendMessage(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reaction.");
    }
  }

  async function showGroupMembers() {
    if (!activeJid) return;
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
    if (tab === "groups") return chats.filter((chat) => chat.isGroup);
    return chats.filter((chat) => !chat.isGroup);
  }, [chats, tab]);

  const searchedChats = searchResults.chats;
  const visibleContacts = query.trim() ? searchResults.contacts : contacts;
  const headerTitle = activeChat ? titleFor(activeChat) : "Choose a conversation";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">Read, reply, and manage your WhatsApp conversations.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={connected ? "default" : "secondary"} className="capitalize">{session?.status ?? "checking"}</Badge>
          {!connected && <Link href="/dashboard/whatsapp" className="text-sm font-medium text-primary hover:underline">Connect WhatsApp</Link>}
        </div>
      </div>

      {!connected && !loading && (
        <Card className="flex items-center justify-between gap-4 border-amber-500/20 bg-amber-500/5 p-4 text-sm">
          <span className="text-muted-foreground">Your WhatsApp session is disconnected. Saved conversations remain readable; connect to send messages or sync new ones.</span>
          <Link href="/dashboard/whatsapp"><Button size="sm">Connect</Button></Link>
        </Card>
      )}

      <Card className="grid min-h-[72vh] overflow-hidden border-border/50 bg-card/80 shadow-lg shadow-black/5 md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`${activeJid ? "hidden md:flex" : "flex"} min-h-0 flex-col border-r border-border/50`}>
          <div className="space-y-3 border-b border-border/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">Conversations</div>
              <Button type="button" size="sm" variant="outline" onClick={() => setGroupFormOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Group
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats, contacts, messages" className="pl-9 pr-9" />
              {query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear search"><X className="h-4 w-4" /></button>}
            </div>
            <div className="flex items-center gap-1">
              {(["chats", "groups", "contacts"] as InboxTab[]).map((value) => (
                <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${tab === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                  {value}
                </button>
              ))}
              {tab !== "contacts" && <button type="button" onClick={() => setArchived((value) => !value)} className="ml-auto rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted">{archived ? "Inbox" : "Archived"}</button>}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted/50" />)}</div>
            ) : query.trim() ? (
              <div className="space-y-3 p-3">
                {!!searchedChats.length && <div><div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">Chats</div>{searchedChats.map((chat) => <ChatRow key={chat.jid} chat={chat} active={activeJid === chat.jid} onClick={() => void openChat(chat.jid, chat.name)} />)}</div>}
                {!!searchResults.messages.length && <div><div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">Messages</div>{searchResults.messages.map((message) => <button key={`${message.chatJid}:${message.messageId}`} type="button" onClick={() => void openChat(message.chatJid)} className="mb-1 block w-full rounded-xl px-3 py-2 text-left hover:bg-muted/60"><div className="truncate text-xs font-medium">{message.chatJid}</div><div className="truncate text-sm text-muted-foreground">{previewFor(message)}</div></button>)}</div>}
                {!!searchResults.contacts.length && <div><div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">Contacts</div>{searchResults.contacts.map((contact) => <ContactRow key={contact.jid} contact={contact} onClick={() => void openContact(contact)} />)}</div>}
                {!searchedChats.length && !searchResults.messages.length && !searchResults.contacts.length && <p className="p-5 text-center text-sm text-muted-foreground">No matches found.</p>}
              </div>
            ) : tab === "contacts" ? (
              visibleContacts.length ? visibleContacts.map((contact) => <ContactRow key={contact.jid} contact={contact} onClick={() => void openContact(contact)} />) : <EmptyList text="Contacts appear after WhatsApp syncs your account." />
            ) : (
              visibleChats.length ? visibleChats.map((chat) => <ChatRow key={chat.jid} chat={chat} active={activeJid === chat.jid} onClick={() => void openChat(chat.jid, chat.name)} />) : <EmptyList text={tab === "groups" ? "No groups found." : "No chats found. Connect WhatsApp and wait for your chat history to sync."} />
            )}
          </div>
        </aside>

        <section className={`${activeJid ? "flex" : "hidden md:flex"} min-h-[72vh] min-w-0 flex-col`}>
          {activeJid ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Button type="button" variant="ghost" size="icon" className="md:hidden" onClick={() => { setActiveJid(null); activeJidRef.current = null; }} aria-label="Back to conversations"><ArrowLeft className="h-4 w-4" /></Button>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">{activeChat?.isGroup ? <Users className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}</div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{headerTitle}</div>
                    <div className="truncate text-xs text-muted-foreground">{activeJid}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {activeChat?.isGroup && <Button type="button" variant="ghost" size="sm" onClick={() => void showGroupMembers()}><Users className="mr-1.5 h-4 w-4" /> Members</Button>}
                  <Button type="button" variant="ghost" size="icon" title={activeChat?.isPinned ? "Unpin chat" : "Pin chat"} onClick={() => void modifyChat(activeChat?.isPinned ? "unpin" : "pin")}><Pin className={`h-4 w-4 ${activeChat?.isPinned ? "text-primary" : ""}`} /></Button>
                  <Button type="button" variant="ghost" size="icon" title="Mute for 8 hours" onClick={() => void modifyChat(activeChat?.mutedUntil ? "unmute" : "mute", { durationMinutes: 480 })}><VolumeX className={`h-4 w-4 ${activeChat?.mutedUntil ? "text-primary" : ""}`} /></Button>
                  <Button type="button" variant="ghost" size="icon" title={activeChat?.isArchived ? "Unarchive chat" : "Archive chat"} onClick={() => void modifyChat(activeChat?.isArchived ? "unarchive" : "archive")}><Archive className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" title="Mark unread" onClick={() => void modifyChat("mark_unread")}><CheckCheck className="h-4 w-4" /></Button>
                </div>
              </header>

              {membersOpen && members && (
                <div className="border-b border-border/40 bg-muted/20 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between"><div className="font-medium">{members.subject} · {members.participants.length} members</div><button type="button" onClick={() => setMembersOpen(false)} aria-label="Close members"><X className="h-4 w-4" /></button></div>
                  <div className="flex flex-wrap gap-2">{members.participants.map((member) => <Badge key={member.jid} variant="secondary">{member.jid.split("@")[0]}{member.admin ? ` · ${member.admin}` : ""}</Badge>)}</div>
                </div>
              )}

              {!!activeChat?.labels.length && <div className="flex flex-wrap items-center gap-2 border-b border-border/30 px-4 py-2">{activeChat.labels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}</div>}
              <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto bg-muted/10 px-3 py-4 sm:px-6">
                <div className="space-y-3">
                  {messagesLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : messages.length ? messages.map((message) => (
                    <MessageBubble key={`${message.chatJid}:${message.messageId}`} message={message} messages={messages} onReply={() => setReplyTo(message)} onReact={(emoji) => void react(message, emoji)} />
                  )) : <div className="py-12 text-center text-sm text-muted-foreground">No messages stored for this chat yet.</div>}
                </div>
              </div>

              {!connected && <div className="border-t border-border/40 bg-amber-500/5 px-4 py-2 text-center text-xs text-muted-foreground">Reconnect WhatsApp to send messages and sync incoming ones.</div>}
              {activeChat && <div className="flex flex-wrap items-center gap-2 border-t border-border/40 px-3 py-2">
                <Input value={labelDraft} onChange={(event) => setLabelDraft(event.target.value)} placeholder="Add a label" className="h-8 max-w-48" onKeyDown={(event) => { if (event.key === "Enter" && labelDraft.trim()) { void modifyChat("labels", { labels: [...new Set([...(activeChat.labels ?? []), labelDraft.trim()])] }); setLabelDraft(""); } }} />
                <Button type="button" size="sm" variant="outline" onClick={() => { if (!labelDraft.trim()) return; void modifyChat("labels", { labels: [...new Set([...(activeChat.labels ?? []), labelDraft.trim()])] }); setLabelDraft(""); }}>Add label</Button>
                {activeChat.labels.length > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => void modifyChat("labels", { labels: [] })}>Clear labels</Button>}
              </div>}

              <form onSubmit={submitText} className="border-t border-border/40 bg-card p-3 sm:p-4">
                {replyTo && <div className="mb-2 flex items-center justify-between rounded-lg border-l-2 border-primary bg-muted/40 px-3 py-2 text-xs"><div className="min-w-0"><div className="font-medium">Replying to {replyTo.fromMe ? "you" : replyTo.participantJid?.split("@")[0] ?? "contact"}</div><div className="truncate text-muted-foreground">{previewFor(replyTo)}</div></div><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="h-4 w-4" /></button></div>}
                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,audio/*,application/pdf,text/plain,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void sendFile(file); }} />
                  <Button type="button" variant="ghost" size="icon" disabled={!connected || sending} onClick={() => fileInputRef.current?.click()} title="Attach photo, audio, or document"><Paperclip className="h-5 w-5" /></Button>
                  <Button type="button" variant="ghost" size="icon" disabled={!connected || sending} onClick={() => void shareLocation()} title="Share location"><MapPin className="h-5 w-5" /></Button>
                  <textarea value={composer} onChange={(event) => setComposer(event.target.value)} disabled={!connected || sending} placeholder={connected ? "Write a message…" : "Connect WhatsApp to send a message"} rows={1} className="max-h-32 min-h-10 flex-1 resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
                  <Button type="submit" size="icon" disabled={!connected || !composer.trim() || sending} aria-label="Send message">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary"><MessageSquare className="h-8 w-8" /></div>
              <div className="text-lg font-semibold text-foreground">Your WhatsApp inbox</div>
              <p className="max-w-sm text-sm">Choose a conversation to read messages, reply, share files, and manage the chat.</p>
              {session?.status === "connected" && <p className="text-xs">Chat history syncs from your linked device while it is connected.</p>}
            </div>
          )}
        </section>
      </Card>

      {groupFormOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGroupFormOpen(false); }}>
        <Card className="w-full max-w-lg space-y-4 p-5 shadow-2xl">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Create WhatsApp group</h2><p className="text-sm text-muted-foreground">Add participant phone numbers with country codes.</p></div><button type="button" onClick={() => setGroupFormOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
          <form onSubmit={createGroup} className="space-y-3">
            <Input value={groupSubject} onChange={(event) => setGroupSubject(event.target.value)} placeholder="Group name" required maxLength={100} />
            <textarea value={groupParticipants} onChange={(event) => setGroupParticipants(event.target.value)} placeholder={"+15551234567\n+447700900123"} rows={4} required className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setGroupFormOpen(false)}>Cancel</Button><Button type="submit" disabled={creatingGroup || !connected}>{creatingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}Create group</Button></div>
          </form>
        </Card>
      </div>}
    </div>
  );
}

function ChatRow({ chat, active, onClick }: { chat: Chat; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 border-b border-border/20 px-3 py-3 text-left transition-colors hover:bg-muted/50 ${active ? "bg-primary/5" : ""}`}>
      <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{chat.isGroup ? <Users className="h-5 w-5" /> : titleFor(chat).slice(0, 1).toUpperCase()}{chat.isPinned && <Pin className="absolute -right-1 -top-1 h-3 w-3 fill-primary text-primary" />}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2"><div className="truncate text-sm font-medium">{titleFor(chat)}</div><span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(chat.lastMessageAt)}</span></div>
        <div className="mt-0.5 flex items-center justify-between gap-2"><div className="truncate text-xs text-muted-foreground">{chat.lastMessageText || "No messages yet"}</div>{chat.unreadCount > 0 && <span className="grid min-h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</span>}</div>
      </div>
    </button>
  );
}

function ContactRow({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 border-b border-border/20 px-3 py-3 text-left hover:bg-muted/50">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">{(contact.name || contact.notify || contact.jid).slice(0, 1).toUpperCase()}</div>
      <div className="min-w-0"><div className="truncate text-sm font-medium">{contact.name || contact.notify || contact.jid.split("@")[0]}</div><div className="truncate text-xs text-muted-foreground">{contact.jid}</div></div>
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
        {message.participantJid && message.chatJid.endsWith("@g.us") && <div className="mb-1 px-2 text-[10px] text-muted-foreground">{message.participantJid.split("@")[0]}</div>}
        <div className={`rounded-2xl px-3 py-2 shadow-sm ${message.fromMe ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border/40 bg-card text-foreground"}`}>
          {quoted && <div className={`mb-2 rounded-md border-l-2 px-2 py-1 text-xs ${message.fromMe ? "border-primary-foreground/60 bg-primary-foreground/10" : "border-primary bg-muted/70"}`}><div className="font-medium">{quoted.fromMe ? "You" : quoted.participantJid?.split("@")[0] || "Reply"}</div><div className="line-clamp-2 opacity-80">{previewFor(quoted)}</div></div>}
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
