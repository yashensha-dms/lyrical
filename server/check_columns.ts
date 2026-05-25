import { supabase } from './supabase';

async function check() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching project:', error);
  } else {
    console.log('Project row columns:', data && data[0] ? Object.keys(data[0]) : 'No data');
  }
}

check();
