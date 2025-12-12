import os


def get_script_dir(file_path: str) -> str:
    return os.path.dirname(os.path.abspath(file_path))


def join_paths(*parts: str) -> str:
    return os.path.join(*parts)


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)
