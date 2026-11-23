'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Check,
  ShieldCheck,
  Sparkles,
} from '@sparktrack/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface SurveyQuestion {
  id: string;
  prompt: string;
  type: 'single' | 'multi' | 'text';
  required: boolean;
  options?: string[];
  maxSelect?: number;
  maxLength?: number;
}

interface SurveyDefinition {
  id: string;
  slug: string;
  title: string;
  description: string;
  targetAudience: string;
  questions: SurveyQuestion[];
}

const DEFAULT_SECONDARY_SURVEY: SurveyDefinition = {
  id: 'default-secondary-discovery-2026',
  slug: 'secondary-discovery-2026',
  title: 'Student Tech & Career Readiness Survey',
  description:
    'A 1-minute anonymous survey for Junior and Senior Secondary students to help us tailor workshops and projects to your needs. No name, email, or phone number is collected.',
  targetAudience: 'JSS1_TO_SS3',
  questions: [
    {
      id: 'class_level',
      prompt: 'What class are you in?',
      type: 'single',
      required: true,
      options: ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'],
    },
    {
      id: 'interests',
      prompt: 'Which areas interest you most? (Pick up to 2)',
      type: 'multi',
      maxSelect: 2,
      required: true,
      options: [
        'Coding & Software',
        'Cybersecurity & Digital Safety',
        'Product & Graphic Design',
        'AI & Data',
        'Robotics & Hardware',
        'Business & Entrepreneurship',
      ],
    },
    {
      id: 'device_access',
      prompt: 'What device can you use for practice?',
      type: 'single',
      required: true,
      options: [
        'Smartphone only',
        'Shared family laptop or desktop',
        'Personal laptop',
        'School computer lab only',
      ],
    },
    {
      id: 'biggest_barrier',
      prompt: 'What is your biggest challenge learning practical tech skills?',
      type: 'single',
      required: true,
      options: [
        'Internet data cost',
        'No laptop or personal device',
        'Need step-by-step mentor guidance',
        'School timetable & exam pressure',
        'Not sure where to start',
      ],
    },
    {
      id: 'preferred_format',
      prompt: 'How would you prefer to join a programme?',
      type: 'single',
      required: true,
      options: [
        'Weekend hands-on workshops',
        'Holiday bootcamp',
        'After-school club at my school',
        'Short mobile-friendly lessons',
      ],
    },
    {
      id: 'one_project_wish',
      prompt: 'Optional: What is one real problem you wish you could build a project to solve?',
      type: 'text',
      required: false,
      maxLength: 200,
    },
  ],
};

const DEFAULT_PROJECT_SURVEY: SurveyDefinition = {
  id: 'default-sparkintel-project-discovery',
  slug: 'sparkintel-project-discovery',
  title: 'SparkIntel Student Discovery Survey',
  description:
    'A brief 1-minute anonymous survey for Junior and Senior Secondary students about career awareness, skills, and learning outside school. No name, email, or phone number is collected.',
  targetAudience: 'JSS1_TO_SS3',
  questions: [
    {
      id: 'class_level',
      prompt: 'What class are you currently in?',
      type: 'single',
      required: true,
      options: ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'],
    },
    {
      id: 'career_understanding',
      prompt: 'How clearly do you understand what skills are needed for a career you like?',
      type: 'single',
      required: true,
      options: ['Very clearly', 'Somewhat clear', 'Not clear yet', 'Still exploring'],
    },
    {
      id: 'career_barrier',
      prompt: 'What makes it hardest to know what career or skill path fits you? (Pick up to 2)',
      type: 'multi',
      maxSelect: 2,
      required: true,
      options: [
        'Not knowing what careers exist',
        'Not knowing what skills are needed',
        'No hands-on practice at school',
        'No mentor or guide',
        'Schoolwork & exam pressure',
      ],
    },
    {
      id: 'top_interests',
      prompt: 'Which areas are you MOST interested in exploring? (Pick up to 2)',
      type: 'multi',
      maxSelect: 2,
      required: true,
      options: [
        'Coding & Software',
        'Cybersecurity & Digital Safety',
        'Product & Graphic Design',
        'AI & Data',
        'Robotics & Hardware',
        'Business & Entrepreneurship',
      ],
    },
    {
      id: 'outside_learning_status',
      prompt: 'Have you ever tried learning a practical skill outside normal school lessons?',
      type: 'single',
      required: true,
      options: ['Yes, and I kept going', 'Yes, but I stopped', 'No, not yet', 'I want to start'],
    },
    {
      id: 'learning_blocker',
      prompt: 'What usually makes students stop learning a new skill? (Pick up to 2)',
      type: 'multi',
      maxSelect: 2,
      required: true,
      options: [
        'No laptop or internet data',
        'Too confusing without a mentor',
        'No real project to practice on',
        'Schoolwork & exam pressure',
        'Lost motivation',
      ],
    },
    {
      id: 'holiday_interest',
      prompt: 'Would you join a short hands-on holiday or weekend project programme?',
      type: 'single',
      required: true,
      options: ['Yes, holiday bootcamp', 'Yes, weekend club', 'Yes, mobile self-paced', 'Not sure yet'],
    },
    {
      id: 'one_project_wish',
      prompt: 'Optional: What is one real problem you wish you could build a project to solve?',
      type: 'text',
      required: false,
      maxLength: 200,
    },
  ],
};

const FALLBACK_SURVEYS: Record<string, SurveyDefinition> = {
  'sparkintel-project-discovery': DEFAULT_PROJECT_SURVEY,
  'secondary-discovery-2026': DEFAULT_SECONDARY_SURVEY,
};

function StudentSurveyContent() {
  const searchParams = useSearchParams();
  const initialSlug = searchParams.get('slug') || 'sparkintel-project-discovery';
  const [activeSlug, setActiveSlug] = useState(initialSlug);

  const [survey, setSurvey] = useState<SurveyDefinition>(
    FALLBACK_SURVEYS[initialSlug] ?? DEFAULT_PROJECT_SURVEY,
  );
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [busy, setBusy] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSurvey(FALLBACK_SURVEYS[activeSlug] ?? DEFAULT_PROJECT_SURVEY);
    setAnswers({});
    setSubmitted(false);
    setError('');
    fetch(`${API_URL}/v1/learning/surveys/${encodeURIComponent(activeSlug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray((data as SurveyDefinition).questions)) {
          setSurvey(data as SurveyDefinition);
        }
      })
      .catch(() => null);
  }, [activeSlug]);

  function selectSingle(questionId: string, option: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  function toggleMulti(questionId: string, option: string, maxSelect = 2) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      if (current.includes(option)) {
        return { ...prev, [questionId]: current.filter((item) => item !== option) };
      }
      if (current.length >= maxSelect) {
        return { ...prev, [questionId]: [...current.slice(1), option] };
      }
      return { ...prev, [questionId]: [...current, option] };
    });
  }

  const allRequiredAnswered = survey.questions
    .filter((q) => q.required)
    .every((q) => {
      const val = answers[q.id];
      if (q.type === 'multi') return Array.isArray(val) && val.length > 0;
      return typeof val === 'string' && val.trim().length > 0;
    });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allRequiredAnswered) {
      setError('Please answer all required questions before submitting.');
      return;
    }
    setBusy(true);
    setError('');
    setStatusNote('');
    const endpoint = `${API_URL}/v1/learning/surveys/${encodeURIComponent(survey.slug)}/responses`;
    const body = JSON.stringify({ answers });

    const attemptPost = () =>
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

    try {
      let res: Response;
      try {
        res = await attemptPost();
      } catch {
        setStatusNote('Waking up the server—retrying automatically…');
        await new Promise((r) => setTimeout(r, 3500));
        res = await attemptPost();
      }
      if (!res.ok) {
        const resBody = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(resBody?.message ?? 'Could not submit your response. Please try again.');
      }
      setStatusNote('');
      setSubmitted(true);
    } catch (err) {
      setStatusNote('');
      setError(
        err instanceof Error && err.message !== 'Failed to fetch'
          ? err.message
          : 'The server is waking up or temporarily unreachable. Please tap Submit once more.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="overflow-hidden border-slate-200/90 shadow-md">
          <div className="h-1.5 bg-gradient-to-r from-spark-600 via-cyan-500 to-emerald-500" />
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="success">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Anonymous · Zero Personal Info
              </Badge>
              <span className="text-xs font-semibold text-slate-500">Under 1 minute</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { slug: 'sparkintel-project-discovery', label: 'SparkIntel Project Survey' },
                { slug: 'secondary-discovery-2026', label: 'Device & Tech Readiness' },
              ].map((opt) => (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={() => setActiveSlug(opt.slug)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    activeSlug === opt.slug
                      ? 'border-spark-600 bg-spark-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <CardTitle className="text-2xl font-extrabold text-slate-900">{survey.title}</CardTitle>
            <CardDescription className="text-sm leading-relaxed text-slate-600">
              {survey.description}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {submitted ? (
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-extrabold text-slate-900">Thank you for sharing!</h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  Your anonymous response has been recorded. It helps us design workshops and projects that fit your
                  school and interests.
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAnswers({});
                      setSubmitted(false);
                    }}
                  >
                    Submit Another Response
                  </Button>
                  <Link href="/demo">
                    <Button type="button">
                      <Sparkles className="mr-1.5 h-4 w-4" /> Explore Interactive Demo
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={(e) => void handleSubmit(e)}>
                {statusNote && (
                  <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
                    {statusNote}
                  </p>
                )}
                {error && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
                    {error}
                  </p>
                )}

                {survey.questions.map((q, index) => (
                  <div key={q.id} className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
                    <p className="text-sm font-bold text-slate-900">
                      {index + 1}. {q.prompt}
                      {q.required && <span className="ml-1 text-rose-600">*</span>}
                    </p>

                    {q.type === 'single' && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(q.options ?? []).map((opt) => {
                          const active = answers[q.id] === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => selectSingle(q.id, opt)}
                              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                                active
                                  ? 'border-spark-600 bg-spark-50 text-spark-900 ring-2 ring-spark-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>{opt}</span>
                              {active && <Check className="h-4 w-4 shrink-0 text-spark-700" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'multi' && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(q.options ?? []).map((opt) => {
                          const selected = Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleMulti(q.id, opt, q.maxSelect ?? 2)}
                              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                                selected
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span>{opt}</span>
                              {selected && <Check className="h-4 w-4 shrink-0 text-emerald-700" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'text' && (
                      <textarea
                        rows={2}
                        maxLength={q.maxLength ?? 200}
                        value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="e.g., An app to help students practice maths offline (do not enter your name or phone number)"
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:border-spark-500 focus-visible:outline-none"
                      />
                    )}
                  </div>
                ))}

                <Button type="submit" size="lg" className="w-full" disabled={busy || !allRequiredAnswered}>
                  {busy ? 'Submitting…' : 'Submit Anonymous Survey'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function StudentSurveyPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading survey…</div>}>
      <StudentSurveyContent />
    </Suspense>
  );
}
