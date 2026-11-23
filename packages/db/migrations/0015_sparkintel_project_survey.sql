-- ============================================================================
-- 0015 SPARKINTEL PROJECT DISCOVERY SURVEY (CONDENSED FROM INITIAL GOOGLE FORM)
-- Condenses the 20+ question SparkIntel Student Discovery Survey into 7 brief,
-- zero-PII questions for JSS1-SS3 students.
-- ============================================================================

INSERT INTO analytics.surveys (slug, title, description, target_audience, questions, is_active)
VALUES (
  'sparkintel-project-discovery',
  'SparkIntel Student Discovery Survey',
  'A brief 1-minute anonymous survey for Junior and Senior Secondary students about career awareness, skills, and learning outside school. No name, email, or phone number is collected.',
  'JSS1_TO_SS3',
  '[
    {
      "id": "class_level",
      "prompt": "What class are you currently in?",
      "type": "single",
      "required": true,
      "options": ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"]
    },
    {
      "id": "career_understanding",
      "prompt": "How clearly do you understand what skills are needed for a career you like?",
      "type": "single",
      "required": true,
      "options": ["Very clearly", "Somewhat clear", "Not clear yet", "Still exploring"]
    },
    {
      "id": "career_barrier",
      "prompt": "What makes it hardest to know what career or skill path fits you? (Pick up to 2)",
      "type": "multi",
      "maxSelect": 2,
      "required": true,
      "options": [
        "Not knowing what careers exist",
        "Not knowing what skills are needed",
        "No hands-on practice at school",
        "No mentor or guide",
        "Schoolwork & exam pressure"
      ]
    },
    {
      "id": "top_interests",
      "prompt": "Which areas are you MOST interested in exploring? (Pick up to 2)",
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
      "id": "outside_learning_status",
      "prompt": "Have you ever tried learning a practical skill outside normal school lessons?",
      "type": "single",
      "required": true,
      "options": [
        "Yes, and I kept going",
        "Yes, but I stopped",
        "No, not yet",
        "I want to start"
      ]
    },
    {
      "id": "learning_blocker",
      "prompt": "What usually makes students stop learning a new skill? (Pick up to 2)",
      "type": "multi",
      "maxSelect": 2,
      "required": true,
      "options": [
        "No laptop or internet data",
        "Too confusing without a mentor",
        "No real project to practice on",
        "Schoolwork & exam pressure",
        "Lost motivation"
      ]
    },
    {
      "id": "holiday_interest",
      "prompt": "Would you join a short hands-on holiday or weekend project programme?",
      "type": "single",
      "required": true,
      "options": [
        "Yes, holiday bootcamp",
        "Yes, weekend club",
        "Yes, mobile self-paced",
        "Not sure yet"
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
