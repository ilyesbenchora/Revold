-- Mémoire SERVEUR du brief de la tour de contrôle, rattachée au compte
-- (et non plus seulement au localStorage du navigateur) :
--   brief_state.ack   : clés d'accomplissement déjà entendues (objectif atteint,
--                       actions exécutées, enrichissement terminé) → l'orbe ne
--                       reste plus verte sur un autre appareil après l'écoute ;
--   brief_state.heard : empreintes des chiffres d'état déjà lus (chiffres
--                       suivis, santé de réconciliation, brief d'équipe) avec
--                       la date → un chiffre inchangé n'est pas relu le
--                       lendemain (« jamais deux fois la même annonce »).
alter table voice_tower_settings
  add column if not exists brief_state jsonb not null default '{}'::jsonb;

comment on column voice_tower_settings.brief_state is
  'Mémoire du brief vocal : { ack: { clé: date }, heard: { empreinte: date } } — écrite par /api/voice/digest à chaque lecture (narrate=1).';
