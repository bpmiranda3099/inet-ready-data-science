from __future__ import annotations

from constants.files import GET_CITY_LOG_FILENAME
from constants.path import CITY_COORDS_FILE, CITY_COORDS_RAW_FILE, LOGS_DIR, ensure_dirs
from constants.weather import CITY_COORDS_HEADER
from dataset.misc.coords_request import get_coords_query
from dataset.misc.exclude_places import get_exclude_places
from routes.overpass import get_coords
from utils.clean import clean_city_coords
from utils.csv import write_csv
from utils.generators import get_city_rows
from utils.logger import get_logger


def main() -> None:
    ensure_dirs()
    logger = get_logger(
        name="get_city_coords",
        log_dir=str(LOGS_DIR),
        log_filename=GET_CITY_LOG_FILENAME,
        use_case="data",
    )

    logger.info("Start: get city coordinates")
    query = get_coords_query()
    result = get_coords(query)
    logger.info(f"Retrieved {len(result.nodes)} locations from Overpass")

    exclude_places = get_exclude_places()
    output_file = str(CITY_COORDS_RAW_FILE)
    logger.info("Writing coordinates to CSV")
    included_count = write_csv(
        output_file,
        CITY_COORDS_HEADER,
        get_city_rows(result.nodes, exclude_places),
    )
    logger.info(f"Wrote {included_count} places to {output_file}")

    logger.info("Cleaning raw data")
    cleaned_count = clean_city_coords(output_file, str(CITY_COORDS_FILE))
    logger.info(f"Wrote cleaned {cleaned_count} places to {CITY_COORDS_FILE}")


if __name__ == "__main__":
    main()