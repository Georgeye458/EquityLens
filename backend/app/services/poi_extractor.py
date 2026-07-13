"""Point of Interest (POI) extraction service."""

import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analysis import Analysis, PointOfInterest, POICategory
from app.models.document import Document
from app.services.scx_client import scx_client
from app.models_catalog import DEFAULT_CHAT_MODEL, max_input_chars

logger = logging.getLogger(__name__)

# Output tokens requested for the combined POI + executive-summary JSON.
# Clamped per-model by the SCX client (some models cap lower).
POI_OUTPUT_TOKENS = 16384

# Master prompt for POI extraction + executive summary in one response
POI_EXTRACTION_PROMPT = """You are an expert financial analyst assistant. Your task is to extract key Points of Interest (POIs) from financial documents AND write a concise executive summary in a single response.

ENTITY ACCURACY (MANDATORY):
- Only use company names, fund names, tickers, and entity names that appear VERBATIM in the document.
- NEVER substitute or infer entity names. If the document says "EFM Group", use "EFM Group" — NOT "FMG" or "Fortescue."

For each POI, provide:
1. The extracted value(s) - use the exact figures from the document
2. Page number citations - where the information was found
3. Confidence level (high/medium/low) based on clarity of the source

Determine the document type and extract accordingly:

**For EARNINGS REPORTS / FINANCIAL STATEMENTS, extract:**

## Financial Metrics
- Revenue & Growth: Total revenue, segment breakdown, growth rates
- Profitability: Gross profit, EBITDA, EBIT, NPAT (statutory and underlying)
- Margins: Gross margin, EBITDA margin, net margin with YoY changes
- Balance Sheet: Net debt, cash, total assets, shareholders' equity
- Key Ratios: ROE, ROA, debt ratios, interest coverage
- Per Share Metrics: EPS, DPS, book value per share
- Guidance: Any forward-looking statements or targets

## Segment Analysis
- Business segments with revenue and EBITDA
- Geographic regions breakdown
- Product categories performance

## Cash Flow
- Operating cash flow, free cash flow, capital expenditure, dividend payments

## Management Commentary
- Strategy changes, outlook and guidance, risk factors, market conditions

## Earnings Quality Indicators
- Non-recurring adjustments, capitalised costs, provision changes, working capital signals

**For PORTFOLIO VALUATIONS / CUSTODIAN STATEMENTS / INVESTMENT REPORTS, extract:**

## Financial Metrics
- Total portfolio value / NAV
- Number of holdings / securities
- Performance returns (by period if available)
- Fee disclosures

## Segment Analysis
- Asset allocation by asset class, geography, or sector
- Top holdings by weight or value

## Cash Flow
- Contributions, withdrawals, distributions, dividends received

## Management Commentary
- Investment commentary, outlook, strategy notes

## Earnings Quality Indicators
- Valuation methodology notes, cost basis vs market value, unrealised gains/losses

IMPORTANT: If the document contains a table of holdings, securities, or positions, extract ALL rows — not just the first few. Include every security name, quantity, value, and relevant details.

Respond with a single JSON object containing:
1. "pois": an array of POIs (each with category, name, description, output_type, value, citations, confidence)
2. "executive_summary": a 3-5 paragraph executive summary in professional analyst tone covering: key financial performance, notable changes from prior period, management outlook and guidance, and any red flags or areas of concern

Each POI should have:
- category: one of [financial_metrics, segment_analysis, cash_flow, management_commentary, earnings_quality]
- name: specific metric name
- description: brief description of what this represents
- output_type: one of [value, multi_value, value_delta, commentary, array]
- value: the extracted value(s) - use appropriate structure for the output_type
- citations: array of {page_number, text} objects
- confidence: "high", "medium", or "low"

Example response format:
{
  "pois": [
    {
      "category": "financial_metrics",
      "name": "Total Revenue",
      "description": "Total revenue for the reporting period",
      "output_type": "value_delta",
      "value": {
        "current": 5200000000,
        "prior": 4800000000,
        "change_percent": 8.3,
        "unit": "AUD"
      },
      "citations": [{"page_number": 2, "text": "Revenue of $5.2 billion, up 8.3%"}],
      "confidence": "high"
    }
  ],
  "executive_summary": "First paragraph covering key financial performance...\\n\\nSecond paragraph on changes from prior period...\\n\\nThird paragraph on outlook and guidance...\\n\\nFourth paragraph on red flags if any."
}"""


class POIExtractor:
    """Extract Points of Interest from documents."""

    async def extract_pois(
        self,
        db: AsyncSession,
        document_id: int,
        model: str = DEFAULT_CHAT_MODEL,
    ) -> Analysis:
        """
        Extract POIs from a document.

        Args:
            db: Database session
            document_id: ID of the document to analyze
            model: Model to use for extraction

        Returns:
            Analysis object with extracted POIs
        """
        start_time = datetime.utcnow()

        # Get document
        result = await db.execute(
            select(Document).where(Document.id == document_id)
        )
        document = result.scalar_one_or_none()

        if not document:
            raise ValueError(f"Document {document_id} not found")

        # Get document chunks for context
        from app.services.vector_store import vector_store
        chunks = await vector_store.get_document_chunks(db, document_id)

        if not chunks:
            raise ValueError(f"No processed chunks found for document {document_id}")

        # Build full document context from all chunks. The character budget is
        # derived from the selected model's context window minus the reserved
        # output tokens, so we never overflow smaller-context models.
        MAX_EXTRACTION_CHARS = max_input_chars(model, POI_OUTPUT_TOKENS)
        pages_text = {}
        for chunk in chunks:
            page = chunk.page_number or 0
            if page not in pages_text:
                pages_text[page] = []
            pages_text[page].append(chunk.content)

        doc_context = []
        total_chars = 0
        for page_num in sorted(pages_text.keys()):
            page_content = "\n".join(pages_text[page_num])
            if total_chars + len(page_content) > MAX_EXTRACTION_CHARS:
                remaining = len([p for p in sorted(pages_text.keys()) if p > page_num])
                doc_context.append(
                    f"\n[Note: {remaining} additional pages omitted due to length. "
                    f"Key data may appear in omitted pages.]"
                )
                break
            doc_context.append(f"[Page {page_num}]\n{page_content}")
            total_chars += len(page_content)

        full_context = "\n\n".join(doc_context)

        # Get existing analysis record (created by endpoint)
        result = await db.execute(
            select(Analysis)
            .where(Analysis.document_id == document_id)
            .order_by(Analysis.created_at.desc())
            .limit(1)
        )
        analysis = result.scalar_one_or_none()
        
        if not analysis:
            # Fallback: create if somehow doesn't exist
            analysis = Analysis(
                document_id=document_id,
                status="processing",
                model_used=model,
            )
            db.add(analysis)
            await db.commit()
            await db.refresh(analysis)
        else:
            # Update status to processing
            analysis.status = "processing"
            await db.commit()

        try:
            # Extract POIs using LLM
            messages = [
                {
                    "role": "user",
                    "content": f"""Analyze this document and extract all Points of Interest.

Company/Entity: {document.company_name}
Ticker: {document.company_ticker or 'N/A'}
Reporting Period: {document.reporting_period or 'N/A'}

Document Content:
{full_context}

Please extract all relevant POIs following the specified format. Only use entity names that appear verbatim in the document.""",
                }
            ]

            response = await scx_client.chat_completion(
                messages=messages,
                model=model,
                system_prompt=POI_EXTRACTION_PROMPT,
                temperature=0.3,
                max_tokens=POI_OUTPUT_TOKENS,
            )

            # Parse single response: pois + executive_summary
            pois_data, summary = self._parse_extraction_response(response)

            # Create POI records
            for poi_data in pois_data:
                poi = PointOfInterest(
                    analysis_id=analysis.id,
                    category=poi_data.get("category", "financial_metrics"),
                    name=poi_data.get("name", "Unknown"),
                    description=poi_data.get("description"),
                    output_type=poi_data.get("output_type", "value"),
                    value=poi_data.get("value"),
                    citations=poi_data.get("citations"),
                    confidence=self._parse_confidence(poi_data.get("confidence")),
                )
                db.add(poi)

            # Update analysis (summary from same LLM response)
            end_time = datetime.utcnow()
            analysis.status = "completed"
            analysis.summary = summary
            analysis.processing_time_seconds = (end_time - start_time).total_seconds()
            analysis.completed_at = end_time

            await db.commit()
            await db.refresh(analysis)

            return analysis

        except Exception as e:
            logger.error(f"POI extraction failed: {e}")
            analysis.status = "failed"
            analysis.summary = str(e)
            await db.commit()
            raise

    def _parse_extraction_response(
        self, response: str
    ) -> tuple[List[Dict[str, Any]], str]:
        """Parse the LLM response to extract POIs and executive_summary in one go."""
        try:
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                json_str = response[json_start:json_end].strip()
            elif "{" in response:
                json_start = response.find("{")
                json_end = response.rfind("}") + 1
                json_str = response[json_start:json_end]
            else:
                return [], ""

            data = json.loads(json_str)

            if not isinstance(data, dict):
                return [], ""

            pois_data = []
            if "pois" in data and isinstance(data["pois"], list):
                pois_data = data["pois"]

            summary = ""
            if "executive_summary" in data and isinstance(data["executive_summary"], str):
                summary = data["executive_summary"].strip()

            return pois_data, summary

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse extraction response as JSON: {e}")
            return [], ""

    def _parse_confidence(self, confidence: Optional[str]) -> Optional[float]:
        """Convert confidence string to float."""
        if not confidence:
            return None

        confidence_map = {
            "high": 0.9,
            "medium": 0.7,
            "low": 0.5,
        }
        return confidence_map.get(confidence.lower(), 0.7)


# Singleton instance
poi_extractor = POIExtractor()
