/**
 * ASX Top 200 Companies for auto-detection
 * This list includes major ASX-listed companies for filename matching
 */

export interface ASXCompany {
  ticker: string;
  name: string;
  aliases: string[]; // Alternative names/abbreviations
}

export const asxCompanies: ASXCompany[] = [
  // Big 4 Banks
  { ticker: 'CBA', name: 'Commonwealth Bank of Australia', aliases: ['CommBank', 'Commonwealth Bank', 'CBA'] },
  { ticker: 'WBC', name: 'Westpac Banking Corporation', aliases: ['Westpac', 'WBC'] },
  { ticker: 'NAB', name: 'National Australia Bank', aliases: ['NAB', 'National Australia'] },
  { ticker: 'ANZ', name: 'ANZ Group Holdings', aliases: ['ANZ', 'Australia and New Zealand Banking'] },
  
  // Mining Giants
  { ticker: 'BHP', name: 'BHP Group', aliases: ['BHP', 'BHP Billiton'] },
  { ticker: 'RIO', name: 'Rio Tinto', aliases: ['Rio Tinto', 'RIO'] },
  { ticker: 'FMG', name: 'Fortescue Metals Group', aliases: ['Fortescue', 'FMG', 'Fortescue Metals'] },
  { ticker: 'MIN', name: 'Mineral Resources', aliases: ['MinRes', 'Mineral Resources', 'MIN'] },
  { ticker: 'S32', name: 'South32', aliases: ['South32', 'S32'] },
  { ticker: 'NCM', name: 'Newcrest Mining', aliases: ['Newcrest', 'NCM'] },
  { ticker: 'NST', name: 'Northern Star Resources', aliases: ['Northern Star', 'NST'] },
  { ticker: 'EVN', name: 'Evolution Mining', aliases: ['Evolution', 'EVN'] },
  { ticker: 'STO', name: 'Santos', aliases: ['Santos', 'STO'] },
  { ticker: 'WDS', name: 'Woodside Energy', aliases: ['Woodside', 'WDS', 'Woodside Petroleum'] },
  { ticker: 'ORG', name: 'Origin Energy', aliases: ['Origin', 'ORG', 'Origin Energy'] },
  
  // Retail & Consumer
  { ticker: 'WOW', name: 'Woolworths Group', aliases: ['Woolworths', 'WOW', 'Woolies'] },
  { ticker: 'COL', name: 'Coles Group', aliases: ['Coles', 'COL'] },
  { ticker: 'WES', name: 'Wesfarmers', aliases: ['Wesfarmers', 'WES'] },
  { ticker: 'HVN', name: 'Harvey Norman', aliases: ['Harvey Norman', 'HVN'] },
  { ticker: 'JBH', name: 'JB Hi-Fi', aliases: ['JB Hi-Fi', 'JBH', 'JB HiFi'] },
  { ticker: 'SUL', name: 'Super Retail Group', aliases: ['Super Retail', 'SUL', 'Supercheap Auto'] },
  
  // Healthcare
  { ticker: 'CSL', name: 'CSL Limited', aliases: ['CSL', 'CSL Limited'] },
  { ticker: 'COH', name: 'Cochlear', aliases: ['Cochlear', 'COH'] },
  { ticker: 'RMD', name: 'ResMed', aliases: ['ResMed', 'RMD'] },
  { ticker: 'SHL', name: 'Sonic Healthcare', aliases: ['Sonic Healthcare', 'SHL', 'Sonic'] },
  { ticker: 'RHC', name: 'Ramsay Health Care', aliases: ['Ramsay', 'RHC', 'Ramsay Health'] },
  { ticker: 'FPH', name: 'Fisher & Paykel Healthcare', aliases: ['Fisher Paykel', 'FPH'] },
  
  // Technology
  { ticker: 'XRO', name: 'Xero', aliases: ['Xero', 'XRO'] },
  { ticker: 'WTC', name: 'WiseTech Global', aliases: ['WiseTech', 'WTC'] },
  { ticker: 'CPU', name: 'Computershare', aliases: ['Computershare', 'CPU'] },
  { ticker: 'REA', name: 'REA Group', aliases: ['REA', 'REA Group', 'realestate.com.au'] },
  { ticker: 'CAR', name: 'CAR Group', aliases: ['Carsales', 'CAR', 'carsales.com.au'] },
  { ticker: 'SEK', name: 'Seek', aliases: ['Seek', 'SEK', 'SEEK'] },
  { ticker: 'NXT', name: 'Nextdc', aliases: ['NextDC', 'NXT', 'NEXTDC'] },
  { ticker: 'APX', name: 'Appen', aliases: ['Appen', 'APX'] },
  { ticker: 'ALU', name: 'Altium', aliases: ['Altium', 'ALU'] },
  
  // Financial Services
  { ticker: 'MQG', name: 'Macquarie Group', aliases: ['Macquarie', 'MQG', 'Macquarie Bank'] },
  { ticker: 'ASX', name: 'ASX Limited', aliases: ['ASX', 'Australian Securities Exchange'] },
  { ticker: 'AMP', name: 'AMP Limited', aliases: ['AMP', 'AMP Limited'] },
  { ticker: 'SUN', name: 'Suncorp Group', aliases: ['Suncorp', 'SUN'] },
  { ticker: 'IAG', name: 'Insurance Australia Group', aliases: ['IAG', 'Insurance Australia'] },
  { ticker: 'QBE', name: 'QBE Insurance', aliases: ['QBE', 'QBE Insurance'] },
  { ticker: 'MPL', name: 'Medibank Private', aliases: ['Medibank', 'MPL'] },
  { ticker: 'NHF', name: 'NIB Holdings', aliases: ['NIB', 'NHF', 'nib'] },
  
  // Telecommunications
  { ticker: 'TLS', name: 'Telstra Group', aliases: ['Telstra', 'TLS'] },
  { ticker: 'TPG', name: 'TPG Telecom', aliases: ['TPG', 'TPG Telecom', 'iiNet'] },
  
  // Real Estate
  { ticker: 'GMG', name: 'Goodman Group', aliases: ['Goodman', 'GMG'] },
  { ticker: 'SGP', name: 'Stockland', aliases: ['Stockland', 'SGP'] },
  { ticker: 'MGR', name: 'Mirvac Group', aliases: ['Mirvac', 'MGR'] },
  { ticker: 'GPT', name: 'GPT Group', aliases: ['GPT', 'GPT Group'] },
  { ticker: 'DXS', name: 'Dexus', aliases: ['Dexus', 'DXS'] },
  { ticker: 'SCG', name: 'Scentre Group', aliases: ['Scentre', 'SCG', 'Westfield'] },
  { ticker: 'VCX', name: 'Vicinity Centres', aliases: ['Vicinity', 'VCX'] },
  { ticker: 'CHC', name: 'Charter Hall Group', aliases: ['Charter Hall', 'CHC'] },
  
  // Infrastructure
  { ticker: 'TCL', name: 'Transurban Group', aliases: ['Transurban', 'TCL'] },
  { ticker: 'APA', name: 'APA Group', aliases: ['APA', 'APA Group'] },
  { ticker: 'SYD', name: 'Sydney Airport', aliases: ['Sydney Airport', 'SYD'] },
  { ticker: 'AZJ', name: 'Aurizon Holdings', aliases: ['Aurizon', 'AZJ'] },
  { ticker: 'QAN', name: 'Qantas Airways', aliases: ['Qantas', 'QAN'] },
  
  // Industrial
  { ticker: 'AMC', name: 'Amcor', aliases: ['Amcor', 'AMC'] },
  { ticker: 'BXB', name: 'Brambles', aliases: ['Brambles', 'BXB', 'CHEP'] },
  { ticker: 'ORA', name: 'Orora', aliases: ['Orora', 'ORA'] },
  { ticker: 'BSL', name: 'BlueScope Steel', aliases: ['BlueScope', 'BSL'] },
  { ticker: 'ABC', name: 'Adbri', aliases: ['Adbri', 'ABC', 'Adelaide Brighton'] },
  { ticker: 'BLD', name: 'Boral', aliases: ['Boral', 'BLD'] },
  { ticker: 'CIM', name: 'CIMIC Group', aliases: ['CIMIC', 'CIM', 'Leighton'] },
  { ticker: 'DOW', name: 'Downer EDI', aliases: ['Downer', 'DOW'] },
  
  // Media & Entertainment
  { ticker: 'NWS', name: 'News Corporation', aliases: ['News Corp', 'NWS', 'News Corporation'] },
  { ticker: 'NEC', name: 'Nine Entertainment', aliases: ['Nine', 'NEC', 'Nine Entertainment'] },
  { ticker: 'SWM', name: 'Seven West Media', aliases: ['Seven West', 'SWM', 'Channel 7'] },
  { ticker: 'ARB', name: 'ARB Corporation', aliases: ['ARB', 'ARB Corporation'] },
  
  // Agriculture
  { ticker: 'ELD', name: 'Elders', aliases: ['Elders', 'ELD'] },
  { ticker: 'GNC', name: 'GrainCorp', aliases: ['GrainCorp', 'GNC'] },
  { ticker: 'CGC', name: 'Costa Group', aliases: ['Costa', 'CGC', 'Costa Group'] },
  { ticker: 'ING', name: 'Inghams Group', aliases: ['Inghams', 'ING'] },
  { ticker: 'TWE', name: 'Treasury Wine Estates', aliases: ['Treasury Wine', 'TWE', 'Penfolds'] },
  
  // Gaming
  { ticker: 'ALL', name: 'Aristocrat Leisure', aliases: ['Aristocrat', 'ALL'] },
  { ticker: 'TAH', name: 'Tabcorp Holdings', aliases: ['Tabcorp', 'TAH'] },
  { ticker: 'SGR', name: 'Star Entertainment', aliases: ['Star Entertainment', 'SGR', 'The Star'] },
  { ticker: 'CWN', name: 'Crown Resorts', aliases: ['Crown', 'CWN', 'Crown Resorts'] },
  
  // Other Major Companies
  { ticker: 'A2M', name: 'a2 Milk Company', aliases: ['a2 Milk', 'A2M', 'a2'] },
  { ticker: 'ALL', name: 'Aristocrat Leisure', aliases: ['Aristocrat', 'ALL'] },
  { ticker: 'AGL', name: 'AGL Energy', aliases: ['AGL', 'AGL Energy'] },
  { ticker: 'ALQ', name: 'ALS Limited', aliases: ['ALS', 'ALQ'] },
  { ticker: 'AWC', name: 'Alumina Limited', aliases: ['Alumina', 'AWC'] },
  { ticker: 'BOQ', name: 'Bank of Queensland', aliases: ['Bank of Queensland', 'BOQ', 'BOQ Bank'] },
  { ticker: 'BEN', name: 'Bendigo and Adelaide Bank', aliases: ['Bendigo Bank', 'BEN', 'Bendigo'] },
  { ticker: 'CCL', name: 'Coca-Cola Europacific Partners', aliases: ['Coca-Cola Amatil', 'CCL', 'Coke'] },
  { ticker: 'DMP', name: 'Dominos Pizza Enterprises', aliases: ['Dominos', 'DMP', "Domino's"] },
  { ticker: 'EDV', name: 'Endeavour Group', aliases: ['Endeavour', 'EDV', 'Dan Murphys', 'BWS'] },
  { ticker: 'FLT', name: 'Flight Centre Travel', aliases: ['Flight Centre', 'FLT'] },
  { ticker: 'IEL', name: 'IDP Education', aliases: ['IDP', 'IEL', 'IELTS'] },
  { ticker: 'LLC', name: 'Lendlease Group', aliases: ['Lendlease', 'LLC'] },
  { ticker: 'LNK', name: 'Link Administration', aliases: ['Link', 'LNK'] },
  { ticker: 'NWL', name: 'Netwealth Group', aliases: ['Netwealth', 'NWL'] },
  { ticker: 'OZL', name: 'OZ Minerals', aliases: ['OZ Minerals', 'OZL'] },
  { ticker: 'PME', name: 'Pro Medicus', aliases: ['Pro Medicus', 'PME'] },
  { ticker: 'QUB', name: 'Qube Holdings', aliases: ['Qube', 'QUB'] },
  { ticker: 'REH', name: 'Reece', aliases: ['Reece', 'REH'] },
  { ticker: 'RWC', name: 'Reliance Worldwide', aliases: ['Reliance Worldwide', 'RWC'] },
  { ticker: 'SVW', name: 'Seven Group Holdings', aliases: ['Seven Group', 'SVW'] },
  { ticker: 'TNE', name: 'TechnologyOne', aliases: ['TechnologyOne', 'TNE', 'Tech One'] },
  { ticker: 'VEA', name: 'Viva Energy', aliases: ['Viva Energy', 'VEA', 'Shell Australia'] },
  { ticker: 'WOR', name: 'Worley', aliases: ['Worley', 'WOR', 'WorleyParsons'] },
  { ticker: 'Z1P', name: 'Zip Co', aliases: ['Zip', 'Z1P', 'Zip Pay'] },
];

/**
 * Detect company from filename
 * Returns the best matching company or null if no match found
 */
export function detectCompanyFromFilename(filename: string): ASXCompany | null {
  const normalizedFilename = filename.toLowerCase().replace(/[_\-\.]/g, ' ');
  
  let bestMatch: ASXCompany | null = null;
  let bestScore = 0;
  
  for (const company of asxCompanies) {
    // Check ticker (exact match gets highest score)
    if (normalizedFilename.includes(company.ticker.toLowerCase())) {
      const score = company.ticker.length + 10; // Bonus for ticker match
      if (score > bestScore) {
        bestScore = score;
        bestMatch = company;
      }
    }
    
    // Check company name and aliases
    const allNames = [company.name, ...company.aliases];
    for (const name of allNames) {
      const normalizedName = name.toLowerCase();
      if (normalizedFilename.includes(normalizedName)) {
        const score = normalizedName.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = company;
        }
      }
    }
  }
  
  return bestMatch;
}

/**
 * Detect reporting period from filename
 */
export function detectReportingPeriod(filename: string): string {
  const normalized = filename.toUpperCase();
  
  // Common patterns
  const patterns = [
    // FY patterns
    /FY\s*(\d{2,4})/i,
    /(\d{4})\s*ANNUAL/i,
    /ANNUAL\s*REPORT\s*(\d{4})/i,
    // Half year patterns
    /H1\s*(\d{2,4})/i,
    /H2\s*(\d{2,4})/i,
    /1H\s*(\d{2,4})/i,
    /2H\s*(\d{2,4})/i,
    /HALF\s*YEAR\s*(\d{4})/i,
    // Quarter patterns
    /Q1\s*(\d{2,4})/i,
    /Q2\s*(\d{2,4})/i,
    /Q3\s*(\d{2,4})/i,
    /Q4\s*(\d{2,4})/i,
    // Year only
    /(\d{4})/,
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      // Return the matched portion, cleaned up
      const fullMatch = match[0].toUpperCase();
      if (fullMatch.includes('FY')) return fullMatch.replace(/\s/g, '');
      if (fullMatch.includes('H1') || fullMatch.includes('1H')) return `H1 ${match[1]}`;
      if (fullMatch.includes('H2') || fullMatch.includes('2H')) return `H2 ${match[1]}`;
      if (fullMatch.includes('HALF')) return `H1 ${match[1]}`;
      if (fullMatch.includes('Q')) return fullMatch.replace(/\s/g, ' ');
      if (fullMatch.includes('ANNUAL')) return `FY${match[1]}`;
      // Just a year
      if (/^\d{4}$/.test(match[1])) return `FY${match[1]}`;
    }
  }
  
  return '';
}

/**
 * Detect document type from filename
 */
export function detectDocumentType(filename: string): string {
  const normalized = filename.toLowerCase();
  
  if (normalized.includes('annual') || normalized.includes('yearly')) {
    return 'annual_report';
  }
  if (normalized.includes('half') || normalized.includes('interim') || /[12]h|h[12]/i.test(normalized)) {
    return 'half_year';
  }
  if (normalized.includes('quarter') || /q[1-4]/i.test(normalized)) {
    return 'quarterly';
  }
  if (normalized.includes('asx') || normalized.includes('announcement')) {
    return 'asx_announcement';
  }
  if (normalized.includes('presentation') || normalized.includes('investor')) {
    return 'investor_presentation';
  }
  
  return 'other';
}
