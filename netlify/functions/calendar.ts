export const handler = async (event: any, _context: any) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const calendarUrl = process.env.VITE_GOOGLE_CALENDAR_ICAL_URL || process.env.GOOGLE_CALENDAR_ICAL_URL;

  if (!calendarUrl) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Calendar URL not configured' }),
    };
  }

  try {
    const response = await fetch(calendarUrl, {
      headers: {
        'Accept': 'text/calendar; charset=utf-8',
        'Accept-Charset': 'utf-8'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Calendar fetch failed: ${response.status}`);
    }

    // Get as buffer first to handle encoding properly
    const arrayBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const icalData = decoder.decode(arrayBuffer);
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'text/calendar',
      },
      body: icalData,
    };

  } catch (error) {
    console.error('Calendar proxy error:', error);
    const message = (error instanceof Error && error.message) ? error.message : "Unknown error";
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Calendar service error: ${message}` }),
    };
  }
};
