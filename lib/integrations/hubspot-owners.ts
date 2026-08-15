/**
 * Propriétaires (owners) HubSpot — lecture live de l'API.
 *
 * Extrait de l'ancienne page Équipes & Adoption (supprimée) : les filtres
 * « par propriétaire » des pages Performances en dépendent, la fonction n'a
 * donc rien à faire dans un dossier de route.
 */

export type Owner = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userId: number | null;
  teams: string[];
};

/** Owners du portail (100 max) — liste vide si HubSpot refuse la lecture. */
export async function fetchOwners(token: string): Promise<Owner[]> {
  const res = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const d = await res.json();
  return ((d.results ?? []) as Array<Record<string, unknown>>).map((o) => ({
    id: o.id as string,
    email: o.email as string,
    firstName: (o.firstName as string) || "",
    lastName: (o.lastName as string) || "",
    userId: (o.userId as number) || null,
    teams: ((o.teams as Array<{ name: string }>) ?? []).map((t) => t.name),
  }));
}
