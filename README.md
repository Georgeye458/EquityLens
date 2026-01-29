# EquityLens

AI-powered earnings report analysis tool designed to dramatically reduce the time investment analysts spend reviewing company financial disclosures during earnings season.

## Overview

EquityLens ingests earnings documents (annual reports, half-year results, ASX announcements), extracts predefined Points of Interest (POIs), and provides an interactive chat interface for follow-up analysis.

**Target Outcome:** Reduce initial analysis time from ~90 minutes to under 10 minutes per company while maintaining or exceeding the quality achievable through direct LLM usage.

## Key Features

- **Document Ingestion**: Upload PDF documents up to 300 pages
- **POI Extraction**: Automatically extract financial metrics, segment analysis, cash flow, and management commentary
- **Full Document Chat**: Ask questions about the entire document, not just extracted POIs
- **Page Citations**: Every insight is linked to its source page for traceability
- **Unlimited Tokens**: Powered by SCX.ai with unlimited token access

## Architecture

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

### Critical Design Principle

> The AI must have access to FULL source documents when answering queries, not just pre-extracted POI tables.

This is the fundamental differentiator from failed prior implementations. Documents are chunked and embedded into a vector store, and chat queries retrieve relevant chunks from the FULL document corpus.

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL with pgvector extension
- **AI**: SCX.ai (OpenAI-compatible API)
- **PDF Processing**: pdfplumber, pypdf

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context

### Deployment
- **Platform**: Heroku
- **Backend App**: equitylens-api
- **Frontend App**: equitylens-frontend

## Project Structure

```
EquityLens/
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── routers/           # API endpoints
│   │   ├── services/          # Business logic
│   │   ├── models/            # Database models & schemas
│   │   └── utils/             # Utilities
│   ├── main.py                # Application entry point
│   ├── requirements.txt       # Python dependencies
│   ├── Procfile              # Heroku backend config
│   └── env.example           # Environment variables template
├── frontend/                   # React TypeScript frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── context/          # React context providers
│   │   ├── lib/              # API client & utilities
│   │   ├── types/            # TypeScript types
│   │   └── styles/           # CSS styles
│   ├── server.js             # Express server for production
│   ├── package.json          # Node dependencies
│   ├── Procfile             # Heroku frontend config
│   └── env.example          # Environment variables template
├── .gitignore
├── DEPLOYMENT.md             # Deployment guide
└── README.md                 # This file
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL with pgvector extension
- SCX.ai API key

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp env.example .env
# Edit .env with your configuration

# Run development server
uvicorn main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp env.example .env

# Run development server
npm run dev
```

### Database Setup

```sql
-- Create database
CREATE DATABASE equitylens;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

## Environment Variables

### Backend (.env)

```env
SCX_API_KEY=your-scx-api-key
SCX_API_BASE_URL=https://api.scx.ai/v1
SCX_MODEL=llama-4
DATABASE_URL=postgresql://user:password@localhost:5432/equitylens
SECRET_KEY=your-secret-key
ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
```

## API Endpoints

### Documents
- `POST /api/documents/upload` - Upload a PDF document
- `GET /api/documents/` - List all documents
- `GET /api/documents/{id}` - Get document details
- `DELETE /api/documents/{id}` - Delete a document

### Analysis
- `POST /api/analysis/{document_id}/analyze` - Start POI extraction
- `GET /api/analysis/{document_id}/latest` - Get latest analysis
- `GET /api/analysis/{document_id}/pois` - Get POIs by category

### Chat
- `POST /api/chat/sessions` - Create chat session
- `POST /api/chat/sessions/{id}/messages` - Send message
- `GET /api/chat/sessions/{id}` - Get session with messages
- `POST /api/chat/quick/{document_id}` - Quick chat (auto-creates session)

## Available Models (SCX.ai)

| Model | Use Case |
|-------|----------|
| `llama-4` | Fast, accurate - recommended for general use |
| `deepseek-v3.1` | Strong reasoning for complex analysis |
| `gpt-oss-120b` | Open-source GPT variant |
| `magpie` | Australian sovereign model |

## Points of Interest (POIs)

### Financial Metrics
- Revenue & Growth
- Profitability (EBITDA, NPAT)
- Margins
- Balance Sheet
- Key Ratios
- Per Share Metrics
- Guidance

### Segment Analysis
- Business segments
- Geographic regions
- Product categories

### Cash Flow
- Operating cash flow
- Free cash flow
- Capital expenditure
- Dividends

### Earnings Quality
- Non-recurring adjustments
- Capitalised costs
- Provision changes
- Working capital signals

### Management Commentary
- Strategy changes
- Outlook
- Risk factors
- Market conditions

## Contributing

1. Create a feature branch from `master`
2. Make your changes
3. Test locally
4. Submit a pull request

## License

Proprietary - Southern Cross AI

## Support

For issues and feature requests, please contact the development team.
