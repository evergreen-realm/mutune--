# Legacy Experimental & Planning Artifacts Archive Manifest

> **Archive Branch**: `archive/pre-v1-experimental-artifacts`  
> **Retention Date**: October 2026  
> **Status**: Frozen / Read-Only Historical Reference  

---

## 1. Executive Summary & Historical Context

During the rapid prototyping and exploratory engineering phases (Phases 1 through 6) of **MutuneRent Pro**, several exploratory proof-of-concepts, local test harnesses, scratch audits, and third-party benchmark evaluations were generated.

As the system matured into an enterprise-grade multi-tenant property management solution deployed to live cloud infrastructure (Render backend and Vercel frontend), these exploratory artifacts were decommissioned from the production `main` branch to ensure:
1. **Clean Production Monorepo Hygiene**: The `main` branch reflects only the canonical, runnable application source code, active tests, CI/CD pipelines, and official operational documentation.
2. **Deterministic CI/CD Execution**: Stray root package manifests and unreferenced worker scripts created ambiguity during automated build, lint, and security auditing stages.
3. **Preservation of Engineering History**: All historical discoveries, competitor benchmarks, video capture frame sequences, and GPU worker prototypes remain fully preserved in this dedicated branch for future research and attribution.

---

## 2. Directory Structure & Inventory

```
legacy-archive/
├── planning-and-audits/
│   ├── agent_planning_v1/       # Initial PRD, launch checklists, and UI/UX briefs
│   ├── agent_planning_v2/       # Detailed user flows, data flows, and task audits
│   ├── AUDIT.md                 # Early audit documentation
│   ├── AUDIT_REPORT.md          # Multi-tenant and security compliance review
│   ├── BACKEND_INTEGRATION_REPORT.md # Initial Express routing & DB validation report
│   ├── BACKEND_REQUIREMENTS.md  # Core requirements specification
│   ├── CODEBASE_VALIDATION_REPORT.md # Post-Phase 1 code review
│   ├── COMPETITOR_EAZZYRENT_ARCHITECTURAL_REVIEW.md # Kenyan proptech benchmark
│   ├── COMPETITOR_FUNCTIONS_REVIEW.md
│   ├── COMPETITOR_PANGONI_ARCHITECTURAL_REVIEW.md
│   ├── COMPETITOR_SILQU_ARCHITECTURAL_REVIEW.md
│   ├── DOMAIN_KNOWLEDGE_ANALYSIS.md
│   ├── FRONTEND_INTEGRATION_REPORT.md
│   ├── GAP_ANALYSIS.md
│   ├── MASTER_FINAL_AUDIT_REPORT.md
│   ├── PRODUCTION_READINESS_VERIFICATION.md
│   ├── RESEARCH_REPORT.md
│   └── report.md
│
├── experimental-3d-pipeline/
│   ├── blender_building_generator.py # Python script for procedural Blender GLB models
│   ├── colab_splat_notebook.ipynb    # Google Colab notebook for Gaussian Splatting
│   ├── modal_blender_worker.py       # Modal serverless GPU Blender execution prototype
│   └── modal_splat_worker.py         # Modal serverless GPU Gaussian splat generation
│
├── sample-captures/
│   ├── watch_mobile/            # Raw audio & 100 extracted camera frames (mobile testing)
│   └── watch_nyc/               # Raw audio & 61 extracted camera frames (desktop testing)
│
├── devops-scripts/
│   ├── deploy.js                # Deprecated manual deployment runner
│   ├── scan_buttons.cjs         # Static HTML button scanning tool
│   ├── set-github-secrets.mjs   # One-off GitHub Actions secrets bootstrap script
│   └── set-render-envvars.ps1   # PowerShell Render environment injection helper
│
├── debug-dumps/
│   ├── ar_diff.patch            # Intermediate diff patch from AR experimental branch
│   ├── git_logs_motion.txt      # Motion hook debugging output
│   ├── git_logs_motion_utf8.txt # UTF-8 normalized motion logs
│   └── old_modal.txt            # Deprecated Modal container configuration dump
│
└── internal-tooling/
    ├── .agents/                 # Internal agent system directives & rules
    ├── package.json             # Root devDependencies convenience shim
    └── package-lock.json
```

---

## 3. Rationale for Archival by Category

### A. Planning, Audits & Competitor Analysis (`planning-and-audits/`)
- **Motivation**: Early development required deep competitive benchmarking against regional market leaders (Silqu, Pangoni, EazzyRent) and rigorous audit documents for Kenyan regulatory compliance (KRA eTIMS, EARB agent licensing, Data Protection Act 2019).
- **Archival Reason**: The core architecture and domain findings have been synthesized directly into the production code, tests, and official `docs/` (`DEPLOYMENT.md`, `API_KEY_ROTATION.md`, `PCI_COMPLIANCE.md`). The exploratory notes are kept here for historical context.

### B. Experimental 3D & Gaussian Splatting Pipeline (`experimental-3d-pipeline/`)
- **Motivation**: Experiments explored whether high-end Gaussian Splats (.splat) and procedural Blender models could be trained per-property in real-time on cloud GPUs (Modal).
- **Archival Reason**: In production, the system utilizes high-fidelity pre-optimized Three.js GLB models (`/models/b_small.glb`, `b_medium.glb`, `b_large.glb`, `b_tower.glb`) loaded via client-side Three.js/WebGL for instant zero-latency rendering without recurring GPU cloud costs. The Modal and Colab GPU training pipelines are preserved here if dedicated cloud neural reconstruction is resumed in future versions.

### C. Sample Video Captures & Frames (`sample-captures/`)
- **Motivation**: Captured during browser WebRTC spatial frame extraction testing to verify 360° rotational room capture.
- **Archival Reason**: Binary assets and hundreds of static JPEG frames bloat git clone size and are unnecessary in the application source tree.

### D. DevOps & Setup Scripts (`devops-scripts/`)
- **Motivation**: Ad-hoc scripts written to bootstrap GitHub Actions secrets and Render environment variables.
- **Archival Reason**: Production CI/CD is fully managed natively via `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, and `render.yaml` (Render Blueprint Infrastructure-as-Code).

### E. Debug Dumps & Raw Logs (`debug-dumps/`)
- **Motivation**: Temporary files created to debug git diffs, motion warnings, and container logs.
- **Archival Reason**: Ephemeral debugging artifacts with no ongoing software lifecycle role.

---

## 4. How to Consult or Revive Archived Items

To access or experiment with any item in this archive:
```bash
# Checkout this archive branch
git checkout archive/pre-v1-experimental-artifacts

# Inspect or run an experimental worker
python legacy-archive/experimental-3d-pipeline/modal_blender_worker.py
```
To return to the canonical production codebase:
```bash
git checkout main
```
