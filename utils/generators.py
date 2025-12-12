from typing import Iterable, Iterator, Sequence


def get_city_rows(nodes: Iterable, exclude_places: Sequence[str] | None = None) -> Iterator[list]:
    excluded = set(exclude_places or ())
    for node in nodes:
        place_name = node.tags.get("name", "n/a")
        if place_name not in excluded:
            yield [place_name, node.lat, node.lon]
