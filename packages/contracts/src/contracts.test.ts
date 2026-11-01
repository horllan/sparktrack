import { describe, expect, it } from 'vitest';
import {
  ConsentVerificationSchema, EvidenceSyncPayloadSchema, LearnerOnboardingSchema, MentorMicroRubricSchema,
} from './index.js';

describe('@sparktrack/contracts', () => {
  it('validates offline evidence sync payloads', () => {
    const parsed = EvidenceSyncPayloadSchema.parse({
      clientSyncId: '11111111-1111-4111-8111-111111111111',
      learnerId: '22222222-2222-4222-8222-222222222222',
      artifactType: 'PROJECT_SUBMISSION',
      title: 'Robotics ultrasonic rover',
      payload: { schema_version: '1.0', skill_codes: ['SKILL_ROBOTICS_IOT'] },
      capturedOfflineAt: '2026-10-23T12:00:00+01:00',
    });
    expect(parsed.complexityWeight).toBe(1.0);
  });

  it('validates mentor 3-minute micro-rubric', () => {
    const parsed = MentorMicroRubricSchema.parse({
      clientSyncId: '11111111-1111-4111-8111-111111111112',
      mentorId: '33333333-3333-4333-8333-333333333333',
      learnerId: '22222222-2222-4222-8222-222222222222',
      cohortId: '44444444-4444-4444-8444-444444444444',
      qualityScore: 0.92,
      observedSignals: [{ signal: 'analytical_thinking', intensity: 4 }],
      capturedOfflineAt: '2026-10-23T12:05:00+01:00',
    });
    expect(parsed.observedSignals[0]?.signal).toBe('analytical_thinking');
  });

  it('validates learner onboarding with declared interests and guardian', () => {
    const parsed = LearnerOnboardingSchema.parse({
      fullName: 'Adaeze Obi',
      ageGroup: 'UNDER_18',
      dateOfBirth: '2013-04-15',
      learnerStage: 'SECONDARY_SCHOOL',
      educationLevel: 'JSS3',
      learningGoal: 'EXPLORE_INTERESTS',
      declaredInterests: ['Graphic Design'],
      guardian: { fullName: 'Chinedu Obi', phoneNumber: '+2348012345678' },
    });
    expect(parsed.guardian?.relationship).toBe('PARENT');
  });

  it('requires an international guardian phone number', () => {
    const result = LearnerOnboardingSchema.safeParse({
      fullName: 'Adaeze Obi',
      ageGroup: 'UNDER_18',
      dateOfBirth: '2013-04-15',
      learnerStage: 'SECONDARY_SCHOOL',
      educationLevel: 'JSS3',
      learningGoal: 'EXPLORE_INTERESTS',
      declaredInterests: ['Graphic Design'],
      guardian: { fullName: 'Chinedu Obi', phoneNumber: '0801 234 5678' },
    });
    expect(result.success).toBe(false);
  });

  it('validates consent decisions with a six-digit code', () => {
    const payload = {
      challengeId: '11111111-1111-4111-8111-111111111111',
      otpCode: '012345',
      consentGiven: true,
      grants: { allowPublicPortfolio: false, allowPartnerTalentDiscovery: false },
    };
    expect(ConsentVerificationSchema.safeParse(payload).success).toBe(true);
    expect(ConsentVerificationSchema.safeParse({ ...payload, otpCode: '123' }).success).toBe(false);
  });
});
