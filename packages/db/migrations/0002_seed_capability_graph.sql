-- ============================================================================
-- SPARKTRACK CAPABILITY GRAPH SEED DATA
-- Migration: 0002_seed_capability_graph.sql
-- Populates Activities -> Skills -> Capabilities -> Career & Business Pathways
-- ============================================================================

INSERT INTO intelligence.graph_nodes (node_type, code, name, category, description) VALUES
  -- 1. TECHNICAL & DIGITAL SKILLS
  ('SKILL', 'SKILL_PYTHON_PROG', 'Python Programming & Scripting', 'TECHNICAL', 'Writing modular Python code, loops, data structures, and automating logic.'),
  ('SKILL', 'SKILL_DEBUGGING_LOGIC', 'Systematic Debugging & Root-Cause Analysis', 'TECHNICAL', 'Isolating defects, reading stack traces, and testing hypotheses methodically.'),
  ('SKILL', 'SKILL_CYBER_FUND', 'Cybersecurity & Network Defense Fundamentals', 'TECHNICAL', 'Understanding threat models, encryption, network packets, and system hardening.'),
  ('SKILL', 'SKILL_ROBOTICS_IOT', 'Robotics & Embedded Systems Logic', 'TECHNICAL', 'Programming sensors, actuators, and microcontrollers to solve physical tasks.'),
  ('SKILL', 'SKILL_DATA_ANALYSIS', 'Data Analysis & Pattern Recognition', 'TECHNICAL', 'Cleaning datasets, writing queries, and extracting quantitative insights.'),
  ('SKILL', 'SKILL_WEB_DEV', 'Modern Web Application Development', 'TECHNICAL', 'Building responsive user interfaces and RESTful web services.'),
  ('SKILL', 'SKILL_AI_LITERACY', 'Artificial Intelligence & Prompt Engineering', 'DIGITAL', 'Applying generative AI and machine learning models responsibly to real workflows.'),

  -- 2. CREATIVE & DESIGN SKILLS
  ('SKILL', 'SKILL_UI_UX_DESIGN', 'UI/UX & Digital Product Design', 'CREATIVE', 'Wireframing user journeys, prototyping in Figma, and conducting usability tests.'),
  ('SKILL', 'SKILL_GRAPHIC_DESIGN', 'Visual Communication & Graphic Design', 'CREATIVE', 'Applying typography, color theory, and layout composition to digital media.'),
  ('SKILL', 'SKILL_DIGITAL_STORY', 'Video Production & Digital Storytelling', 'CREATIVE', 'Scripting, editing, and producing compelling multimedia narratives.'),

  -- 3. BUSINESS & ENTREPRENEURSHIP SKILLS
  ('SKILL', 'SKILL_BIZ_MODEL', 'Business Modelling & Value Proposition Design', 'BUSINESS', 'Mapping customer problems, revenue streams, and unit economics.'),
  ('SKILL', 'SKILL_FIN_LITERACY', 'Financial Literacy & Budgeting', 'BUSINESS', 'Managing cashflow, pricing products, and understanding savings and investment.'),
  ('SKILL', 'SKILL_MKT_SALES', 'Digital Marketing & Customer Discovery', 'BUSINESS', 'Interviewing users, positioning products, and acquiring early customers.'),

  -- 4. PROFESSIONAL & BEHAVIOURAL SIGNALS (Evolving Signals, Not Permanent Labels)
  ('SKILL', 'SIG_ANALYTICAL_THINKING', 'Analytical & Critical Thinking Signal', 'BEHAVIOURAL_SIGNAL', 'Observed tendency to decompose complex problems into logical steps.'),
  ('SKILL', 'SIG_PERSISTENCE', 'Persistence & Grit Under Challenge', 'BEHAVIOURAL_SIGNAL', 'Observed consistency when facing bugs, failed prototypes, or hard tasks.'),
  ('SKILL', 'SIG_COLLABORATION', 'Team Collaboration & Peer Support', 'BEHAVIOURAL_SIGNAL', 'Observed effectiveness in group projects and helping peers.'),
  ('SKILL', 'SIG_COMMUNICATION', 'Presentation & Technical Communication', 'PROFESSIONAL', 'Explaining ideas, projects, and decisions clearly to mentors and peers.'),

  -- 5. HIGHER-ORDER CAPABILITIES
  ('CAPABILITY', 'CAP_SOFTWARE_ENG', 'Software Systems Construction', 'TECHNICAL', 'Ability to design, build, test, and debug working software applications.'),
  ('CAPABILITY', 'CAP_SECURITY_INV', 'Cyber Defense & Security Investigation', 'TECHNICAL', 'Ability to analyze vulnerabilities, secure systems, and investigate anomalies.'),
  ('CAPABILITY', 'CAP_TECH_PRODUCT', 'Technical Product & UX Engineering', 'CREATIVE', 'Ability to bridge user-centric design with technical software feasibility.'),
  ('CAPABILITY', 'CAP_VENTURE_BUILD', 'Early-Stage Venture Creation', 'BUSINESS', 'Ability to identify a real-world problem, prototype a solution, and pitch a business model.'),

  -- 6. CAREER & ENTREPRENEURSHIP PATHWAYS (For Exploration)
  ('CAREER_PATHWAY', 'PATH_CYBERSECURITY', 'Cybersecurity & SOC Engineering Exploration', 'TECHNICAL', 'Exploration pathway covering Network Security, Ethical Hacking, and SOC Analysis.'),
  ('CAREER_PATHWAY', 'PATH_SOFTWARE_AI', 'Software & AI Engineering Exploration', 'TECHNICAL', 'Exploration pathway covering Full-Stack Development, Backend Systems, and Applied AI.'),
  ('CAREER_PATHWAY', 'PATH_ROBOTICS_ENG', 'Robotics & Autonomous Systems Exploration', 'TECHNICAL', 'Exploration pathway covering Mechatronics, IoT, and Embedded Engineering.'),
  ('CAREER_PATHWAY', 'PATH_PRODUCT_DESIGN', 'Digital Product & UI/UX Design Exploration', 'CREATIVE', 'Exploration pathway covering User Research, Interaction Design, and Design Systems.'),
  ('ENTREPRENEURSHIP_PATHWAY', 'PATH_TECH_FOUNDER', 'Tech Entrepreneurship & Micro-Venture Pathway', 'BUSINESS', 'Pathway guiding learners from problem discovery to launching a student micro-business.')
ON CONFLICT (code) DO NOTHING;

-- Wire Directed Weighted Edges (Skills -> Capabilities -> Pathways)
INSERT INTO intelligence.graph_edges (source_node_id, target_node_id, relationship_type, contribution_weight, is_required)
SELECT s.id, t.id, 'BUILDS_CAPABILITY', 0.8500, true
FROM intelligence.graph_nodes s, intelligence.graph_nodes t
WHERE s.code = 'SKILL_PYTHON_PROG' AND t.code = 'CAP_SOFTWARE_ENG'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.graph_edges (source_node_id, target_node_id, relationship_type, contribution_weight, is_required)
SELECT s.id, t.id, 'BUILDS_CAPABILITY', 0.9000, true
FROM intelligence.graph_nodes s, intelligence.graph_nodes t
WHERE s.code = 'SKILL_DEBUGGING_LOGIC' AND t.code = 'CAP_SECURITY_INV'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.graph_edges (source_node_id, target_node_id, relationship_type, contribution_weight, is_required)
SELECT s.id, t.id, 'BUILDS_CAPABILITY', 0.9500, true
FROM intelligence.graph_nodes s, intelligence.graph_nodes t
WHERE s.code = 'SKILL_CYBER_FUND' AND t.code = 'CAP_SECURITY_INV'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.graph_edges (source_node_id, target_node_id, relationship_type, contribution_weight, is_required)
SELECT s.id, t.id, 'UNLOCKS_PATHWAY', 0.9000, true
FROM intelligence.graph_nodes s, intelligence.graph_nodes t
WHERE s.code = 'CAP_SECURITY_INV' AND t.code = 'PATH_CYBERSECURITY'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.graph_edges (source_node_id, target_node_id, relationship_type, contribution_weight, is_required)
SELECT s.id, t.id, 'UNLOCKS_PATHWAY', 0.8800, true
FROM intelligence.graph_nodes s, intelligence.graph_nodes t
WHERE s.code = 'CAP_SOFTWARE_ENG' AND t.code = 'PATH_SOFTWARE_AI'
ON CONFLICT DO NOTHING;
