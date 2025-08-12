"""
Carga incremental de reportes publicitarios a un modelo estrella en SQL Server.

- Lee un archivo CSV (86 columnas) usando pandas.
- Aplica lógica de "buscar o crear" para las tablas de dimensiones.
- Elimina la métrica diaria existente y luego inserta la nueva en una sola transacción.
- Maneja errores por fila, permitiendo continuar con las siguientes.
"""
from __future__ import annotations

import sys
from datetime import datetime
import pandas as pd
import pyodbc

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
SERVER = "localhost\\SQLEXPRESS"
DATABASE = "MarketingDW"
USERNAME = "sa"
PASSWORD = "yourStrong(!)Password"
CSV_PATH = "reporte.csv"

CONN_STR = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={SERVER};"
    f"DATABASE={DATABASE};"
    f"UID={USERNAME};"
    f"PWD={PASSWORD};"
    "TrustServerCertificate=yes;"
)


# ---------------------------------------------------------------------------
# Funciones auxiliares para UPSERT de dimensiones
# ---------------------------------------------------------------------------
def get_or_create_client(cur: pyodbc.Cursor, account_fbid: int, name: str | None) -> int:
    cur.execute("SELECT ClientID FROM dim_Clients WHERE AccountFBID = ?", account_fbid)
    row = cur.fetchone()
    if row:
        return row.ClientID
    cur.execute(
        """
        INSERT INTO dim_Clients (AccountFBID, ClientName)
        OUTPUT INSERTED.ClientID
        VALUES (?, ?)
        """,
        account_fbid,
        name,
    )
    return cur.fetchone()[0]


def get_or_create_campaign(
    cur: pyodbc.Cursor, client_id: int, campaign_fbid: int, name: str | None, objective: str | None
) -> int:
    cur.execute("SELECT CampaignID FROM dim_Campaigns WHERE CampaignFBID = ?", campaign_fbid)
    row = cur.fetchone()
    if row:
        return row.CampaignID
    cur.execute(
        """
        INSERT INTO dim_Campaigns (ClientID, CampaignFBID, CampaignName, Objective)
        OUTPUT INSERTED.CampaignID
        VALUES (?, ?, ?, ?)
        """,
        client_id,
        campaign_fbid,
        name,
        objective,
    )
    return cur.fetchone()[0]


def get_or_create_adset(
    cur: pyodbc.Cursor, campaign_id: int, adset_fbid: int, name: str | None
) -> int:
    cur.execute("SELECT AdSetID FROM dim_AdSets WHERE AdSetFBID = ?", adset_fbid)
    row = cur.fetchone()
    if row:
        return row.AdSetID
    cur.execute(
        """
        INSERT INTO dim_AdSets (CampaignID, AdSetFBID, AdSetName)
        OUTPUT INSERTED.AdSetID
        VALUES (?, ?, ?)
        """,
        campaign_id,
        adset_fbid,
        name,
    )
    return cur.fetchone()[0]


def get_or_create_ad(
    cur: pyodbc.Cursor,
    adset_id: int,
    ad_fbid: int,
    name: str | None,
    body: str | None,
    thumbnail_url: str | None,
    permanent_link: str | None,
) -> int:
    cur.execute("SELECT AdID FROM dim_Ads WHERE AdFBID = ?", ad_fbid)
    row = cur.fetchone()
    if row:
        return row.AdID
    cur.execute(
        """
        INSERT INTO dim_Ads
            (AdSetID, AdFBID, AdName, AdBody, AdThumbnailURL, PermanentLink)
        OUTPUT INSERTED.AdID
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        adset_id,
        ad_fbid,
        name,
        body,
        thumbnail_url,
        permanent_link,
    )
    return cur.fetchone()[0]


def get_or_create_date(cur: pyodbc.Cursor, full_date: datetime) -> int:
    date_id = int(full_date.strftime("%Y%m%d"))
    cur.execute("SELECT DateID FROM dim_Date WHERE DateID = ?", date_id)
    if cur.fetchone():
        return date_id
    cur.execute(
        """
        INSERT INTO dim_Date (DateID, FullDate, Year, Month, Day, DayOfWeek)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        date_id,
        full_date.date(),
        full_date.year,
        full_date.month,
        full_date.day,
        full_date.weekday() + 1,
    )
    return date_id


def get_or_create_demographic(
    cur: pyodbc.Cursor, age_bracket: str | None, gender: str | None
) -> int:
    cur.execute(
        "SELECT DemographicID FROM dim_Demographics WHERE AgeBracket = ? AND Gender = ?",
        age_bracket,
        gender,
    )
    row = cur.fetchone()
    if row:
        return row.DemographicID
    cur.execute(
        """
        INSERT INTO dim_Demographics (AgeBracket, Gender)
        OUTPUT INSERTED.DemographicID
        VALUES (?, ?)
        """,
        age_bracket,
        gender,
    )
    return cur.fetchone()[0]


def get_or_create_placement(
    cur: pyodbc.Cursor, platform: str | None, device: str | None, position: str | None
) -> int:
    cur.execute(
        """
        SELECT PlacementID FROM dim_Placements
        WHERE Platform = ? AND Device = ? AND Position = ?
        """,
        platform,
        device,
        position,
    )
    row = cur.fetchone()
    if row:
        return row.PlacementID
    cur.execute(
        """
        INSERT INTO dim_Placements (Platform, Device, Position)
        OUTPUT INSERTED.PlacementID
        VALUES (?, ?, ?)
        """,
        platform,
        device,
        position,
    )
    return cur.fetchone()[0]


# ---------------------------------------------------------------------------
# Función principal de procesamiento
# ---------------------------------------------------------------------------
def process_row(cur: pyodbc.Cursor, row: pd.Series) -> None:
    date_id = get_or_create_date(cur, row.FullDate)
    client_id = get_or_create_client(cur, row.AccountFBID, row.ClientName)
    campaign_id = get_or_create_campaign(cur, client_id, row.CampaignFBID, row.CampaignName, row.Objective)
    adset_id = get_or_create_adset(cur, campaign_id, row.AdSetFBID, row.AdSetName)
    ad_id = get_or_create_ad(
        cur,
        adset_id,
        row.AdFBID,
        row.AdName,
        row.AdBody,
        row.AdThumbnailURL,
        row.PermanentLink,
    )
    demographic_id = get_or_create_demographic(cur, row.AgeBracket, row.Gender)
    placement_id = get_or_create_placement(cur, row.Platform, row.Device, row.Position)

    cur.execute(
        """
        DELETE FROM fact_Metrics
        WHERE DateID=? AND AdID=? AND DemographicID=? AND PlacementID=?
        """,
        date_id,
        ad_id,
        demographic_id,
        placement_id,
    )

    cur.execute(
        """
        INSERT INTO fact_Metrics (
            DateID, ClientID, CampaignID, AdSetID, AdID, DemographicID, PlacementID,
            Spend, Impressions, Reach, Clicks, Purchases, PurchaseValue,
            VideoPlays_25_Pct, VideoPlays_50_Pct, VideoPlays_75_Pct,
            VideoPlays_95_Pct, VideoPlays_100_Pct, Results, CostPerResult
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        date_id,
        client_id,
        campaign_id,
        adset_id,
        ad_id,
        demographic_id,
        placement_id,
        row.Spend,
        row.Impressions,
        row.Reach,
        row.Clicks,
        row.Purchases,
        row.PurchaseValue,
        row.VideoPlays_25_Pct,
        row.VideoPlays_50_Pct,
        row.VideoPlays_75_Pct,
        row.VideoPlays_95_Pct,
        row.VideoPlays_100_Pct,
        row.Results,
        row.CostPerResult,
    )


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------
def main() -> None:
    print("Conectando a la base de datos...")
    try:
        conn = pyodbc.connect(CONN_STR, autocommit=False)
    except pyodbc.Error as err:
        print(f"Error de conexión: {err}")
        sys.exit(1)

    try:
        df = pd.read_csv(CSV_PATH, parse_dates=["FullDate"])
    except Exception as err:  # noqa: BLE001
        print(f"No se pudo leer el CSV: {err}")
        conn.close()
        sys.exit(1)

    print(f"Iniciando importación de archivo {CSV_PATH}")
    cursor = conn.cursor()
    total = len(df)

    for idx, row in enumerate(df.itertuples(index=False), start=1):
        print(f"Procesando fila {idx} de {total}...")
        try:
            process_row(cursor, row)
            conn.commit()
        except pyodbc.Error as err:
            conn.rollback()
            print(f"Error en fila {idx}: {err}")

    cursor.close()
    conn.close()
    print("Importación completada.")


if __name__ == "__main__":
    main()
