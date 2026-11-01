export interface DemoTrainingMilestone {
  id: string;
  year: number;
  title: string;
  programmeType: 'HOLIDAY_CAMP' | 'SCHOOL_TERM_COCURRICULAR' | 'WEEKEND_WORKSHOP' | 'ONLINE_COHORT' | 'VOCATIONAL_APPRENTICESHIP';
  provider: string;
  durationHours: number;
  certificateHash: string;
  skillsGained: string[];
  summary: string;
}

export interface DemoProjectArtifact {
  id: string;
  trainingId: string;
  year: number;
  capturedOfflineAt: string;
  artifactType: string;
  title: string;
  description: string;
  skillCodes: string[];
  qualityScore: number | null;
  mentorVerified: boolean;
  mentorName: string;
  mentorFeedback: string;
  ledgerSeq: number;
  rowSignatureHash: string;
  externalUrl?: string;
}

export interface DemoRubricDimensions {
  execution: number;
  problemSolving: number;
  creativity: number;
  iteration: number;
  independence: number;
}

export interface DemoPathwayMatch {
  pathwayCode: string;
  pathwayName: string;
  pathwayType: 'CAREER' | 'ENTREPRENEURSHIP' | 'ACADEMIC_STREAM';
  affinityScore: number;
  isDivergentFromDeclared: boolean;
  rationale: string;
}

export interface DemoCaseStudy {
  id: string;
  learnerId: string;
  accessCode: string;
  badgeLabel: string;
  caseStudyTitle: string;
  caseStudySubtitle: string;
  fullName: string;
  age: number;
  ageGroup: 'UNDER_18' | 'ADULT';
  dateOfBirth: string;
  educationStage: string;
  learnerStage: string;
  educationLevel: string;
  learningGoal: string;
  currentRole: string | null;
  targetRole: string;
  organisationName: string;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  mentorName: string;
  consentStatus: 'VERIFIED_ACTIVE';
  consentMethod: 'SMS_OTP' | 'ADULT_SELF_ATTESTATION';
  allowPublicPortfolio: boolean;
  allowPartnerTalentDiscovery: boolean;
  defaultOnboardingYear: number;
  availableYears: number[];
  declaredInterests: string[];
  observedTopDomains: string[];
  baseRubric: DemoRubricDimensions;
  trainings: DemoTrainingMilestone[];
  projects: DemoProjectArtifact[];
  pathways: DemoPathwayMatch[];
  autoGenerateTemplates: Array<{
    trainingTitle: string;
    programmeType: DemoTrainingMilestone['programmeType'];
    provider: string;
    durationHours: number;
    projectTitle: string;
    artifactType: DemoProjectArtifact['artifactType'];
    projectDescription: string;
    skillCodes: string[];
    qualityScore: number;
    mentorFeedback: string;
  }>;
}

export const DEMO_ACCOUNTS = [
  {
    role: 'LEARNER',
    label: 'Student / Explorer Demo',
    email: 'student@sparktrack.africa',
    password: 'SparkTrackDemo!2026',
    name: 'Chidi Okafor (13yo JSS3)',
    href: '/student/dashboard',
  },
  {
    role: 'PARENT',
    label: 'Parent / Guardian Demo',
    email: 'guardian@sparktrack.africa',
    password: 'SparkTrackDemo!2026',
    name: 'Mrs. Ngozi Okafor',
    href: '/parent/dashboard',
  },
  {
    role: 'MENTOR',
    label: 'Mentor / Verifier Demo',
    email: 'mentor@sparktrack.africa',
    password: 'SparkTrackDemo!2026',
    name: 'Dr. Amina Bello',
    href: '/mentor/dashboard',
  },
  {
    role: 'SCHOOL_ADMIN',
    label: 'School / Partner Demo',
    email: 'school@sparktrack.africa',
    password: 'SparkTrackDemo!2026',
    name: "Queen's College Innovation Hub",
    href: '/school/dashboard',
  },
  {
    role: 'SUPER_ADMIN',
    label: 'Operations Console Demo',
    email: 'admin@sparktrack.africa',
    password: 'SparkTrackDemo!2026',
    name: 'SparkTrack Operations Lead',
    href: '/admin/dashboard',
  },
] as const;

export const SKILL_LABELS: Record<string, { name: string; category: string }> = {
  SKILL_PYTHON_PROG: { name: 'Python Programming & Automation', category: 'TECHNICAL' },
  SKILL_CYBER_FUND: { name: 'Cybersecurity & Network Defense', category: 'TECHNICAL' },
  SKILL_DEBUGGING_LOGIC: { name: 'Systems Debugging & Logic', category: 'TECHNICAL' },
  SKILL_ROBOTICS_IOT: { name: 'Robotics, Microcontrollers & IoT', category: 'TECHNICAL' },
  SKILL_DATA_ANALYSIS: { name: 'Data Analysis & Telemetry', category: 'TECHNICAL' },
  SKILL_WEB_DEV: { name: 'Full-Stack Web & Mobile Engineering', category: 'TECHNICAL' },
  SKILL_SOLAR_HARDWARE: { name: 'Solar Power & Inverter Systems', category: 'VOCATIONAL' },
  SKILL_GRAPHIC_DESIGN: { name: 'Visual & Brand Design', category: 'CREATIVE' },
  SKILL_UI_UX_DESIGN: { name: 'UI/UX Product Prototyping', category: 'CREATIVE' },
  SKILL_DIGITAL_MEDIA: { name: 'Digital Storytelling & Video Media', category: 'CREATIVE' },
  SKILL_VENTURE_DESIGN: { name: 'Entrepreneurship & Venture Unit Economics', category: 'BUSINESS' },
  SKILL_CUSTOMER_DISCOVERY: { name: 'Market Research & Customer Discovery', category: 'BUSINESS' },
};

export const DEMO_CASE_STUDIES: DemoCaseStudy[] = [
  {
    id: 'chidi-jss3',
    learnerId: '11111111-1111-4111-8111-111111111113',
    accessCode: 'SPK-111113',
    badgeLabel: 'Case Study 1 · Secondary School (JSS1 → JSS3)',
    caseStudyTitle: 'Chidi Okafor — 13yo Secondary School STEM & Cyber Explorer',
    caseStudySubtitle:
      'Onboarded in JSS1 declaring Graphic Design, then discovered standout talent in Python, Cybersecurity & Robotics across 3 years of school clubs and holiday camps.',
    fullName: 'Chidi Okafor',
    age: 13,
    ageGroup: 'UNDER_18',
    dateOfBirth: '2013-04-12',
    educationStage: 'JSS3',
    learnerStage: 'SECONDARY_SCHOOL',
    educationLevel: 'JSS3 (Preparing for SS1 Stream Selection)',
    learningGoal: 'EXPLORE_INTERESTS',
    currentRole: 'JSS3 Co-Curricular Prefect',
    targetRole: 'Robotics, AI & Cybersecurity Engineer',
    organisationName: "Queen's College Lagos Innovation Hub",
    guardianName: 'Mrs. Ngozi Okafor',
    guardianEmail: 'guardian@sparktrack.africa',
    guardianPhone: '+2348030000002',
    mentorName: 'Dr. Amina Bello',
    consentStatus: 'VERIFIED_ACTIVE',
    consentMethod: 'SMS_OTP',
    allowPublicPortfolio: true,
    allowPartnerTalentDiscovery: true,
    defaultOnboardingYear: 2023,
    availableYears: [2023, 2024, 2025, 2026],
    declaredInterests: ['Graphic Design'],
    observedTopDomains: ['Cybersecurity & Network Defense', 'Python Programming', 'Robotics & IoT'],
    baseRubric: {
      execution: 91,
      problemSolving: 94,
      creativity: 84,
      iteration: 92,
      independence: 88,
    },
    trainings: [
      {
        id: 'trn-chidi-2023',
        year: 2023,
        title: 'JSS1 Creative Digital Literacy & Scratch/Design Foundations',
        programmeType: 'SCHOOL_TERM_COCURRICULAR',
        provider: "Queen's College Lagos Innovation Hub",
        durationHours: 24,
        certificateHash: 'sha256:4a91f0c8e2b1d073812ab99e0c14a812b77e5100',
        skillsGained: ['SKILL_GRAPHIC_DESIGN', 'SKILL_DEBUGGING_LOGIC'],
        summary: 'First exposure to digital layout, Scratch logic loops, and structured design critiques.',
      },
      {
        id: 'trn-chidi-2024',
        year: 2024,
        title: 'JSS2 Python Automation & Logic Problem-Solving Bootcamp',
        programmeType: 'HOLIDAY_CAMP',
        provider: 'SparkTrack Africa Foundation',
        durationHours: 40,
        certificateHash: 'sha256:7d82e3b19c45a11200f8e7123a9b4c5d6e7f8091',
        skillsGained: ['SKILL_PYTHON_PROG', 'SKILL_DEBUGGING_LOGIC', 'SKILL_DATA_ANALYSIS'],
        summary: 'Transitioned from visual blocks to writing Python scripts for log parsing and automated alerts.',
      },
      {
        id: 'trn-chidi-2025',
        year: 2025,
        title: 'West Africa Junior Cyber Defense & Network Forensics Lab',
        programmeType: 'WEEKEND_WORKSHOP',
        provider: 'SparkTrack Cyber Defenders Guild',
        durationHours: 36,
        certificateHash: 'sha256:9f01c4a2e8b3d7651209ab87c65d43e21f098765',
        skillsGained: ['SKILL_CYBER_FUND', 'SKILL_DEBUGGING_LOGIC', 'SKILL_PYTHON_PROG'],
        summary: 'Captured and analyzed live PCAP network traces, identifying ARP spoofing and cleartext leaks.',
      },
      {
        id: 'trn-chidi-2026',
        year: 2026,
        title: 'Lagos Robotics, Cyber & Embedded IoT Explorer Camp 2026',
        programmeType: 'HOLIDAY_CAMP',
        provider: 'SparkTrack Africa Foundation',
        durationHours: 48,
        certificateHash: 'sha256:e310a98b7c6d54e321f09a8b7c6d5e4f3a2b1c0d',
        skillsGained: ['SKILL_ROBOTICS_IOT', 'SKILL_PYTHON_PROG', 'SKILL_DATA_ANALYSIS'],
        summary: 'Built autonomous ultrasonic rovers and solar classroom telemetry nodes with microcontroller Python.',
      },
    ],
    projects: [
      {
        id: '11111111-1111-4111-8111-000000000101',
        trainingId: 'trn-chidi-2023',
        year: 2023,
        capturedOfflineAt: '2023-11-14T14:20:00Z',
        artifactType: 'DESIGN_PORTFOLIO',
        title: 'Holiday Camp Poster & Brand Layout',
        description: 'Initial Graphic Design poster exploration for the JSS1 school exhibition.',
        skillCodes: ['SKILL_GRAPHIC_DESIGN'],
        qualityScore: 0.58,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Good colour contrast; Chidi was much more excited automating the layout grid than drawing.',
        ledgerSeq: 12,
        rowSignatureHash: '9b4e12f8a301c7d6e54f32a1098b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
        externalUrl: 'https://github.com/sparktrack-africa/explorer-labs',
      },
      {
        id: '11111111-1111-4111-8111-000000000102',
        trainingId: 'trn-chidi-2024',
        year: 2024,
        capturedOfflineAt: '2024-08-22T15:10:00Z',
        artifactType: 'GIT_REPOSITORY',
        title: 'Python Network Log Parser & Alert Script',
        description: 'Automated parsing of server logs to detect anomalous traffic spikes and brute-force attempts.',
        skillCodes: ['SKILL_PYTHON_PROG', 'SKILL_DEBUGGING_LOGIC'],
        qualityScore: 0.93,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Standout analytical leap—wrote clean regex filters and edge-case tests independently.',
        ledgerSeq: 28,
        rowSignatureHash: '3c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d',
        externalUrl: 'https://github.com/sparktrack-africa/explorer-labs',
      },
      {
        id: '11111111-1111-4111-8111-000000000103',
        trainingId: 'trn-chidi-2025',
        year: 2025,
        capturedOfflineAt: '2025-07-19T11:45:00Z',
        artifactType: 'PROJECT_SUBMISSION',
        title: 'Wireshark Packet Capture & Threat Analysis Lab',
        description: 'Identified cleartext credentials and ARP spoofing patterns in a simulated school LAN PCAP.',
        skillCodes: ['SKILL_CYBER_FUND', 'SKILL_DEBUGGING_LOGIC'],
        qualityScore: 0.95,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Methodically isolated network packet anomalies faster than senior secondary peers.',
        ledgerSeq: 49,
        rowSignatureHash: '7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e',
        externalUrl: 'https://github.com/sparktrack-africa/explorer-labs',
      },
      {
        id: '11111111-1111-4111-8111-000000000104',
        trainingId: 'trn-chidi-2026',
        year: 2026,
        capturedOfflineAt: '2026-09-05T16:30:00Z',
        artifactType: 'PROJECT_SUBMISSION',
        title: 'Autonomous Ultrasonic Obstacle Avoidance Rover',
        description: 'Microcontroller sensor loop in Python with servo steering calibration and battery telemetry.',
        skillCodes: ['SKILL_ROBOTICS_IOT', 'SKILL_PYTHON_PROG'],
        qualityScore: 0.89,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Persisted through three hardware wiring revisions until the rover stabilised around tight corners.',
        ledgerSeq: 64,
        rowSignatureHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
        externalUrl: 'https://github.com/sparktrack-africa/explorer-labs',
      },
      {
        id: '11111111-1111-4111-8111-000000000105',
        trainingId: 'trn-chidi-2026',
        year: 2026,
        capturedOfflineAt: '2026-10-28T13:15:00Z',
        artifactType: 'PROJECT_SUBMISSION',
        title: 'Smart Solar Classroom Telemetry Node (Awaiting Mentor Review)',
        description: 'Live ESP32 temperature and solar voltage logger ready for the Mentor 3-Minute Micro-Rubric queue.',
        skillCodes: ['SKILL_ROBOTICS_IOT', 'SKILL_DATA_ANALYSIS'],
        qualityScore: null,
        mentorVerified: false,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Queued in Mentor Verification Studio for 3-minute rubric scoring.',
        ledgerSeq: 78,
        rowSignatureHash: '5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f',
      },
    ],
    pathways: [
      {
        pathwayCode: 'PATH_CYBER_SECURITY',
        pathwayName: 'Cybersecurity & Network Reliability Engineering',
        pathwayType: 'CAREER',
        affinityScore: 0.94,
        isDivergentFromDeclared: true,
        rationale:
          'Divergence Alert: Although Chidi initially declared Graphic Design in JSS1, his strongest verified scores (93%–95%) are in network packet analysis and Python log automation.',
      },
      {
        pathwayCode: 'PATH_ROBOTICS_EMBEDDED',
        pathwayName: 'Robotics, Embedded Systems & Smart Infrastructure',
        pathwayType: 'CAREER',
        affinityScore: 0.89,
        isDivergentFromDeclared: true,
        rationale: 'High persistence and execution scores across microcontroller wiring and sensor calibration labs.',
      },
      {
        pathwayCode: 'PATH_SS1_SCIENCE_TECH',
        pathwayName: 'SS1 Senior Secondary Stream: Science & Further Mathematics + Computing',
        pathwayType: 'ACADEMIC_STREAM',
        affinityScore: 0.92,
        isDivergentFromDeclared: false,
        rationale: 'Recommended SS1 subject combination based on 3-year verified problem-solving trajectory.',
      },
    ],
    autoGenerateTemplates: [
      {
        trainingTitle: '2026 AI & Embedded Edge Vision Micro-Credential',
        programmeType: 'WEEKEND_WORKSHOP',
        provider: 'SparkTrack AI & Robotics Guild',
        durationHours: 20,
        projectTitle: 'Raspberry Pi Smart School Gate Attendance Scanner',
        artifactType: 'PROJECT_SUBMISSION',
        projectDescription:
          'Built an offline-capable QR + camera verification node in Python with encrypted SQLite sync.',
        skillCodes: ['SKILL_PYTHON_PROG', 'SKILL_ROBOTICS_IOT', 'SKILL_CYBER_FUND'],
        qualityScore: 0.96,
        mentorFeedback: 'Exceptional systems integration—handled low-light camera calibration and hash signing cleanly.',
      },
      {
        trainingTitle: '2026 Youth Tech Entrepreneurship & Pitch Lab',
        programmeType: 'ONLINE_COHORT',
        provider: 'SparkTrack Venture Studio',
        durationHours: 18,
        projectTitle: 'SafeSchool LAN Monitor — Student Micro-SaaS Prototype',
        artifactType: 'BUSINESS_PROTOTYPE',
        projectDescription: 'Packaged the Python network alert script into a dashboard for school ICT administrators.',
        skillCodes: ['SKILL_CYBER_FUND', 'SKILL_VENTURE_DESIGN', 'SKILL_UI_UX_DESIGN'],
        qualityScore: 0.91,
        mentorFeedback: 'Strong customer discovery with two school ICT coordinators.',
      },
    ],
  },
  {
    id: 'aisha-vocational',
    learnerId: '11111111-1111-4111-8111-111111111114',
    accessCode: 'SPK-111114',
    badgeLabel: 'Case Study 2 · Out-of-School / Vocational Maker (19yo)',
    caseStudyTitle: 'Aisha Musa — 19yo Solar Hardware & IoT Vocational Technologist',
    caseStudySubtitle:
      'Self-taught and workshop-trained outside formal university. SparkTrack turns her solar inverter builds and mobile telemetry repairs into an employer-verifiable capability passport.',
    fullName: 'Aisha Musa',
    age: 19,
    ageGroup: 'ADULT',
    dateOfBirth: '2007-02-18',
    educationStage: 'Vocational / Apprenticeship',
    learnerStage: 'NO_FORMAL_EDUCATION',
    educationLevel: 'Vocational Trade & Maker Apprenticeship',
    learningGoal: 'BUILD_PRACTICAL_SKILLS',
    currentRole: 'Apprentice Solar & Inverter Technician',
    targetRole: 'Lead Renewable Energy Field Engineer & Micro-Grid Entrepreneur',
    organisationName: 'Kano Community Solar & Maker Hub',
    guardianName: null,
    guardianEmail: null,
    guardianPhone: null,
    mentorName: 'Dr. Amina Bello',
    consentStatus: 'VERIFIED_ACTIVE',
    consentMethod: 'ADULT_SELF_ATTESTATION',
    allowPublicPortfolio: true,
    allowPartnerTalentDiscovery: true,
    defaultOnboardingYear: 2024,
    availableYears: [2023, 2024, 2025, 2026],
    declaredInterests: ['Robotics', 'Business & Entrepreneurship'],
    observedTopDomains: ['Solar Power & Inverter Systems', 'Robotics, Microcontrollers & IoT', 'Venture Design'],
    baseRubric: {
      execution: 95,
      problemSolving: 93,
      creativity: 86,
      iteration: 94,
      independence: 96,
    },
    trainings: [
      {
        id: 'trn-aisha-2023',
        year: 2023,
        title: 'Foundational DC Electronics, Multimeter Diagnostics & Soldering Guild',
        programmeType: 'VOCATIONAL_APPRENTICESHIP',
        provider: 'Kano Community Solar & Maker Hub',
        durationHours: 60,
        certificateHash: 'sha256:11a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4',
        skillsGained: ['SKILL_SOLAR_HARDWARE', 'SKILL_DEBUGGING_LOGIC'],
        summary: 'Mastered fault isolation on damaged DC charge controllers and lithium battery packs.',
      },
      {
        id: 'trn-aisha-2024',
        year: 2024,
        title: 'Off-Grid Solar Sizing, Hybrid Inverter Wiring & Safety Standard Intensive',
        programmeType: 'VOCATIONAL_APPRENTICESHIP',
        provider: 'CleanEnergy Youth Nigeria',
        durationHours: 80,
        certificateHash: 'sha256:22b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5',
        skillsGained: ['SKILL_SOLAR_HARDWARE', 'SKILL_CUSTOMER_DISCOVERY'],
        summary: 'Completed 12 supervised residential and cold-room solar installations.',
      },
      {
        id: 'trn-aisha-2025',
        year: 2025,
        title: 'IoT Remote Battery Telemetry & GSM Fault Alert Workshop',
        programmeType: 'WEEKEND_WORKSHOP',
        provider: 'SparkTrack Maker Network',
        durationHours: 35,
        certificateHash: 'sha256:33c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6',
        skillsGained: ['SKILL_ROBOTICS_IOT', 'SKILL_DATA_ANALYSIS', 'SKILL_SOLAR_HARDWARE'],
        summary: 'Added microcontroller voltage/current sensors to rural solar installations for proactive maintenance.',
      },
      {
        id: 'trn-aisha-2026',
        year: 2026,
        title: 'Micro-Grid Service Business & Client Operations Accelerator',
        programmeType: 'ONLINE_COHORT',
        provider: 'SparkTrack Africa Foundation',
        durationHours: 30,
        certificateHash: 'sha256:44d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f7',
        skillsGained: ['SKILL_VENTURE_DESIGN', 'SKILL_CUSTOMER_DISCOVERY'],
        summary: 'Structured maintenance SLA pricing and WhatsApp customer dispatch workflow for local SMEs.',
      },
    ],
    projects: [
      {
        id: '11111111-1111-4111-8111-000000000201',
        trainingId: 'trn-aisha-2023',
        year: 2023,
        capturedOfflineAt: '2023-10-12T10:00:00Z',
        artifactType: 'PROJECT_SUBMISSION',
        title: 'Refurbished 24V LiFePO4 Market Stall Battery Pack with BMS Balancing',
        description: 'Rebuilt and balanced 8 salvaged cells with active thermal protection for evening market traders.',
        skillCodes: ['SKILL_SOLAR_HARDWARE', 'SKILL_DEBUGGING_LOGIC'],
        qualityScore: 0.88,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Clean busbar terminations and thorough load-testing logs.',
        ledgerSeq: 18,
        rowSignatureHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      },
      {
        id: '11111111-1111-4111-8111-000000000202',
        trainingId: 'trn-aisha-2024',
        year: 2024,
        capturedOfflineAt: '2024-09-18T14:30:00Z',
        artifactType: 'PROJECT_SUBMISSION',
        title: '3.5kVA Solar Cold-Storage Backup for Pharmacy Clinic',
        description: 'Full load audit, PV array protection wiring, and changeover relay installation.',
        skillCodes: ['SKILL_SOLAR_HARDWARE', 'SKILL_CUSTOMER_DISCOVERY'],
        qualityScore: 0.94,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Zero voltage drop under compressor surge; client reported 99.8% uptime.',
        ledgerSeq: 35,
        rowSignatureHash: 'b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1',
      },
      {
        id: '11111111-1111-4111-8111-000000000203',
        trainingId: 'trn-aisha-2025',
        year: 2025,
        capturedOfflineAt: '2025-11-04T16:15:00Z',
        artifactType: 'PROJECT_SUBMISSION',
        title: 'GSM SMS Low-Voltage Battery Guardian Node',
        description: 'Hardware monitor that alerts shop owners via SMS before deep-discharge damages inverter batteries.',
        skillCodes: ['SKILL_ROBOTICS_IOT', 'SKILL_SOLAR_HARDWARE', 'SKILL_DATA_ANALYSIS'],
        qualityScore: 0.96,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Solved the #1 cause of premature battery failure for local merchants.',
        ledgerSeq: 54,
        rowSignatureHash: 'c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2',
      },
      {
        id: '11111111-1111-4111-8111-000000000204',
        trainingId: 'trn-aisha-2026',
        year: 2026,
        capturedOfflineAt: '2026-08-19T12:00:00Z',
        artifactType: 'BUSINESS_PROTOTYPE',
        title: 'SunPulse Kano — Pay-As-You-Go Solar Maintenance Cooperative',
        description: 'Unit economics model and 18-merchant recurring maintenance book generating ₦320,000/month.',
        skillCodes: ['SKILL_VENTURE_DESIGN', 'SKILL_CUSTOMER_DISCOVERY', 'SKILL_SOLAR_HARDWARE'],
        qualityScore: 0.92,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Real paying customers and verifiable hardware reliability receipts.',
        ledgerSeq: 70,
        rowSignatureHash: 'd4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3',
      },
    ],
    pathways: [
      {
        pathwayCode: 'PATH_RENEWABLE_FIELD_ENG',
        pathwayName: 'Renewable Energy & Smart Micro-Grid Field Engineering',
        pathwayType: 'CAREER',
        affinityScore: 0.96,
        isDivergentFromDeclared: false,
        rationale: 'Four verified solar and hardware projects with 94%–96% mentor quality scores.',
      },
      {
        pathwayCode: 'PATH_CLEAN_TECH_VENTURE',
        pathwayName: 'Clean-Tech Hardware Maintenance Micro-Enterprise',
        pathwayType: 'ENTREPRENEURSHIP',
        affinityScore: 0.91,
        isDivergentFromDeclared: false,
        rationale: 'Demonstrated independent customer acquisition and recurring service revenue.',
      },
    ],
    autoGenerateTemplates: [
      {
        trainingTitle: '2026 Three-Phase Commercial Solar & Mini-Grid Commissioning',
        programmeType: 'VOCATIONAL_APPRENTICESHIP',
        provider: 'Rural Electrification Partner Guild',
        durationHours: 45,
        projectTitle: '15kW Agro-Processing Solar Milling Micro-Grid',
        artifactType: 'PROJECT_SUBMISSION',
        projectDescription: 'Commissioned 3-phase inverter bank with automated load-shedding and cloud telemetry.',
        skillCodes: ['SKILL_SOLAR_HARDWARE', 'SKILL_ROBOTICS_IOT', 'SKILL_VENTURE_DESIGN'],
        qualityScore: 0.97,
        mentorFeedback: 'Commercial-grade commissioning verified on-site.',
      },
    ],
  },
  {
    id: 'tunde-nysc',
    learnerId: '11111111-1111-4111-8111-111111111115',
    accessCode: 'SPK-111115',
    badgeLabel: 'Case Study 3 · University / NYSC Graduate Track (23yo)',
    caseStudyTitle: 'Tunde Adeyemi — 23yo NYSC Corps Member & Full-Stack AI Builder',
    caseStudySubtitle:
      'Bridging the "no work experience" graduate gap: tracked from 300-Level University innovation clubs through NYSC SAED into the Employer Talent Discovery Pool.',
    fullName: 'Tunde Adeyemi',
    age: 23,
    ageGroup: 'ADULT',
    dateOfBirth: '2003-07-09',
    educationStage: 'University / College',
    learnerStage: 'NYSC',
    educationLevel: 'B.Sc. Computer Science / NYSC Corps Member',
    learningGoal: 'GET_FIRST_JOB',
    currentRole: 'NYSC SAED Tech Lead',
    targetRole: 'Full-Stack Product & Data Engineer',
    organisationName: 'SparkTrack Africa Foundation',
    guardianName: null,
    guardianEmail: null,
    guardianPhone: null,
    mentorName: 'Dr. Amina Bello',
    consentStatus: 'VERIFIED_ACTIVE',
    consentMethod: 'ADULT_SELF_ATTESTATION',
    allowPublicPortfolio: true,
    allowPartnerTalentDiscovery: true,
    defaultOnboardingYear: 2023,
    availableYears: [2023, 2024, 2025, 2026],
    declaredInterests: ['Web Development', 'AI & Data Science'],
    observedTopDomains: ['Full-Stack Web & Mobile Engineering', 'Python Programming', 'Data Analysis & Telemetry'],
    baseRubric: {
      execution: 93,
      problemSolving: 91,
      creativity: 89,
      iteration: 94,
      independence: 95,
    },
    trainings: [
      {
        id: 'trn-tunde-2023',
        year: 2023,
        title: 'Campus Full-Stack TypeScript & PostgreSQL Engineering Fellowship',
        programmeType: 'ONLINE_COHORT',
        provider: 'UNILAG Innovation Club',
        durationHours: 64,
        certificateHash: 'sha256:55e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708',
        skillsGained: ['SKILL_WEB_DEV', 'SKILL_DEBUGGING_LOGIC'],
        summary: 'Built offline-first progressive web apps and relational schemas.',
      },
      {
        id: 'trn-tunde-2024',
        year: 2024,
        title: 'Applied Data Engineering & Python ETL Sprint',
        programmeType: 'HOLIDAY_CAMP',
        provider: 'SparkTrack Africa Foundation',
        durationHours: 48,
        certificateHash: 'sha256:66f708192a3b4c5d6e7f8091a2b3c4d5e6f70819',
        skillsGained: ['SKILL_PYTHON_PROG', 'SKILL_DATA_ANALYSIS'],
        summary: 'Automated agricultural commodity price pipelines across 14 Nigerian states.',
      },
      {
        id: 'trn-tunde-2025',
        year: 2025,
        title: 'Final-Year Capstone & Security Hardening Guild',
        programmeType: 'WEEKEND_WORKSHOP',
        provider: 'SparkTrack Cyber Defenders Guild',
        durationHours: 36,
        certificateHash: 'sha256:7708192a3b4c5d6e7f8091a2b3c4d5e6f708192a',
        skillsGained: ['SKILL_WEB_DEV', 'SKILL_CYBER_FUND', 'SKILL_UI_UX_DESIGN'],
        summary: 'Added OWASP rate-limiting, JWT RBAC, and automated CI tests to production apps.',
      },
      {
        id: 'trn-tunde-2026',
        year: 2026,
        title: 'NYSC SAED AI Workflow & Civic-Tech Deployment Cohort',
        programmeType: 'ONLINE_COHORT',
        provider: 'SparkTrack Employer Readiness Studio',
        durationHours: 52,
        certificateHash: 'sha256:88192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b',
        skillsGained: ['SKILL_WEB_DEV', 'SKILL_PYTHON_PROG', 'SKILL_VENTURE_DESIGN'],
        summary: 'Deployed a live clinic queue & maternal health SMS reminder platform during NYSC service year.',
      },
    ],
    projects: [
      {
        id: '11111111-1111-4111-8111-000000000301',
        trainingId: 'trn-tunde-2023',
        year: 2023,
        capturedOfflineAt: '2023-09-20T18:00:00Z',
        artifactType: 'GIT_REPOSITORY',
        title: 'CampusTransit — Shuttle Bus Live Seat & Wallet PWA',
        description: 'TypeScript + IndexedDB offline ticket validator used by 400+ campus commuters.',
        skillCodes: ['SKILL_WEB_DEV', 'SKILL_DEBUGGING_LOGIC'],
        qualityScore: 0.87,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Handled flaky 3G reconnects gracefully with idempotent sync keys.',
        ledgerSeq: 22,
        rowSignatureHash: 'e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4',
      },
      {
        id: '11111111-1111-4111-8111-000000000302',
        trainingId: 'trn-tunde-2024',
        year: 2024,
        capturedOfflineAt: '2024-10-11T15:40:00Z',
        artifactType: 'GIT_REPOSITORY',
        title: 'AgroPulse NG — Food Basket Price Anomaly Tracker',
        description: 'Python scraper and time-series dashboard tracking market inflation across 6 geopolitical zones.',
        skillCodes: ['SKILL_PYTHON_PROG', 'SKILL_DATA_ANALYSIS'],
        qualityScore: 0.92,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Clean data normalization and clear statistical confidence bands.',
        ledgerSeq: 41,
        rowSignatureHash: 'f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5',
      },
      {
        id: '11111111-1111-4111-8111-000000000303',
        trainingId: 'trn-tunde-2025',
        year: 2025,
        capturedOfflineAt: '2025-06-30T11:20:00Z',
        artifactType: 'PROJECT_SUBMISSION',
        title: 'Zero-Trust Cooperative Ledger API (B.Sc. Capstone)',
        description: 'Auditable savings & loan backend with SHA-256 hash chaining and role-based access control.',
        skillCodes: ['SKILL_WEB_DEV', 'SKILL_CYBER_FUND'],
        qualityScore: 0.95,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Production-grade security posture; passed all automated penetration checks.',
        ledgerSeq: 58,
        rowSignatureHash: '0718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6',
      },
      {
        id: '11111111-1111-4111-8111-000000000304',
        trainingId: 'trn-tunde-2026',
        year: 2026,
        capturedOfflineAt: '2026-09-14T17:05:00Z',
        artifactType: 'PROJECT_SUBMISSION',
        title: 'MamaCare NYSC — Primary Health Centre Immunization Triage System',
        description: 'Built during NYSC Community Development Service (CDS); reduced clinic wait times by 42%.',
        skillCodes: ['SKILL_WEB_DEV', 'SKILL_PYTHON_PROG', 'SKILL_VENTURE_DESIGN'],
        qualityScore: 0.97,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Outstanding real-world impact; ready for immediate Junior/Mid Product Engineer placement.',
        ledgerSeq: 74,
        rowSignatureHash: '18293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f607',
      },
    ],
    pathways: [
      {
        pathwayCode: 'PATH_FULLSTACK_PRODUCT_ENG',
        pathwayName: 'Full-Stack Software & Distributed Systems Engineering',
        pathwayType: 'CAREER',
        affinityScore: 0.96,
        isDivergentFromDeclared: false,
        rationale: '4 years of verified shipping velocity from university projects to live NYSC civic-tech deployment.',
      },
      {
        pathwayCode: 'PATH_DATA_AI_ENG',
        pathwayName: 'Applied Data & AI Workflow Engineering',
        pathwayType: 'CAREER',
        affinityScore: 0.91,
        isDivergentFromDeclared: false,
        rationale: 'Strong Python ETL and telemetry architecture scores.',
      },
    ],
    autoGenerateTemplates: [
      {
        trainingTitle: '2026 FinTech High-Concurrency Payment Systems Lab',
        programmeType: 'ONLINE_COHORT',
        provider: 'Lagos FinTech Engineering Partner',
        durationHours: 32,
        projectTitle: 'Idempotent Webhook & Double-Entry Settlement Engine',
        artifactType: 'GIT_REPOSITORY',
        projectDescription: 'Implemented Paystack/Stripe webhook replay protection and row-locked ledger transfers.',
        skillCodes: ['SKILL_WEB_DEV', 'SKILL_CYBER_FUND', 'SKILL_DATA_ANALYSIS'],
        qualityScore: 0.98,
        mentorFeedback: 'Employer Partner Shortlist: Top 2% of cohort.',
      },
    ],
  },
  {
    id: 'zainab-creative',
    learnerId: '11111111-1111-4111-8111-111111111116',
    accessCode: 'SPK-111116',
    badgeLabel: 'Case Study 4 · Creative Design & Youth Venture (JSS2 → SS1)',
    caseStudyTitle: 'Zainab Ibrahim — 15yo UI/UX Designer & Student Social Entrepreneur',
    caseStudySubtitle:
      'Showcases how SparkTrack validates Creative Design, Digital Media, and Youth Entrepreneurship alongside STEM—helping schools nurture well-rounded innovators.',
    fullName: 'Zainab Ibrahim',
    age: 15,
    ageGroup: 'UNDER_18',
    dateOfBirth: '2011-08-24',
    educationStage: 'SS1',
    learnerStage: 'SECONDARY_SCHOOL',
    educationLevel: 'SS1 (Creative Arts, Design & Commercial Stream)',
    learningGoal: 'START_BUSINESS',
    currentRole: 'School Design & Enterprise Club Lead',
    targetRole: 'Product Designer & Sustainable Brand Founder',
    organisationName: "Queen's College Lagos Innovation Hub",
    guardianName: 'Mrs. Ngozi Okafor',
    guardianEmail: 'guardian@sparktrack.africa',
    guardianPhone: '+2348030000002',
    mentorName: 'Dr. Amina Bello',
    consentStatus: 'VERIFIED_ACTIVE',
    consentMethod: 'SMS_OTP',
    allowPublicPortfolio: true,
    allowPartnerTalentDiscovery: true,
    defaultOnboardingYear: 2024,
    availableYears: [2024, 2025, 2026],
    declaredInterests: ['Graphic Design', 'Video Production', 'Business & Entrepreneurship'],
    observedTopDomains: ['UI/UX Product Prototyping', 'Entrepreneurship & Venture Design', 'Visual & Brand Design'],
    baseRubric: {
      execution: 90,
      problemSolving: 88,
      creativity: 97,
      iteration: 93,
      independence: 91,
    },
    trainings: [
      {
        id: 'trn-zainab-2024',
        year: 2024,
        title: 'JSS2 Visual Identity, Typography & Brand Storytelling Studio',
        programmeType: 'SCHOOL_TERM_COCURRICULAR',
        provider: "Queen's College Lagos Innovation Hub",
        durationHours: 28,
        certificateHash: 'sha256:992a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c',
        skillsGained: ['SKILL_GRAPHIC_DESIGN', 'SKILL_DIGITAL_MEDIA'],
        summary: 'Designed complete visual systems and short documentary reels for school community campaigns.',
      },
      {
        id: 'trn-zainab-2025',
        year: 2025,
        title: 'JSS3 Mobile UI/UX Prototyping & Accessibility Design Camp',
        programmeType: 'HOLIDAY_CAMP',
        provider: 'SparkTrack Africa Foundation',
        durationHours: 42,
        certificateHash: 'sha256:aa3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d',
        skillsGained: ['SKILL_UI_UX_DESIGN', 'SKILL_CUSTOMER_DISCOVERY'],
        summary: 'Conducted usability interviews with 25 parents and built interactive Figma prototypes.',
      },
      {
        id: 'trn-zainab-2026',
        year: 2026,
        title: 'SS1 Green Enterprise & Youth Venture Incubator',
        programmeType: 'WEEKEND_WORKSHOP',
        provider: 'SparkTrack Venture Studio',
        durationHours: 36,
        certificateHash: 'sha256:bb4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e',
        skillsGained: ['SKILL_VENTURE_DESIGN', 'SKILL_CUSTOMER_DISCOVERY', 'SKILL_UI_UX_DESIGN'],
        summary: 'Launched EcoPack School Canteen biodegradable packaging pilot with verified unit margins.',
      },
    ],
    projects: [
      {
        id: '11111111-1111-4111-8111-000000000401',
        trainingId: 'trn-zainab-2024',
        year: 2024,
        capturedOfflineAt: '2024-11-08T13:30:00Z',
        artifactType: 'DESIGN_PORTFOLIO',
        title: 'Zero-Litter Campus Campaign Brand System & Motion Reel',
        description: 'Bilingual visual identity, posters, and 90-second awareness video screened at assembly.',
        skillCodes: ['SKILL_GRAPHIC_DESIGN', 'SKILL_DIGITAL_MEDIA'],
        qualityScore: 0.89,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Compelling visual hierarchy and authentic student voice.',
        ledgerSeq: 39,
        rowSignatureHash: '293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718',
      },
      {
        id: '11111111-1111-4111-8111-000000000402',
        trainingId: 'trn-zainab-2025',
        year: 2025,
        capturedOfflineAt: '2025-08-25T15:00:00Z',
        artifactType: 'DESIGN_PORTFOLIO',
        title: 'StudyBuddy NG — Low-Bandwidth Peer Revision App UI/UX Prototype',
        description: 'Interactive 18-screen mobile prototype tested with JSS3 students preparing for BECE.',
        skillCodes: ['SKILL_UI_UX_DESIGN', 'SKILL_CUSTOMER_DISCOVERY'],
        qualityScore: 0.94,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Iterated navigation three times based on real classmate usability testing.',
        ledgerSeq: 56,
        rowSignatureHash: '3a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071829',
      },
      {
        id: '11111111-1111-4111-8111-000000000403',
        trainingId: 'trn-zainab-2026',
        year: 2026,
        capturedOfflineAt: '2026-09-29T14:15:00Z',
        artifactType: 'BUSINESS_PROTOTYPE',
        title: 'EcoLeaf Packs — Plantain-Fibre Canteen Packaging Micro-Venture',
        description: 'Replaced 1,200 single-use plastics at school events; documented unit cost (₦45) vs. price (₦80).',
        skillCodes: ['SKILL_VENTURE_DESIGN', 'SKILL_CUSTOMER_DISCOVERY', 'SKILL_GRAPHIC_DESIGN'],
        qualityScore: 0.96,
        mentorVerified: true,
        mentorName: 'Dr. Amina Bello',
        mentorFeedback: 'Rare blend of product aesthetics and disciplined unit economics.',
        ledgerSeq: 72,
        rowSignatureHash: '4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a',
      },
    ],
    pathways: [
      {
        pathwayCode: 'PATH_PRODUCT_UI_UX',
        pathwayName: 'Digital Product Design (UI/UX) & Human-Centred Research',
        pathwayType: 'CAREER',
        affinityScore: 0.95,
        isDivergentFromDeclared: false,
        rationale: 'Consistent 94%+ mentor scores in user research, rapid prototyping, and visual craft.',
      },
      {
        pathwayCode: 'PATH_SOCIAL_VENTURE',
        pathwayName: 'Consumer Brand & Sustainable Social Enterprise',
        pathwayType: 'ENTREPRENEURSHIP',
        affinityScore: 0.93,
        isDivergentFromDeclared: false,
        rationale: 'Proven ability to take a physical + digital product from customer interview to positive margin.',
      },
    ],
    autoGenerateTemplates: [
      {
        trainingTitle: '2026 No-Code Webflow & E-Commerce Brand Launchpad',
        programmeType: 'ONLINE_COHORT',
        provider: 'SparkTrack Creative Guild',
        durationHours: 24,
        projectTitle: 'EcoLeaf Direct — Wholesale School Ordering Portal',
        artifactType: 'DESIGN_PORTFOLIO',
        projectDescription: 'Designed and launched a responsive ordering storefront for 5 neighbouring schools.',
        skillCodes: ['SKILL_UI_UX_DESIGN', 'SKILL_VENTURE_DESIGN', 'SKILL_WEB_DEV'],
        qualityScore: 0.95,
        mentorFeedback: 'Seamless checkout flow and strong brand storytelling.',
      },
    ],
  },
];

export interface SimulatedTimelinePoint {
  year: number;
  stageLabel: string;
  trainingsCompleted: number;
  projectsVerified: number;
  compositeMasteryPct: number;
  highlight: string;
}

export interface ComputedDemoState {
  caseStudy: DemoCaseStudy;
  onboardingYear: number;
  yearsActive: number;
  activeTrainings: DemoTrainingMilestone[];
  activeProjects: DemoProjectArtifact[];
  totalHoursTrained: number;
  rubric: DemoRubricDimensions;
  skillScores: Array<{
    code: string;
    name: string;
    category: string;
    score: number;
    progression: 'BEGINNER' | 'DEVELOPING' | 'COMPETENT' | 'ADVANCED';
    evidenceCount: number;
  }>;
  timeline: SimulatedTimelinePoint[];
  report: {
    id: string;
    version: number;
    learnerId: string;
    generatedAt: string;
    synthesisModel: string;
    parametersSummary: string;
    guardrailResult: {
      passed: boolean;
      deterministicViolations: Array<{ phrase: string; sectionKey: string }>;
      explorationLanguageCount: number;
    };
    executiveSummary: { key: string; title: string; narrative: string };
    participationHistory: { key: string; title: string; narrative: string };
    declaredVsObserved: { key: string; title: string; narrative: string };
    technicalSkills: { key: string; title: string; narrative: string };
    creativeSkills: { key: string; title: string; narrative: string };
    businessSkills: { key: string; title: string; narrative: string };
    behaviouralSignals: { key: string; title: string; narrative: string };
    capabilityMaturity: { key: string; title: string; narrative: string };
    careerPathways: { key: string; title: string; narrative: string };
    entrepreneurshipPathways: { key: string; title: string; narrative: string };
    longitudinalProgress: { key: string; title: string; narrative: string };
    recommendedNextSteps: { key: string; title: string; narrative: string };
    mentorInsights: { key: string; title: string; narrative: string };
  };
}

export function computeDemoState(
  caseStudy: DemoCaseStudy,
  onboardingYear: number,
  selectedTrainingIds: string[],
  extraTrainings: DemoTrainingMilestone[] = [],
  extraProjects: DemoProjectArtifact[] = [],
): ComputedDemoState {
  const allTrainings = [...caseStudy.trainings, ...extraTrainings].filter((t) => t.year >= onboardingYear);
  const activeTrainings = allTrainings.filter((t) => selectedTrainingIds.includes(t.id));
  const activeTrainingIdSet = new Set(activeTrainings.map((t) => t.id));

  const allProjects = [...caseStudy.projects, ...extraProjects].filter(
    (p) => p.year >= onboardingYear && activeTrainingIdSet.has(p.trainingId),
  );

  const yearsActive = Math.max(1, 2026 - onboardingYear + 1);
  const totalHoursTrained = activeTrainings.reduce((acc, t) => acc + t.durationHours, 0);

  // Compute dynamic skill scores from active projects & trainings
  const skillBuckets = new Map<string, { scores: number[]; count: number }>();
  for (const t of activeTrainings) {
    for (const code of t.skillsGained) {
      const cur = skillBuckets.get(code) ?? { scores: [], count: 0 };
      cur.scores.push(0.76);
      cur.count += 1;
      skillBuckets.set(code, cur);
    }
  }
  for (const p of allProjects) {
    for (const code of p.skillCodes) {
      const cur = skillBuckets.get(code) ?? { scores: [], count: 0 };
      cur.scores.push(p.qualityScore ?? 0.82);
      cur.count += 1;
      skillBuckets.set(code, cur);
    }
  }

  const skillScores = Array.from(skillBuckets.entries())
    .map(([code, data]) => {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const bonus = Math.min(0.08, (data.count - 1) * 0.025);
      const score = Math.min(0.98, Number((avg + bonus).toFixed(2)));
      const progression: 'BEGINNER' | 'DEVELOPING' | 'COMPETENT' | 'ADVANCED' =
        score >= 0.85 ? 'ADVANCED' : score >= 0.72 ? 'COMPETENT' : score >= 0.5 ? 'DEVELOPING' : 'BEGINNER';
      const meta = SKILL_LABELS[code] ?? {
        name: code.replace(/^SKILL_/, '').replace(/_/g, ' '),
        category: 'TECHNICAL',
      };
      return {
        code,
        name: meta.name,
        category: meta.category,
        score,
        progression,
        evidenceCount: data.count,
      };
    })
    .sort((a, b) => b.score - a.score);

  const scaleFactor = Math.min(1.05, 0.78 + activeTrainings.length * 0.06 + extraProjects.length * 0.03);
  const rubric: DemoRubricDimensions = {
    execution: Math.min(99, Math.round(caseStudy.baseRubric.execution * scaleFactor)),
    problemSolving: Math.min(99, Math.round(caseStudy.baseRubric.problemSolving * scaleFactor)),
    creativity: Math.min(99, Math.round(caseStudy.baseRubric.creativity * scaleFactor)),
    iteration: Math.min(99, Math.round(caseStudy.baseRubric.iteration * scaleFactor)),
    independence: Math.min(99, Math.round(caseStudy.baseRubric.independence * scaleFactor)),
  };

  // Build year-by-year longitudinal timeline from onboardingYear to 2026
  const timeline: SimulatedTimelinePoint[] = [];
  for (let yr = onboardingYear; yr <= 2026; yr++) {
    const yrTrainings = activeTrainings.filter((t) => t.year === yr);
    const yrProjects = allProjects.filter((p) => p.year === yr);
    const yrIdx = yr - onboardingYear;
    const baseMastery = Math.min(
      96,
      Math.round(58 + yrIdx * 11 + yrTrainings.length * 5 + yrProjects.length * 4),
    );
    timeline.push({
      year: yr,
      stageLabel:
        caseStudy.learnerStage === 'SECONDARY_SCHOOL'
          ? yr === 2023
            ? 'JSS1'
            : yr === 2024
              ? 'JSS2'
              : yr === 2025
                ? 'JSS3'
                : 'JSS3 / SS1 Readiness'
          : `Year ${yrIdx + 1} (${yr})`,
      trainingsCompleted: yrTrainings.length,
      projectsVerified: yrProjects.length,
      compositeMasteryPct: baseMastery,
      highlight:
        yrProjects[0]?.title ??
        yrTrainings[0]?.title ??
        'Initial onboarding & baseline capability exploration',
    });
  }

  const topSkillsText =
    skillScores
      .slice(0, 3)
      .map((s) => `${s.name} (${Math.round(s.score * 100)}% · ${s.progression})`)
      .join(', ') || 'Foundational Digital Exploration';

  const trainingsListText =
    activeTrainings.map((t) => `${t.title} (${t.year}, ${t.durationHours}h)`).join('; ') ||
    'Initial onboarding baseline';

  const projectsListText =
    allProjects.map((p) => `"${p.title}" (${p.year})`).join(', ') || 'First project in progress';

  const parametersSummary = `Started ${onboardingYear} (${yearsActive} ${yearsActive === 1 ? 'yr' : 'yrs'}) • ${activeTrainings.length} Trainings (${totalHoursTrained} hrs) • ${allProjects.length} Projects`;

  const report = {
    id: `rep-demo-${caseStudy.id}-${onboardingYear}-${activeTrainings.length}-${allProjects.length}`,
    version: activeTrainings.length + allProjects.length,
    learnerId: caseStudy.learnerId,
    generatedAt: new Date().toISOString(),
    synthesisModel: 'SparkTrack Educator Review',
    parametersSummary,
    guardrailResult: {
      passed: true,
      deterministicViolations: [],
      explorationLanguageCount: 19,
    },
    executiveSummary: {
      key: 'executiveSummary',
      title: 'Summary',
      narrative: `${caseStudy.fullName} (${caseStudy.educationLevel}, ${caseStudy.organisationName}) has been building on SparkTrack since ${onboardingYear} (${yearsActive} ${yearsActive === 1 ? 'year' : 'years'}). Across ${activeTrainings.length} completed trainings (${totalHoursTrained} hours) and ${allProjects.length} reviewed projects, ${caseStudy.fullName.split(' ')[0]} shows strong progress in ${topSkillsText}. Every insight in this report is based on real project work and mentor reviews.`,
    },
    participationHistory: {
      key: 'participationHistory',
      title: 'Trainings & Projects Completed',
      narrative: `Between ${onboardingYear} and 2026, ${caseStudy.fullName.split(' ')[0]} completed ${activeTrainings.length} structured trainings: ${trainingsListText}. During these programmes, they built ${allProjects.length} verified projects: ${projectsListText}.`,
    },
    declaredVsObserved: {
      key: 'declaredVsObserved',
      title: 'Initial Interests vs. Demonstrated Strengths',
      narrative: `When joining in ${onboardingYear}, ${caseStudy.fullName.split(' ')[0]} chose ${caseStudy.declaredInterests.join(' and ')} as their starting interest. Through ${allProjects.length} hands-on projects, mentors observed their strongest work in ${caseStudy.observedTopDomains.join(', ')}. ${
        caseStudy.pathways.some((p) => p.isDivergentFromDeclared)
          ? 'This shift shows how practical project work helps students discover talents that standard exams often miss.'
          : 'Their completed projects confirm and deepen the interests they first chose.'
      }`,
    },
    technicalSkills: {
      key: 'technicalSkills',
      title: 'Technical & Practical Skills',
      narrative:
        skillScores
          .filter((s) => s.category === 'TECHNICAL' || s.category === 'VOCATIONAL')
          .map((s) => `${s.name}: ${Math.round(s.score * 100)}% (${s.progression}, ${s.evidenceCount} projects/trainings)`)
          .join(' • ') ||
        'Building foundational technical skills through practical project work.',
    },
    creativeSkills: {
      key: 'creativeSkills',
      title: 'Design & Communication Skills',
      narrative:
        skillScores
          .filter((s) => s.category === 'CREATIVE')
          .map((s) => `${s.name}: ${Math.round(s.score * 100)}% (${s.progression}, ${s.evidenceCount} projects/trainings)`)
          .join(' • ') ||
        `Earned a ${rubric.creativity}% creativity rating from mentors for clear design and presentation.`,
    },
    businessSkills: {
      key: 'businessSkills',
      title: 'Business & Problem-Solving Skills',
      narrative:
        skillScores
          .filter((s) => s.category === 'BUSINESS')
          .map((s) => `${s.name}: ${Math.round(s.score * 100)}% (${s.progression}, ${s.evidenceCount} projects/trainings)`)
          .join(' • ') ||
        'Demonstrates a strong focus on solving practical problems for real users.',
    },
    behaviouralSignals: {
      key: 'behaviouralSignals',
      title: 'Work Habits & Mentor Observations',
      narrative: `In reviews led by ${caseStudy.mentorName}, ${caseStudy.fullName.split(' ')[0]} earned strong ratings across all five core habits: Execution (${rubric.execution}%), Problem Solving (${rubric.problemSolving}%), Persistence (${rubric.iteration}%), Creativity (${rubric.creativity}%), and Independence (${rubric.independence}%).`,
    },
    capabilityMaturity: {
      key: 'capabilityMaturity',
      title: 'Overall Skill Growth',
      narrative: `Overall mastery grew from ${timeline[0]?.compositeMasteryPct ?? 58}% in ${onboardingYear} to ${timeline[timeline.length - 1]?.compositeMasteryPct ?? 91}% in 2026 (+${(timeline[timeline.length - 1]?.compositeMasteryPct ?? 91) - (timeline[0]?.compositeMasteryPct ?? 58)}% growth), backed by ${allProjects.filter((p) => p.mentorVerified).length} mentor-reviewed projects.`,
    },
    careerPathways: {
      key: 'careerPathways',
      title: 'Recommended Career & Study Paths',
      narrative: caseStudy.pathways
        .map((p) => `${p.pathwayName} (${Math.round(p.affinityScore * 100)}% match) — ${p.rationale}`)
        .join(' | '),
    },
    entrepreneurshipPathways: {
      key: 'entrepreneurshipPathways',
      title: 'Venture & Community Opportunities',
      narrative: `${caseStudy.fullName.split(' ')[0]} is well positioned to apply ${topSkillsText} to school innovation challenges, community projects, and small student ventures.`,
    },
    longitudinalProgress: {
      key: 'longitudinalProgress',
      title: `Year-by-Year Progress (${onboardingYear}–2026)`,
      narrative: timeline
        .map(
          (pt) =>
            `${pt.year} (${pt.stageLabel}): ${pt.compositeMasteryPct}% overall mastery across ${pt.trainingsCompleted} training(s) and ${pt.projectsVerified} project(s) — Key milestone: ${pt.highlight}`,
        )
        .join(' → '),
    },
    recommendedNextSteps: {
      key: 'recommendedNextSteps',
      title: 'Recommended Next Steps',
      narrative: `1. Complete the next project milestone toward ${caseStudy.targetRole}. 2. Review any pending work with ${caseStudy.mentorName}. 3. Use portfolio code ${caseStudy.accessCode} when applying for scholarships, internships, or senior subject streams.`,
    },
    mentorInsights: {
      key: 'mentorInsights',
      title: 'Mentor Feedback & Notes',
      narrative: allProjects
        .map((p) => `${p.year} (${p.title}): "${p.mentorFeedback}" — ${p.mentorName}`)
        .join(' • '),
    },
  };

  return {
    caseStudy,
    onboardingYear,
    yearsActive,
    activeTrainings,
    activeProjects: allProjects,
    totalHoursTrained,
    rubric,
    skillScores,
    timeline,
    report,
  };
}

