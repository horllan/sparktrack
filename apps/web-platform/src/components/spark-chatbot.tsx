'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  HelpCircle,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  X,
  Button,
  Input,
} from '@sparktrack/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  links?: Array<{ label: string; href: string }>;
  followUps?: string[];
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  sender: 'bot',
  text: 'Hi! How can I help you today? You can ask about setting up a student account, parent consent, progress reports, or school partnerships.',
  links: [
    { label: 'Try the Product Demo', href: '/demo' },
    { label: 'Create an Account', href: '/auth?mode=signup&role=PARENT' },
    { label: 'Contact Support', href: '/contact' },
  ],
  followUps: [
    'How do I register a student?',
    'How does parent consent work?',
    'What is included in a progress report?',
    'How can our school partner with SparkTrack?',
  ],
};

function offlineFallbackAnswer(question: string): Omit<ChatMessage, 'id' | 'sender'> {
  const q = question.toLowerCase();
  if (q.includes('register') || q.includes('parent') || q.includes('child') || q.includes('jss') || q.includes('student')) {
    return {
      text: 'Learners aged 18 and above can create their own profile directly. For learners under 18, a parent or school registers them and a parent approves the profile before any project work is shared.',
      links: [
        { label: 'Register as a Parent', href: '/auth?mode=signup&role=PARENT' },
        { label: 'Learner Setup', href: '/student/onboarding' },
      ],
      followUps: ['How does parent consent work?', 'What is included in a progress report?'],
    };
  }
  if (q.includes('ndpa') || q.includes('privacy') || q.includes('consent') || q.includes('gdpr') || q.includes('legal')) {
    return {
      text: 'Every profile for a learner under 18 is private by default. Parents choose whether a portfolio can be shared publicly and can change or withdraw permission at any time from the Family Hub.',
      links: [
        { label: 'Privacy & Terms', href: '/legal' },
        { label: 'Contact Privacy Team', href: '/contact?category=PRIVACY_DPO_REQUEST' },
      ],
      followUps: ['How do parents withdraw consent?', 'How do I register a student?'],
    };
  }
  return {
    text: 'SparkTrack helps learners record real projects, receive feedback from mentors, and see their strengths grow over time. You can explore a full walkthrough on the Demo page.',
    links: [
      { label: 'Open Product Demo', href: '/demo' },
      { label: 'Contact Support', href: '/contact' },
    ],
    followUps: [
      'How do I register a student?',
      'How does parent consent work?',
    ],
  };
}

export function SparkChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);

  async function sendQuestion(questionText: string) {
    const trimmed = questionText.trim();
    if (!trimmed || busy) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch(`${API_URL}/v1/support/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) throw new Error('Offline');
      const data = (await res.json()) as {
        reply: string;
        links?: Array<{ label: string; href: string }>;
        followUps?: string[];
      };
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: data.reply,
          links: data.links,
          followUps: data.followUps,
        },
      ]);
    } catch {
      const fb = offlineFallbackAnswer(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          ...fb,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating Launcher Pill */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open SparkTrack AI & Support Assistant"
          className="fixed bottom-20 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-spark-600 px-4 py-3 text-xs font-extrabold text-white shadow-[0_12px_32px_rgba(29,78,216,0.45)] transition-all hover:-translate-y-0.5 hover:bg-spark-800 md:bottom-6 md:right-6 md:px-5 md:py-3.5 md:text-sm"
        >
          <MessageSquare className="h-4 w-4 text-cyan-300" />
          <span>Ask SparkTrack</span>
        </button>
      )}

      {/* Interactive Chat Drawer / Modal */}
      {open && (
        <section
          aria-label="SparkTrack Assistant Chat"
          className="fixed bottom-20 right-3 z-50 flex max-h-[78vh] w-[calc(100vw-1.5rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl md:bottom-6 md:right-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-[#0e1b38] px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-spark-500 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold">SparkTrack Help</p>
                <p className="flex items-center gap-1 text-[11px] text-cyan-300">
                  <ShieldCheck className="h-3 w-3" /> Quick answers &amp; support
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close SparkTrack Assistant"
              className="rounded-xl bg-white/10 p-1.5 text-slate-300 hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-5 sm:text-sm ${
                    msg.sender === 'user'
                      ? 'bg-spark-600 font-medium text-white'
                      : 'border border-slate-200/90 bg-white text-slate-800 shadow-2xs'
                  }`}
                >
                  <p>{msg.text}</p>

                  {msg.links && msg.links.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                      {msg.links.map((lnk) => (
                        <Link
                          key={lnk.href + lnk.label}
                          href={lnk.href}
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1 rounded-lg bg-spark-50 px-2.5 py-1 text-[11px] font-bold text-spark-700 hover:bg-spark-100"
                        >
                          <span>{lnk.label}</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {msg.followUps && msg.followUps.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.followUps.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void sendQuestion(q)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-spark-400 hover:text-spark-800"
                      >
                        <HelpCircle className="h-3 w-3 text-spark-600" />
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input Bar & Human Escalation Link */}
          <div className="border-t border-slate-200 bg-white p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendQuestion(input);
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question…"
                className="h-10 text-xs sm:text-sm"
              />
              <Button type="submit" size="sm" disabled={busy || !input.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
            <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-slate-500">
              <span>Need to speak with our team?</span>
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="font-bold text-spark-700 hover:underline"
              >
                Contact Support →
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

