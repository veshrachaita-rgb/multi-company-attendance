import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vqqwuaezehgbkjguaxnl.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxcXd1YWV6ZWhnYmtqZ3VheG5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5NTYxOSwiZXhwIjoyMDk4NTcxNjE5fQ.xlnPuBgjbi9_L2dRvdJtObiGzZEEnrHtWbdrTpTHbco';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkCompanies() {
  const { data, error } = await supabase.from('companies').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Companies:', data);
  }
}

checkCompanies();
