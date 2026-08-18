/**
 * Détection « nouvel utilisateur » — gate serveur des mini-tutoriels.
 *
 * Les FeatureTour (coach marks) ne doivent s'afficher QUE pour un nouvel
 * utilisateur lors de sa première prise en main de l'app. Le flag localStorage
 * par tourId ne suffit pas : un utilisateur existant qui change de navigateur,
 * de poste ou vide son cache revoyait tous les tutoriels. On borne donc leur
 * affichage à une courte fenêtre après la création du compte auth — au-delà,
 * plus aucun tutoriel, quel que soit l'état du localStorage.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Fenêtre pendant laquelle un compte est considéré « nouveau » (48 h). */
const NEW_USER_WINDOW_MS = 48 * 3600 * 1000;

export async function isNewUser(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const createdAt = user?.created_at ? Date.parse(user.created_at) : NaN;
    return Number.isFinite(createdAt) && Date.now() - createdAt < NEW_USER_WINDOW_MS;
  } catch {
    return false; // au moindre doute, pas de tutoriel — jamais l'inverse
  }
}
