import { CompanyKnowledge } from '../types';
import { fetchCalendarData } from './calendarService';
import { extractCompanyURLs } from './urlExtractor';

export const loadCompanyKnowledge = async (): Promise<CompanyKnowledge> => {
  console.log('🔍 loadCompanyKnowledge called!');
  try {
    // Vite's BASE_URL is /contact/chat/ in the Pages build. Keep public data
    // on that mount path so the edge prefix strip remains transparent.
    const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
    const publicUrl = (relativePath: string): string =>
      `${base.replace(/\/?$/, '/')}${relativePath.replace(/^\/+/, '')}`;

    // Load company markdown file (try both locations)
    let companyResponse = await fetch(publicUrl('company.md'));
    if (!companyResponse.ok) {
      companyResponse = await fetch(publicUrl('company-info/company.md'));
    }
    let markdownContent = '';
    
    if (companyResponse.ok) {
      markdownContent = await companyResponse.text();
    } else {
      console.warn('Could not load company.md file');
      markdownContent = '# Company Information\nNo company information available.';
    }
    
    // Load calendar data if URL is provided
    let calendarInfo = '';
    const icalUrl = process.env.VITE_GOOGLE_CALENDAR_ICAL_URL || process.env.GOOGLE_CALENDAR_ICAL_URL;
    console.log('Calendar URL found:', icalUrl ? 'Yes' : 'No');
    
    if (icalUrl && icalUrl.trim()) {
      calendarInfo = await fetchCalendarData(icalUrl);
    } else {
      console.warn('No calendar URL provided in environment variables');
      calendarInfo = '## Calendar Information:\nNo calendar information configured.';
    }
    
    // Extract company URLs from markdown
    const companyUrls = extractCompanyURLs(markdownContent);
    
    return {
      markdownContent,
      calendarInfo,
      companyUrls
    };
    
  } catch (error) {
    console.error('Error loading company knowledge:', error);
    return {
      markdownContent: '# Company Information\nError loading company information.',
      calendarInfo: '## Calendar Information:\nError loading calendar information.',
      companyUrls: []
    };
  }
};
