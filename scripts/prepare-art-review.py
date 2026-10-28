"""Pack the approved generation source for the isolated static review; no repainting."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
image = Image.open(root / 'assets/art-review/sources/characters.webp').convert('RGBA')
image.save(root / 'assets/art-review/characters.webp', 'WEBP', quality=94, method=6)
print('Packed review sprites:', (root / 'assets/art-review/characters.webp').stat().st_size, 'bytes')
