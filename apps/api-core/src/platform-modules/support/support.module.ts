import { randomInt } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { supportQueries, type SparkTrackDatabase } from '@sparktrack/db';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { CurrentUser, Public, Roles, type AuthUser } from '../../common/auth/auth.guard';
import { KYSELY } from '../../common/database/database.module';

const CreateTicketSchema = z.object({
  category: z
    .enum([
      'GENERAL_SUPPORT',
      'PARENT_CONSENT_HELP',
      'SCHOOL_PARTNERSHIP',
      'SCHOLARSHIP_SPONSORSHIP',
      'PRIVACY_DPO_REQUEST',
      'TECHNICAL_ISSUE',
    ])
    .default('GENERAL_SUPPORT'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT_COMPLIANCE']).optional(),
  requesterName: z.string().min(2).max(140),
  requesterEmail: z.string().email().max(255),
  requesterPhone: z.string().max(40).optional(),
  requesterRole: z.string().max(40).optional(),
  organisationName: z.string().max(180).optional(),
  countryCode: z.string().min(2).max(8).optional(),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(4000),
});

const UpdateTicketSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'ESCALATED_DPO', 'RESOLVED']),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT_COMPLIANCE']).optional(),
  staffResolutionNotes: z.string().max(4000).optional(),
});

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
});

interface KnowledgeTopic {
  keywords: string[];
  answer: string;
  links: Array<{ label: string; href: string }>;
  followUps: string[];
}

const KNOWLEDGE_BASE: KnowledgeTopic[] = [
  {
    keywords: ['register', 'parent', 'child', 'jss', 'sss', 'secondary', 'junior', 'onboard', 'sign up', 'signup', 'student'],
    answer:
      'For Junior and Senior Secondary learners (Primary 5 through SS3), a Parent/Guardian or School Administrator registers first at /auth. Once signed in, open the Parent Hub (/parent/dashboard) or School Hub (/school/dashboard) and click "Add Child / Register Student" to create the student profile, choose initial curiosity areas, and generate their unique SPK-XXXX Learner Access Code.',
    links: [
      { label: 'Register as Parent or School', href: '/auth?mode=signup&role=PARENT' },
      { label: 'Open Parent Hub', href: '/parent/dashboard' },
    ],
    followUps: [
      'How does NDPA parental consent work?',
      'What is in the 13-Part Development Report?',
      'How do schools partner with SparkTrack?',
    ],
  },
  {
    keywords: ['ndpa', 'privacy', 'consent', 'otp', 'sms', 'gdpr', 'popia', 'coppa', 'legal', 'law', 'dpo', 'child safety', 'erasure'],
    answer:
      'SparkTrack is built on a Privacy-by-Default architecture aligned with the Nigeria Data Protection Act (NDPA) 2023 (Section 31 on Child Data), the Nigerian Child’s Rights Act 2003, South Africa POPIA, Kenya DPA, EU/UK GDPR (Article 8), and US COPPA/FERPA. Every minor profile defaults to private (PENDING_PARENTAL_CONSENT) until verified by a parent/guardian via 6-digit SMS OTP or direct Parent Portal registration. Parents can toggle public portfolio sharing, partner talent discovery, or revoke consent at any time.',
    links: [
      { label: 'Legal, Privacy & Compliance Center', href: '/legal' },
      { label: 'Guardian SMS Consent Portal', href: '/parent/consent' },
      { label: 'Contact Data Protection Officer (DPO)', href: '/contact?category=PRIVACY_DPO_REQUEST' },
    ],
    followUps: [
      'How does the Right to Erasure work with the SHA-256 ledger?',
      'How do parents revoke consent?',
      'Can I read the School Data Processing Agreement (DPA)?',
    ],
  },
  {
    keywords: ['ledger', 'sha-256', 'sha256', 'hash', 'blockchain', 'immutable', 'tamper', 'delete', 'erasure', 'pseudonym'],
    answer:
      'Every student project is sealed into an append-only SHA-256 hash chain (evidence.cryptographic_ledger) linked to the Genesis Block. To comply with NDPA Section 34 and GDPR Article 17 (Right to Erasure) without breaking cryptographic integrity, zero personally identifiable information (PII) is stored in the ledger—only pseudonymous UUIDs and canonical hashes. If a parent requests erasure, PII in core.users is scrubbed while the mathematical chain remains intact.',
    links: [
      { label: 'Ledger Governance & Erasure Protocol', href: '/legal?doc=ledger-governance' },
      { label: 'Verify a Public Portfolio', href: '/student/portfolio' },
    ],
    followUps: [
      'How do mentors verify student projects?',
      'Does project capture work offline?',
    ],
  },
  {
    keywords: ['report', '13-part', '13 part', 'pathway', 'career', 'ai', 'guardrail', 'engine', 'skill', 'divergence'],
    answer:
      'SparkTrack runs 6 headless intelligence engines (Evidence, Skill, Capability Graph, Bitemporal Progress, Pathway Affinity, and Recommendation Synthesis) to produce a 13-Part Longitudinal Development Report. It compares declared interests with observed project evidence and recommends non-deterministic Career & Entrepreneurship pathways. Every report passes a dual-layer AI Child-Safety Guardrail that bans deterministic career labeling.',
    links: [
      { label: 'View 13-Part Report in Parent Hub', href: '/parent/dashboard' },
      { label: 'AI Ethics & Non-Deterministic Charter', href: '/legal?doc=ai-charter' },
    ],
    followUps: [
      'What does time-travel bitemporal progress mean?',
      'How do mentor signals affect skill scores?',
    ],
  },
  {
    keywords: ['mentor', 'teacher', 'rubric', 'signal', 'verify', 'quality', 'score'],
    answer:
      'Verified educators and industry mentors review learner projects in the Mentor Studio (/mentor/dashboard). They assign a rubric quality score (e.g. 70%–95%)—which gives the evidence a 1.35× verification weight—and record 1–4 behavioural signal observations (such as Analytical Problem Solving, Creative Framing, and Initiative).',
    links: [
      { label: 'Open Mentor Studio', href: '/mentor/dashboard' },
      { label: 'Register as a Mentor', href: '/auth?mode=signup&role=MENTOR' },
    ],
    followUps: [
      'How do schools assign mentors to a cohort?',
      'How are skill levels calculated?',
    ],
  },
  {
    keywords: ['offline', 'internet', 'pwa', 'sync', 'indexeddb', 'network'],
    answer:
      'SparkTrack is an Offline-First Progressive Web App (PWA) designed for school computer labs and workshops across Nigeria and Africa with intermittent internet. Students and mentors can capture projects and rubric signals offline; items are stored safely in browser IndexedDB and automatically synced and sealed when connectivity returns.',
    links: [{ label: 'Open Student Learning Hub', href: '/student/dashboard' }],
    followUps: ['How do I verify if my offline work synced?', 'How does the SHA-256 ledger work?'],
  },
  {
    keywords: ['school', 'partner', 'ngo', 'sponsor', 'scholarship', 'cohort', 'price', 'billing', 'paystack', 'stripe', 'contact', 'human', 'employee'],
    answer:
      'Schools, NGOs, CSR foundations, and government agencies can launch Holiday Camps, School Term Co-Curricular programmes, or Sponsored Scholarship cohorts on SparkTrack. Billing supports Free Pilots, Sponsored Scholarships, Paystack (NGN), and Stripe (USD/Global). You can register your institution directly or message our partnerships & operations team.',
    links: [
      { label: 'Register School or Organisation', href: '/auth?mode=signup&role=SCHOOL_ADMIN' },
      { label: 'Contact Partnerships & Support Team', href: '/contact?category=SCHOOL_PARTNERSHIP' },
      { label: 'School Institutional DPA', href: '/legal?doc=dpa' },
    ],
    followUps: [
      'How do I submit a support or partnership ticket?',
      'What are the Terms of Service for schools?',
    ],
  },
];

function answerQuestion(rawMessage: string) {
  const q = rawMessage.toLowerCase();
  let bestTopic: KnowledgeTopic | null = null;
  let bestScore = 0;

  for (const topic of KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (q.includes(kw)) score += kw.length > 5 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  if (bestTopic && bestScore > 0) {
    return {
      reply: bestTopic.answer,
      links: bestTopic.links,
      followUps: bestTopic.followUps,
    };
  }

  return {
    reply:
      'I am the SparkTrack Intelligence & Compliance Assistant. I can help you with Parent & School registration for Junior/Senior Secondary students (JSS1–SS3), NDPA 2023 & international child-privacy laws, the 13-Part Development Report, offline project capture, school partnerships, or connect you directly with our employee support desk.',
    links: [
      { label: 'Get Started (Parent / School / Learner)', href: '/auth' },
      { label: 'Legal, Privacy & Compliance Center', href: '/legal' },
      { label: 'Contact Support & Partnerships Desk', href: '/contact' },
    ],
    followUps: [
      'How do parents or schools register a JSS/SSS student?',
      'How does SparkTrack comply with NDPA 2023, POPIA & GDPR?',
      'How does the 13-Part Development Report work?',
      'I want to contact a human team member',
    ],
  };
}

@ApiTags('support')
@Controller('v1/support')
class SupportController {
  constructor(@Inject(KYSELY) private readonly db: Kysely<SparkTrackDatabase>) {}

  @Public()
  @Post('chat')
  @ApiOperation({ summary: 'Interactive SparkTrack Assistant chatbot for platform, onboarding, and compliance Q&A' })
  chat(@Body() body: unknown) {
    const parsed = ChatRequestSchema.parse(body);
    return {
      ...answerQuestion(parsed.message),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post('tickets')
  @ApiOperation({ summary: 'Submit a Contact Us, School Partnership, Scholarship, or DPO Privacy inquiry ticket' })
  async createTicket(@Body() body: unknown) {
    const parsed = CreateTicketSchema.parse(body);
    const ticketReference = `TKT-${new Date().getFullYear()}-${randomInt(10000, 99999)}`;
    return supportQueries.createTicket(this.db, {
      ticketReference,
      ...parsed,
    });
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @Get('tickets')
  @ApiOperation({ summary: 'Employee & Operations queue: list support, partnership, and DPO compliance tickets' })
  listTickets(@Query('status') status?: string) {
    return supportQueries.listTickets(this.db, status);
  }

  @ApiBearerAuth()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Employee & Operations action: update ticket status, priority, and resolution notes' })
  async updateTicket(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateTicketSchema.parse(body);
    const updated = await supportQueries.updateTicket(this.db, {
      ticketId: id,
      ...parsed,
      assignedToUserId: user.id,
    });
    if (!updated) throw new NotFoundException('Support ticket not found');
    return updated;
  }
}

@Module({
  controllers: [SupportController],
})
export class SupportModule {}

