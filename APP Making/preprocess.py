import pandas as pd
import json
import os
import numpy as np

def normalize_country(name):
    if not isinstance(name, str):
        return ""
    name = name.strip().lower()
    mapping = {
        "usa": "united states",
        "united states of america": "united states",
        "us": "united states",
        "uk": "united kingdom",
        "united kingdom of great britain and northern ireland": "united kingdom",
        "uae": "united arab emirates",
        "south korea": "korea, rep.",
        "north korea": "korea, dem. cent. rep.",
        "russia": "russian federation",
        "turkiye": "turkey",
        "türkiye": "turkey",
        "vietnam": "viet nam",
        "laos": "lao pdr",
        "venezuela": "venezuela, rb",
        "egypt": "egypt, arab rep.",
        "syria": "syrian arab republic",
        "iran": "iran, islamic rep."
    }
    return mapping.get(name, name)

# 1. Military Totals
print("Processing Military Personnel Totals...")
mil_df = pd.read_excel('Military Personnel Totals.xlsx', header=2)
mil_df = mil_df[['Unnamed: 0', 'Unnamed: 1', 'Unnamed: 2']].rename(columns={
    'Unnamed: 0': 'Country',
    'Unnamed: 1': 'Code',
    'Unnamed: 2': 'TotalPersonnel'
})
mil_df = mil_df.dropna(subset=['TotalPersonnel'])
mil_df = mil_df[~mil_df['Country'].astype(str).str.lower().str.contains('country name')]
mil_df['CountryNorm'] = mil_df['Country'].apply(normalize_country)
mil_data = mil_df.set_index('CountryNorm')['TotalPersonnel'].to_dict()

# 2. Extract EMDAT and initial Regional Mapping (6 Regions)
print("Extracting EMDAT and mapping to 6 specific regions...")
emdat_raw = pd.read_excel('EMDAT Data for App Making.xlsx')

def consolidate_disaster(d_type):
    if not isinstance(d_type, str): return d_type
    if "Mass movement" in d_type: return "Mass movement"
    if "Glacial lake outburst flood" in d_type or "Glacial" in d_type: return "Flood"
    return d_type

emdat_raw['Disaster Type'] = emdat_raw['Disaster Type'].apply(consolidate_disaster)
emdat_raw['CountryNorm'] = emdat_raw['Country'].apply(normalize_country)

SOUTH_AMERICA = {
    'argentina', 'bolivia', 'brazil', 'chile', 'colombia', 'ecuador', 
    'guyana', 'paraguay', 'peru', 'suriname', 'uruguay', 'venezuela, rb', 
    'venezuela', 'french guiana'
}

AFRICA_KEYWORDS = ['congo', 'africa', 'nigeria', 'kenya', 'ethiopia', 'ghana', 'sudan', 'tanzania', 
                   'tunisia', 'algeria', 'angola', 'benin', 'burkina faso', 'burundi', 'cameroon', 
                   'central african rep', 'chad', 'cabo verde', 'cote d\'ivoire', 'djibouti', 
                   'equatorial guinea', 'eritrea', 'gabon', 'gambia', 'guinea', 'guinea-bissau', 
                   'lesotho', 'liberia', 'libya', 'madagascar', 'malawi', 'mali', 'mauritania', 
                   'mauritius', 'mozambique', 'namibia', 'niger', 'rwanda', 'senegal', 
                   'sierra leone', 'somalia', 'south africa', 'south sudan', 'togo', 'uganda', 
                   'zambia', 'zimbabwe', 'morocco', 'botswana']

ASIA_KEYWORDS = ['korea', 'china', 'japan', 'india', 'viet nam', 'thailand', 'arab', 'iran', 'iraq', 
                 'afghanistan', 'pakistan', 'cambodia', 'lao pdr', 'myanmar', 'nepal', 'philippines', 
                 'singapore', 'sri lanka', 'syrian', 'turkiye', 'turkey', 'vietnam', 'taiwan',
                 'uzbekistan', 'turkmenistan', 'timor-leste', 'tajikistan', 'qatar', 'oman', 
                 'lebanon', 'kuwait', 'kyrgyz', 'kazakhstan', 'jordan', 'indonesia', 'cyprus', 
                 'israel', 'russian federation', 'russia', 'bahrain', 'brunei', 'armenia', 
                 'azerbaijan', 'georgia', 'bangladesh', 'yemen', 'south asia']

EUROPE_KEYWORDS = ['france', 'germany', 'kingdom', 'spain', 'italy', 'europe', 'albania', 'belgium', 
                   'austria', 'bulgaria', 'belarus', 'bosnia', 'croatia', 'czechia', 'denmark', 
                   'estonia', 'finland', 'greece', 'hungary', 'ireland', 'latvia', 'lithuania', 
                   'luxembourg', 'malta', 'moldova', 'montenegro', 'netherlands', 'north macedonia', 
                   'norway', 'poland', 'portugal', 'romania', 'serbia', 'slovak', 'slovenia', 
                   'sweden', 'switzerland', 'ukraine', 'baltics']

PACIFIC_KEYWORDS = ['zealand', 'australia', 'fiji', 'guinea', 'pacific', 'papua', 'melanesia', 'micronesia', 'polynesia']

def get_region_name(country_norm, emdat_region, emdat_subregion):
    # Fixed assignments
    name = str(country_norm).lower()
    if 'russian federation' in name or 'russia' in name: return "Asia"
    if 'panama' in name: return "North America"
    if 'papua new guinea' in name: return "Pacific"
    if country_norm in SOUTH_AMERICA: return "South America"
    
    # Keyword-based Assignment (Priority over EMDAT due to user specifics)
    name = str(country_norm).lower()
    if any(x in name for x in AFRICA_KEYWORDS): return "Africa"
    if any(x in name for x in ASIA_KEYWORDS): return "Asia"
    if any(x in name for x in EUROPE_KEYWORDS): return "Europe"
    if any(x in name for x in PACIFIC_KEYWORDS): return "Pacific"
    
    # EMDAT region mapping
    if not pd.isna(emdat_region):
        reg = str(emdat_region).lower()
        if reg == 'africa': return "Africa"
        if reg == 'europe': return "Europe"
        if reg == 'asia': return "Asia"
        if reg == 'oceania': return "Pacific"
        if reg == 'americas':
            if country_norm in SOUTH_AMERICA: return "South America"
            return "North America"

    return "North America" # Default for Americas (excluding South America marked as South America)

emdat_raw_regs = emdat_raw[['CountryNorm', 'Region', 'Subregion']].drop_duplicates()
country_to_region = {}
for _, row in emdat_raw_regs.iterrows():
    country_to_region[row['CountryNorm']] = get_region_name(row['CountryNorm'], row['Region'], row['Subregion'])

# Ensure all mil_df countries have a region
for country_norm in mil_df['CountryNorm'].unique():
    if country_norm not in country_to_region:
        country_to_region[country_norm] = get_region_name(country_norm, np.nan, np.nan)

# 3. Survey Data
print("Processing Survey Data with 6-Region Imputation...")
survey_df = pd.read_excel('Survey of Military Mobilization - National Security and Natural Disasters.xlsx')
threat_cols = [
    "In your opinion, how much of your country's military should be mobilized to defend against an international terrorist attack/threat?",
    "In your opinion, how much of your country's military should be mobilized to participate in a war against a peer-to-peer threat or country with similar capabilities and technology?",
    "In your opinion, how much of your country's military should be mobilized to defend against illegal drugs, drug trafficking, and drug distribution?",
    "In your opinion, how much of your country's military should be mobilized to mitigate or assist in resource scarcities (e.g. large-scale water shortage, long-term power outages, food security)?",
    "In your opinion, how much of your country's military should be mobilized to defend against an domestic terrorist attack/threat?",
    "In your opinion, how much of your country's military should be mobilized to defend against civil unrest or domestic armed conflict?"
]
country_col = 'What country were you considering or representing while taking this survey?'

survey_df = survey_df.iloc[1:].copy()
survey_df['CountryNorm'] = survey_df[country_col].apply(normalize_country)
survey_df['Region'] = survey_df['CountryNorm'].map(country_to_region)

for col in threat_cols:
    survey_df[col] = pd.to_numeric(survey_df[col], errors='coerce')

threat_map = {
    col: col.split("to ")[-1].capitalize().replace("Defend against ", "").replace("Participate in a ", "").replace("Mitigate or assist in ", "")
    for col in threat_cols
}
for k, v in threat_map.items():
    if "international terrorist" in v.lower(): threat_map[k] = "International Terrorism"
    if "peer-to-peer" in v.lower(): threat_map[k] = "Peer-to-Peer War"
    if "illegal drugs" in v.lower(): threat_map[k] = "Drug Trafficking"
    if "resource scarcities" in v.lower(): threat_map[k] = "Resource Scarcity"
    if "domestic terrorist" in v.lower(): threat_map[k] = "Domestic Terrorism"
    if "civil unrest" in v.lower(): threat_map[k] = "Civil Unrest"

country_survey_avg = {}
for country, group in survey_df.groupby('CountryNorm'):
    country_survey_avg[country] = {threat_map[col]: group[col].mean() for col in threat_cols if not pd.isna(group[col].mean())}

region_survey_avg = {}
for region, group in survey_df.groupby('Region'):
    if pd.isna(region): continue
    region_survey_avg[region] = {threat_map[col]: group[col].mean() for col in threat_cols if not pd.isna(group[col].mean())}

overall_survey_avg = {threat_map[col]: survey_df[col].mean() for col in threat_cols if not pd.isna(survey_df[col].mean())}

# 4. EMDAT Mobilization with Region Medians
print("Processing EMDAT Mobilization with 6-Region Medians...")
emdat_df = emdat_raw.copy()
emdat_df['Personnel'] = pd.to_numeric(emdat_df['Personnel'], errors='coerce')
emdat_df = emdat_df.merge(mil_df[['CountryNorm', 'TotalPersonnel']], on='CountryNorm', how='inner')
emdat_df['MobilizationPct'] = (emdat_df['Personnel'] / emdat_df['TotalPersonnel']) * 100
emdat_df['Region'] = emdat_df['CountryNorm'].map(country_to_region)

emdat_valid = emdat_df.dropna(subset=['MobilizationPct'])

country_disaster_avg = {}
for (country, dis_type), group in emdat_valid.groupby(['CountryNorm', 'Disaster Type']):
    if country not in country_disaster_avg: country_disaster_avg[country] = {}
    country_disaster_avg[country][dis_type] = group['MobilizationPct'].mean()

region_disaster_median = {}
for (region, dis_type), group in emdat_valid.groupby(['Region', 'Disaster Type']):
    if pd.isna(region): continue
    if region not in region_disaster_median: region_disaster_median[region] = {}
    region_disaster_median[region][dis_type] = group['MobilizationPct'].median()

overall_disaster_median = {}
for dis_type, group in emdat_valid.groupby('Disaster Type'):
    overall_disaster_median[dis_type] = group['MobilizationPct'].median()

# 5. Final Merge
print("Merging data...")
final_data = []
all_countries_ready = mil_df[['Country', 'CountryNorm', 'TotalPersonnel']].to_dict('records')
all_disaster_types = sorted(emdat_raw['Disaster Type'].unique().tolist())
all_threat_types = sorted(list(threat_map.values()))

for item in all_countries_ready:
    country_norm = item['CountryNorm']
    country_name = item['Country']
    total_force = item['TotalPersonnel']
    region = country_to_region.get(country_norm, "North America")
    
    threats = {}
    for t in all_threat_types:
        val = None
        imputed = False
        if country_norm in country_survey_avg and t in country_survey_avg[country_norm]:
            val = country_survey_avg[country_norm][t]
        elif region in region_survey_avg and t in region_survey_avg[region]:
            val = region_survey_avg[region][t]
            imputed = True
        else:
            val = overall_survey_avg.get(t)
            imputed = True
        if val is not None:
            threats[t] = {"value": val, "isImputed": imputed}
            
    disasters = {}
    for d in all_disaster_types:
        val = None
        imputed = False
        if country_norm in country_disaster_avg and d in country_disaster_avg[country_norm]:
            val = country_disaster_avg[country_norm][d]
        elif region in region_disaster_median and d in region_disaster_median[region]:
            val = region_disaster_median[region][d]
            imputed = True
        else:
            val = overall_disaster_median.get(d)
            imputed = True
        if val is not None:
            disasters[d] = {"value": val, "isImputed": imputed}
    
    final_data.append({
        "id": country_norm,
        "name": country_name,
        "subregion": region,
        "totalForce": total_force,
        "threats": threats,
        "disasters": disasters
    })

with open('processed_data.json', 'w') as f:
    json.dump({
        "countries": final_data,
        "threatTypes": all_threat_types,
        "disasterTypes": all_disaster_types
    }, f, indent=2)

print(f"Preprocessed {len(final_data)} countries. Saved to processed_data.json")
