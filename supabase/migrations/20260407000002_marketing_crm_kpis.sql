-- ============================================================
-- Marketing Ops & CRM Ops KPIs
-- Aligned with Ringo LLM payload structure
-- ============================================================

-- Marketing Ops KPIs
ALTER TABLE kpi_snapshots ADD COLUMN lead_velocity_rate numeric(5,2);
ALTER TABLE kpi_snapshots ADD COLUMN funnel_leakage_rate numeric(5,2);

-- CRM Ops KPIs
ALTER TABLE kpi_snapshots ADD COLUMN deal_stagnation_rate numeric(5,2);
ALTER TABLE kpi_snapshots ADD COLUMN duplicate_contacts_pct numeric(5,2);
ALTER TABLE kpi_snapshots ADD COLUMN orphan_contacts_pct numeric(5,2);
ALTER TABLE kpi_snapshots ADD COLUMN activities_per_deal numeric(5,1);

-- Seed: update existing snapshots
UPDATE kpi_snapshots SET
  lead_velocity_rate = 8.2, funnel_leakage_rate = 42.5,
  deal_stagnation_rate = 28.0, duplicate_contacts_pct = 6.2, orphan_contacts_pct = 14.5, activities_per_deal = 6.8
WHERE snapshot_date = '2026-04-01';

UPDATE kpi_snapshots SET
  lead_velocity_rate = 9.1, funnel_leakage_rate = 41.8,
  deal_stagnation_rate = 27.0, duplicate_contacts_pct = 5.9, orphan_contacts_pct = 14.0, activities_per_deal = 7.1
WHERE snapshot_date = '2026-04-02';

UPDATE kpi_snapshots SET
  lead_velocity_rate = 9.5, funnel_leakage_rate = 41.2,
  deal_stagnation_rate = 26.5, duplicate_contacts_pct = 5.7, orphan_contacts_pct = 13.8, activities_per_deal = 7.3
WHERE snapshot_date = '2026-04-03';

UPDATE kpi_snapshots SET
  lead_velocity_rate = 10.3, funnel_leakage_rate = 40.5,
  deal_stagnation_rate = 26.0, duplicate_contacts_pct = 5.5, orphan_contacts_pct = 13.5, activities_per_deal = 7.5
WHERE snapshot_date = '2026-04-04';

UPDATE kpi_snapshots SET
  lead_velocity_rate = 11.0, funnel_leakage_rate = 39.8,
  deal_stagnation_rate = 25.5, duplicate_contacts_pct = 5.3, orphan_contacts_pct = 13.2, activities_per_deal = 7.8
WHERE snapshot_date = '2026-04-05';

UPDATE kpi_snapshots SET
  lead_velocity_rate = 11.8, funnel_leakage_rate = 39.2,
  deal_stagnation_rate = 25.0, duplicate_contacts_pct = 5.1, orphan_contacts_pct = 13.0, activities_per_deal = 8.0
WHERE snapshot_date = '2026-04-06';

UPDATE kpi_snapshots SET
  lead_velocity_rate = 12.4, funnel_leakage_rate = 38.5,
  deal_stagnation_rate = 24.5, duplicate_contacts_pct = 4.9, orphan_contacts_pct = 12.8, activities_per_deal = 8.2
WHERE snapshot_date = '2026-04-07';
