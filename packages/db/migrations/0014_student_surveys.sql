-- ============================================================================
-- 0014 PRIVACY-FIRST REUSABLE STUDENT SURVEYS
-- Zero PII collected (no names, emails, phones, or user IDs).
-- Reusable across pre-programme school discovery and post-bootcamp feedback.
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'JSS1_TO_SS3',
  questions JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES analytics.surveys(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_time
  ON analytics.survey_responses (survey_id, submitted_at DESC);

INSERT INTO analytics.surveys (slug, title, description, target_audience, questions, is_active)
VALUES (
  'secondary-discovery-2026',
  'Student Tech & Career Readiness Survey',
  'A 1-minute anonymous survey for Junior and Senior Secondary students to help us tailor workshops and projects to your needs. No name, email, or phone number is collected.',
  'JSS1_TO_SS3',
  '[
    {
      "id": "class_level",
      "prompt": "What class are you in?",
      "type": "single",
      "required": true,
      "options": ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"]
    },
    {
      "id": "interests",
      "prompt": "Which areas interest you most? (Pick up to 2)",
      "type": "multi",
      "maxSelect": 2,
      "required": true,
      "options": [
        "Coding & Software",
        "Cybersecurity & Digital Safety",
        "Product & Graphic Design",
        "AI & Data",
        "Robotics & Hardware",
        "Business & Entrepreneurship"
      ]
    },
    {
      "id": "device_access",
      "prompt": "What device can you use for practice?",
      "type": "single",
      "required": true,
      "options": [
        "Smartphone only",
        "Shared family laptop or desktop",
        "Personal laptop",
        "School computer lab only"
      ]
    },
    {
      "id": "biggest_barrier",
      "prompt": "What is your biggest challenge learning practical tech skills?",
      "type": "single",
      "required": true,
      "options": [
        "Internet data cost",
        "No laptop or personal device",
        "Need step-by-step mentor guidance",
        "School timetable & exam pressure",
        "Not sure where to start"
      ]
    },
    {
      "id": "preferred_format",
      "prompt": "How would you prefer to join a programme?",
      "type": "single",
      "required": true,
      "options": [
        "Weekend hands-on workshops",
        "Holiday bootcamp",
        "After-school club at my school",
        "Short mobile-friendly lessons"
      ]
    },
    {
      "id": "one_project_wish",
      "prompt": "Optional: What is one real problem you wish you could build a project to solve?",
      "type": "text",
      "required": false,
      "maxLength": 200
    }
  ]'::jsonb,
  TRUE
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  questions = EXCLUDED.questions,
  is_active = EXCLUDED.is_active;
