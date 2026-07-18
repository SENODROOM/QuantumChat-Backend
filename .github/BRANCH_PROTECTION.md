# Required checks for `main`

Configure repository branch protection to require:

## Security and Vulnerability Detection System (L0–L4)

- Static Analysis
- Crypto Confidentiality
- Auth Abuse
- API Vuln Detection
- Transport Hardening
- Security Canary (must fail)
- E2E Ciphertext Confidentiality (must not decode)

## Legacy / umbrella (recommended)

- Security Attack Suite
- Crypto Algorithms
- Backend Build

Require the branch to be up to date and disable administrator bypass.

Nightly (not required for merge): **Deep Fuzz and Stress** (`security-nightly.yml`).
