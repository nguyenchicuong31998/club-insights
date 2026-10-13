const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Club {
  id: string;
  name: string;
  timezone: string;
  createdAt: string;
}

async function fetchClubs(): Promise<{ clubs: Club[] } | { error: string }> {
  try {
    const res = await fetch(`${API_URL}/api/clubs`, { cache: "no-store" });
    if (!res.ok) return { error: `API returned ${res.status}` };
    const body: { data: Club[] } = await res.json();
    return { clubs: body.data };
  } catch {
    return { error: `Cannot reach the API at ${API_URL}` };
  }
}

export default async function Home() {
  const result = await fetchClubs();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 font-sans">
      <h1 className="text-2xl font-semibold">Club Insights</h1>

      {"error" in result ? (
        <p className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-red-800">{result.error}</p>
      ) : result.clubs.length === 0 ? (
        <p className="mt-6 text-gray-600">No clubs in the database yet. Run the seed script once the CSV files are added.</p>
      ) : (
        <ul className="mt-6 divide-y rounded border">
          {result.clubs.map((club) => (
            <li key={club.id} className="flex justify-between p-4">
              <span className="font-medium">{club.name}</span>
              <span className="text-sm text-gray-500">{club.timezone}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
