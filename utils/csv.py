import csv
import os
from typing import Iterable, Sequence


def write_csv(output_file: str, header: Sequence[str], rows: Iterable[Sequence]) -> int:
    parent = os.path.dirname(output_file)
    if parent:
        os.makedirs(parent, exist_ok=True)

    count = 0
    with open(output_file, mode='w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)
            count += 1

    return count
