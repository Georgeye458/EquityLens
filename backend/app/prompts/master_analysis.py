"""Master analysis prompt template for comprehensive earnings report analysis."""

MASTER_ANALYSIS_SYSTEM_PROMPT = """You are an expert financial analyst specializing in earnings report analysis. 
You provide comprehensive, accurate, and well-structured analysis of financial documents.
Your outputs should be in clean markdown format with properly formatted tables.
Always cite page numbers from the source document when referencing specific data using this EXACT format: [CompanyName - Page X] or [Document - Page X].
For example: "Revenue increased to $500M [WBC - Page 12]" or "Net profit was $50M [Document - Page 8]".
Include citations after key financial metrics, ratios, and any specific data points.
Use millions as the base unit for monetary values and specify the currency.
Be precise with numbers and calculations."""


MASTER_ANALYSIS_PROMPT = """I need you to analyse {company_name}'s {period} financial results. Please extract and analyse all key financial data compare on a year to year basis from the attached documents.

**REQUIRED OUTPUTS:**

### 1. FINANCIAL METRICS TABLE
Create a comprehensive table with these sections:
- **Revenue & Growth**: Total revenue, segment breakdown, growth rates
- **Profitability**: Gross profit, EBITDA, EBIT, NPAT (both statutory and underlying)
- **Margins**: Gross margin, EBITDA margin, net margin with period-on-period changes
- **Balance Sheet**: Net debt, cash, total assets, shareholders' equity
- **Key Ratios**: ROE, ROA, debt ratios, interest coverage
- **Per Share Metrics**: EPS, dividend per share, book value per share
- **Guidance**: Any forward-looking statements or targets provided

### 2. SEGMENT ANALYSIS
Break down performance by:
- Business segments/divisions
- Geographic regions
- Product categories
- Include revenue, EBITDA, and margin analysis for each

### 3. CASH FLOW SUMMARY
- Operating cash flow
- Free cash flow
- Capital expenditure
- Dividend payments

### 4. MANAGEMENT HIGHLIGHTS
- Key strategic initiatives
- Major achievements or challenges
- Outlook and guidance
- Market conditions commentary

### 5. EARNINGS QUALITY & RED FLAGS ANALYSIS
Provide a comprehensive assessment of earnings quality including:

**Red Flags Table:**
- **Non-recurring adjustments**: Items removed from underlying/normalised earnings
- **Capitalised costs**: Unusual capitalisation of expenses (R&D, interest, marketing, etc.)
- **Provision changes**: Increases/decreases in restructuring, warranty, legal provisions
- **Depreciation changes**: Changes in asset lives, depreciation methods, or impairment reversals
- **Bad debt provisions**: Changes in doubtful debt allowances relative to receivables growth
- **Working capital manipulation**: Unusual changes in payables, receivables, or inventory
- **Revenue recognition**: Changes in revenue recognition policies or timing
- **Related party transactions**: Unusual transactions with related entities
- **Asset revaluations**: Non-cash gains from property or investment revaluations
- **Tax rate changes**: One-off tax benefits or rate changes affecting comparability

**EQ Table:**
Get net operating cashflow, add interest paid, add tax paid, add gain or loss on disposal, add dividends from associates, add share of net profit/losses from associates and compare this to EBITDA. Make the final column the ratio of the answer in % terms.

| Metric | Current Period | Prior Period |
|--------|----------------|--------------|
| Net Operating Cash Flow | | |
| + Interest Paid | | |
| + Tax Paid | | |
| + Gain/Loss on Disposal | | |
| + Dividends from Associates | | |
| + Share of Associates P&L | | |
| **Adjusted OCF** | | |
| EBITDA | | |
| **Ratio (%)** | | |

**EQ 2 Table:**
If available, in the Cashflow statement complete the following: Receipts from customers deduct Payments to suppliers and employees. Compare this to EBITDA. Place your output into a table with the underlying data. Complete for whatever periods are available.

| Metric | Current Period | Prior Period |
|--------|----------------|--------------|
| Receipts from Customers | | |
| - Payments to Suppliers/Employees | | |
| **Net Cash from Operations** | | |
| EBITDA | | |
| **Ratio (%)** | | |

**Working Capital Red Flags:**
- Receivables growth vs revenue growth comparison
- Days sales outstanding (DSO) trends
- Average Accounts Receivables turnover Days
- Average Inventory Turnover Days
- Average Accounts Payable Turnover Days
- Add Accounts Receivable Days to Inventory Turnover Days and deduct Accounts Payable Turnover Days. Compare to prior Year.
- Inventory turnover deterioration
- Extended payment terms or bill-and-hold arrangements
- Accounts payable payment period extensions

**Cash Flow vs Earnings Analysis:**
- Operating cash flow vs NPAT comparison
- Free cash flow vs NPAT comparison
- Free cash flow conversion rates
- Quality of cash flow (customer vs supplier driven)
- Timing differences between cash and accrual accounting

**Earnings Quality Score:** Provide an overall assessment (High/Medium/Low quality) with key supporting factors.

### 6. EXCEPTIONAL ITEMS
Separate table showing:
- One-off gains/losses
- Restructuring costs
- Acquisition-related expenses
- Asset impairments or reversals
- Any other non-recurring items

Also provide another table splitting out the exceptional items on a First half vs Second half basis.

**FORMATTING NOTES:**
- Use millions as base unit (specify currency)
- Show growth rates as percentages
- **CRITICAL: Include page citations for ALL data points using this format: [CompanyName - Page X]**
  - Example: "Total revenue was $1,234M [WBC - Page 5]"
  - Example: "Operating cash flow of $890M [ANZ - Page 12]"
  - Add citations after numbers in tables and after key facts in text
- Highlight any data gaps or unclear items
- Use clear, scannable table formats

**CONTEXT TO CONSIDER:**
- Compare performance to management guidance if available
- Note any significant changes in business strategy
- Identify key performance drivers mentioned by management
- Flag any concerns about data quality or presentation

---

**DOCUMENT CONTENT:**

{document_content}
"""


def build_master_prompt(company_name: str, period: str, document_content: str) -> str:
    """Build the master analysis prompt with document context.
    
    Args:
        company_name: Name of the company being analyzed
        period: Reporting period (e.g., "FY24", "H1 2024")
        document_content: Full text content of the document
        
    Returns:
        Formatted prompt string
    """
    return MASTER_ANALYSIS_PROMPT.format(
        company_name=company_name,
        period=period or "latest reporting period",
        document_content=document_content
    )
