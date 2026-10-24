---
name: run-13yo-explorer-e2e-test
description: Runs the Section 37 end-to-end verification scenario for a 13-year-old learner across holiday programmes to validate Observed vs. Declared Interest divergence and non-deterministic report generation.
---

# Skill: 13-Year-Old Explorer E2E Verification

1. Seed a test learner (age 13, `JSS3`, `consent_status = 'VERIFIED_ACTIVE'`) with `declared_interests = ['Graphic Design']`.
2. Simulate offline-first evidence submissions across Graphic Design (moderate score: 0.58) and Python, Cybersecurity, and Robotics (high scores: 0.88 - 0.94) with Mentor verification tags (`analytical_thinking`, `persistence`, `problem_solving`).
3. Trigger the SparkTrack Intelligence synthesis pipeline.
4. Assert that the resulting 13-part SparkTrack Development Report:
   - Identifies the divergence between declared interest (design) and observed analytical/technical strengths.
   - Recommends software engineering, cybersecurity, robotics, and technical product design for exploration.
   - Passes the Child-Safety Non-Deterministic Guardrail check with zero deterministic career assignment phrases.
