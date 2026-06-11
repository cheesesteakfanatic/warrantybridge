import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://ronqqvkjeeuturcqjgef.supabase.co'
// The anon key is safe to expose in client code: all data access is enforced by Row Level Security.
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvbnFxdmtqZWV1dHVyY3FqZ2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNTkyNzYsImV4cCI6MjA5NjczNTI3Nn0.x8XC9ueQQdqCQfNtUo9UnRuHXdeqeNmNz_a1wqBpzH4'

export const supabase = createClient(url, anonKey)

export async function uploadImage(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('attachments').upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw error
  return path
}

export function publicUrl(path) {
  return supabase.storage.from('attachments').getPublicUrl(path).data.publicUrl
}
