import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, ArrowLeft, ShieldAlert, BadgeCheck, Headset, RefreshCw } from 'lucide-react';
import { sendMessageToChatInFirestore, fetchChatFromFirestore, ChatMessage } from '../lib/firebase';

interface SupportChatProps {
  onBack?: () => void;
  connectedAddress?: string | null;
}

export default function SupportChat({ onBack, connectedAddress }: SupportChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Get active user wallet address or persistent guest ID
  const getChatId = () => {
    if (connectedAddress && connectedAddress !== 'null' && connectedAddress !== 'undefined') {
      return connectedAddress.toLowerCase();
    }
    const savedAddress = localStorage.getItem('connectedAddress');
    if (savedAddress && savedAddress !== 'null' && savedAddress !== 'undefined') {
      return savedAddress.toLowerCase();
    }
    let guestId = localStorage.getItem('support_guest_id');
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('support_guest_id', guestId);
    }
    return guestId;
  };

  const chatId = getChatId();

  // Load Chat messages continuously
  const loadChat = async () => {
    try {
      const session = await fetchChatFromFirestore(chatId);
      if (session && session.messages && session.messages.length > 0) {
        setMessages(session.messages);
      } else {
        // Initial Welcome Message displayed locally until user sends a message
        const welcomeMsg: ChatMessage = {
          id: 'welcome',
          sender: 'agent',
          text: 'Hello! Welcome to Customer Support. How can our online representatives assist you today?',
          timestamp: Date.now(),
        };
        setMessages([welcomeMsg]);
      }
    } catch (e) {
      console.warn('Support Chat sync notice:', e);
    }
  };

  useEffect(() => {
    loadChat();

    // Poll every 1.5s for live agent responses
    const interval = setInterval(loadChat, 1500);

    return () => clearInterval(interval);
  }, [chatId]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const userText = inputText.trim();
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInputText('');
    setIsSending(true);

    try {
      await sendMessageToChatInFirestore(chatId, userMsg, connectedAddress || chatId);
      await loadChat();
    } catch (err) {
      console.warn('Failed to send support message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadChat();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="flex flex-col h-[calc(100vh-76px)] max-h-[calc(100vh-76px)] bg-slate-50 overflow-hidden font-sans relative"
    >
      {/* Top Header Navigation Bar */}
      <div className="p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white shadow-md shrink-0">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-full hover:bg-white/10 transition cursor-pointer active:scale-95"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
              <Headset className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-sm flex items-center gap-1.5">
                Customer Support Center
                <BadgeCheck className="w-4 h-4 text-emerald-300 fill-emerald-300/25" />
              </div>
              <div className="text-[11px] text-blue-100 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Agent Online 24/7
              </div>
            </div>
          </div>

          <button
            onClick={handleManualRefresh}
            className={`p-2 rounded-full hover:bg-white/10 text-white transition cursor-pointer ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Refresh Messages"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Security Alert Banner */}
      <div className="bg-amber-50 border-b border-amber-200/80 p-3 px-4 text-xs text-amber-900 shrink-0">
        <div className="max-w-7xl mx-auto w-full flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Official Security Notice:</strong> Official customer service agents will <em>never</em> ask for your private key, seed phrase, or passwords.
          </span>
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-100/70">
        <div className="max-w-7xl mx-auto w-full space-y-3.5">
          <div className="text-center my-2">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 px-3 py-1 bg-white rounded-full border border-slate-200 shadow-2xs">
              Encrypted Support Session ({chatId.slice(0, 10)}...)
            </span>
          </div>

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-xs ${
                  m.sender === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                }`}
              >
                <div className="font-extrabold text-[10px] mb-1 opacity-80">
                  {m.sender === 'user' ? 'You' : 'Customer Service Agent'}
                </div>
                <p className="whitespace-pre-wrap font-medium">{m.text}</p>
                <span
                  className={`text-[9.5px] block text-right mt-1.5 font-mono ${
                    m.sender === 'user' ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
          <div ref={messageEndRef} />
        </div>
      </div>

      {/* Input Message Form */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 shrink-0 shadow-lg">
        <div className="max-w-7xl mx-auto w-full flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Describe your issue or ask a question..."
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full text-white font-bold text-xs cursor-pointer transition active:scale-95 flex items-center justify-center gap-1.5 shrink-0 shadow-md"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
      </form>
    </motion.div>
  );
}
