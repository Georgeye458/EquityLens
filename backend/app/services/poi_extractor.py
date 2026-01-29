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

logger = logging.getLogger(__name__)

# Master prompt for POI extraction based on requirements
POI_EXTRACTION_PROMPT = """You are an expert equity analyst assistant. Your task is to extract key Points of Interest (POIs) from earnings report documents.

For each POI, provide:
1. The extracted value(s) - use the exact figures from the document
2. Page number citations - where the information was found
3. Confidence level (high/medium/low) based on clarity of the source

Extract the following categories of information:

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
- Operating cash flow
- Free cash flow
- Capital expenditure
- Dividend payments

## Management Commentary
- Strategy changes and initiatives
- Outlook and guidance
- Risk factors highlighted
- Market conditions commentary

## Earnings Quality Indicators
- Non-recurring adjustments
- Capitalised costs changes
- Provision changes
- Working capital signals
- Cash vs accrual comparison
- Revenue recognition notes

Respond with a JSON object containing an array of POIs. Each POI should have:
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
  ]
}"""


class POIExtractor:
    """Extract Points of Interest from documents."""

    async def extract_pois(
        self,
        db: AsyncSession,
        document_id: int,
        model: str = "llama-4",
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

        # Prepare document text (use full context per requirements)
        # Group chunks by page for better context
        pages_text = {}
        for chunk in chunks:
            page = chunk.page_number or 0
            if page not in pages_text:
                pages_text[page] = []
            pages_text[page].append(chunk.content)

        # Build document context
        doc_context = []
        for page_num in sorted(pages_text.keys()):
            page_content = "\n".join(pages_text[page_num])
            doc_context.append(f"[Page {page_num}]\n{page_content}")

        full_context = "\n\n".join(doc_context)

        # Create analysis record
        analysis = Analysis(
            document_id=document_id,
            status="processing",
            model_used=model,
        )
        db.add(analysis)
        await db.commit()
        await db.refresh(analysis)

        try:
            # Extract POIs using LLM
            messages = [
                {
                    "role": "user",
                    "content": f"""Analyze this earnings report and extract all Points of Interest.

Company: {document.company_name}
Ticker: {document.company_ticker or 'N/A'}
Reporting Period: {document.reporting_period or 'N/A'}

Document Content:
{full_context[:50000]}  # Truncate if too long

Please extract all relevant POIs following the specified format.""",
                }
            ]

            response = await scx_client.chat_completion(
                messages=messages,
                model=model,
                system_prompt=POI_EXTRACTION_PROMPT,
                temperature=0.3,  # Lower temperature for factual extraction
            )

            # Parse response
            pois_data = self._parse_poi_response(response)

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

            # Generate summary
            summary = await self._generate_summary(
                db, document, pois_data, model
            )

            # Update analysis
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

    def _parse_poi_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse the LLM response to extract POI data."""
        try:
            # Try to extract JSON from response
            # Look for JSON block
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                json_str = response[json_start:json_end].strip()
            elif "{" in response:
                # Find the JSON object
                json_start = response.find("{")
                json_end = response.rfind("}") + 1
                json_str = response[json_start:json_end]
            else:
                return []

            data = json.loads(json_str)

            if isinstance(data, dict) and "pois" in data:
                return data["pois"]
            elif isinstance(data, list):
                return data
            else:
                return []

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse POI response as JSON: {e}")
            return []

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

    async def _generate_summary(
        self,
        db: AsyncSession,
        document: Document,
        pois: List[Dict[str, Any]],
        model: str,
    ) -> str:
        """Generate a narrative summary of key findings."""
        # Build a summary of extracted POIs for the summary prompt
        poi_summary = []
        for poi in pois[:20]:  # Limit to top 20 for summary
            poi_summary.append(
                f"- {poi.get('name')}: {poi.get('value')}"
            )

        poi_text = "\n".join(poi_summary) if poi_summary else "No POIs extracted"

        messages = [
            {
                "role": "user",
                "content": f"""Based on these extracted Points of Interest from {document.company_name}'s earnings report, 
write a concise executive summary (3-5 paragraphs) highlighting:
1. Key financial performance
2. Notable changes from prior period
3. Management outlook and guidance
4. Any red flags or areas of concern

Extracted POIs:
{poi_text}

Write the summary in a professional analyst tone.""",
            }
        ]

        summary = await scx_client.chat_completion(
            messages=messages,
            model=model,
            temperature=0.5,
        )

        return summary


# Singleton instance
poi_extractor = POIExtractor()
