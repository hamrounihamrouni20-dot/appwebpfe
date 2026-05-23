import { supabase } from '../lib/supabase';

export async function getPredictionsByUser(userId: string) {
  const res = await supabase.from('predictions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (res.error) throw res.error;
  return res.data;
}

export async function getLatestPredictionByInstallation(installationId: string) {
  const res = await supabase.from('predictions').select('*').eq('installation_id', installationId).order('created_at', { ascending: false }).limit(1).single();
  if (res.error) throw res.error;
  return res.data;
}

export async function createPrediction(prediction: Record<string, any>) {
  const res = await supabase.from('predictions').insert(prediction).select().single();
  if (res.error) throw res.error;
  return res.data;
}

export default {
  getPredictionsByUser,
  getLatestPredictionByInstallation,
  createPrediction,
};
