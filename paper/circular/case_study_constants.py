"""Verified case-study numbers for the 50-household coastal community simulation."""

# Demographics & water
HOUSEHOLDS = 50
RESIDENTS = 200
L_PER_PERSON_DAY = 50
V_W_M3_DAY = RESIDENTS * L_PER_PERSON_DAY / 1000  # 10 m³/day
V_W_M3_YEAR = V_W_M3_DAY * 365  # 3,650 m³/year

# Baseline & ISSG sizing [1]
EF_CONV_KG = 3.5  # kg CO₂e/m³ (grid 0.5 × RO 7 kWh/m³)
EF_GRID = 0.5
RO_KWH_M3 = 7.0
EVAP_RATE = 1.57  # kg·m⁻²·h⁻¹
SUN_HOURS = 5
EVAP_AREA_M2 = round(V_W_M3_DAY * 1000 / EVAP_RATE / SUN_HOURS)  # 1,274 m²
BIOCHAR_LOADING = 0.5  # kg/m²
M_M_KG = round(EVAP_AREA_M2 * BIOCHAR_LOADING)  # 637 kg
C_PCT = 0.75
F_D = 0.9
SYSTEM_LIFE_YR = 10

# Carbon flows (kg CO₂e)
AE_KG = round(V_W_M3_YEAR * EF_CONV_KG)  # 12,775
CS_KG = int(round(M_M_KG * C_PCT * (44 / 12) * F_D))  # 1,574 kg CO₂e
EE_KG = 1500  # one-time embedded (500 process + 1,000 other)

# Accounting scenarios
NCB_YEAR1_KG = AE_KG + CS_KG - EE_KG  # 12,849
NCB_STEADY_KG = AE_KG  # recurring operational benefit (Years 2+)
NCB_AMORT_KG = round(AE_KG + CS_KG / SYSTEM_LIFE_YR - EE_KG / SYSTEM_LIFE_YR)  # 12,782

# Display (tCO₂e, 2 dp)
AE_T = round(AE_KG / 1000, 2)
CS_T = round(CS_KG / 1000, 2)
EE_T = round(EE_KG / 1000, 2)
NCB_YEAR1_T = round(NCB_YEAR1_KG / 1000, 2)
NCB_STEADY_T = round(NCB_STEADY_KG / 1000, 2)
NCB_AMORT_T = round(NCB_AMORT_KG / 1000, 2)

# Economics (USD)
CAPEX = 15_000
O_M_YEAR = 1_000
WATER_PRICE = 2.0
CREDIT_PRICE = 20.0
WATER_SAVINGS = round(V_W_M3_YEAR * WATER_PRICE)  # 7,300
CREDITS_STEADY = int(NCB_STEADY_T)  # 12 credits (conservative floor)
CREDIT_REVENUE = CREDITS_STEADY * CREDIT_PRICE  # 240
NET_BENEFIT = WATER_SAVINGS + CREDIT_REVENUE - O_M_YEAR  # 6,540
PAYBACK_YR = round(CAPEX / NET_BENEFIT, 1)  # 2.3

# Monthly MRV (operational AE only)
MONTHLY_AE_KG = round(AE_KG / 12)  # 1,065 kg/month
