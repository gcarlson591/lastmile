import CampusNavigator from '@/components/campus-navigator'

export default function Page() {
  return (
    <CampusNavigator
      supabaseConfig={{
        url: process.env.NEXT_SUPABASE_URL,
        publishableKey: process.env.NEXT_SUPABASE_PUBLISHABLE_KEY,
      }}
    />
  )
}
