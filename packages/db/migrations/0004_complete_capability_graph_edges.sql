-- ============================================================================
-- SPARKTRACK: Complete Capability Graph Edges
-- Migration: 0004_complete_capability_graph_edges.sql
-- Wires Skills -> Capabilities -> Pathways (plus behavioural amplifiers).
-- Idempotent via ON CONFLICT DO NOTHING.
-- ============================================================================

WITH e(src, tgt, rel, w, req) AS (VALUES
  -- Skills -> Capabilities
  ('SKILL_WEB_DEV',          'CAP_SOFTWARE_ENG',  'BUILDS_CAPABILITY', 0.7500, false),
  ('SKILL_AI_LITERACY',      'CAP_SOFTWARE_ENG',  'BUILDS_CAPABILITY', 0.6000, false),
  ('SKILL_DATA_ANALYSIS',    'CAP_SOFTWARE_ENG',  'BUILDS_CAPABILITY', 0.7000, false),
  ('SKILL_DEBUGGING_LOGIC',  'CAP_SOFTWARE_ENG',  'BUILDS_CAPABILITY', 0.8000, true),
  ('SKILL_ROBOTICS_IOT',     'CAP_SOFTWARE_ENG',  'BUILDS_CAPABILITY', 0.7000, false),
  ('SKILL_ROBOTICS_IOT',     'CAP_SECURITY_INV',  'BUILDS_CAPABILITY', 0.6500, false),
  ('SKILL_PYTHON_PROG',      'CAP_SECURITY_INV',  'BUILDS_CAPABILITY', 0.6000, false),
  ('SKILL_UI_UX_DESIGN',     'CAP_TECH_PRODUCT',  'BUILDS_CAPABILITY', 0.9000, true),
  ('SKILL_GRAPHIC_DESIGN',   'CAP_TECH_PRODUCT',  'BUILDS_CAPABILITY', 0.7500, false),
  ('SKILL_WEB_DEV',          'CAP_TECH_PRODUCT',  'BUILDS_CAPABILITY', 0.8000, true),
  ('SKILL_DIGITAL_STORY',    'CAP_TECH_PRODUCT',  'BUILDS_CAPABILITY', 0.5500, false),
  ('SKILL_BIZ_MODEL',        'CAP_VENTURE_BUILD', 'BUILDS_CAPABILITY', 0.9500, true),
  ('SKILL_FIN_LITERACY',     'CAP_VENTURE_BUILD', 'BUILDS_CAPABILITY', 0.8000, true),
  ('SKILL_MKT_SALES',        'CAP_VENTURE_BUILD', 'BUILDS_CAPABILITY', 0.8500, true),
  -- Behavioural signals amplify capabilities (modest weights)
  ('SIG_ANALYTICAL_THINKING','CAP_SOFTWARE_ENG',  'AMPLIFIES_CAPABILITY', 0.3000, false),
  ('SIG_ANALYTICAL_THINKING','CAP_SECURITY_INV',  'AMPLIFIES_CAPABILITY', 0.3000, false),
  ('SIG_PERSISTENCE',        'CAP_SOFTWARE_ENG',  'AMPLIFIES_CAPABILITY', 0.2500, false),
  ('SIG_PERSISTENCE',        'CAP_SECURITY_INV',  'AMPLIFIES_CAPABILITY', 0.2500, false),
  ('SIG_PERSISTENCE',        'CAP_TECH_PRODUCT',  'AMPLIFIES_CAPABILITY', 0.2500, false),
  ('SIG_PERSISTENCE',        'CAP_VENTURE_BUILD', 'AMPLIFIES_CAPABILITY', 0.2500, false),
  ('SIG_COLLABORATION',      'CAP_TECH_PRODUCT',  'AMPLIFIES_CAPABILITY', 0.3000, false),
  ('SIG_COLLABORATION',      'CAP_VENTURE_BUILD', 'AMPLIFIES_CAPABILITY', 0.3000, false),
  ('SIG_COMMUNICATION',      'CAP_TECH_PRODUCT',  'AMPLIFIES_CAPABILITY', 0.3500, false),
  ('SIG_COMMUNICATION',      'CAP_VENTURE_BUILD', 'AMPLIFIES_CAPABILITY', 0.3500, false),
  -- Capabilities -> Pathways
  ('CAP_SOFTWARE_ENG',       'PATH_ROBOTICS_ENG', 'UNLOCKS_PATHWAY', 0.7000, false),
  ('CAP_TECH_PRODUCT',       'PATH_PRODUCT_DESIGN','UNLOCKS_PATHWAY', 0.9500, true),
  ('CAP_VENTURE_BUILD',      'PATH_TECH_FOUNDER', 'UNLOCKS_PATHWAY', 0.9500, true),
  ('CAP_SECURITY_INV',       'PATH_SOFTWARE_AI',  'UNLOCKS_PATHWAY', 0.5500, false),
  ('CAP_TECH_PRODUCT',       'PATH_SOFTWARE_AI',  'UNLOCKS_PATHWAY', 0.5000, false),
  -- Direct skill -> pathway (hands-on domains with no dedicated capability yet)
  ('SKILL_ROBOTICS_IOT',     'PATH_ROBOTICS_ENG', 'UNLOCKS_PATHWAY', 0.9000, true)
)
INSERT INTO intelligence.graph_edges (source_node_id, target_node_id, relationship_type, contribution_weight, is_required)
SELECT s.id, t.id, e.rel, e.w, e.req
FROM e
JOIN intelligence.graph_nodes s ON s.code = e.src
JOIN intelligence.graph_nodes t ON t.code = e.tgt
ON CONFLICT (source_node_id, target_node_id, relationship_type) DO NOTHING;

