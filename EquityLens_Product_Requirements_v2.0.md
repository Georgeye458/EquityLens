# EquityLens Product Requirements Document

**Version:** 2.0  
**Date:** January 2026  
**Author:** Southern Cross AI  
**Status:** Draft  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Architecture](#3-solution-architecture)
4. [Deployment Context](#4-deployment-context)
5. [Functional Requirements](#5-functional-requirements)
6. [Points of Interest Specification](#6-points-of-interest-specification)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Success Criteria](#8-success-criteria)
9. [Constraints and Assumptions](#9-constraints-and-assumptions)
10. [Design Considerations from Prior Implementations](#10-design-considerations-from-prior-implementations)
- [Appendix A: Glossary](#appendix-a-glossary)
- [Appendix B: Master Prompt Reference](#appendix-b-master-prompt-reference)

---

## 1. Executive Summary

EquityLens is an AI-powered earnings report analysis tool designed to dramatically reduce the time investment analysts spend reviewing company financial disclosures during earnings season. The tool ingests earnings documents (annual reports, half-year results, ASX announcements), extracts predefined Points of Interest (POIs), and provides an interactive chat interface for follow-up analysis.

**Target Outcome:** Reduce initial analysis time from ~90 minutes to under 10 minutes per company while maintaining or exceeding the quality achievable through direct LLM usage.

**Critical Design Principle:** Unlike failed prior approaches, EquityLens ensures the AI can access FULL source documents when answering chat queries - not just pre-extracted POI data. This architectural decision is non-negotiable.

---

## 2. Problem Statement

### 2.1 Current State

During earnings season, equity analysts face significant time pressure. Reports are released pre-market (7:30-8:00 AM) with market open at 10:00 AM, or intra-day with 15-20 minute trading halts. Analysts must review documents spanning hundreds of pages across multiple companies.

| Metric | Current State |
|--------|---------------|
| Time to initial analysis | ~90 minutes per company |
| Document sources | Inconsistent, fragmented |
| Information sharing | Ad-hoc (email, Symphony) |
| Analysis quality | Variable, time-dependent |

### 2.2 Pain Points

- Manual document location and download across ASX, company sites, vendor platforms
- Insufficient time for thorough review under concurrent reporting
- Fragmented information storage reduces reuse and consistency
- Model updates delayed due to time spent on initial analysis

### 2.3 Desired Future State

- Consistent, centrally stored earnings documents with governed access
- Automated capture with analyst notifications
- Initial analysis completed within minutes
- Output is accurate, traceable (click-through to source), and formatted per analyst preference
- Frictionless retrieval with standard prompts and follow-up query capability

---

## 3. Solution Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         EquityLens                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Document   │───▶│    Vector    │───▶│     Chat     │      │
│  │   Ingestion  │    │    Store     │    │   Interface  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                    SCX.ai API                         │      │
│  │         (LLM Inference + Embeddings)                  │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Critical Architecture Principle

> **The AI must have access to FULL source documents when answering queries, not just pre-extracted POI tables.**

This is the fundamental differentiator from failed prior implementations. The two-stage approach (extract POIs → query POI table only) artificially constrains the AI and produces inferior results compared to direct LLM usage.

**EquityLens Approach:**
1. Documents are chunked and embedded into a vector store
2. POIs are extracted for dashboard display
3. Chat queries retrieve relevant chunks from the FULL document corpus
4. AI generates responses with complete context, not limited to POI fields

---

## 4. Deployment Context

### 4.1 Infrastructure

| Component | Technology | Notes |
|-----------|------------|-------|
| Platform | Heroku | Cloud PaaS for application hosting |
| Source Control | GitHub (georgeye458) | Version control and CI/CD integration |
| Database | Heroku Postgres | Application data, user sessions, document metadata |
| Vector Store | pgvector extension or dedicated vector DB add-on | Embeddings for RAG retrieval |
| File Storage | Heroku ephemeral storage or S3-compatible object storage | PDF document storage |

### 4.2 AI Services - SCX.ai Platform

EquityLens leverages the SCX.ai platform (Southern Cross AI) for all AI capabilities. Key advantages:

- **Unlimited Tokens:** No token limits across all available models - critical for processing large earnings documents (200+ pages)
- **Multiple LLM Options:** Access to Llama 4, DeepSeek V3.1, GPT OSS 120B, and Magpie (Australian sovereign model)
- **Embedding Models:** RAG-optimised embedding models for high-quality financial document retrieval
- **OpenAI Compatibility:** OpenAI-compatible API endpoints - use existing OpenAI SDK with different base URL

### SCX.ai API Reference

**Base URL:** `https://api.scx.ai/v1`

**Documentation:** https://platform.scx.ai/docs

**Quick Start Example (Python):**

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-scx-api-key",
    base_url="https://api.scx.ai/v1"
)

response = client.chat.completions.create(
    model="llama-4",
    messages=[{"role": "user", "content": "Analyze this earnings report..."}]
)
```

| Endpoint | Purpose |
|----------|---------|
| `/chat/completions` | LLM inference for analysis and chat responses (OpenAI-compatible) |
| `/embeddings` | Document and query embedding for RAG retrieval |

### 4.3 Available Models

The following models are available via SCX.ai (unlimited tokens for all):

| Model | Provider | Notes |
|-------|----------|-------|
| `llama-4` | Meta | Latest Llama model - recommended for general use |
| `deepseek-v3.1` | DeepSeek | Strong reasoning and coding capabilities |
| `gpt-oss-120b` | OpenAI | Open-source GPT variant |
| `magpie` | SCX.ai | Experimental Australian sovereign model |

> **Note:** Refer to https://platform.scx.ai/docs/models for the current list of available models and embedding options.

### 4.4 Recommended Model Selection

| Use Case | Recommended Model | Rationale |
|----------|-------------------|-----------|
| Initial POI Extraction | `llama-4` | Fast, accurate, good for structured extraction tasks |
| Chat Responses | `llama-4` | Good balance of quality and speed for interactive use |
| Complex Analysis | `deepseek-v3.1` | Strong reasoning for nuanced financial interpretation |
| Document Embeddings | (See SCX.ai docs) | Use embedding models available via /embeddings endpoint |

---

## 5. Functional Requirements

### 5.1 Document Ingestion (FR-DI)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DI-01 | System shall accept PDF documents up to 300 pages | Must Have |
| FR-DI-02 | System shall process multiple documents per company per reporting period | Must Have |
| FR-DI-03 | System shall extract text while preserving table structures | Must Have |
| FR-DI-04 | System shall track original page numbers in merged/concatenated PDFs | Must Have |
| FR-DI-05 | System shall complete document processing within 10 minutes of upload | Must Have |
| FR-DI-06 | System shall store processed documents with metadata (company, period, type) | Must Have |

### 5.2 Analysis Output (FR-AO)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AO-01 | System shall extract all defined POIs from ingested documents | Must Have |
| FR-AO-02 | System shall present POIs in a structured dashboard/table format | Must Have |
| FR-AO-03 | System shall provide citations (page references) for each extracted POI | Must Have |
| FR-AO-04 | System shall support multi-value POIs (e.g., revenue by segment, multi-year data) | Must Have |
| FR-AO-05 | System shall generate a narrative summary synthesising key findings | Should Have |
| FR-AO-06 | System shall flag divergent or contradictory information across POIs | Should Have |
| FR-AO-07 | System shall compare current period values to prior period where available | Should Have |

### 5.3 Chat Interface (FR-CH)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CH-01 | System shall provide a conversational interface for follow-up queries | Must Have |
| FR-CH-02 | Chat shall query the FULL document corpus, not just extracted POIs | Must Have |
| FR-CH-03 | Chat shall maintain conversation context within a session | Must Have |
| FR-CH-04 | Chat responses shall include citations to source document locations | Must Have |
| FR-CH-05 | System shall support analyst-defined custom prompts/questions | Should Have |

### 5.4 Citations and Traceability (FR-CT)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CT-01 | All factual claims shall be accompanied by page-level citations | Must Have |
| FR-CT-02 | Citations shall be clickable/navigable to source location | Should Have |
| FR-CT-03 | System shall distinguish between directly quoted and inferred information | Should Have |

---

## 6. Points of Interest Specification

### 6.1 Financial Metrics

| POI | Description | Output Type |
|-----|-------------|-------------|
| Revenue & Growth | Total revenue, segment breakdown, growth rates | Multi-value |
| Profitability | Gross profit, EBITDA, EBIT, NPAT (statutory and underlying) | Multi-value |
| Margins | Gross margin, EBITDA margin, net margin with period-on-period changes | Value + Delta |
| Balance Sheet | Net debt, cash, total assets, shareholders' equity | Multi-value |
| Key Ratios | ROE, ROA, debt ratios, interest coverage | Multi-value |
| Per Share Metrics | EPS, dividend per share, book value per share | Multi-value |
| Guidance | Forward-looking statements or targets provided | Commentary |

### 6.2 Segment Analysis

| POI | Description | Output Type |
|-----|-------------|-------------|
| Business Segments | Revenue, EBITDA, margin by division | Multi-value array |
| Geographic Regions | Performance breakdown by region | Multi-value array |
| Product Categories | Revenue and margin by product line | Multi-value array |

### 6.3 Cash Flow

| POI | Description | Output Type |
|-----|-------------|-------------|
| Operating Cash Flow | Cash generated from operations | Value |
| Free Cash Flow | OCF less capital expenditure | Value |
| Capital Expenditure | Investment in PP&E and intangibles | Value |
| Dividend Payments | Cash returned to shareholders | Value |

### 6.4 Earnings Quality Analysis

| POI | Description | Output Type |
|-----|-------------|-------------|
| Non-recurring Adjustments | Items removed from underlying earnings | Commentary + Values |
| Capitalised Costs | Unusual capitalisation of expenses | Commentary |
| Provision Changes | Restructuring, warranty, legal provisions | Commentary + Values |
| Working Capital Signals | Unusual changes in payables, receivables, inventory | Commentary |
| Cash vs Accrual | Timing differences, OCF vs NPAT comparison | Ratio + Commentary |
| Revenue Recognition | Changes in recognition policies or timing | Commentary |

### 6.5 Management Commentary

| POI | Description | Output Type |
|-----|-------------|-------------|
| Strategy Changes | Key strategic initiatives and pivots | Commentary |
| Outlook | Management guidance and forward statements | Commentary |
| Risk Factors | Key risks highlighted by management | Commentary |
| Market Conditions | Commentary on operating environment | Commentary |

---

## 7. Non-Functional Requirements

### 7.1 Performance (NFR-P)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-P-01 | Document processing time | < 10 minutes for 300-page PDF |
| NFR-P-02 | POI extraction time | < 5 minutes after document processing |
| NFR-P-03 | Chat response latency | < 30 seconds for typical queries |
| NFR-P-04 | Concurrent users supported | Minimum 10 simultaneous users |

### 7.2 Security (NFR-S)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-S-01 | Data encryption | TLS 1.3 in transit, AES-256 at rest |
| NFR-S-02 | Authentication | Integration with enterprise SSO where required |
| NFR-S-03 | Audit logging | All document access and queries logged |
| NFR-S-04 | Data residency | Australian data sovereignty maintained |

### 7.3 Usability (NFR-U)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-U-01 | Learning curve | Productive use within 30 minutes of first use |
| NFR-U-02 | Error messages | Clear, actionable error messages |
| NFR-U-03 | Documentation | Comprehensive user guide provided |

---

## 8. Success Criteria

### 8.1 Quantitative Metrics

| Criterion | Target | Measurement Method |
|-----------|--------|-------------------|
| Processing Time | < 10 minutes from upload to POI availability | System timing logs |
| POI Accuracy | > 95% factual accuracy vs manual verification | SME spot audit (sample of 10 POIs across 4 companies) |
| Citation Accuracy | > 90% of citations point to correct page/section | Manual verification |
| Chat Completeness | Chat responses equivalent to public LLM on same query | Side-by-side comparison |

### 8.2 Qualitative Criteria

| Criterion | Target | Measurement Method |
|-----------|--------|-------------------|
| User Satisfaction | Tool meets or exceeds satisfaction with public LLM usage | User feedback survey |
| Workflow Integration | Tool fits naturally into analyst workflow | User observation and feedback |
| Trust | Analysts trust outputs sufficiently to base recommendations on them | User interviews |

### 8.3 Test Approach

- Test with earnings reports from 4 different company types: Big 4 bank (not ANZ), Big miner, Small cap (<$1Bn), International
- Absolute testing against defined criteria
- Comparative testing against analyst using public LLM (initial query response, no iteration)
- Test cases must not have been used during development

---

## 9. Constraints and Assumptions

### 9.1 Constraints

| Constraint | Impact |
|------------|--------|
| POC Budget | 100 hours total engagement (per consultancy deed) |
| Timeline | Target readiness for February 2026 earnings season |
| Data Sources | POC limited to manually uploaded documents (no automated scraping) |
| User Base | Initial deployment to SME analysts only |

### 9.2 Assumptions

| Assumption | Risk if Invalid |
|------------|-----------------|
| SCX.ai platform provides sufficient model quality | May need to supplement with additional AI providers |
| Heroku provides adequate compute for document processing | May need to scale up or use worker dynos |
| PDF documents are machine-readable (not scanned images) | Would require OCR preprocessing step |
| Analysts will provide feedback during testing phase | Reduced ability to iterate on requirements |

---

## 10. Design Considerations from Prior Implementations

### 10.1 Lessons from Failed POC #1

The prior proof-of-concept (POC #1 - Earnings Report Analyst, HSO vendor) was discontinued due to poor business user feedback despite technical functionality. Key failure modes:

| Issue | Impact | EquityLens Mitigation |
|-------|--------|----------------------|
| Two-stage architecture lost context | Chat could only query limited POI table, not full documents | Chat queries full vector store of document chunks |
| Single-value POI fields | Could not represent multi-year data or segment breakdowns | Flexible schema supporting arrays and multi-value responses |
| Inferior to public LLM | Users compared unfavourably to direct Claude/GPT usage | Architecture matches or exceeds direct LLM capabilities |
| Chat functionality unavailable for testing | Core feature could not be evaluated | Chat is a first-class feature from day one |
| Page citations incorrect | Merged PDFs caused page number misalignment | Document parser tracks original page numbers |
| POI prompts required constant tuning | Business burden to maintain prompt quality | Configurable prompt templates with sensible defaults |
| Testing was frustrating for users | Technical issues consumed testing time | Comprehensive documentation and support plan |

### 10.2 Architecture Anti-Pattern to Avoid

```
❌ FAILED APPROACH:
Document → Extract POIs → Store in fixed table → Chat queries table only
                                                  ↑
                                    Limited context, inferior results

✅ EQUITYLENS APPROACH:
Document → Chunk & Embed → Vector Store → Chat queries full context
              ↓                              ↑
         Extract POIs ─────────────────────────
         (for dashboard)     POIs inform but don't limit chat
```

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| POI | Point of Interest - a specific data element or insight to be extracted from earnings documents |
| RAG | Retrieval-Augmented Generation - technique combining document retrieval with LLM generation |
| Vector Store | Database optimised for similarity search on embedded document chunks |
| Embedding | Numerical representation of text enabling semantic similarity comparison |
| SCX.ai | Southern Cross AI platform providing unlimited token access to LLM and embedding models via OpenAI-compatible API (base URL: api.scx.ai/v1) |
| ASX | Australian Securities Exchange |
| EBITDA | Earnings Before Interest, Tax, Depreciation and Amortisation |
| NPAT | Net Profit After Tax |
| OCF | Operating Cash Flow |
| FCF | Free Cash Flow |

---

## Appendix B: Master Prompt Reference

The POI extraction prompt is based on the analyst-developed "Master Prompt" which defines the comprehensive analysis framework. Key sections include:

1. **Financial Metrics Table** - Revenue, profitability, margins, balance sheet, ratios, per-share metrics, guidance
2. **Segment Analysis** - Business segments, geographic regions, product categories
3. **Cash Flow Summary** - Operating cash flow, free cash flow, capex, dividends
4. **Management Highlights** - Strategic initiatives, achievements, challenges, outlook
5. **Earnings Quality & Red Flags** - Non-recurring items, capitalised costs, provision changes, working capital signals
6. **Exceptional Items** - One-off gains/losses, restructuring, impairments (including H1 vs H2 split)

The full master prompt is maintained as a separate configuration artifact and can be customised per analyst or sector requirements.

---

*Document Version History:*
- v1.0 (January 2026): Initial requirements document
- v2.0 (January 2026): Added deployment context (Heroku, GitHub, SCX.ai platform details)
