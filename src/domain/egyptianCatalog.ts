import type { CustomCatalogEntry } from './types';

export interface CatalogModel {
  name: string;
  years: number[];
}

export interface CatalogBrand {
  brand: string;
  sourceNote: string;
  models: CatalogModel[];
}

function yearRange(start: number, end: number): number[] {
  const list: number[] = [];
  for (let y = end; y >= start; y--) list.push(y);
  return list;
}

/**
 * Offline Egyptian market vehicle brands, models, and years catalog (Spec Section 8.2).
 * Prioritizes official local agents & common Egyptian market models.
 * Users can manually add any missing brand/model/year which is persisted locally on-device.
 */
export const EGYPTIAN_CAR_CATALOG: CatalogBrand[] = [
  {
    brand: 'Hyundai',
    sourceNote: 'GB Auto & Egyptian Market',
    models: [
      { name: 'Elantra CN7', years: yearRange(2021, 2026) },
      { name: 'Elantra AD', years: yearRange(2016, 2026) },
      { name: 'Elantra HD', years: yearRange(2007, 2025) },
      { name: 'Elantra MD', years: yearRange(2011, 2016) },
      { name: 'Elantra (2000–2007)', years: yearRange(2000, 2007) },
      { name: 'Accent RB', years: yearRange(2011, 2026) },
      { name: 'Accent HCI', years: yearRange(2018, 2026) },
      { name: 'Accent / New Accent', years: yearRange(1998, 2011) },
      { name: 'Verna', years: yearRange(2002, 2019) },
      { name: 'Tucson', years: yearRange(2005, 2026) },
      { name: 'ix35', years: yearRange(2010, 2016) },
      { name: 'Bayon', years: yearRange(2022, 2026) },
      { name: 'Creta / Creta SU2', years: yearRange(2016, 2026) },
      { name: 'Creta Grand', years: yearRange(2022, 2026) },
      { name: 'i10 / Grand i10', years: yearRange(2008, 2026) },
      { name: 'i20', years: yearRange(2009, 2026) },
      { name: 'i30', years: yearRange(2008, 2020) },
      { name: 'Matrix', years: yearRange(2001, 2010) },
      { name: 'Getz', years: yearRange(2003, 2011) },
      { name: 'Avante', years: yearRange(2007, 2020) },
      { name: 'Solaris', years: yearRange(2011, 2022) },
      { name: 'Atos', years: yearRange(1999, 2008) },
      { name: 'Excel', years: yearRange(1992, 1999) },
      { name: 'Sonata', years: yearRange(2005, 2026) },
      { name: 'Santa Fe', years: yearRange(2006, 2026) },
      { name: 'Kona', years: yearRange(2019, 2026) },
      { name: 'Veloster', years: yearRange(2012, 2020) },
      { name: 'Ioniq / Ioniq 5 / Ioniq 6', years: yearRange(2017, 2026) },
      { name: 'H1', years: yearRange(2008, 2023) },
    ],
  },
  {
    brand: 'Kia',
    sourceNote: 'EIT & Egyptian Market',
    models: [
      { name: 'Cerato', years: yearRange(2004, 2020) },
      { name: 'Grand Cerato', years: yearRange(2019, 2026) },
      { name: 'K3', years: yearRange(2013, 2025) },
      { name: 'K4', years: yearRange(2025, 2026) },
      { name: 'K5 / Optima', years: yearRange(2006, 2026) },
      { name: 'Sportage', years: yearRange(2005, 2026) },
      { name: 'Seltos', years: yearRange(2020, 2026) },
      { name: 'Sonet', years: yearRange(2021, 2026) },
      { name: 'XCeed', years: yearRange(2021, 2026) },
      { name: 'Ceed', years: yearRange(2008, 2025) },
      { name: 'Carens', years: yearRange(2004, 2026) },
      { name: 'Soul', years: yearRange(2009, 2024) },
      { name: 'Rio (Sedan / Hatchback)', years: yearRange(2002, 2024) },
      { name: 'Picanto', years: yearRange(2004, 2025) },
      { name: 'Pegas', years: yearRange(2020, 2026) },
      { name: 'Sorento', years: yearRange(2006, 2026) },
      { name: 'Carnival', years: yearRange(2007, 2026) },
      { name: 'Sephia / Spectra / Shuma', years: yearRange(1998, 2005) },
      { name: 'Pride', years: yearRange(1996, 2005) },
      { name: 'Niro / EV6 / EV9', years: yearRange(2018, 2026) },
    ],
  },
  {
    brand: 'Nissan',
    sourceNote: 'Nissan Egypt & Egyptian Market',
    models: [
      { name: 'Sunny N17', years: yearRange(2013, 2026) },
      { name: 'Sunny N16 / Super Saloon', years: yearRange(2000, 2014) },
      { name: 'Sentra', years: yearRange(2014, 2026) },
      { name: 'Qashqai', years: yearRange(2008, 2026) },
      { name: 'Juke', years: yearRange(2011, 2026) },
      { name: 'Tiida (Sedan / Hatchback)', years: yearRange(2006, 2016) },
      { name: 'X-Trail', years: yearRange(2004, 2026) },
      { name: 'Kicks', years: yearRange(2018, 2026) },
      { name: 'Navara / Pickup', years: yearRange(2006, 2026) },
      { name: 'Patrol', years: yearRange(2005, 2026) },
      { name: 'Bluebird / Sylphy', years: yearRange(2006, 2022) },
      { name: 'Livina / Grand Livina', years: yearRange(2008, 2016) },
      { name: 'Micra / March', years: yearRange(2005, 2022) },
      { name: 'Altima / Maxima', years: yearRange(2005, 2025) },
      { name: 'Urvan', years: yearRange(2008, 2025) },
    ],
  },
  {
    brand: 'Mitsubishi',
    sourceNote: 'Diamond Motors & Egyptian Market',
    models: [
      { name: 'Lancer Shark', years: yearRange(2008, 2019) },
      { name: 'Lancer Puma', years: yearRange(2004, 2016) },
      { name: 'Lancer Kristala', years: yearRange(1997, 2003) },
      { name: 'Lancer EX / Evo', years: yearRange(2008, 2018) },
      { name: 'Eclipse Cross', years: yearRange(2018, 2026) },
      { name: 'Xpander', years: yearRange(2019, 2026) },
      { name: 'Xpander Cross', years: yearRange(2021, 2026) },
      { name: 'Attrage', years: yearRange(2014, 2026) },
      { name: 'Mirage', years: yearRange(2013, 2026) },
      { name: 'Outlander / Outlander Sport', years: yearRange(2007, 2026) },
      { name: 'ASX', years: yearRange(2011, 2024) },
      { name: 'Pajero', years: yearRange(2000, 2021) },
      { name: 'Montero Sport', years: yearRange(2016, 2026) },
      { name: 'L200', years: yearRange(2006, 2026) },
      { name: 'Colt / Galant / Grandis', years: yearRange(1998, 2012) },
    ],
  },
  {
    brand: 'Toyota',
    sourceNote: 'Toyota Egypt',
    models: [
      { name: 'Corolla', years: yearRange(2000, 2026) },
      { name: 'Yaris', years: yearRange(2006, 2025) },
      { name: 'Belta', years: yearRange(2022, 2025) },
      { name: 'Rumion', years: yearRange(2022, 2026) },
      { name: 'Fortuner', years: yearRange(2010, 2026) },
      { name: 'C-HR', years: yearRange(2018, 2025) },
      { name: 'Rush', years: yearRange(2018, 2025) },
      { name: 'Avanza', years: yearRange(2012, 2022) },
      { name: 'Hilux', years: yearRange(2005, 2026) },
      { name: 'RAV4 / Land Cruiser', years: yearRange(2006, 2026) },
    ],
  },
  {
    brand: 'Chevrolet',
    sourceNote: 'Mansour Automotive',
    models: [
      { name: 'Optra', years: yearRange(2006, 2026) },
      { name: 'Aveo', years: yearRange(2006, 2020) },
      { name: 'Lanos', years: yearRange(2000, 2020) },
      { name: 'Cruze', years: yearRange(2010, 2017) },
      { name: 'Captiva', years: yearRange(2020, 2026) },
      { name: 'Spark', years: yearRange(2007, 2018) },
      { name: 'Malibu / Equinox', years: yearRange(2017, 2024) },
    ],
  },
  {
    brand: 'MG',
    sourceNote: 'Mansour MG Automotive',
    models: [
      { name: 'MG 5', years: yearRange(2020, 2026) },
      { name: 'MG 6', years: yearRange(2019, 2026) },
      { name: 'MG ZS', years: yearRange(2019, 2026) },
      { name: 'MG HS', years: yearRange(2020, 2026) },
      { name: 'MG RX5 / RX5 Plus', years: yearRange(2019, 2026) },
      { name: 'MG One / MG 4 (EV)', years: yearRange(2023, 2026) },
    ],
  },
  {
    brand: 'Chery',
    sourceNote: 'GB Auto - Chery Egypt',
    models: [
      { name: 'Arrizo 5', years: yearRange(2019, 2026) },
      { name: 'Tiggo 3', years: yearRange(2018, 2025) },
      { name: 'Tiggo 4 Pro', years: yearRange(2023, 2026) },
      { name: 'Tiggo 7 / 7 Pro / 7 Pro Max', years: yearRange(2019, 2026) },
      { name: 'Tiggo 8 / 8 Pro / 8 Pro Max', years: yearRange(2020, 2026) },
      { name: 'Envy', years: yearRange(2014, 2020) },
    ],
  },
  {
    brand: 'Renault',
    sourceNote: 'EIM - Renault Egypt',
    models: [
      { name: 'Logan', years: yearRange(2008, 2023) },
      { name: 'Sandero / Stepway', years: yearRange(2010, 2024) },
      { name: 'Megane', years: yearRange(2006, 2026) },
      { name: 'Duster', years: yearRange(2012, 2026) },
      { name: 'Taliant', years: yearRange(2024, 2026) },
      { name: 'Fluence', years: yearRange(2010, 2017) },
      { name: 'Kadjar / Austral', years: yearRange(2017, 2026) },
    ],
  },
  {
    brand: 'Peugeot',
    sourceNote: 'MANSCO - Peugeot Egypt',
    models: [
      { name: '301', years: yearRange(2013, 2025) },
      { name: '2008', years: yearRange(2020, 2026) },
      { name: '3008', years: yearRange(2018, 2026) },
      { name: '5008', years: yearRange(2018, 2026) },
      { name: '508', years: yearRange(2012, 2025) },
      { name: '408', years: yearRange(2023, 2026) },
    ],
  },
  {
    brand: 'Opel',
    sourceNote: 'Mansour Opel',
    models: [
      { name: 'Astra', years: yearRange(2006, 2023) },
      { name: 'Corsa', years: yearRange(2008, 2026) },
      { name: 'Crossland', years: yearRange(2019, 2026) },
      { name: 'Mokka', years: yearRange(2022, 2026) },
      { name: 'Grandland', years: yearRange(2019, 2026) },
      { name: 'Insignia / Vectra', years: yearRange(2000, 2021) },
    ],
  },
  {
    brand: 'Skoda',
    sourceNote: 'Kayan Egypt',
    models: [
      { name: 'Octavia (A4 / A5 / A7 / A8)', years: yearRange(2000, 2026) },
      { name: 'Kodiaq', years: yearRange(2018, 2026) },
      { name: 'Karoq', years: yearRange(2019, 2026) },
      { name: 'Kamiq / Scala', years: yearRange(2020, 2026) },
      { name: 'Superb / Rapid / Fabia', years: yearRange(2008, 2025) },
    ],
  },
  {
    brand: 'Suzuki',
    sourceNote: 'Modern Motors',
    models: [
      { name: 'Dzire', years: yearRange(2018, 2026) },
      { name: 'Swift', years: yearRange(2008, 2026) },
      { name: 'Ciaz', years: yearRange(2015, 2025) },
      { name: 'Baleno', years: yearRange(2020, 2026) },
      { name: 'Ertiga', years: yearRange(2019, 2025) },
      { name: 'Alto / Celerio / S-Presso', years: yearRange(2010, 2026) },
      { name: 'Vitara / Grand Vitara / Fronx', years: yearRange(2016, 2026) },
    ],
  },
  {
    brand: 'Fiat',
    sourceNote: 'Dynamics - Fiat Egypt',
    models: [
      { name: 'Tipo', years: yearRange(2016, 2026) },
      { name: '500X / 500', years: yearRange(2018, 2025) },
      { name: 'Punto / Grande Punto', years: yearRange(2008, 2019) },
      { name: '128 / Shahin / Siena', years: yearRange(1990, 2009) },
    ],
  },
  {
    brand: 'BYD',
    sourceNote: 'Al Amal - BYD Egypt',
    models: [
      { name: 'F3', years: yearRange(2010, 2026) },
      { name: 'L3', years: yearRange(2015, 2022) },
      { name: 'Song Plus / Dolphin / Seal (EV)', years: yearRange(2022, 2026) },
    ],
  },
  {
    brand: 'Volkswagen',
    sourceNote: 'Egyptian Automotive',
    models: [
      { name: 'Golf', years: yearRange(2000, 2025) },
      { name: 'Passat', years: yearRange(2006, 2024) },
      { name: 'Jetta', years: yearRange(2007, 2018) },
      { name: 'Tiguan / T-Roc', years: yearRange(2012, 2026) },
      { name: 'ID.4 / ID.6 (EV)', years: yearRange(2021, 2026) },
    ],
  },
  {
    brand: 'Daewoo',
    sourceNote: 'Egyptian Market',
    models: [
      { name: 'Lanos', years: yearRange(1998, 2008) },
      { name: 'Nubira 1 / 2', years: yearRange(1998, 2008) },
      { name: 'Juliet / Lacetti', years: yearRange(1999, 2008) },
      { name: 'Matiz', years: yearRange(1999, 2008) },
    ],
  },
  {
    brand: 'BMW',
    sourceNote: 'Global Auto - BMW Egypt',
    models: [
      { name: '318i / 320i / 330i', years: yearRange(2005, 2026) },
      { name: '520i / 530i', years: yearRange(2006, 2026) },
      { name: 'X1 / X3 / X5 / X6', years: yearRange(2010, 2026) },
    ],
  },
  {
    brand: 'Mercedes-Benz',
    sourceNote: 'Mercedes-Benz Egypt',
    models: [
      { name: 'C180 / C200', years: yearRange(2005, 2026) },
      { name: 'E200 / E300', years: yearRange(2006, 2026) },
      { name: 'A180 / A200 / CLA', years: yearRange(2014, 2026) },
      { name: 'GLA / GLC / GLE', years: yearRange(2015, 2026) },
    ],
  },
];

function cleanToEnglishLabel(raw: string): string {
  const trimmed = raw.trim();
  const parenMatch = trimmed.match(/^[\u0600-\u06FF\s]+\(([^)]+)\)$/);
  if (parenMatch) return parenMatch[1].trim();
  return trimmed.replace(/\s*\([^)]*[\u0600-\u06FF][^)]*\)/g, '').trim();
}

export function mergeCatalogWithCustom(customEntries: CustomCatalogEntry[]): CatalogBrand[] {
  const map = new Map<string, { sourceNote: string; models: Map<string, Set<number>> }>();

  for (const b of EGYPTIAN_CAR_CATALOG) {
    const modelMap = new Map<string, Set<number>>();
    for (const m of b.models) {
      modelMap.set(m.name, new Set(m.years));
    }
    map.set(b.brand, { sourceNote: b.sourceNote, models: modelMap });
  }

  for (const c of customEntries) {
    const brandName = cleanToEnglishLabel(c.brand);
    const modelName = cleanToEnglishLabel(c.model);
    if (!brandName || !modelName || !Number.isFinite(c.year)) continue;

    if (!map.has(brandName)) {
      map.set(brandName, { sourceNote: 'Saved on device', models: new Map() });
    }
    const brandEntry = map.get(brandName)!;
    if (!brandEntry.models.has(modelName)) {
      brandEntry.models.set(modelName, new Set());
    }
    brandEntry.models.get(modelName)!.add(c.year);
  }

  return Array.from(map.entries()).map(([brand, info]) => ({
    brand,
    sourceNote: info.sourceNote,
    models: Array.from(info.models.entries()).map(([name, yearsSet]) => ({
      name,
      years: Array.from(yearsSet).sort((a, b) => b - a),
    })),
  }));
}
