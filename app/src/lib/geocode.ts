export async function geocodeAddress(query: string): Promise<{ latitude: number; longitude: number } | null> {
  // Alpha stub: returns null. Replace with a Canada-hosted geocoding API (e.g. Nominatim or paid provider) in Beta/RC.
  console.log("Geocoding skipped for Alpha:", query)
  return null
}
